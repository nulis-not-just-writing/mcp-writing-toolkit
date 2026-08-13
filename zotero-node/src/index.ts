import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const USE_LOCAL = (process.env.ZOTERO_LOCAL ?? "true").toLowerCase() !== "false";
const API_KEY = process.env.ZOTERO_API_KEY?.trim() || "";
const LIBRARY_ID = process.env.ZOTERO_LIBRARY_ID?.trim() || "0";
const LIBRARY_TYPE = (process.env.ZOTERO_LIBRARY_TYPE?.trim() || "user") === "group" ? "groups" : "users";

const BASE = USE_LOCAL
  ? `http://127.0.0.1:23119/api/users/0`
  : `https://api.zotero.org/${LIBRARY_TYPE}/${LIBRARY_ID}`;

async function zfetch(pathname: string, accept: "json" | "text" = "json"): Promise<any> {
  const headers: Record<string, string> = { "Zotero-API-Version": "3" };
  if (!USE_LOCAL && API_KEY) headers["Zotero-API-Key"] = API_KEY;
  let res: Response;
  try {
    res = await fetch(`${BASE}${pathname}`, { headers, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    if (USE_LOCAL)
      throw new Error(
        "Tidak bisa terhubung ke Zotero lokal (127.0.0.1:23119). Pastikan aplikasi Zotero 7+ sedang berjalan dan opsi Settings → Advanced → 'Allow other applications on this computer to communicate with Zotero' dicentang."
      );
    throw e;
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Zotero API HTTP ${res.status} — ${pathname}`);
  return accept === "json" ? res.json() : res.text();
}

interface Item {
  key: string;
  item_type: string;
  title: string | null;
  creators: string[];
  date: string | null;
  doi: string | null;
  publication: string | null;
  url: string | null;
  abstract: string | null;
  tags: string[];
}

const clip = (s: string | null | undefined, n = 1200): string | null => {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t || null;
};

function toItem(raw: any): Item {
  const d = raw?.data ?? raw ?? {};
  return {
    key: d.key,
    item_type: d.itemType,
    title: d.title ?? null,
    creators: (d.creators ?? [])
      .map((c: any) => c.name ?? [c.firstName, c.lastName].filter(Boolean).join(" "))
      .filter(Boolean),
    date: d.date ?? null,
    doi: d.DOI ?? null,
    publication: d.publicationTitle ?? d.bookTitle ?? d.proceedingsTitle ?? null,
    url: d.url ?? null,
    abstract: clip(d.abstractNote),
    tags: (d.tags ?? []).map((t: any) => t.tag).filter(Boolean),
  };
}

const ok = (payload: unknown) => ({
  content: [{ type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }],
});
const fail = (e: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

function windowText(text: string, startChar: number, maxChars: number) {
  const chunk = text.slice(startChar, startChar + maxChars);
  return {
    total_chars: text.length,
    start_char: startChar,
    returned_chars: chunk.length,
    has_more: startChar + chunk.length < text.length,
    text: chunk,
  };
}

// Versi harus sama dengan "version" di manifest.json — build-mcpb.sh menolak bila berbeda.
const server = new McpServer({ name: "zotero-mcp", version: "0.5.0" });

// Bypass tipe untuk server.tool: kombinasi SDK 1.29 + zod 3.25 memicu TS2589 di call site.
// Validasi runtime zod tetap utuh.
type ToolResult = ReturnType<typeof ok> | ReturnType<typeof fail>;
const tool = (name: string, desc: string, shape: z.ZodRawShape, cb: (args: any) => Promise<ToolResult>) =>
  (server.tool as Function)(name, desc, shape, cb);

tool(
  "zotero_search_items",
  "Cari item di pustaka Zotero berdasarkan kata kunci (judul/penulis/tahun, atau seluruh isi).",
  {
    query: z.string().describe("Kata kunci pencarian"),
    qmode: z.enum(["titleCreatorYear", "everything"]).default("titleCreatorYear").describe("Cakupan pencarian"),
    limit: z.number().int().min(1).max(100).default(20),
  },
  async ({ query, qmode, limit }) => {
    try {
      const j = await zfetch(`/items?q=${encodeURIComponent(query)}&qmode=${qmode}&limit=${limit}&itemType=-attachment`);
      const items = (j ?? []).map(toItem);
      return ok({ count: items.length, items });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "zotero_get_item_metadata",
  "Ambil metadata lengkap satu item Zotero (JSON) atau sitasi BibTeX-nya.",
  {
    item_key: z.string().describe("Key item Zotero (8 karakter)"),
    format: z.enum(["json", "bibtex"]).default("json"),
  },
  async ({ item_key, format }) => {
    try {
      if (format === "bibtex") {
        const bib = await zfetch(`/items/${item_key}?format=bibtex`, "text");
        return bib == null ? ok({ found: false, item_key }) : ok(String(bib).trim());
      }
      const j = await zfetch(`/items/${item_key}`);
      return j == null ? ok({ found: false, item_key }) : ok({ found: true, item: toItem(j), raw_fields: j.data });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "zotero_get_item_fulltext",
  "Ambil teks penuh sebuah item (dari indeks fulltext Zotero; otomatis mencoba lampiran PDF anaknya).",
  {
    item_key: z.string().describe("Key item Zotero"),
    max_chars: z.number().int().min(500).max(200_000).default(40_000),
    start_char: z.number().int().min(0).default(0),
  },
  async ({ item_key, max_chars, start_char }) => {
    try {
      let ft = await zfetch(`/items/${item_key}/fulltext`);
      let from = item_key;
      if (!ft?.content) {
        const children = (await zfetch(`/items/${item_key}/children`)) ?? [];
        for (const ch of children) {
          if (ch?.data?.itemType !== "attachment") continue;
          ft = await zfetch(`/items/${ch.data.key}/fulltext`);
          if (ft?.content) {
            from = ch.data.key;
            break;
          }
        }
      }
      if (!ft?.content)
        return ok({ found: false, item_key, note: "Tidak ada teks penuh terindeks untuk item ini (cek apakah PDF-nya sudah diindeks Zotero)." });
      return ok({ found: true, item_key, attachment_key: from, ...windowText(String(ft.content), start_char, max_chars) });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "zotero_get_item_children",
  "Daftar lampiran (PDF dsb.) dan catatan milik sebuah item.",
  { item_key: z.string().describe("Key item Zotero") },
  async ({ item_key }) => {
    try {
      const j = (await zfetch(`/items/${item_key}/children`)) ?? [];
      return ok(
        j.map((c: any) => ({
          key: c.data?.key,
          item_type: c.data?.itemType,
          title: c.data?.title ?? null,
          content_type: c.data?.contentType ?? null,
          note_preview: clip(c.data?.note?.replace(/<[^>]+>/g, " "), 300),
        }))
      );
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "zotero_list_collections",
  "Daftar koleksi (folder) di pustaka Zotero.",
  { limit: z.number().int().min(1).max(200).default(100) },
  async ({ limit }) => {
    try {
      const j = (await zfetch(`/collections?limit=${limit}`)) ?? [];
      return ok(
        j.map((c: any) => ({ key: c.data?.key, name: c.data?.name, parent: c.data?.parentCollection || null, items: c.meta?.numItems ?? null }))
      );
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "zotero_get_collection_items",
  "Daftar item di dalam sebuah koleksi.",
  { collection_key: z.string().describe("Key koleksi"), limit: z.number().int().min(1).max(100).default(30) },
  async ({ collection_key, limit }) => {
    try {
      const j = (await zfetch(`/collections/${collection_key}/items/top?limit=${limit}`)) ?? [];
      const items = j.map(toItem);
      return ok({ count: items.length, items });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "zotero_get_recent",
  "Item yang terakhir ditambahkan ke pustaka.",
  { limit: z.number().int().min(1).max(100).default(15) },
  async ({ limit }) => {
    try {
      const j = (await zfetch(`/items/top?sort=dateAdded&direction=desc&limit=${limit}`)) ?? [];
      const items = j.map(toItem);
      return ok({ count: items.length, items });
    } catch (e) {
      return fail(e);
    }
  }
);

tool(
  "zotero_export_bibtex",
  "Ekspor satu atau beberapa item sebagai BibTeX (untuk daftar pustaka).",
  { item_keys: z.array(z.string()).min(1).max(50).describe("Daftar key item") },
  async ({ item_keys }) => {
    try {
      const bib = await zfetch(`/items?itemKey=${item_keys.join(",")}&format=bibtex`, "text");
      return ok(String(bib ?? "").trim() || "(kosong — periksa item keys)");
    } catch (e) {
      return fail(e);
    }
  }
);

async function main() {
  await server.connect(new StdioServerTransport());
  console.error(`zotero-mcp (node) ready — mode: ${USE_LOCAL ? "local" : `web (${LIBRARY_TYPE}/${LIBRARY_ID})`}`);
}
main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
