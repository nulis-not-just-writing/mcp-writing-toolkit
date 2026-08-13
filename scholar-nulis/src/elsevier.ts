// Adaptor Elsevier: Scopus Search + Abstract Retrieval + ScienceDirect.
//
// Kunci dibaca dari env (diisi lewat user_config Claude Desktop → keychain OS).
// Kunci TIDAK PERNAH ditulis ke log, pesan galat, atau keluaran tool.
//
// Catatan kuota & lisensi:
// - Scopus Search API: kuota mingguan per kunci; header X-RateLimit-* dibaca dan
//   dikembalikan ke pemanggil supaya sisa kuota terlihat sebelum habis.
// - Akses institusional sering menuntut IP kampus atau insttoken. Tanpa itu,
//   sebagian field (mis. abstrak lengkap) dapat kosong meski kunci valid.
// - Teks lengkap ScienceDirect hanya untuk konten yang dilanggan institusi.

import { politeFetch } from "./http.js";

/**
 * Baca kunci dari env dengan menolak nilai yang bukan kunci sungguhan.
 *
 * Kolom user_config yang dikosongkan pengguna dapat sampai ke server dalam beberapa
 * bentuk: string kosong, spasi, atau — pada sebagian versi klien — teks penggantinya
 * secara harfiah ("${user_config.scopus_api_key}"). Bentuk terakhir itu berbahaya:
 * panjangnya bukan nol, sehingga tanpa penyaringan ini tool Scopus akan didaftarkan
 * untuk pengguna yang justru tidak punya kunci, lalu gagal pada setiap pemanggilan.
 *
 * Kunci Elsevier berupa heksadesimal 32 karakter; apa pun di luar bentuk itu ditolak.
 */
function bacaKunci(nama: string): string {
  const v = (process.env[nama] ?? "").trim();
  if (!v) return "";
  if (v.startsWith("${") || v.includes("user_config")) return ""; // placeholder belum tersubstitusi
  if (!/^[A-Za-z0-9]{20,64}$/.test(v)) return ""; // bukan bentuk kunci API
  return v;
}

const SCOPUS_KEY = bacaKunci("SCOPUS_API_KEY");
const SD_KEY = bacaKunci("SCIENCEDIRECT_API_KEY");
const INSTTOKEN = (() => {
  const v = (process.env.ELSEVIER_INSTTOKEN ?? "").trim();
  return !v || v.startsWith("${") || v.includes("user_config") ? "" : v;
})();

export const hasScopusKey = () => Boolean(SCOPUS_KEY);
export const hasSdKey = () => Boolean(SD_KEY || SCOPUS_KEY);

const KEY_HINT =
  "Kunci Elsevier belum terpasang. Isi lewat Settings → Extensions → scholar-nulis " +
  "(kolom Scopus API key / ScienceDirect API key). Daftar di dev.elsevier.com.";

function headers(key: string): Record<string, string> {
  const h: Record<string, string> = { "X-ELS-APIKey": key, Accept: "application/json" };
  if (INSTTOKEN) h["X-ELS-Insttoken"] = INSTTOKEN;
  return h;
}

/** Buang kunci dari pesan galat sebelum sampai ke pemanggil. */
function scrub(msg: string): string {
  let s = msg;
  for (const k of [SCOPUS_KEY, SD_KEY, INSTTOKEN]) if (k) s = s.split(k).join("«redacted»");
  return s.replace(/apiKey=[^&\s]+/gi, "apiKey=«redacted»");
}

export interface Quota {
  limit?: number;
  remaining?: number;
  resets_at?: string;
}

function quotaOf(res: Response): Quota {
  const lim = res.headers.get("X-RateLimit-Limit");
  const rem = res.headers.get("X-RateLimit-Remaining");
  const rst = res.headers.get("X-RateLimit-Reset");
  const q: Quota = {};
  if (lim) q.limit = Number(lim);
  if (rem) q.remaining = Number(rem);
  if (rst) q.resets_at = new Date(Number(rst) * 1000).toISOString();
  return q;
}

async function elsevierJSON(url: string, key: string): Promise<{ data: any; quota: Quota }> {
  const res = await politeFetch(url, { headers: headers(key) });
  const quota = quotaOf(res);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let hint = "";
    if (res.status === 401) hint = " — kunci ditolak. Periksa kunci, atau apakah kunci sudah diaktifkan untuk API ini.";
    else if (res.status === 403)
      hint =
        " — kunci valid tetapi akses ditolak. Umumnya karena permintaan berasal dari luar jaringan institusi: " +
        "jalankan dari jaringan kampus, atau minta insttoken ke pustakawan/admin lisensi.";
    else if (res.status === 429)
      hint = ` — kuota habis${quota.resets_at ? `, pulih ${quota.resets_at}` : ""}. Tunggu reset atau kurangi jumlah permintaan.`;
    throw new Error(scrub(`Elsevier HTTP ${res.status}${hint} ${body.slice(0, 200)}`));
  }
  return { data: await res.json(), quota };
}

export interface ScopusRecord {
  title: string;
  authors: string;
  year: string;
  journal: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  eid?: string;
  scopus_id?: string;
  issn?: string;
  document_type?: string;
  cited_by?: number;
  open_access?: boolean;
  affiliation?: string;
  source: "scopus";
}

function mapEntry(e: any): ScopusRecord {
  const affs = (e.affiliation || []).map((a: any) => [a.affilname, a["affiliation-country"]].filter(Boolean).join(", "));
  return {
    title: e["dc:title"] || "",
    authors: e["dc:creator"] || "",
    year: (e["prism:coverDate"] || "").slice(0, 4),
    journal: e["prism:publicationName"] || "",
    volume: e["prism:volume"],
    issue: e["prism:issueIdentifier"],
    pages: e["prism:pageRange"],
    doi: e["prism:doi"],
    eid: e.eid,
    scopus_id: (e["dc:identifier"] || "").replace("SCOPUS_ID:", "") || undefined,
    issn: e["prism:issn"] || e["prism:eIssn"],
    document_type: e.subtypeDescription,
    cited_by: e["citedby-count"] != null ? Number(e["citedby-count"]) : undefined,
    open_access: e.openaccess === "1" || e.openaccessFlag === true,
    affiliation: affs.join(" | ") || undefined,
    source: "scopus",
  };
}

/**
 * Pencarian Scopus dengan sintaks asli (TITLE-ABS-KEY, AND/OR/NOT, W/n, PUBYEAR, DOCTYPE, LANGUAGE).
 * Query diteruskan apa adanya — TIDAK diterjemahkan — agar search string yang dilaporkan
 * di manuskrip sama persis dengan yang dieksekusi.
 */
export async function searchScopus(
  query: string,
  max_results = 25,
  opts: { start?: number; view?: "STANDARD" | "COMPLETE"; sort?: string } = {}
): Promise<{ total: number; returned: number; start: number; records: ScopusRecord[]; quota: Quota; query: string }> {
  if (!SCOPUS_KEY) throw new Error(KEY_HINT);
  const count = Math.min(max_results, 25); // batas per halaman untuk view STANDARD
  const p = new URLSearchParams({ query, count: String(count), start: String(opts.start ?? 0) });
  if (opts.view) p.set("view", opts.view);
  if (opts.sort) p.set("sort", opts.sort);

  const { data, quota } = await elsevierJSON(`https://api.elsevier.com/content/search/scopus?${p}`, SCOPUS_KEY);
  const sr = data["search-results"] || {};
  const entries: any[] = Array.isArray(sr.entry) ? sr.entry : [];
  if (entries.length === 1 && entries[0].error) {
    return { total: 0, returned: 0, start: opts.start ?? 0, records: [], quota, query };
  }
  return {
    total: Number(sr["opensearch:totalResults"] ?? 0),
    returned: entries.length,
    start: Number(sr["opensearch:startIndex"] ?? 0),
    records: entries.map(mapEntry),
    quota,
    query,
  };
}

/**
 * Abstrak + kata kunci penulis, dengan dua jalur.
 *
 * Abstract Retrieval view META_ABS menuntut hak akses penuh (umumnya dari jaringan
 * institusi). Kunci tanpa hak itu tetap menerima 200 pada view META, tetapi field
 * abstraknya KOSONG — bukan galat, sehingga mudah lolos tanpa disadari. Karena itu:
 * bila abstrak kosong dan DOI berawalan 10.1016 (Elsevier), coba Article Retrieval
 * yang untuk banyak kunci tetap mengembalikan abstrak lengkap.
 */
export async function scopusAbstract(id: string): Promise<any> {
  if (!SCOPUS_KEY) throw new Error(KEY_HINT);
  const path = id.startsWith("10.") ? `doi/${encodeURIComponent(id)}` : `scopus_id/${encodeURIComponent(id)}`;
  const { data } = await elsevierJSON(`https://api.elsevier.com/content/abstract/${path}`, SCOPUS_KEY);
  const c = data["abstracts-retrieval-response"] || {};
  const core = c.coredata || {};
  const kw = c.authkeywords?.["author-keyword"];
  let abstract: string | null = core["dc:description"] || null;
  let abstract_via = abstract ? "abstract_retrieval" : null;

  if (!abstract && id.startsWith("10.")) {
    try {
      const alt = await sciencedirectFulltext(id);
      if (alt.abstract) {
        abstract = alt.abstract;
        abstract_via = "article_retrieval_fallback";
      }
    } catch {
      /* artikel non-Elsevier atau di luar hak akses — biarkan abstrak null */
    }
  }

  return {
    doi: core["prism:doi"],
    title: core["dc:title"],
    journal: core["prism:publicationName"],
    year: (core["prism:coverDate"] || "").slice(0, 4),
    document_type: core.subtypeDescription,
    cited_by: core["citedby-count"] != null ? Number(core["citedby-count"]) : undefined,
    abstract,
    abstract_via,
    author_keywords: Array.isArray(kw) ? kw.map((k: any) => k.$ ?? k) : kw?.$ ? [kw.$] : [],
    open_access: core.openaccess === "1",
    catatan:
      abstract === null
        ? "Abstrak tidak tersedia untuk kunci ini. Umumnya karena permintaan dari luar jaringan institusi " +
          "(view META_ABS menuntut hak akses penuh). Jalankan dari jaringan kampus, minta insttoken, atau " +
          "lengkapi abstrak dari export manual scopus.com."
        : undefined,
    source: "scopus",
  };
}

/**
 * Periksa hak akses kunci per-API. Sebuah kunci Elsevier dapat valid untuk satu API
 * dan ditolak untuk yang lain — dan yang paling menipu, Abstract Retrieval dapat
 * membalas 200 dengan abstrak kosong. Jalankan ini sebelum Tahap 3 supaya jalur mana
 * yang dapat dipakai diketahui sebelum query dirancang.
 */
export async function probeEntitlements(): Promise<Record<string, unknown>> {
  if (!SCOPUS_KEY && !SD_KEY) throw new Error(KEY_HINT);
  const key = SCOPUS_KEY || SD_KEY;
  const out: Record<string, unknown> = {};
  let quota: Quota = {};

  const cek = async (nama: string, url: string, nilai: (d: any) => unknown) => {
    try {
      const res = await politeFetch(url, { headers: headers(key) });
      Object.assign(quota, quotaOf(res));
      if (!res.ok) {
        out[nama] = { ok: false, status: res.status, arti: res.status === 401 ? "tidak berhak" : res.status === 429 ? "kuota habis" : "galat" };
        return;
      }
      out[nama] = { ok: true, ...(nilai(await res.json()) as object) };
    } catch (e) {
      out[nama] = { ok: false, pesan: scrub(e instanceof Error ? e.message : String(e)) };
    }
  };

  await cek("scopus_search", "https://api.elsevier.com/content/search/scopus?query=" + encodeURIComponent("ALL(prisma)") + "&count=1", (d) => ({
    total_hits: Number(d?.["search-results"]?.["opensearch:totalResults"] ?? 0),
  }));
  await cek("abstract_retrieval", "https://api.elsevier.com/content/abstract/doi/10.1016%2Fj.jclinepi.2021.03.001", (d) => {
    const ab = d?.["abstracts-retrieval-response"]?.coredata?.["dc:description"] || "";
    return { metadata: true, abstrak_terisi: ab.length > 0, abstrak_chars: ab.length };
  });
  await cek("article_retrieval", "https://api.elsevier.com/content/article/doi/10.1016%2Fj.jclinepi.2021.03.001?view=FULL", (d) => {
    const f = d?.["full-text-retrieval-response"] || {};
    return { abstrak_chars: (f.coredata?.["dc:description"] || "").length, fulltext_chars: (f.originalText || "").length };
  });

  out.kuota = quota;
  return out;
}

/** Teks lengkap ScienceDirect (hanya konten yang dilanggan institusi). */
export async function sciencedirectFulltext(doi: string): Promise<any> {
  const key = SD_KEY || SCOPUS_KEY;
  if (!key) throw new Error(KEY_HINT);
  const { data } = await elsevierJSON(
    `https://api.elsevier.com/content/article/doi/${encodeURIComponent(doi)}?view=FULL`,
    key
  );
  const full = data["full-text-retrieval-response"] || {};
  const core = full.coredata || {};
  const text: string = full.originalText || "";
  return {
    doi: core["prism:doi"] || doi,
    title: core["dc:title"],
    journal: core["prism:publicationName"],
    year: (core["prism:coverDate"] || "").slice(0, 4),
    abstract: core["dc:description"] || null,
    has_fulltext: Boolean(text),
    fulltext_chars: text.length,
    fulltext: text ? text.slice(0, 200_000) : null,
    truncated: text.length > 200_000,
    source: "sciencedirect",
  };
}
