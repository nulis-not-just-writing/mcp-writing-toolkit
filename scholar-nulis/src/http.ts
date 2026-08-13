// Email kontak hanya dipakai bila benar-benar berupa alamat email. Kolom user_config yang
// dikosongkan dapat sampai sebagai teks pengganti ("${user_config.contact_email}"); bila
// diteruskan apa adanya, teks itu terkirim ke Unpaywall/Crossref sebagai alamat email dan
// permintaan ditolak.
const CONTACT = (() => {
  const v = (process.env.CONTACT_EMAIL ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
})();
const UA = `scholar-nulis/0.7 (${CONTACT ? `mailto:${CONTACT}` : "https://github.com/nulis-not-just-writing/mcp-writing-toolkit"})`;

// Jeda minimum antar request per host (ms) — hormati polite pool tiap API.
const MIN_GAP: Record<string, number> = {
  "export.arxiv.org": 3000,
  "eutils.ncbi.nlm.nih.gov": 400,
  "api.semanticscholar.org": 1100,
  "api.crossref.org": 350,
  "api.openalex.org": 250,
  "api.unpaywall.org": 250,
  "www.ebi.ac.uk": 250,
  "doaj.org": 400,
};
const lastAt = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function politeFetch(url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const host = new URL(url).host;
  const gap = MIN_GAP[host] ?? 300;
  const wait = (lastAt.get(host) ?? 0) + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastAt.set(host, Date.now());

  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", UA);
  const res = await fetch(url, { ...init, headers, redirect: "follow", signal: AbortSignal.timeout(60_000) });
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    const retryAfter = Number(res.headers.get("retry-after")) || 0;
    await sleep(Math.max(retryAfter * 1000, 2000 * (attempt + 1)));
    return politeFetch(url, init, attempt + 1);
  }
  return res;
}

export async function getJSON(url: string, init: RequestInit = {}): Promise<any> {
  const res = await politeFetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

export async function getText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await politeFetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

export async function getBinary(url: string): Promise<{ data: Uint8Array; contentType: string }> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  return { data: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "" };
}

export const contactEmail = () => CONTACT;
