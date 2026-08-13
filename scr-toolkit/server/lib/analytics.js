'use strict';
/** Operasi deterministik tinjauan: rekonsiliasi, sampling, audit angka. */

/**
 * PRNG berbenih (mulberry32). Math.random TIDAK dapat diberi benih, sehingga
 * sampel kalibrasi tidak akan dapat direproduksi — padahal reproducibility
 * justru alasan langkah ini ada. Seed WAJIB dicatat di provenance.
 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FORWARD = new Set(['INCLUDE', 'UNCERTAIN']);
const norm = (v) => {
  const s = String(v ?? '').trim();
  // "-", "NA", "n/a" dan sel kosong adalah hal yang SAMA. Memperlakukannya
  // berbeda pernah melahirkan 182 sengketa palsu di satu tinjauan nyata.
  return /^(-|na|n\/a|nan|none|null)$/i.test(s) ? '' : s;
};

/**
 * Rekonsiliasi dua pass mandiri.
 * pass1/pass2: array {ID, Decision, Reason_Code?, Evidence?, Note?}
 * Mengembalikan statistik + antrean arbitrase + yang teratasi otomatis.
 */
function reconcile(pass1, pass2, opts = {}) {
  const forwardSet = new Set(opts.forward_values || [...FORWARD]);
  const m1 = new Map(pass1.map((r) => [String(r.ID), r]));
  const m2 = new Map(pass2.map((r) => [String(r.ID), r]));
  const ids = [...new Set([...m1.keys(), ...m2.keys()])].sort();

  const arbitration = [];
  const autoResolved = [];
  const agreed = [];
  const missing = [];
  let identical = 0, sameFate = 0;
  const patterns = {};

  for (const id of ids) {
    const a = m1.get(id), b = m2.get(id);
    if (!a || !b) { missing.push({ ID: id, in_pass1: !!a, in_pass2: !!b }); continue; }
    const da = String(a.Decision || '').trim().toUpperCase();
    const db = String(b.Decision || '').trim().toUpperCase();
    const fa = forwardSet.has(da), fb = forwardSet.has(db);
    const row = {
      ID: id,
      Pass1_Decision: da, Pass1_Reason_Code: norm(a.Reason_Code), Pass1_Evidence: a.Evidence ?? '', Pass1_Note: a.Note ?? '',
      Pass2_Decision: db, Pass2_Reason_Code: norm(b.Reason_Code), Pass2_Evidence: b.Evidence ?? '', Pass2_Note: b.Note ?? '',
    };

    if (da === db) {
      identical++; sameFate++;
      // Kode alasan berbeda pada keputusan yang sama: bukan sengketa keputusan.
      if (row.Pass1_Reason_Code !== row.Pass2_Reason_Code) {
        autoResolved.push({ ...row, Disagreement_Type: 'Reason-only', Resolution: da, Resolution_Basis: 'keputusan identik; kode alasan berbeda tidak mengubah nasib' });
      } else {
        agreed.push({ ...row, Disagreement_Type: 'None', Resolution: da });
      }
    } else if (fa === fb) {
      sameFate++;
      // Mis. INCLUDE vs UNCERTAIN: dua-duanya diteruskan ke full-text.
      const conservative = da === 'UNCERTAIN' || db === 'UNCERTAIN' ? 'UNCERTAIN' : da;
      autoResolved.push({ ...row, Disagreement_Type: 'Label-only (nasib sama)', Resolution: conservative, Resolution_Basis: 'kedua pass sepakat nasibnya; dipakai label paling hati-hati' });
    } else {
      const key = `${da} vs ${db}`;
      patterns[key] = (patterns[key] || 0) + 1;
      arbitration.push({ ...row, Disagreement_Type: 'Decision', Author_Decision: '', Author_Reason: '', Author_Notes: '' });
    }
  }

  const n = ids.length - missing.length;
  const union = ids.filter((id) => {
    const a = m1.get(id), b = m2.get(id);
    return (a && forwardSet.has(String(a.Decision).toUpperCase())) || (b && forwardSet.has(String(b.Decision).toUpperCase()));
  }).length;
  const inter = ids.filter((id) => {
    const a = m1.get(id), b = m2.get(id);
    return a && b && forwardSet.has(String(a.Decision).toUpperCase()) && forwardSet.has(String(b.Decision).toUpperCase());
  }).length;

  return {
    summary: {
      records_compared: n,
      identical_decisions: identical,
      identical_pct: n ? +(identical / n * 100).toFixed(2) : null,
      same_fate: sameFate,
      same_fate_pct: n ? +(sameFate / n * 100).toFixed(2) : null,
      arbitration_queue: arbitration.length,
      auto_resolved: autoResolved.length,
      forwarded_union: union,
      forwarded_intersection: inter,
      forwarded_final_range: [inter, union],
      disagreement_patterns: patterns,
      records_missing_from_one_pass: missing.length,
    },
    arbitration_queue: arbitration,
    auto_resolved: autoResolved,
    agreed_count: agreed.length,
    missing,
    caveat: 'Angka kesepakatan tinggi tidak dengan sendirinya berarti kriteria tegas. Bila kedua pass berasal dari model yang sama dengan prompt yang sama, sebagian kesepakatan mencerminkan kesamaan model. Kalibrasi penulis adalah pengaman utama, bukan pelengkap.',
  };
}

/**
 * Sampel acak berbenih, opsional terstratifikasi menurut satu kolom.
 * Proporsional terhadap distribusi populasi.
 */
function stratifiedSample(records, { size = 50, seed, stratify_by = null } = {}) {
  if (seed === undefined || seed === null) throw new Error('seed WAJIB diisi agar sampel dapat direproduksi');
  const rand = rng(Number(seed));
  const n = Math.min(size, records.length);
  if (!stratify_by) {
    return { seed: Number(seed), size: n, strata: null, sample: shuffled(records, rand).slice(0, n) };
  }
  const groups = new Map();
  for (const r of records) {
    const k = String(r[stratify_by] ?? '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const keys = [...groups.keys()].sort();
  const alloc = keys.map((k) => ({ k, want: (groups.get(k).length / records.length) * n }));
  // Alokasi bilangan bulat: ambil lantai lalu bagikan sisanya ke pecahan terbesar.
  let assigned = alloc.map((a) => ({ ...a, take: Math.floor(a.want) }));
  let left = n - assigned.reduce((s, a) => s + a.take, 0);
  assigned.sort((a, b) => (b.want - Math.floor(b.want)) - (a.want - Math.floor(a.want)));
  for (let i = 0; i < left; i++) assigned[i % assigned.length].take++;

  const sample = [];
  const strata = {};
  for (const a of assigned) {
    const picked = shuffled(groups.get(a.k), rand).slice(0, a.take);
    strata[a.k] = picked.length;
    sample.push(...picked);
  }
  return {
    seed: Number(seed), size: sample.length, stratify_by, strata,
    sample: sample.sort((x, y) => String(x.ID ?? '').localeCompare(String(y.ID ?? ''))),
    note: 'Catat seed ini di provenance. Bila sampel harus digambar ulang (mis. kriteria berubah), GANTI seed — memakai seed yang sama menghasilkan sampel yang sama dan kalibrasinya tidak lagi independen.',
  };
}

/**
 * Audit angka naskah: setiap angka di teks dicocokkan dengan daftar fakta.
 * facts: { label: nilai }. Angka yang tidak ada di daftar dilaporkan sebagai
 * UNSOURCED — bukan salah, tetapi wajib ditelusuri penulis.
 */
function numericAudit(text, facts = {}) {
  const allowed = new Map();
  for (const [k, v] of Object.entries(facts)) {
    const s = String(v).replace(/[^\d.]/g, '');
    if (s) allowed.set(s, k);
  }
  const found = [];
  // Angka ditulis berbeda antar-lokal: "93.5" (Inggris) dan "93,5" (Indonesia)
  // sama-sama desimal, sedangkan "1.000"/"1,000" adalah pemisah ribuan.
  // Ambiguitasnya melekat, jadi tiap angka diuji dalam KEDUA tafsiran; cocok
  // dengan salah satunya sudah dianggap bersumber. Tanpa ini, "93,5%" terpecah
  // menjadi "93" dan "5%" dan dilaporkan tak bersumber — padahal sah.
  const re = /(?<![\w.,])(\d+(?:[.,]\d+)*)\s*(%)?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1] + (m[2] ? '%' : '');
    const variants = new Set([
      m[1],
      m[1].replace(/[.,]/g, ''),                       // sebagai pemisah ribuan
      m[1].replace(',', '.'),                          // koma sebagai desimal
      m[1].replace(/\.(?=\d{3}\b)/g, ''),              // titik ribuan saja
    ]);
    let hit = null;
    for (const v of variants) if (allowed.has(v)) { hit = allowed.get(v); break; }
    const ctxStart = Math.max(0, m.index - 60);
    found.push({
      value: raw,
      variants_tested: [...variants],
      matches_fact: hit,
      context: text.slice(ctxStart, m.index + raw.length + 40).replace(/\s+/g, ' ').trim(),
    });
  }
  const unsourced = found.filter((f) => f.matches_fact === null);
  return {
    numbers_in_text: found.length,
    matched_to_facts: found.length - unsourced.length,
    unsourced_count: unsourced.length,
    unsourced,
    facts_never_cited: [...allowed.entries()]
      .filter(([bare]) => !found.some((f) => (f.variants_tested || []).includes(bare)))
      .map(([bare, label]) => ({ fact: label, value: bare })),
    note: 'UNSOURCED berarti angka itu tidak ada dalam daftar fakta yang diberikan — bisa jadi angka sah dari sumber lain, bisa jadi salah tulis. Alat ini menandai, penulis yang memutuskan.',
  };
}

module.exports = { reconcile, stratifiedSample, numericAudit, rng };
