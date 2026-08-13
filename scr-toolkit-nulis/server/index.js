#!/usr/bin/env node
'use strict';
/**
 * ScR Toolkit — server MCP untuk pekerjaan DETERMINISTIK sebuah scoping review.
 *
 * Mengapa ada: modul menetapkan pekerjaan deterministik dikerjakan skrip, bukan
 * LLM (Modul 1). Tetapi peserta bukan orang IT dan banyak yang tidak punya
 * Python. Claude Desktop menyediakan Node bawaan untuk ekstensi bertipe "node"
 * ketika Node sistem tidak ada — Python tidak punya padanan itu. Karena itu
 * seluruh alat di sini ditulis TANPA satu pun dependensi npm.
 *
 * Protokol: JSON-RPC 2.0 di atas stdio, satu pesan per baris.
 */
const fs = require('node:fs');
const path = require('node:path');

const pdf = require('./lib/pdf');
const xlsx = require('./lib/xlsx');
const analytics = require('./lib/analytics');
const retrieve = require('./lib/retrieve');

// Harus sama dengan "version" di manifest.json — build-mcpb.sh menolak bila berbeda.
const SERVER = { name: 'scr-toolkit-nulis', version: '2.0.0' };

// Claude Desktop menampilkan nama tool secara RATA — tidak ada ruang nama per
// server. Awalan ditambahkan di batas protokol (tools/list dan tools/call),
// sehingga TOOLS di bawah tetap memakai nama pendek dan mustahil ada yang
// terlewat diberi awalan.
const PREFIX = 'nulis_';

/* ------------------------------------------------------------------ helpers */

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const listPdfs = (dir) => fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();

/** Cari PDF milik sebuah ID (konvensi SCR[ID]_*.pdf). */
function pdfForId(dir, id) {
  const hit = listPdfs(dir).find((f) => f.startsWith(id + '_') || f.startsWith(id + '.'));
  return hit ? path.join(dir, hit) : null;
}

/**
 * Ambil teks PDF: utamakan pdftotext bila ada, jatuh ke pengekstrak bawaan.
 *
 * KEPADATAN TEKS MENENTUKAN OTORITAS, BUKAN SEKADAR BERHASIL-TIDAKNYA EKSTRAKSI.
 * PDF hasil scan tetap mengembalikan sedikit teks (nomor halaman, DOI, header)
 * sehingga ekstraksi "berhasil" secara teknis padahal isi artikelnya berupa
 * gambar. Diukur pada korpus 92 artikel jurnal: median 2.713 karakter per
 * halaman, sementara satu berkas hasil scan hanya 399 — dan seluruh 29 kutipan
 * kutipannya dituduh palsu padahal berasal dari pembacaan visual
 * yang sah. Karena itu teks berkepadatan rendah TIDAK boleh dipakai menuduh.
 */
const MIN_CHARS_PER_PAGE = 800;

function pdfText(file) {
  const pages = (pdf.integrity(file).pages) || null;
  try {
    const { execFileSync } = require('node:child_process');
    const t = execFileSync('pdftotext', [file, '-'], { maxBuffer: 1 << 28 }).toString();
    const dense = t.replace(/\s/g, '').length;
    if (dense > 200) {
      const perPage = pages ? dense / pages : null;
      const thin = perPage !== null && perPage < MIN_CHARS_PER_PAGE;
      return {
        text: t,
        engine: thin ? 'pdftotext (lapisan teks tipis)' : 'pdftotext',
        confidence: thin ? 0.5 : 1,
        chars_per_page: perPage === null ? null : Math.round(perPage),
        // Kepadatan rendah = kemungkinan hasil scan. Tidak otoritatif.
        authoritative: !thin,
        thin_text_layer: thin,
      };
    }
  } catch { /* poppler tidak terpasang — lanjut ke pengekstrak bawaan */ }
  const r = pdf.extractText(file);
  const dense = r.text.replace(/\s/g, '').length;
  const perPage = pages ? dense / pages : null;
  return {
    ...r,
    engine: 'builtin',
    authoritative: false,
    chars_per_page: perPage === null ? null : Math.round(perPage),
    thin_text_layer: perPage !== null && perPage < MIN_CHARS_PER_PAGE,
  };
}

/* -------------------------------------------------------------------- tools */

const TOOLS = [
  {
    name: 'pdf_integrity',
    description: 'Periksa integritas semua PDF di sebuah folder: header, penanda EOF, jumlah halaman, panjang teks. Mendeteksi unduhan TERPOTONG yang lolos pemeriksaan magic byte. Jalankan ini sebelum PDF dipakai untuk screening (M6 Langkah 2).',
    inputSchema: {
      type: 'object',
      properties: { pdf_dir: { type: 'string', description: 'Folder berisi PDF' } },
      required: ['pdf_dir'],
    },
    run: ({ pdf_dir }) => {
      const rows = listPdfs(pdf_dir).map((f) => {
        const p = path.join(pdf_dir, f);
        const r = pdf.integrity(p);
        let chars = null, engine = null;
        if (r.ok) { const t = pdfText(p); chars = t.text.replace(/\s/g, '').length; engine = t.engine; }
        return { file: f, ok: r.ok, pages: r.pages, bytes: r.bytes, text_chars: chars, engine, issues: r.issues };
      });
      const broken = rows.filter((r) => !r.ok);
      // Berkas dari alat lain (MCP scholar, Zotero, unduhan manual) tidak
      // bernama SCR[ID]_ dan karena itu TIDAK TERLIHAT oleh alat berbasis nama.
      // Justru berkas dari sumber luar itulah yang paling perlu diverifikasi.
      const unconventional = rows.filter((r) => !/^SCR\d+[_.]/.test(r.file));
      const scanned = rows.filter((r) => r.ok && r.text_chars !== null && r.text_chars < 1500);
      return {
        checked: rows.length,
        healthy: rows.length - broken.length,
        broken: broken.length,
        likely_scanned_no_text_layer: scanned.length,
        unconventional_filenames: unconventional.length,
        verdict: broken.length ? 'ADA BERKAS CACAT — jangan dipakai untuk screening' : 'SEMUA UTUH',
        coexistence_warning: unconventional.length
          ? `${unconventional.length} berkas tidak bernama SCR[ID]_ — kemungkinan berasal dari alat lain (MCP scholar, Zotero, unduhan manual). Jalankan pdf_match_records untuk mencocokkannya lewat ISI; jangan menebak dari nama berkas.`
          : null,
        unconventional_files: unconventional.map((r) => r.file),
        broken_files: broken,
        likely_scanned_files: scanned.map((r) => ({ file: r.file, text_chars: r.text_chars })),
        all: rows,
      };
    },
  },

  {
    name: 'pdf_verify_record',
    description: 'Cari judul record DI SELURUH teks PDF, bukan hanya halaman pertama (M6 Langkah 2). Terbitan ber-front-matter membuat judul baru muncul beberapa halaman kemudian; sebaliknya halaman pertama bisa memuat header artikel lain karena kesalahan produksi jurnal.',
    inputSchema: {
      type: 'object',
      properties: {
        pdf_dir: { type: 'string' },
        records: { type: 'array', description: 'Array {ID, Title}', items: { type: 'object' } },
      },
      required: ['pdf_dir', 'records'],
    },
    run: ({ pdf_dir, records }) => {
      const rows = records.map((rec) => {
        const file = pdfForId(pdf_dir, String(rec.ID));
        if (!file) return { ID: rec.ID, verdict: 'PDF_TIDAK_ADA' };
        const t = pdfText(file);
        const hay = pdf.letters(t.text);
        const want = pdf.letters(rec.Title);
        const found = want.length > 20 && hay.includes(want);
        // Bila judul tak ditemukan sementara mutu teks rendah, ini TIDAK boleh
        // disebut artikel salah — teksnya yang tak terbaca.
        const lowQuality = !t.authoritative && t.confidence < 0.9;
        return {
          ID: rec.ID, file: path.basename(file), engine: t.engine,
          title_found_in_pdf: found,
          verdict: found ? 'MATCH' : (lowQuality ? 'TIDAK_DAPAT_DIPERIKSA' : 'MISMATCH'),
          confidence: +Number(t.confidence).toFixed(2),
        };
      });
      const bad = rows.filter((r) => r.verdict === 'MISMATCH');
      return {
        checked: rows.length,
        match: rows.filter((r) => r.verdict === 'MATCH').length,
        mismatch: bad.length,
        unverifiable: rows.filter((r) => r.verdict === 'TIDAK_DAPAT_DIPERIKSA').length,
        missing_pdf: rows.filter((r) => r.verdict === 'PDF_TIDAK_ADA').length,
        action_required: bad.length
          ? 'MISMATCH = PDF memuat artikel lain. Pindahkan ke outputs/_rejected_[ID]_wrong_article.pdf, set Full_Text_Retrieved=INACCESSIBLE, JANGAN dipakai untuk screening.'
          : 'tidak ada mismatch',
        all: rows,
      };
    },
  },

  {
    name: 'pdf_match_records',
    description: 'Cocokkan SETIAP PDF di folder ke record berdasarkan ISI (judul di dalam berkas), tanpa bergantung pada nama berkas. WAJIB dijalankan bila PDF diperoleh lewat alat lain (MCP scholar, Zotero, unduhan manual), karena berkas dari sumber itu tidak bernama SCR[ID]_ sehingga tidak terlihat oleh alat berbasis nama. Opsional me-rename berkas yang cocok tanpa keraguan ke konvensi modul.',
    inputSchema: {
      type: 'object',
      properties: {
        pdf_dir: { type: 'string' },
        records: { type: 'array', items: { type: 'object' }, description: 'Array {ID, Title, Authors?, Year?}' },
        records_file: { type: 'string' },
        rename: { type: 'boolean', description: 'Bila true, berkas yang cocok TANPA KERAGUAN di-rename ke SCR[ID]_[Penulis]_[Tahun].pdf (default false)' },
        only_unconventional: { type: 'boolean', description: 'Bila true, hanya periksa berkas yang belum bernama SCR[ID]_ (default true — lebih murah)' },
      },
      required: ['pdf_dir'],
    },
    run: ({ pdf_dir, records, records_file, rename = false, only_unconventional = true }) => {
      const recs = (records || readJson(records_file)).filter((r) => r && r.ID && r.Title);
      const wanted = recs.map((r) => ({ ...r, key: pdf.letters(r.Title) })).filter((r) => r.key.length > 20);
      const files = listPdfs(pdf_dir).filter((f) => !only_unconventional || !/^SCR\d+[_.]/.test(f));

      const matched = [], ambiguous = [], unmatched = [], renamed = [], unreadable = [];
      for (const f of files) {
        const full = path.join(pdf_dir, f);
        const chk = pdf.integrity(full);
        if (!chk.ok) { unreadable.push({ file: f, issues: chk.issues }); continue; }
        const t = pdfText(full);
        const hay = pdf.letters(t.text);
        if (hay.length < 400) { unreadable.push({ file: f, issues: ['lapisan teks tidak memadai — kandidat OCR'] }); continue; }
        // POSISI MENENTUKAN, bukan sekadar keberadaan.
        // Judul yang MENGIDENTIFIKASI artikel muncul di awal (halaman judul)
        // atau berulang sebagai running header. Judul yang muncul HANYA di
        // paruh belakang hampir selalu berasal dari daftar pustaka/catatan kaki
        // — artinya artikel itu DISITIR, bukan artikel yang ada di berkas ini.
        // Terbukti: satu berkas berisi "Legal Adaptation for Muslim Minorities"
        // tercocokkan ke record lain semata karena record itu ada di catatan
        // kaki ke-56. Tanpa penjagaan ini, artikel salah akan di-rename menjadi
        // ID record yang sah lalu masuk ke screening.
        const positions = (key) => {
          const out = []; let i = hay.indexOf(key);
          while (i >= 0) { out.push(i / hay.length); i = hay.indexOf(key, i + 1); }
          return out;
        };
        const hits = [];
        const referenceOnly = [];
        for (const r of wanted) {
          const pos = positions(r.key);
          if (!pos.length) continue;
          // Diterima bila ada kemunculan di paruh depan (halaman judul atau
          // front matter terbitan), atau berulang di luar sepertiga terakhir.
          const early = pos.some((p) => p < 0.5);
          const repeatedNotAtEnd = pos.filter((p) => p < 0.7).length >= 2;
          if (early || repeatedNotAtEnd) hits.push({ ...r, positions: pos.map((p) => +p.toFixed(2)) });
          else referenceOnly.push({ ID: r.ID, positions: pos.map((p) => +p.toFixed(2)) });
        }
        // Berkas yang SUDAH bernama SCR[ID]_ tidak boleh di-rename ulang atas
        // dasar isi. Diukur pada 92 PDF nyata: pencocokan isi menetapkan ID
        // yang BERBEDA pada 2 berkas, karena judul record lain terkutip cukup
        // awal (mis. di pendahuluan). Menuruti isi di situ akan me-rename dua
        // berkas yang sudah benar menjadi salah. Ketidaksesuaian dilaporkan
        // untuk diputus peneliti, bukan dieksekusi.
        const own = /^(SCR\d+)[_.]/.exec(f);
        if (hits.length === 1) {
          const r = hits[0];
          const entry = { file: f, ID: r.ID, engine: t.engine, pages: chk.pages };
          if (own && own[1] !== r.ID) {
            entry.id_conflict = `nama berkas menyebut ${own[1]} tetapi isinya cocok ke ${r.ID} — JANGAN di-rename; laporkan ke peneliti`;
            entry.rename_skipped = 'berkas sudah bernama SCR[ID]_';
            ambiguous.push({ file: f, candidates: [own[1], r.ID], reason: entry.id_conflict });
            continue;
          }
          if (rename && own) entry.rename_skipped = 'berkas sudah bernama SCR[ID]_ — tidak di-rename';
          else if (rename) {
            const first = String(r.Authors || '').split(';')[0].split(',')[0].replace(/[^A-Za-z0-9]/g, '') || 'NoAuthor';
            const target = `${r.ID}_${first}_${r.Year || 'NA'}.pdf`;
            if (!fs.existsSync(path.join(pdf_dir, target))) {
              fs.renameSync(full, path.join(pdf_dir, target));
              entry.renamed_to = target; renamed.push(entry);
            } else entry.rename_skipped = `${target} sudah ada`;
          }
          matched.push(entry);
        } else if (hits.length > 1) {
          // JANGAN menebak. Modul mensyaratkan pelaporan ke peserta.
          ambiguous.push({ file: f, candidates: hits.map((r) => r.ID) });
        } else {
          unmatched.push({
            file: f, pages: chk.pages, engine: t.engine,
            cited_records_only: referenceOnly.slice(0, 5),
            hint: referenceOnly.length
              ? 'Beberapa judul record muncul di berkas ini TETAPI hanya di bagian belakang — itu daftar pustaka, bukan identitas artikelnya. Berkas ini kemungkinan artikel lain.'
              : 'Tidak ada judul record yang muncul di berkas ini.',
          });
        }
      }
      const haveFile = new Set(matched.map((m) => m.ID));
      return {
        pdfs_examined: files.length,
        scope: only_unconventional ? 'hanya berkas yang belum bernama SCR[ID]_' : 'semua PDF di folder',
        matched: matched.length,
        renamed: renamed.length,
        ambiguous: ambiguous.length,
        unmatched: unmatched.length,
        unreadable: unreadable.length,
        action_required: [
          ambiguous.length ? `${ambiguous.length} berkas cocok ke lebih dari satu record — JANGAN ditebak, laporkan ke peneliti.` : null,
          unmatched.length ? `${unmatched.length} berkas tidak cocok ke record mana pun — kemungkinan artikel lain (alat unduh eksternal terbukti dapat mengembalikan artikel yang sepenuhnya berbeda). Jangan dipakai untuk screening.` : null,
          unreadable.length ? `${unreadable.length} berkas cacat atau tanpa lapisan teks.` : null,
        ].filter(Boolean),
        records_without_file: recs.filter((r) => !haveFile.has(r.ID)).length,
        details: { matched, renamed, ambiguous, unmatched, unreadable },
      };
    },
  },

  {
    name: 'reconcile_two_pass',
    description: 'Rekonsiliasi dua pass mandiri (M5 L3, M6 L5, M7 L5). Menghasilkan statistik kesepakatan, antrean arbitrase, dan yang teratasi otomatis. Kode alasan "-", "NA", dan sel kosong diperlakukan SAMA — perbedaan penulisan pernah melahirkan 182 sengketa palsu.',
    inputSchema: {
      type: 'object',
      properties: {
        pass1: { type: 'array', items: { type: 'object' }, description: 'Array {ID, Decision, Reason_Code?, Evidence?, Note?}' },
        pass2: { type: 'array', items: { type: 'object' } },
        pass1_file: { type: 'string', description: 'Alternatif: path berkas JSON' },
        pass2_file: { type: 'string' },
        forward_values: { type: 'array', items: { type: 'string' }, description: 'Keputusan yang dihitung "diteruskan" (default INCLUDE, UNCERTAIN)' },
      },
    },
    run: (a) => analytics.reconcile(
      a.pass1 || readJson(a.pass1_file),
      a.pass2 || readJson(a.pass2_file),
      { forward_values: a.forward_values },
    ),
  },

  {
    name: 'calibration_sample',
    description: 'Sampel acak BERBENIH, opsional terstratifikasi proporsional (M5 L3). Math.random tidak dapat diberi benih sehingga tidak reproducible; alat ini memakai PRNG berbenih. Seed wajib dicatat di provenance, dan wajib DIGANTI bila sampel digambar ulang.',
    inputSchema: {
      type: 'object',
      properties: {
        records: { type: 'array', items: { type: 'object' } },
        records_file: { type: 'string' },
        size: { type: 'number' },
        seed: { type: 'number', description: 'WAJIB' },
        stratify_by: { type: 'string', description: 'Nama kolom untuk stratifikasi, mis. Decision' },
      },
      required: ['seed'],
    },
    run: (a) => analytics.stratifiedSample(a.records || readJson(a.records_file), a),
  },

  {
    name: 'retrieve_fulltext',
    description: 'Akuisisi full-text via Unpaywall + citation_pdf_url (M6 Langkah 1). Memverifikasi hasil unduhan benar-benar PDF utuh, dan memisahkan NEED_MANUAL (terbuka tetapi server menolak skrip — cukup dibuka di browser) dari NEED_INSTITUTIONAL (berbayar).',
    inputSchema: {
      type: 'object',
      properties: {
        records: { type: 'array', items: { type: 'object' }, description: 'Array {ID, DOI, Authors?, Year?}' },
        records_file: { type: 'string' },
        pdf_dir: { type: 'string' },
        email: { type: 'string', description: 'Email peserta — disyaratkan Unpaywall' },
        delay_ms: { type: 'number' },
      },
      required: ['pdf_dir', 'email'],
    },
    run: (a) => retrieve.retrieveBatch(a.records || readJson(a.records_file), a),
  },

  {
    name: 'xlsx_read',
    description: 'Baca satu sheet .xlsx menjadi array objek. Tanpa argumen sheet, mengembalikan daftar nama sheet.',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string' }, sheet: { type: 'string' }, limit: { type: 'number' } },
      required: ['file'],
    },
    run: ({ file, sheet, limit }) => {
      if (!sheet) return { sheets: xlsx.listSheets(file) };
      const rows = xlsx.readSheet(file, sheet);
      return { sheet, rows: rows.length, columns: Object.keys(rows[0] || {}), data: limit ? rows.slice(0, limit) : rows };
    },
  },

  {
    name: 'xlsx_write',
    description: 'Tulis workbook .xlsx dari objek {namaSheet: array objek}. MENULIS ULANG seluruh berkas — sertakan SEMUA sheet yang ingin dipertahankan, atau tulis ke berkas baru.',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string' }, sheets: { type: 'object' } },
      required: ['file', 'sheets'],
    },
    run: ({ file, sheets }) => xlsx.writeWorkbook(file, sheets),
  },

  {
    name: 'manuscript_numeric_audit',
    description: 'Audit angka naskah terhadap daftar fakta (M9 L8). Menangani desimal koma (Indonesia) maupun titik (Inggris). Angka yang tidak ada di daftar dilaporkan UNSOURCED untuk ditelusuri penulis, bukan dinyatakan salah.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        file: { type: 'string' },
        facts: { type: 'object', description: 'Peta {label: nilai}, mis. {"total_records":"645"}' },
      },
      required: ['facts'],
    },
    run: ({ text, file, facts }) => analytics.numericAudit(text ?? fs.readFileSync(file, 'utf8'), facts),
  },
];

/* --------------------------------------------------------- protokol JSON-RPC */

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const ok = (id, result) => send({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(req) {
  const { id, method, params } = req;
  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: (params && params.protocolVersion) || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: SERVER,
    });
  }
  if (method === 'notifications/initialized' || method === 'initialized') return;
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') {
    return ok(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name: PREFIX + name, description, inputSchema })) });
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => PREFIX + t.name === (params || {}).name);
    if (!tool) return err(id, -32601, `Alat tidak dikenal: ${(params || {}).name}`);
    try {
      const result = await tool.run((params && params.arguments) || {});
      return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] });
    } catch (e) {
      return ok(id, { content: [{ type: 'text', text: JSON.stringify({ error: e.message, tool: tool.name }, null, 1) }], isError: true });
    }
  }
  if (id !== undefined) err(id, -32601, `Metode tidak didukung: ${method}`);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let req;
    try { req = JSON.parse(line); } catch { continue; }
    Promise.resolve(handle(req)).catch((e) => {
      if (req && req.id !== undefined) err(req.id, -32603, e.message);
    });
  }
});
process.stdin.on('end', () => process.exit(0));
