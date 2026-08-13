# MCP Writing Toolkit

*[Read this in English](README.en.md)*

Dua MCP server untuk pekerjaan pustaka: **mencari literatur, memverifikasi sitasi, dan
membaca pustaka Zotero Anda** — langsung dari dalam Claude.

Keduanya ditulis dalam TypeScript dan dijalankan oleh Node.js. **Tidak ada Python,
tidak ada `pip install`, tidak ada virtualenv.** Untuk Claude Desktop, unduh satu berkas
`.mcpb` lalu klik dua kali.

## Server

| Server | Tool | Menjawab |
|---|---|---|
| [`scholar-node`](scholar-node/) → `scholar-paper-search` **0.5.0** | 21 | apakah paper ini benar ada, dan di mana PDF legalnya? |
| [`zotero-node`](zotero-node/) → `zotero-mcp` **0.4.0** | 8 | apa yang sudah ada di pustaka saya sendiri? |

`scholar` mencari di **tujuh API ilmiah terbuka** — arXiv, OpenAlex, Crossref, Semantic
Scholar, PubMed, Europe PMC, DOAJ — tanpa perlu kunci apa pun. Bila Anda punya kunci
Elsevier, delapan tool Scopus/ScienceDirect ikut menyala.

`zotero` berbicara dengan aplikasi **Zotero 7+ di komputer Anda sendiri**. Mode lokal
adalah bawaannya: tanpa kunci API, tanpa unggah, tanpa apa pun keluar dari mesin Anda.

## Pasang

**Claude Desktop** — unduh dari [`dist/`](dist/), lalu klik dua kali (atau
**Settings → Extensions**):

- [`scholar-paper-search-0.5.0.mcpb`](dist/scholar-paper-search-0.5.0.mcpb)
- [`zotero-mcp-0.4.0.mcpb`](dist/zotero-mcp-0.4.0.mcpb)

Isian konfigurasinya muncul sebagai formulir di jendela ekstensi. **Semuanya opsional**
untuk `scholar`; kunci yang ditandai rahasia disimpan di keychain sistem operasi Anda,
bukan di berkas teks.

**Claude Code** — bangun dari sumber, lalu daftarkan:

```bash
git clone https://github.com/nulis-not-just-writing/mcp-writing-toolkit.git
cd mcp-writing-toolkit/scholar-node && npm install && npm run build
claude mcp add scholar -- node "$PWD/dist/index.js"
```

Detail lengkap, termasuk cara meneruskan kunci API, ada di
[docs/Pemasangan.md](docs/Pemasangan.md).

## Yang membedakannya

**Sitasi diverifikasi, bukan diduga.** `get_paper_by_doi` meresolusi DOI ke Crossref dan
mengembalikan metadata yang sebenarnya terdaftar. Ini penanggulangan langsung untuk
sitasi karangan — kombinasi penulis–tahun–jurnal yang *terlihat* masuk akal justru pola
khasnya, dan satu-satunya cara membedakannya adalah menanyakan ke registrar.

**Query Scopus diteruskan apa adanya.** `search_scopus` tidak menerjemahkan, menormalkan,
atau "memperbaiki" query Anda. Akibatnya *search string* yang Anda laporkan di manuskrip
identik dengan yang benar-benar dieksekusi — syarat keterulangan yang gugur begitu ada
lapisan yang diam-diam menulis ulang query.

**Kunci API tidak pernah bocor lewat pesan galat.** Setiap pesan kesalahan Elsevier
melewati `scrub()` yang mengganti kunci dan `apiKey=` di URL dengan `«redacted»` sebelum
sampai ke pemanggil. Galat 401 dari Elsevier biasanya memuat URL lengkap beserta kuncinya.

**Fitur yang tak bisa dijalankan tidak muncul.** Tanpa kunci Scopus, kedelapan tool
Elsevier tidak didaftarkan sama sekali — bukan muncul lalu gagal saat dipanggil. Yang
tampil di daftar tool adalah yang benar-benar bisa dipakai.

**Tidak ada yang meninggalkan komputer Anda.** Tidak ada telemetri, tidak ada server
perantara. `scholar` memanggil API publik langsung; `zotero` mode lokal hanya berbicara
dengan aplikasi Zotero di `localhost`.

## Konfigurasi

Kedua server membaca konfigurasinya dari **variabel lingkungan**. Di Claude Desktop,
`manifest.json` yang mengisikannya dari formulir ekstensi — Anda tidak perlu menyentuh
variabel ini. Daftar berikut untuk pemakaian manual (Claude Code, atau menjalankan
server langsung):

| Variabel | Server | Wajib | Untuk apa |
|---|---|---|---|
| `CONTACT_EMAIL` | scholar | tidak | *polite pool* Crossref/OpenAlex + mengaktifkan pencarian PDF via Unpaywall |
| `S2_API_KEY` | scholar | tidak | melonggarkan kuota Semantic Scholar |
| `DOWNLOAD_DIR` | scholar | tidak | folder unduhan; bila kosong → `~/Downloads`, lalu folder sementara sistem |
| `SCOPUS_API_KEY` | scholar | tidak | menyalakan 8 tool Scopus |
| `SCIENCEDIRECT_API_KEY` | scholar | tidak | teks lengkap ScienceDirect |
| `ELSEVIER_INSTTOKEN` | scholar | tidak | token institusi, bila akses dari luar jaringan kampus ditolak 401/403 |
| `ZOTERO_LOCAL` | zotero | tidak | `true` (bawaan) — bicara dengan aplikasi Zotero di komputer ini |
| `ZOTERO_API_KEY` · `ZOTERO_LIBRARY_ID` · `ZOTERO_LIBRARY_TYPE` | zotero | hanya mode Web API | alternatif tanpa aplikasi Zotero lokal |

**Tidak ada berkas `.env`.** Kedua server tidak pernah membacanya — konfigurasi hanya
mengalir lewat variabel lingkungan proses.

## Prasyarat

| Kebutuhan | Untuk apa | Catatan |
|---|---|---|
| Claude Desktop | memasang `.mcpb` | Node.js-nya sudah disertakan — tidak perlu memasang apa pun |
| Node.js 20+ | membangun dari sumber / memakai di Claude Code | `.nvmrc` menunjuk 24 |
| Zotero 7+ | server `zotero` mode lokal | Settings → Advanced → centang *"Allow other applications on this computer to communicate with Zotero"* |
| Kunci Elsevier | 8 tool Scopus/ScienceDirect | daftar di [dev.elsevier.com](https://dev.elsevier.com) dengan akun institusi |

## Membangun ulang

```bash
./build-mcpb.sh          # membangun kedua server, menghasilkan dist/<nama>-<versi>.mcpb
```

Skripnya menolak menghasilkan bundle yang membawa `node_modules/`, `src/`, atau kunci API
tertanam — gerbangnya gagal keras, bukan memberi peringatan lalu lanjut.

> Nama berkas memuat versi supaya sebuah bundle tidak pernah "basi": versi baru
> menghasilkan berkas baru, bukan menimpa yang lama.

## Hubungannya dengan repo `skills`

Repo ini menyediakan **alatnya**; [`nulis-not-just-writing/skills`](https://github.com/nulis-not-just-writing/skills)
menyediakan **prosedurnya** — lima skill Claude untuk menulis, memoles, menyubmit, dan
merevisi artikel jurnal Q1, plus satu untuk menjalankan tinjauan sistematis.

Keduanya **saling melengkapi, bukan saling menuntut**. Skill-skillnya berfungsi penuh
tanpa server ini (verifikasi sitasi turun ke resolusi DOI lewat web, lalu ke penandaan
manual). Server ini berguna tanpa skill itu. Dipasang bersama, verifikasi sitasi dan
pencarian Scopus jadi langsung tanpa perantara.

## Lisensi

**[MIT](LICENSE)** — bebas dipakai, disalin, diubah, dan disebarkan, termasuk secara
komersial, selama pemberitahuan hak ciptanya dipertahankan.

Lisensinya sengaja berbeda dari repo `skills` (CC BY-NC 4.0). Ini kode, dan Creative
Commons sendiri menyarankan agar lisensinya tidak dipakai untuk perangkat lunak.

Seluruh dependensi yang ikut ter-*bundle* juga MIT — rinciannya di [`NOTICE.md`](NOTICE.md),
beserta catatan tentang layanan yang diakses dan syarat pemakaiannya masing-masing.
