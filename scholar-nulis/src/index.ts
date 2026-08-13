import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { politeFetch, getJSON, getText, getBinary, contactEmail } from "./http.js";
import {
  searchScopus,
  scopusAbstract,
  sciencedirectFulltext,
  hasScopusKey,
  hasSdKey,
  probeEntitlements,
  type ScopusRecord,
} from "./elsevier.js";

interface Paper {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  venue: string | null;
  abstract: string | null;
  url: string | null;
  pdf_url: string | null;
  citations: number | null;
  source: string;
  extra?: Record<string, unknown>;
}

// Sama seperti kunci Elsevier: tolak teks pengganti yang belum tersubstitusi, agar tidak
// terkirim sebagai header x-api-key dan memicu penolakan.
const S2_KEY = (() => {
  const v = (process.env.S2_API_KEY ?? "").trim();
  return !v || v.includes("${") || v.includes("user_config") ? "" : v;
})();

const clip = (s: string | null | undefined, n = 1500): string | null => {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t || null;
};

const asList = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

const ok = (payload: unknown) => ({
  content: [{ type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }],
});
const fail = (e: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

/**
 * Tentukan folder unduhan, menolak nilai yang bukan path sungguhan.
 *
 * Nilai dari user_config dapat sampai ke server sebagai teks pengganti yang belum
 * tersubstitusi — "${DOWNLOADS}" (default manifest) atau "${user_config.download_dir}"
 * (kolom yang dikosongkan). Tanpa penyaringan ini, server membuat folder bernama harfiah
 * "${DOWNLOADS}" di direktori kerja, dan PDF tersimpan di tempat yang tidak dapat
 * ditemukan pengguna.
 *
 * Urutan: nilai env yang sah → ~/Downloads → direktori sementara sistem.
 */
function downloadDir(): string {
  const raw = (process.env.DOWNLOAD_DIR ?? "").trim();
  const placeholder = !raw || raw.includes("${") || raw.includes("user_config") || raw.includes("DOWNLOADS");

  const kandidat: string[] = [];
  if (!placeholder) kandidat.push(raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : path.resolve(raw));
  kandidat.push(path.join(os.homedir(), "Downloads"), path.join(os.tmpdir(), "scholar-nulis"));

  const galat: string[] = [];
  for (const d of kandidat) {
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.accessSync(d, fs.constants.W_OK);
      return d;
    } catch (e) {
      galat.push(`${d}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(
    "Tidak ada folder unduhan yang dapat ditulisi. Isi 'Folder unduhan PDF' di " +
      "Settings → Extensions dengan path absolut. Dicoba — " +
      galat.join(" | ")
  );
}
const safeName = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 150);

async function savePdf(url: string, filename: string): Promise<Record<string, unknown>> {
  const { data, contentType } = await getBinary(url);
  const isPdf = contentType.includes("pdf") || (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46);
  if (!isPdf) throw new Error(`Bukan PDF (content-type: ${contentType || "?"}) — ${url}`);
  const file = path.join(downloadDir(), safeName(filename.endsWith(".pdf") ? filename : filename + ".pdf"));
  fs.writeFileSync(file, data);
  return { saved_to: file, size_bytes: data.length, source_url: url };
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const doc = await getDocumentProxy(data);
  const { text } = await extractText(doc, { mergePages: true });
  return text;
}

function windowText(text: string, startChar: number, maxChars: number) {
  const total = text.length;
  const chunk = text.slice(startChar, startChar + maxChars);
  return {
    total_chars: total,
    start_char: startChar,
    returned_chars: chunk.length,
    has_more: startChar + chunk.length < total,
    text: chunk,
  };
}

// ---------- sumber data ----------

async function searchArxiv(query: string, max: number): Promise<Paper[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${max}&sortBy=relevance`;
  const xml = await getText(url);
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  return asList(parsed?.feed?.entry).map((e: any): Paper => {
    const id: string = e.id ?? "";
    const arxivId = id.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
    const pdf = asList(e.link).find((l: any) => l["@_title"] === "pdf")?.["@_href"] ?? `https://arxiv.org/pdf/${arxivId}`;
    return {
      title: clip(e.title, 400) ?? "",
      authors: asList(e.author).map((a: any) => a.name).filter(Boolean),
      year: e.published ? Number(String(e.published).slice(0, 4)) : null,
      doi: e["arxiv:doi"]?.["#text"] ?? (typeof e["arxiv:doi"] === "string" ? e["arxiv:doi"] : null),
      venue: "arXiv",
      abstract: clip(e.summary),
      url: id || null,
      pdf_url: pdf,
      citations: null,
      source: "arxiv",
      extra: { arxiv_id: arxivId },
    };
  });
}

function openalexAbstract(inv: Record<string, number[]> | null | undefined): string | null {
  if (!inv) return null;
  const words: string[] = [];
  for (const [w, positions] of Object.entries(inv)) for (const p of positions) words[p] = w;
  return clip(words.join(" "));
}

async function searchOpenalex(query: string, max: number, yearFrom?: number, yearTo?: number): Promise<Paper[]> {
  let url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${max}`;
  const filters: string[] = [];
  if (yearFrom) filters.push(`from_publication_date:${yearFrom}-01-01`);
  if (yearTo) filters.push(`to_publication_date:${yearTo}-12-31`);
  if (filters.length) url += `&filter=${filters.join(",")}`;
  if (contactEmail()) url += `&mailto=${encodeURIComponent(contactEmail())}`;
  const j = await getJSON(url);
  return (j.results ?? []).map((w: any): Paper => ({
    title: clip(w.display_name, 400) ?? "",
    authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
    year: w.publication_year ?? null,
    doi: w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//, "") : null,
    venue: w.primary_location?.source?.display_name ?? null,
    abstract: openalexAbstract(w.abstract_inverted_index),
    url: w.doi ?? w.id ?? null,
    pdf_url: w.open_access?.oa_url ?? null,
    citations: w.cited_by_count ?? null,
    source: "openalex",
    extra: { openalex_id: w.id, is_oa: w.open_access?.is_oa ?? null },
  }));
}

function crossrefToPaper(it: any): Paper {
  return {
    title: clip(asList(it.title)[0], 400) ?? "",
    authors: (it.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean),
    year: it.issued?.["date-parts"]?.[0]?.[0] ?? null,
    doi: it.DOI ?? null,
    venue: asList(it["container-title"])[0] ?? null,
    abstract: clip(typeof it.abstract === "string" ? it.abstract.replace(/<[^>]+>/g, " ") : null),
    url: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : null),
    pdf_url: null,
    citations: it["is-referenced-by-count"] ?? null,
    source: "crossref",
    extra: { type: it.type, publisher: it.publisher },
  };
}

async function searchCrossref(query: string, max: number): Promise<Paper[]> {
  let url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${max}`;
  if (contactEmail()) url += `&mailto=${encodeURIComponent(contactEmail())}`;
  const j = await getJSON(url);
  return (j.message?.items ?? []).map(crossrefToPaper);
}

async function searchSemantic(query: string, max: number, yearFrom?: number): Promise<Paper[]> {
  const fields = "title,authors,year,abstract,externalIds,openAccessPdf,citationCount,venue,url";
  let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${max}&fields=${fields}`;
  if (yearFrom) url += `&year=${yearFrom}-`;
  const j = await getJSON(url, S2_KEY ? { headers: { "x-api-key": S2_KEY } } : {});
  return (j.data ?? []).map((p: any): Paper => ({
    title: clip(p.title, 400) ?? "",
    authors: (p.authors ?? []).map((a: any) => a.name).filter(Boolean),
    year: p.year ?? null,
    doi: p.externalIds?.DOI ?? null,
    venue: p.venue || null,
    abstract: clip(p.abstract),
    url: p.url ?? null,
    pdf_url: p.openAccessPdf?.url ?? null,
    citations: p.citationCount ?? null,
    source: "semanticscholar",
  }));
}

async function searchPubmed(query: string, max: number): Promise<Paper[]> {
  const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  const mail = contactEmail() ? `&email=${encodeURIComponent(contactEmail())}` : "";
  const es = await getJSON(`${base}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${max}&retmode=json&tool=mcp-scr${mail}`);
  const ids: string[] = es.esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  const sum = await getJSON(`${base}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json&tool=mcp-scr${mail}`);
  return ids.map((id): Paper => {
    const r = sum.result?.[id] ?? {};
    const doi = (r.articleids ?? []).find((a: any) => a.idtype === "doi")?.value ?? null;
    return {
      title: clip(r.title, 400) ?? "",
      authors: (r.authors ?? []).map((a: any) => a.name).filter(Boolean),
      year: r.pubdate ? Number(String(r.pubdate).slice(0, 4)) || null : null,
      doi,
      venue: r.fulljournalname ?? null,
      abstract: null,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      pdf_url: null,
      citations: null,
      source: "pubmed",
      extra: { pmid: id },
    };
  });
}

async function searchEuropePmc(query: string, max: number): Promise<Paper[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${max}&resultType=core`;
  const j = await getJSON(url);
  return (j.resultList?.result ?? []).map((r: any): Paper => ({
    title: clip(r.title, 400) ?? "",
    authors: r.authorString ? String(r.authorString).split(/,\s*/) : [],
    year: r.pubYear ? Number(r.pubYear) : null,
    doi: r.doi ?? null,
    venue: r.journalInfo?.journal?.title ?? r.journalTitle ?? null,
    abstract: clip(r.abstractText),
    url: r.doi ? `https://doi.org/${r.doi}` : null,
    pdf_url: asList(r.fullTextUrlList?.fullTextUrl).find((u: any) => u.documentStyle === "pdf")?.url ?? null,
    citations: r.citedByCount ?? null,
    source: "europepmc",
    extra: { pmid: r.pmid ?? null, is_oa: r.isOpenAccess === "Y" },
  }));
}

async function searchDoaj(query: string, max: number): Promise<Paper[]> {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=${max}`;
  const j = await getJSON(url);
  return (j.results ?? []).map((r: any): Paper => {
    const b = r.bibjson ?? {};
    const doi = (b.identifier ?? []).find((i: any) => i.type === "doi")?.id ?? null;
    return {
      title: clip(b.title, 400) ?? "",
      authors: (b.author ?? []).map((a: any) => a.name).filter(Boolean),
      year: b.year ? Number(b.year) : null,
      doi,
      venue: b.journal?.title ?? null,
      abstract: clip(b.abstract),
      url: (b.link ?? [])[0]?.url ?? (doi ? `https://doi.org/${doi}` : null),
      pdf_url: null,
      citations: null,
      source: "doaj",
    };
  });
}

// ---------- server ----------

// Harus sama dengan "version" di manifest.json — build-mcpb.sh menolak bila berbeda.
const SERVER_VERSION = "0.8.0";
const server = new McpServer({ name: "scholar-nulis", version: SERVER_VERSION });

// Bypass tipe untuk server.tool: kombinasi SDK 1.29 + zod 3.25 memicu TS2589
// (instansiasi tipe terlalu dalam) di setiap call site. Validasi runtime zod tetap utuh.
type ToolResult = ReturnType<typeof ok> | ReturnType<typeof fail>;

// ── Awalan nama tool ──────────────────────────────────────────────────────
// Claude Desktop menampilkan nama tool secara RATA: tidak ada ruang nama per
// server seperti "mcp__scholar__" di Claude Code. Dua ekstensi yang sama-sama
// mendaftarkan "search_arxiv" karena itu saling bertabrakan, dan yang menang
// tidak dapat diprediksi.
//
// Awalan ditambahkan DI SATU TEMPAT, bukan ditulis ulang di tiap pemanggilan
// tool() — supaya mustahil ada yang terlewat. Nama di dalam kode tetap pendek;
// yang tampil ke luar selalu berawalan.
const PREFIX = "nulis_";
const tool = (name: string, desc: string, shape: z.ZodRawShape, cb: (args: any) => Promise<ToolResult>) =>
  (server.tool as Function)(PREFIX + name, desc, shape, cb);

const qShape = {
  query: z.string().describe("Kata kunci pencarian"),
  max_results: z.number().int().min(1).max(50).default(10).describe("Jumlah hasil maksimal"),
};

function searchTool(name: string, desc: string, fn: (q: string, n: number) => Promise<Paper[]>) {
  // TS2589 (inferensi terlalu dalam) pada kombinasi SDK 1.29 + zod 3.25 — validasi runtime tetap utuh.
  tool(name, desc, qShape, async ({ query, max_results }: { query: string; max_results: number }) => {
    try {
      const papers = await fn(query, max_results);
      return ok({ count: papers.length, papers });
    } catch (e) {
      return fail(e);
    }
  });
}

searchTool("search_arxiv", "Cari paper di arXiv (preprint sains/teknik).", searchArxiv);
searchTool("search_crossref", "Cari paper di Crossref (metadata DOI lintas penerbit).", searchCrossref);
searchTool("search_pubmed", "Cari paper di PubMed (biomedis/kesehatan).", searchPubmed);
searchTool("search_europepmc", "Cari paper di Europe PMC (biomedis, termasuk abstrak & link OA).", searchEuropePmc);
searchTool("search_doaj", "Cari artikel di DOAJ (jurnal open access).", searchDoaj);

tool(
  "search_openalex",
  "Cari paper di OpenAlex (indeks ilmiah terbuka terbesar, semua bidang; mendukung filter tahun).",
  { ...qShape, year_from: z.number().int().optional().describe("Tahun terbit minimal"), year_to: z.number().int().optional().describe("Tahun terbit maksimal") },
  async ({ query, max_results, year_from, year_to }) => {
    try {
      const papers = await searchOpenalex(query, max_results, year_from, year_to);
      return ok({ count: papers.length, papers });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "search_semantic_scholar",
  "Cari paper di Semantic Scholar (semua bidang, dengan jumlah sitasi & link PDF open access).",
  { ...qShape, year_from: z.number().int().optional().describe("Tahun terbit minimal") },
  async ({ query, max_results, year_from }) => {
    try {
      const papers = await searchSemantic(query, max_results, year_from);
      return ok({ count: papers.length, papers });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "get_paper_by_doi",
  "Ambil metadata terverifikasi sebuah paper dari Crossref berdasarkan DOI — gunakan untuk verifikasi eksistensi referensi (anti-fabrikasi).",
  { doi: z.string().describe("DOI, mis. 10.1000/xyz123") },
  async ({ doi }) => {
    try {
      const clean = doi.replace(/^https?:\/\/doi\.org\//, "").trim();
      const j = await getJSON(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
      const msg = j.message ?? {};
      const paper = crossrefToPaper(msg);

      // Status retraksi: Crossref menandainya lewat update-to (relasi antar-karya) DAN
      // sering pula lewat awalan judul. Diperiksa keduanya — record lama kerap hanya
      // punya penanda judul, sedangkan record baru hanya punya update-to.
      const updates = (msg["update-to"] ?? []) as Array<{ type?: string; label?: string; DOI?: string; updated?: any }>;
      const flagRelasi = updates.filter((u) =>
        /retraction|withdrawal|removal|concern/i.test(`${u.type ?? ""} ${u.label ?? ""}`)
      );
      const judul = (paper.title ?? "").toString();
      const flagJudul = /^\s*(RETRACTED|WITHDRAWN|RETRACTION)\b/i.test(judul);
      const dicabut = flagRelasi.length > 0 || flagJudul;

      return ok({
        verified: true,
        retracted: dicabut,
        retraction_evidence: dicabut
          ? {
              dari_relasi: flagRelasi.map((u) => ({ tipe: u.type, label: u.label, doi_pemberitahuan: u.DOI })),
              dari_judul: flagJudul ? judul.slice(0, 120) : null,
            }
          : null,
        peringatan: dicabut
          ? "STUDI INI DICABUT (retracted) atau diberi expression of concern. Jangan disintesis. " +
            "Bila tetap dibahas karena alasan tertentu, nyatakan statusnya secara eksplisit di teks."
          : null,
        paper,
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("HTTP 404")) return ok({ verified: false, doi, note: "DOI tidak ditemukan di Crossref — tandai [VERIFY]." });
      return fail(e);
    }
  }
);

tool(
  "get_open_access_pdf",
  "Cari link PDF open access legal untuk sebuah DOI (Unpaywall bila email kontak diisi, fallback OpenAlex).",
  { doi: z.string().describe("DOI paper") },
  async ({ doi }) => {
    try {
      const clean = doi.replace(/^https?:\/\/doi\.org\//, "").trim();
      if (contactEmail()) {
        try {
          const j = await getJSON(`https://api.unpaywall.org/v2/${encodeURIComponent(clean)}?email=${encodeURIComponent(contactEmail())}`);
          const best = j.best_oa_location;
          if (best?.url_for_pdf || best?.url)
            return ok({ found: true, via: "unpaywall", pdf_url: best.url_for_pdf ?? best.url, oa_status: j.oa_status ?? null, license: best.license ?? null });
        } catch { /* lanjut ke OpenAlex */ }
      }
      const w = await getJSON(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(clean)}${contactEmail() ? `?mailto=${encodeURIComponent(contactEmail())}` : ""}`);
      if (w.open_access?.oa_url) return ok({ found: true, via: "openalex", pdf_url: w.open_access.oa_url, oa_status: w.open_access.oa_status ?? null });
      return ok({ found: false, doi: clean, note: "Tidak ada versi open access yang terdeteksi." });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "download_pdf",
  "Unduh file PDF dari URL ke folder unduhan lokal.",
  { url: z.string().url().describe("URL PDF"), filename: z.string().optional().describe("Nama file tujuan (opsional)") },
  async ({ url, filename }) => {
    try {
      return ok(await savePdf(url, filename ?? path.basename(new URL(url).pathname) ?? "paper.pdf"));
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "download_arxiv",
  "Unduh PDF sebuah paper arXiv berdasarkan ID (mis. 2401.12345).",
  { arxiv_id: z.string().describe("ID arXiv, mis. 2401.12345 atau cs/0301012") },
  async ({ arxiv_id }) => {
    try {
      return ok(await savePdf(`https://arxiv.org/pdf/${arxiv_id}`, `arxiv_${arxiv_id.replace("/", "_")}.pdf`));
    } catch (e) {
      return fail(e);
    }
  }
);

const readShape = {
  max_chars: z.number().int().min(500).max(200_000).default(40_000).describe("Maksimal karakter teks yang dikembalikan"),
  start_char: z.number().int().min(0).default(0).describe("Posisi awal (untuk membaca lanjutan)"),
};

tool(
  "read_arxiv_paper",
  "Ambil dan baca teks penuh paper arXiv (ekstraksi teks dari PDF).",
  { arxiv_id: z.string().describe("ID arXiv"), ...readShape },
  async ({ arxiv_id, max_chars, start_char }) => {
    try {
      const { data } = await getBinary(`https://arxiv.org/pdf/${arxiv_id}`);
      return ok({ arxiv_id, ...windowText(await extractPdfText(data), start_char, max_chars) });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "read_pdf",
  "Ekstrak teks dari sebuah PDF — dari URL atau file lokal (mis. hasil download_pdf).",
  { source: z.string().describe("URL PDF atau path file lokal absolut"), ...readShape },
  async ({ source, max_chars, start_char }) => {
    try {
      const data = /^https?:\/\//.test(source) ? (await getBinary(source)).data : new Uint8Array(fs.readFileSync(source));
      return ok({ source, ...windowText(await extractPdfText(data), start_char, max_chars) });
    } catch (e) {
      return fail(e);
    }
  }
);

/** Cari tautan PDF open access untuk satu DOI. Dipakai bersama oleh tool tunggal dan batch. */
async function cariOaPdf(doi: string): Promise<{ found: boolean; via?: string; pdf_url?: string; oa_status?: string | null }> {
  const clean = doi.replace(/^https?:\/\/doi\.org\//, "").trim();
  if (contactEmail()) {
    try {
      const j = await getJSON(`https://api.unpaywall.org/v2/${encodeURIComponent(clean)}?email=${encodeURIComponent(contactEmail())}`);
      const best = j.best_oa_location;
      if (best?.url_for_pdf || best?.url)
        return { found: true, via: "unpaywall", pdf_url: best.url_for_pdf ?? best.url, oa_status: j.oa_status ?? null };
    } catch {
      /* lanjut ke OpenAlex */
    }
  }
  const w = await getJSON(
    `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(clean)}${contactEmail() ? `?mailto=${encodeURIComponent(contactEmail())}` : ""}`
  );
  if (w.open_access?.oa_url) return { found: true, via: "openalex", pdf_url: w.open_access.oa_url, oa_status: w.open_access.oa_status ?? null };
  return { found: false };
}

tool(
  "batch_acquire_pdfs",
  "Coba unduh PDF untuk SEKUMPULAN studi sekaligus (daftar INCLUDED hasil screening title/abstract). " +
    "Menyimpan yang berhasil ke subfolder pdfs/, lalu menulis laporan akuisisi berisi daftar studi yang " +
    "HARUS diunduh manual beserta alasannya. Dijalankan sekali sebagai penutup Tahap 5 / pembuka Tahap 6, " +
    "sebelum penilaian teks lengkap dimulai.",
  {
    records: z
      .array(
        z.object({
          id: z.string().optional().describe("ID record pada screening.xlsx"),
          doi: z.string().optional().describe("DOI studi"),
          label: z.string().optional().describe("Label singkat, mis. 'Chen 2019'"),
          url: z.string().optional().describe("URL PDF langsung bila sudah diketahui (melewati pencarian OA)"),
          title: z.string().optional().describe("Judul, dipakai pada laporan bila DOI tidak ada"),
        })
      )
      .min(1)
      .max(300)
      .describe("Daftar studi INCLUDED yang akan diakuisisi"),
    laporan: z.string().default("acquisition_report.md").describe("Nama berkas laporan di folder unduhan"),
  },
  async ({ records, laporan }) => {
    try {
      const dir = path.join(downloadDir(), "pdfs");
      fs.mkdirSync(dir, { recursive: true });

      type Hasil = { id?: string; label: string; doi?: string; status: string; file?: string; via?: string; alasan?: string };
      const hasil: Hasil[] = [];

      for (const r of records) {
        const label = r.label || r.id || r.doi || r.title || "tanpa-label";
        const namaFile = safeName(r.label || r.id || (r.doi ?? "studi").replace(/[/.]/g, "_"));
        try {
          let url = r.url;
          let via = url ? "url_langsung" : undefined;
          if (!url) {
            if (!r.doi) {
              hasil.push({ ...r, label, status: "MANUAL", alasan: "Tidak ada DOI maupun URL — telusuri manual dari judul." });
              continue;
            }
            let oa: Awaited<ReturnType<typeof cariOaPdf>>;
            try {
              oa = await cariOaPdf(r.doi);
            } catch (e) {
              const pesan = e instanceof Error ? e.message : String(e);
              hasil.push({
                ...r,
                label,
                status: "MANUAL",
                alasan: pesan.includes("404")
                  ? "DOI tidak ditemukan di OpenAlex/Unpaywall — periksa ulang penulisannya."
                  : `Pencarian open access gagal — ${pesan.slice(0, 100)}`,
              });
              continue;
            }
            if (!oa.found) {
              hasil.push({ ...r, label, status: "MANUAL", alasan: "Tidak ada versi open access terdeteksi (kemungkinan berbayar)." });
              continue;
            }
            url = oa.pdf_url;
            via = oa.via;
          }
          const simpan = await savePdf(url!, path.join("pdfs", namaFile));
          hasil.push({ ...r, label, status: "OK", file: String(simpan.saved_to), via });
        } catch (e) {
          hasil.push({ ...r, label, status: "MANUAL", alasan: `Unduhan gagal — ${e instanceof Error ? e.message.slice(0, 120) : String(e)}` });
        }
      }

      const ok_ = hasil.filter((h) => h.status === "OK");
      const manual = hasil.filter((h) => h.status === "MANUAL");
      const baris = (h: Hasil) => `| ${h.id ?? ""} | ${h.label} | ${h.doi ?? "—"} | ${h.alasan ?? h.file ?? ""} |`;
      const isi =
        `# Laporan Akuisisi Teks Lengkap\n\n` +
        `Tanggal: ${new Date().toISOString().slice(0, 10)}\n` +
        `Diminta: ${records.length} · Terunduh otomatis: ${ok_.length} · **Perlu unduh manual: ${manual.length}**\n\n` +
        `Berkas tersimpan di: \`${dir}\`\n\n` +
        `## Perlu diunduh manual (${manual.length})\n\n` +
        (manual.length
          ? `Jalur manual sesuai bidang: repositori institusi penulis, Garuda/Moraref/SINTA untuk korpus Indonesia,\n` +
            `ResearchGate/SSRN, permintaan langsung ke penulis, atau langganan perpustakaan kampus.\n` +
            `Simpan hasil unduhan ke folder \`pdfs/\` dengan nama sesuai kolom Label.\n\n` +
            `| ID | Label | DOI | Alasan |\n|---|---|---|---|\n${manual.map(baris).join("\n")}\n`
          : `Tidak ada — seluruh studi berhasil diakuisisi otomatis.\n`) +
        `\n## Terunduh otomatis (${ok_.length})\n\n` +
        (ok_.length ? `| ID | Label | DOI | Berkas |\n|---|---|---|---|\n${ok_.map(baris).join("\n")}\n` : `Tidak ada.\n`) +
        `\n---\n\n` +
        `**Untuk diagram PRISMA.** Studi yang tetap tidak terjangkau setelah seluruh jalur manual dicoba\n` +
        `dihitung sebagai *reports not retrieved* — kotak tersendiri pada PRISMA 2020, bukan reason code\n` +
        `eksklusi. Laporan ini belum final sampai jalur manual dikerjakan; perbarui statusnya setelah itu.\n`;

      const fileLaporan = path.join(downloadDir(), safeName(laporan.endsWith(".md") ? laporan : laporan + ".md"));
      fs.writeFileSync(fileLaporan, isi, "utf8");

      return ok({
        diminta: records.length,
        terunduh_otomatis: ok_.length,
        perlu_manual: manual.length,
        folder_pdf: dir,
        laporan: fileLaporan,
        daftar_manual: manual.map((h) => ({ id: h.id, label: h.label, doi: h.doi, alasan: h.alasan })),
        catatan:
          manual.length > 0
            ? `${manual.length} studi perlu diunduh manual — daftar lengkap beserta alasannya ada di berkas laporan. ` +
              `Jangan lanjut ke penilaian teks lengkap sebelum status tiap studi jelas.`
            : "Seluruh studi terakuisisi otomatis.",
      });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "pdf_to_text",
  "Ekstrak teks sebuah PDF lalu SIMPAN sebagai berkas .md di folder unduhan (subfolder fulltext/). " +
    "Berbeda dengan read_pdf yang hanya menampilkan teks sekali pakai: berkas hasil tool ini bertahan, " +
    "dapat dibaca berulang tanpa mengunduh ulang, dan menjadi sumber yang dapat ditelusuri saat mengutip " +
    "di ekstraksi. Header berkas memuat sumber dan tanggal akses.",
  {
    source: z.string().describe("URL PDF atau path file lokal absolut (mis. hasil download_pdf)"),
    save_as: z.string().optional().describe("Nama berkas tujuan tanpa ekstensi (opsional; default dari nama sumber)"),
    label: z.string().optional().describe("Label studi untuk header berkas, mis. 'Chen 2019' atau ID record"),
    doi: z.string().optional().describe("DOI studi, dicatat di header untuk penelusuran"),
  },
  async ({ source, save_as, label, doi }) => {
    try {
      const data = /^https?:\/\//.test(source)
        ? (await getBinary(source)).data
        : new Uint8Array(fs.readFileSync(source));
      const teks = await extractPdfText(data);

      const dir = path.join(downloadDir(), "fulltext");
      fs.mkdirSync(dir, { recursive: true });
      const dasar = safeName(save_as || path.basename(source).replace(/\.pdf$/i, "") || "fulltext");
      const out = path.join(dir, `${dasar}.md`);

      const header =
        `---\n` +
        (label ? `studi: ${label}\n` : "") +
        (doi ? `doi: ${doi}\n` : "") +
        `sumber: ${source}\n` +
        `diakses: ${new Date().toISOString().slice(0, 10)}\n` +
        `jumlah_karakter: ${teks.length}\n` +
        `---\n\n`;
      fs.writeFileSync(out, header + teks, "utf8");

      return ok({
        file: out,
        total_chars: teks.length,
        preview: teks.slice(0, 500),
        catatan:
          teks.length < 1000
            ? "Teks sangat pendek — PDF kemungkinan hasil pindaian (gambar) tanpa lapisan teks. " +
              "Perlu OCR, atau cari versi lain dari artikel ini."
            : "Baca berkas ini dengan read_pdf tidak diperlukan — isinya sudah berupa teks biasa.",
      });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "server_status",
  "Diagnostik server: versi yang sedang berjalan, folder tempat PDF akan disimpan, dan fitur opsional yang aktif. " +
    "Jalankan ini lebih dulu bila unduhan gagal atau bila ragu versi mana yang terpasang.",
  {},
  async () => {
    const out: Record<string, unknown> = { versi: SERVER_VERSION };
    try {
      out.folder_unduhan = { path: downloadDir(), dapat_ditulisi: true };
    } catch (e) {
      out.folder_unduhan = { dapat_ditulisi: false, pesan: e instanceof Error ? e.message : String(e) };
    }
    const mentah = (process.env.DOWNLOAD_DIR ?? "").trim();
    out.konfigurasi = {
      download_dir_diterima: mentah || "(kosong)",
      placeholder_terdeteksi: mentah.includes("${") || mentah.includes("DOWNLOADS"),
      email_kontak_aktif: Boolean(contactEmail()),
      scopus_aktif: hasScopusKey(),
      sciencedirect_aktif: hasSdKey(),
    };
    out.catatan =
      "Bila placeholder_terdeteksi bernilai true, nilai dari kolom konfigurasi tidak tersubstitusi oleh klien — " +
      "server mengabaikannya dan memakai folder cadangan. Isi 'Folder unduhan PDF' dengan path absolut bila ingin folder khusus.";
    return ok(out);
  }
);

// ---------------------------------------------------------------------------
// Elsevier — Scopus & ScienceDirect (butuh kunci API institusional)
//
// Tool di bawah HANYA didaftarkan bila kunci Elsevier terpasang. Tanpa kunci,
// tool ini tidak muncul sama sekali di daftar tool — pengguna tanpa langganan
// Scopus tidak melihat perkakas yang pasti gagal, dan tidak tergoda memakainya.
// Sisa server (arXiv, OpenAlex, Crossref, PubMed, Europe PMC, DOAJ, Unpaywall)
// tetap berfungsi penuh tanpa kunci apa pun.
// ---------------------------------------------------------------------------

const ELSEVIER_AKTIF = hasScopusKey() || hasSdKey();

if (ELSEVIER_AKTIF) {

tool(
  "search_scopus",
  "Cari di Scopus memakai sintaks query Scopus asli (TITLE-ABS-KEY, AND/OR/NOT, W/n, PUBYEAR, DOCTYPE, LANGUAGE, SRCTYPE). " +
    "Query diteruskan apa adanya tanpa diterjemahkan, sehingga search string yang dilaporkan di manuskrip identik dengan yang dieksekusi. " +
    "Mengembalikan total hits (angka untuk kotak identifikasi PRISMA), metadata per record, dan sisa kuota kunci. Butuh Scopus API key.",
  {
    query: z
      .string()
      .describe('Query sintaks Scopus, mis: TITLE-ABS-KEY("islamic contract" W/3 freedom) AND PUBYEAR > 2014 AND DOCTYPE(ar)'),
    max_results: z.number().int().min(1).max(25).default(25).describe("Jumlah record per halaman (maks 25)"),
    start: z.number().int().min(0).default(0).describe("Offset paginasi — untuk mengambil halaman berikutnya"),
    view: z.enum(["STANDARD", "COMPLETE"]).optional().describe("COMPLETE memuat lebih banyak field, menuntut hak akses lebih tinggi"),
    sort: z.string().optional().describe("Urutan, mis. -citedby-count atau +coverDate"),
  },
  async ({ query, max_results, start, view, sort }) => {
    try {
      const r = await searchScopus(query, max_results, { start, view, sort });
      return ok({
        ...r,
        catatan:
          r.total > r.start + r.returned
            ? `Menampilkan ${r.start + 1}–${r.start + r.returned} dari ${r.total}. Ulangi dengan start=${r.start + r.returned} untuk halaman berikutnya.`
            : "Seluruh hasil sudah terambil.",
      });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "scopus_abstract",
  "Ambil abstrak lengkap + kata kunci penulis + jumlah sitasi dari Scopus Abstract Retrieval, berdasarkan DOI atau Scopus ID. " +
    "Dipakai untuk melengkapi record yang abstraknya kosong pada hasil pencarian.",
  { id: z.string().describe("DOI (mis. 10.1108/IMEFM-01-2020-0038) atau Scopus ID") },
  async ({ id }) => {
    try {
      return ok(await scopusAbstract(id));
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "sciencedirect_fulltext",
  "Ambil teks lengkap artikel ScienceDirect berdasarkan DOI. Hanya untuk konten yang dilanggan institusi Anda; " +
    "artikel di luar langganan mengembalikan galat akses. Untuk artikel non-Elsevier gunakan get_open_access_pdf.",
  {
    doi: z.string().describe("DOI artikel Elsevier/ScienceDirect"),
    simpan: z
      .boolean()
      .default(false)
      .describe("Simpan teks lengkap sebagai berkas .md di folder unduhan (subfolder fulltext/) agar dapat dibaca ulang"),
    label: z.string().optional().describe("Label studi untuk header berkas, mis. 'Chen 2019'"),
  },
  async ({ doi, simpan, label }) => {
    try {
      const hasil = await sciencedirectFulltext(doi);
      if (simpan && hasil.fulltext) {
        const dir = path.join(downloadDir(), "fulltext");
        fs.mkdirSync(dir, { recursive: true });
        const out = path.join(dir, `${safeName(label || doi)}.md`);
        const header =
          `---\n` +
          (label ? `studi: ${label}\n` : "") +
          `doi: ${hasil.doi}\n` +
          `judul: ${hasil.title ?? ""}\n` +
          `jurnal: ${hasil.journal ?? ""} ${hasil.year ?? ""}\n` +
          `sumber: ScienceDirect API\n` +
          `diakses: ${new Date().toISOString().slice(0, 10)}\n` +
          `jumlah_karakter: ${hasil.fulltext_chars}\n` +
          `---\n\n`;
        fs.writeFileSync(out, header + hasil.fulltext, "utf8");
        return ok({ ...hasil, fulltext: undefined, file: out, catatan: "Teks lengkap disimpan; field fulltext dihilangkan dari keluaran agar ringkas." });
      }
      return ok(hasil);
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "scopus_export_csv",
  "Jalankan query Scopus, kumpulkan seluruh halaman, lalu simpan sebagai CSV siap-screening (kolom ID, Source_DB, Authors, Year, " +
    "Title, Abstract, Keywords, DOI, Journal, DocType, CitedBy). Melaporkan jumlah record yang abstraknya kosong — export tanpa " +
    "abstrak membuat screening title/abstract tidak punya bahan.",
  {
    query: z.string().describe("Query sintaks Scopus"),
    max_records: z.number().int().min(1).max(2000).default(200).describe("Batas total record yang diambil"),
    filename: z.string().default("scopus_export.csv").describe("Nama file CSV di folder unduhan"),
    fetch_abstracts: z
      .boolean()
      .default(false)
      .describe("Ambil abstrak satu per satu via Abstract Retrieval bila kosong (lambat, memakan kuota)"),
  },
  async ({ query, max_records, filename, fetch_abstracts }) => {
    try {
      const all: ScopusRecord[] = [];
      let start = 0;
      let total = 0;
      let quota: any = {};
      while (all.length < max_records) {
        const r = await searchScopus(query, 25, { start });
        total = r.total;
        quota = r.quota;
        if (!r.records.length) break;
        all.push(...r.records);
        start += r.returned;
        if (start >= total) break;
      }
      const records = all.slice(0, max_records);

      const abstracts = new Map<string, string>();
      if (fetch_abstracts) {
        for (const rec of records) {
          if (!rec.doi) continue;
          try {
            const a = await scopusAbstract(rec.doi);
            if (a.abstract) abstracts.set(rec.doi, a.abstract);
          } catch {
            /* lewati record yang gagal; dilaporkan lewat hitungan abstrak kosong */
          }
        }
      }

      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const cols = ["ID", "Source_DB", "Authors", "Year", "Title", "Abstract", "Keywords", "DOI", "Journal", "DocType", "CitedBy"];
      const rows = records.map((r, i) =>
        [
          i + 1,
          "Scopus",
          r.authors,
          r.year,
          r.title,
          (r.doi && abstracts.get(r.doi)) || "",
          "",
          r.doi ?? "",
          r.journal,
          r.document_type ?? "",
          r.cited_by ?? "",
        ]
          .map(esc)
          .join(",")
      );
      const outPath = path.join(downloadDir(), filename);
      fs.writeFileSync(outPath, "\uFEFF" + [cols.join(","), ...rows].join("\n"), "utf8");

      const kosong = records.filter((r) => !(r.doi && abstracts.get(r.doi))).length;
      return ok({
        query,
        total_hits_scopus: total,
        records_diambil: records.length,
        file: outPath,
        abstrak_kosong: kosong,
        kuota: quota,
        peringatan:
          kosong > 0
            ? `${kosong} record tanpa abstrak. Scopus Search API tidak mengembalikan abstrak pada view STANDARD — ` +
              `jalankan ulang dengan fetch_abstracts=true, atau lengkapi dari export manual scopus.com. ` +
              `Screening title/abstract tidak dapat dijalankan atas record tanpa abstrak.`
            : null,
        catatan_prisma: `Angka identifikasi PRISMA untuk Scopus = ${total} (total hits), bukan ${records.length} (yang terambil).`,
      });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "elsevier_status",
  "Periksa apakah kunci Scopus/ScienceDirect terpasang dan berfungsi, beserta sisa kuota. Jalankan ini sebelum memulai tahap pencarian.",
  {},
  async () => {
    const out: Record<string, unknown> = {
      scopus_key_terpasang: hasScopusKey(),
      sciencedirect_key_terpasang: hasSdKey(),
      insttoken_terpasang: Boolean(process.env.ELSEVIER_INSTTOKEN?.trim()),
    };
    if (hasScopusKey() || hasSdKey()) {
      try {
        out.hak_akses = await probeEntitlements();
      } catch (e) {
        out.hak_akses = { galat: e instanceof Error ? e.message : String(e) };
      }
    }
    out.catatan = [
      "Kunci Elsevier dapat berhak atas satu API dan ditolak pada yang lain — periksa hak_akses per API, bukan sekadar apakah kunci terpasang.",
      "abstract_retrieval yang membalas ok:true tetapi abstrak_terisi:false berarti view META_ABS di luar hak akses kunci ini (lazim di luar jaringan institusi); abstrak tetap dapat diambil lewat article_retrieval untuk DOI Elsevier (10.1016).",
      "401/403 saat kunci valid biasanya berarti permintaan dari luar jaringan institusi — jalankan dari jaringan kampus/VPN, atau minta insttoken ke admin lisensi.",
    ];
    return ok(out);
  }
);

} // akhir blok ELSEVIER_AKTIF

async function main() {
  await server.connect(new StdioServerTransport());
  console.error("scholar-nulis (node) ready");
}
main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
