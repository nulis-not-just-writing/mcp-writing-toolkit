'use strict';
/**
 * Pemeriksa integritas + pengekstrak lapisan teks PDF, hanya modul bawaan Node.
 *
 * MENGAPA TIDAK CUKUP MEMBACA OPERATOR Tj/TJ SAJA:
 * Jurnal akademik lazim memakai font Type0/Identity-H (CID). Di dalamnya, byte
 * pada string bukan karakter melainkan *glyph ID*. Membacanya mentah-mentah
 * menghasilkan teks kacau, dan gerbang fidelitas kutipan akan menuduh kutipan
 * yang sah sebagai palsu. Karena itu modul ini memetakan glyph ID lewat
 * /ToUnicode CMap tiap font, dengan font aktif dilacak per content stream
 * melalui operator Tf dan /Resources halaman.
 *
 * BATAS YANG TETAP ADA: PDF hasil scan tanpa lapisan teks tidak dapat dibaca
 * siapa pun tanpa OCR. Setiap hasil ekstraksi membawa `confidence`; pemanggil
 * WAJIB memperlakukan confidence rendah sebagai "tidak dapat diperiksa",
 * BUKAN sebagai "kutipan tidak cocok".
 */
const zlib = require('node:zlib');
const fs = require('node:fs');

/* ---------------------------------------------------------------- integritas */

function integrity(path) {
  const out = { path, ok: false, pages: null, issues: [] };
  let buf;
  try { buf = fs.readFileSync(path); }
  catch (e) { out.issues.push(`tidak dapat dibaca: ${e.message}`); return out; }
  out.bytes = buf.length;

  if (!buf.slice(0, 5).toString('latin1').startsWith('%PDF-')) {
    out.issues.push('header %PDF- tidak ada — bukan PDF');
    return out;
  }
  out.version = buf.slice(5, 8).toString('latin1');

  // Penanda akhir. Unduhan terputus LOLOS cek magic byte tetapi gagal di sini.
  if (!buf.slice(Math.max(0, buf.length - 2048)).toString('latin1').includes('%%EOF')) {
    out.issues.push('penanda %%EOF tidak ada — berkas kemungkinan TERPOTONG');
  }

  const latin = buf.toString('latin1');
  const pm = latin.match(/\/Type\s*\/Page[^s]/g);
  out.pages = pm ? pm.length : null;
  if (!out.pages) {
    const m = latin.match(/\/Count\s+(\d+)/);
    if (m) out.pages = parseInt(m[1], 10);
  }
  if (!out.pages) out.issues.push('jumlah halaman tidak dapat ditentukan');

  out.ok = !out.issues.some((s) => s.includes('TERPOTONG') || s.includes('bukan PDF'));
  return out;
}

/* ------------------------------------------------------------ objek & stream */

/** Peta nomor objek -> {dict, raw stream (sudah didekompresi bila perlu)}. */
function parseObjects(buf) {
  const latin = buf.toString('latin1');
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(latin)) !== null) {
    const num = parseInt(m[1], 10);
    const start = m.index + m[0].length;
    const endObj = latin.indexOf('endobj', start);
    if (endObj < 0) continue;
    const body = latin.slice(start, endObj);
    const sIdx = body.search(/stream\r?\n/);
    let dict = body, data = null;
    if (sIdx >= 0) {
      dict = body.slice(0, sIdx);
      const sm = /stream\r?\n/.exec(body.slice(sIdx));
      const dStart = start + sIdx + sm[0].length;
      const dEnd = latin.indexOf('endstream', dStart);
      if (dEnd > 0) {
        let raw = buf.slice(dStart, dEnd);
        if (/\/FlateDecode/.test(dict)) {
          try { raw = zlib.inflateSync(raw); }
          catch { try { raw = zlib.inflateRawSync(raw); } catch { raw = null; } }
        } else if (/\/(DCTDecode|JPXDecode|CCITT|JBIG2|LZW|ASCII85|RunLength)/.test(dict)) {
          raw = null;
        }
        data = raw;
      }
    }
    objs.set(num, { dict, data });
  }
  return objs;
}

/**
 * Nomor objek bila nilainya berupa rujukan "N 0 R".
 * PENTING: nilai yang berupa dictionary inline (<< ... >>) atau array sering
 * MEMUAT pola "N 0 R" di dalamnya. Tanpa penjagaan ini, dictionary font
 * /Font<</C2_0 1095 0 R/...>> akan disalahartikan sebagai rujukan ke objek
 * 1095, sehingga peta nama-font hilang dan seluruh teks CID gagal dipetakan.
 */
const refOf = (s) => {
  const v = String(s || '').trim();
  if (v.startsWith('<<') || v.startsWith('[')) return null;
  const m = /^(\d+)\s+\d+\s+R\b/.exec(v);
  return m ? parseInt(m[1], 10) : null;
};

/** Ambil isi sebuah kunci dictionary, menangani nilai bersarang << >> dan [ ]. */
function dictValue(dict, key) {
  const i = dict.indexOf('/' + key);
  if (i < 0) return null;
  let j = i + key.length + 1;
  while (j < dict.length && /\s/.test(dict[j])) j++;
  if (dict[j] === '<' && dict[j + 1] === '<') {
    let depth = 0;
    for (let k = j; k < dict.length - 1; k++) {
      if (dict[k] === '<' && dict[k + 1] === '<') { depth++; k++; }
      else if (dict[k] === '>' && dict[k + 1] === '>') { depth--; k++; if (!depth) return dict.slice(j, k + 1); }
    }
    return dict.slice(j);
  }
  if (dict[j] === '[') {
    const end = dict.indexOf(']', j);
    return dict.slice(j, end + 1);
  }
  const end = dict.slice(j).search(/[\/\]>\n\r]/);
  return dict.slice(j, end < 0 ? undefined : j + end).trim();
}

/* -------------------------------------------------------------- ToUnicode */

/** Parse CMap /ToUnicode -> Map<kode, string unicode>. */
function parseToUnicode(cmapText) {
  const map = new Map();
  if (!cmapText) return map;
  const hexToStr = (h) => {
    let s = '';
    for (let i = 0; i + 3 < h.length + 1 && i < h.length; i += 4) {
      const c = parseInt(h.substr(i, 4), 16);
      if (!Number.isNaN(c)) s += String.fromCharCode(c);
    }
    return s;
  };
  for (const blk of cmapText.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    const re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g;
    let m;
    while ((m = re.exec(blk)) !== null) map.set(parseInt(m[1], 16), hexToStr(m[2]));
  }
  for (const blk of cmapText.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    // bentuk 1: <lo> <hi> <dst>
    let re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g;
    let m;
    while ((m = re.exec(blk)) !== null) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16), base = parseInt(m[3].substr(0, 4), 16);
      for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, String.fromCharCode(base + (c - lo)));
    }
    // bentuk 2: <lo> <hi> [ <d1> <d2> ... ]
    re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g;
    while ((m = re.exec(blk)) !== null) {
      const lo = parseInt(m[1], 16);
      const items = m[3].match(/<([0-9a-fA-F]*)>/g) || [];
      items.forEach((it, k) => map.set(lo + k, hexToStr(it.replace(/[<>]/g, ''))));
    }
  }
  return map;
}

/* ------------------------------------------------------------- teks halaman */

function decodeLiteral(s) {
  let r = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') { r += c; continue; }
    const n = s[++i];
    if (n === undefined) break;
    if (n === 'n' || n === 'r') r += '\n';
    else if (n === 't') r += '\t';
    else if (n === 'b' || n === 'f') r += ' ';
    else if (n >= '0' && n <= '7') {
      let oct = n;
      while (oct.length < 3 && s[i + 1] >= '0' && s[i + 1] <= '7') oct += s[++i];
      r += String.fromCharCode(parseInt(oct, 8));
    } else if (n !== '\n') r += n;
  }
  return r;
}

function extractText(path) {
  const buf = fs.readFileSync(path);
  const objs = parseObjects(buf);

  // Peta ToUnicode per objek font.
  const uniOfFont = new Map();
  for (const [num, o] of objs) {
    if (!/\/Type\s*\/Font/.test(o.dict)) continue;
    const tuRef = refOf(dictValue(o.dict, 'ToUnicode'));
    const tu = tuRef !== null ? objs.get(tuRef) : null;
    uniOfFont.set(num, tu && tu.data ? parseToUnicode(tu.data.toString('latin1')) : new Map());
  }

  // Untuk setiap halaman: peta nama font -> peta ToUnicode, lalu decode isinya.
  let text = '';
  let cidChars = 0, cidMapped = 0;

  const decodeStream = (content, fontMaps) => {
    let active = null;
    const re = /\/([A-Za-z0-9#._-]+)\s+[\d.]+\s+Tf|\((?:\\.|[^\\()])*\)|<([0-9a-fA-F\s]+)>|(-?\d+\.?\d*)|(T\*|TJ|Tj|Td|TD|'|")/g;
    let m, pending = null;
    while ((m = re.exec(content)) !== null) {
      if (m[1] !== undefined) { active = fontMaps.get(m[1]) || null; continue; }
      const tok = m[0];
      if (tok.startsWith('(')) {
        const lit = decodeLiteral(tok.slice(1, -1));
        if (active && active.size) {
          // Font CID satu byte: petakan tiap byte.
          for (const ch of lit) {
            cidChars++;
            const u = active.get(ch.charCodeAt(0));
            if (u !== undefined) { text += u; cidMapped++; } else text += ch;
          }
        } else text += lit;
      } else if (m[2] !== undefined) {
        const h = m[2].replace(/\s/g, '');
        if (active && active.size) {
          for (let i = 0; i + 3 < h.length + 1 && i < h.length; i += 4) {
            const code = parseInt(h.substr(i, 4), 16);
            cidChars++;
            const u = active.get(code);
            if (u !== undefined) { text += u; cidMapped++; } else text += ' ';
          }
        } else {
          for (let i = 0; i + 1 < h.length; i += 2) text += String.fromCharCode(parseInt(h.substr(i, 2), 16));
        }
      } else if (m[3] !== undefined) { pending = parseFloat(m[3]); continue; }
      else if (tok === 'T*' || tok === 'Td' || tok === 'TD' || tok === "'" || tok === '"') text += '\n';
      else if (tok === 'TJ' && pending !== null && pending < -120) text += ' ';
      pending = null;
    }
    text += '\n';
  };

  for (const [, o] of objs) {
    if (!/\/Type\s*\/Page[^s]/.test(o.dict + ' ')) continue;
    const resRef = refOf(dictValue(o.dict, 'Resources'));
    const resDict = resRef !== null ? (objs.get(resRef) || {}).dict : dictValue(o.dict, 'Resources');
    const fontDictRaw = dictValue(resDict || '', 'Font') || '';
    const fontDict = refOf(fontDictRaw) !== null ? (objs.get(refOf(fontDictRaw)) || {}).dict || '' : fontDictRaw;

    const fontMaps = new Map();
    const fre = /\/([A-Za-z0-9#._-]+)\s+(\d+)\s+\d+\s+R/g;
    let fm;
    while ((fm = fre.exec(fontDict)) !== null) {
      const u = uniOfFont.get(parseInt(fm[2], 10));
      if (u) fontMaps.set(fm[1], u);
    }

    const contents = dictValue(o.dict, 'Contents') || '';
    const nums = [...contents.matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => parseInt(x[1], 10));
    for (const n of nums) {
      const c = objs.get(n);
      if (c && c.data) decodeStream(c.data.toString('latin1'), fontMaps);
    }
  }

  const total = text.replace(/\s/g, '').length;
  const sane = (text.match(/[A-Za-z0-9.,;:'"()\-À-ɏ]/g) || []).length;
  const confidence = total === 0 ? 0 : Math.min(1, sane / total);

  return {
    text,
    confidence,
    chars: text.length,
    cid_glyphs: cidChars,
    cid_mapped: cidMapped,
    cid_map_rate: cidChars ? cidMapped / cidChars : null,
  };
}

/**
 * Perbandingan verbatim hanya atas deret huruf-angka.
 * Tiga artefak yang TERBUKTI muncul dan bukan kesalahan pengutip:
 *   1. tanda hubung hilang di lapisan teks — "Sharia-based" menjadi "Shariabased"
 *   2. tanda hubung/en dash diikuti ganti baris — "Council-\nIndonesian"
 *   3. ligatur (fi/fl/ff) dan smart quotes
 * Membandingkan mentah-mentah akan melaporkan kutipan sah sebagai palsu.
 */
function letters(s) {
  return String(s)
    .normalize('NFKC')
    .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

module.exports = { integrity, extractText, letters };
