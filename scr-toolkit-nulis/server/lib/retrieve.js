'use strict';
/**
 * Akuisisi full-text (M6 L1.2). Memakai fetch bawaan Node 18+.
 *
 * Urutan channel dan ALASANNYA — jangan dipangkas:
 *   1. Unpaywall best_oa_location.url_for_pdf  -> unduhan langsung
 *   2. Bila url_for_pdf kosong padahal is_oa=true: ambil halaman artikel lalu
 *      cari <meta name="citation_pdf_url">. Banyak penerbit — OJS (mayoritas
 *      jurnal Indonesia), Elsevier, Springer, MDPI — hanya menaruh tautan PDF
 *      di meta tag ini, dan Unpaywall kerap menyimpan halaman landing saja.
 *      Melewatkan langkah ini membuat artikel yang SEPENUHNYA TERBUKA
 *      dilaporkan gagal unduh. Pada satu tinjauan nyata: 19 dari 162 record.
 *   3. Ulangi (2) pada https://doi.org/[DOI].
 *   4. Seluruh oa_locations lain, bukan hanya best_oa_location.
 *
 * Berhasil HANYA bila berkasnya benar-benar PDF dan tidak terpotong. HTTP 200
 * bukan bukti: halaman error, halaman login, dan balasan berbadan kosong pun
 * mengembalikan 200.
 */
const fs = require('node:fs');
const path = require('node:path');
const { integrity } = require('./pdf');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url, referer) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', ...(referer ? { Referer: referer } : {}) },
  });
  return r.ok ? r.text() : '';
}

function findPdfUrl(html) {
  for (const re of [
    /<meta[^>]*name=["']citation_pdf_url["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']citation_pdf_url["']/i,
  ]) {
    const m = re.exec(html || '');
    if (m) return m[1].replace(/&amp;/g, '&');
  }
  return null;
}

async function download(url, dest, referer) {
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*;q=0.8', ...(referer ? { Referer: referer } : {}) },
    });
    if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1024 || !buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
      return { ok: false, why: `bukan PDF (${buf.length} byte, tipe ${r.headers.get('content-type') || '?'})` };
    }
    fs.writeFileSync(dest, buf);
    const chk = integrity(dest);
    if (!chk.ok) { fs.unlinkSync(dest); return { ok: false, why: `PDF cacat: ${chk.issues.join('; ')}` }; }
    return { ok: true, bytes: buf.length, pages: chk.pages };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}

const safe = (s, n = 26) => String(s || 'NA').replace(/[^A-Za-z0-9]/g, '').slice(0, n) || 'NA';

/**
 * records: [{ID, DOI, Authors?, Year?}]
 * Menulis ke pdf_dir. Progres dikembalikan per record.
 */
async function retrieveBatch(records, { pdf_dir, email, delay_ms = 400 } = {}) {
  if (!email) throw new Error('email WAJIB diisi — Unpaywall mensyaratkannya sebagai identifikasi');
  fs.mkdirSync(pdf_dir, { recursive: true });
  const out = [];

  for (const rec of records) {
    const id = String(rec.ID);
    const doi = String(rec.DOI || '').trim();
    const first = String(rec.Authors || '').split(';')[0].split(',')[0];
    const dest = path.join(pdf_dir, `${id}_${safe(first)}_${rec.Year || 'NA'}.pdf`);
    const e = { ID: id, DOI: doi, status: 'NEED_INSTITUTIONAL', channel: '', file: '', is_oa: null, pdf_url_found: '', note: '' };

    if (!doi) {
      e.note = 'tanpa DOI — tidak dapat ditelusuri otomatis';
      out.push(e); continue;
    }

    let up = null;
    try {
      const r = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`, { headers: { 'User-Agent': UA } });
      if (r.ok) up = await r.json();
    } catch { /* diperlakukan sebagai tidak terjawab */ }

    const landing = `https://doi.org/${doi}`;
    const tried = new Set();
    if (up) {
      e.is_oa = !!up.is_oa;
      const locs = [up.best_oa_location, ...(up.oa_locations || [])].filter(Boolean);
      for (const L of locs) {
        for (const [u, kind] of [[L.url_for_pdf, 'OA'], [L.url, 'OA_landing']]) {
          if (!u || tried.has(u)) continue;
          tried.add(u);
          if (kind === 'OA') {
            const d = await download(u, dest, landing);
            if (d.ok) { Object.assign(e, { status: 'YES', channel: 'OA', file: dest, pdf_url_found: u, note: `${d.pages} hal` }); break; }
          } else {
            const pu = findPdfUrl(await getText(u, landing));
            if (pu) {
              e.pdf_url_found = pu;
              const d = await download(pu, dest, u);
              if (d.ok) { Object.assign(e, { status: 'YES', channel: 'OA_landing', file: dest, note: `${d.pages} hal` }); break; }
            }
          }
        }
        if (e.status === 'YES') break;
      }
    }

    if (e.status !== 'YES') {
      const pu = findPdfUrl(await getText(landing));
      if (pu) {
        e.pdf_url_found = pu;
        const d = await download(pu, dest, landing);
        if (d.ok) Object.assign(e, { status: 'YES', channel: 'doi_landing', file: dest, note: `${d.pages} hal` });
      }
    }

    if (e.status !== 'YES') {
      // Pembedaan yang menentukan beban kerja peserta: terbuka-tetapi-terhalang
      // hanya perlu dibuka di browser; berbayar perlu akses institusi.
      if (e.is_oa) {
        e.status = 'NEED_MANUAL';
        e.note = 'Open Access, tetapi server penerbit menolak unduhan otomatis. Buka tautannya di browser lalu simpan PDF-nya.';
      } else {
        e.note = 'Tidak Open Access — perlu akses berlangganan institusi.';
      }
      if (!e.pdf_url_found) e.pdf_url_found = landing;
    }

    out.push(e);
    if (delay_ms) await sleep(delay_ms);
  }

  const tally = out.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
  return {
    summary: { attempted: out.length, ...tally, success_rate_pct: +((100 * (tally.YES || 0)) / Math.max(1, out.length)).toFixed(1) },
    records: out,
    note: 'Status NEED_* BUKAN "inaccessible". Modul mensyaratkan sekurang-kurangnya tiga channel dicoba dan didokumentasikan sebelum INACCESSIBLE ditetapkan.',
  };
}

module.exports = { retrieveBatch, findPdfUrl };
