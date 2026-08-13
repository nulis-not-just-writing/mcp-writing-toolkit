# MCP Writing Toolkit

*[Read this in English](README.md)*

Tiga MCP server untuk pekerjaan pustaka: **mencari literatur, memverifikasi sitasi,
membaca pustaka Zotero Anda, dan menjalankan pemeriksaan deterministik yang dituntut
tinjauan cakupan** — langsung dari dalam Claude.

Ketiganya dijalankan Node.js. **Tidak ada Python, tidak ada `pip install`, tidak ada
virtualenv.** Untuk Claude Desktop, unduh satu berkas `.mcpb` lalu klik dua kali.
`scholar` dan `zotero` ditulis TypeScript lalu di-*bundle* esbuild; `scr-toolkit`
JavaScript biasa tanpa dependensi sama sekali.

## Server

| Server | Tool | Menjawab |
|---|---|---|
| [`scholar-node`](scholar-node/) → `scholar-paper-search` **0.6.0** | 21 | apakah paper ini benar ada, dan di mana PDF legalnya? |
| [`zotero-node`](zotero-node/) → `zotero-mcp` **0.5.0** | 8 | apa yang sudah ada di pustaka saya sendiri? |
| [`scr-toolkit`](scr-toolkit/) **1.5.0** | 9 | benarkah PDF ini artikel yang diakuinya, dan apakah dua pass screening sepakat? |

`scholar` mencari di **tujuh API ilmiah terbuka** — arXiv, OpenAlex, Crossref, Semantic
Scholar, PubMed, Europe PMC, DOAJ — tanpa perlu kunci apa pun. Bila Anda punya kunci
Elsevier, lima tool Scopus/ScienceDirect ikut menyala — 16 tanpa kunci, 21 dengan kunci.

`zotero` berbicara dengan aplikasi **Zotero 7+ di komputer Anda sendiri**. Mode lokal
adalah bawaannya: tanpa kunci API, tanpa unggah, tanpa apa pun keluar dari mesin Anda.

`scr-toolkit` mengerjakan separuh **deterministik** tinjauan cakupan — memeriksa,
menghitung, mencocokkan, mengunduh. Tidak satu pun alatnya memutuskan eligibility;
penilaian tetap milik peneliti. Ia **pelengkap modul kursus Alur SLR AI** dan tetap begitu:
tiap alat menyebut titik modul yang dilayaninya. Tidak butuh kunci apa pun, dan **nol
dependensi npm**.

## Pasang

**Claude Desktop** — unduh dari [`dist/`](dist/), lalu klik dua kali (atau
**Settings → Extensions**):

- [`scholar-paper-search-0.6.0.mcpb`](dist/scholar-paper-search-0.6.0.mcpb)
- [`zotero-mcp-0.5.0.mcpb`](dist/zotero-mcp-0.5.0.mcpb)
- [`scr-toolkit-1.5.0.mcpb`](dist/scr-toolkit-1.5.0.mcpb)

Bundle bernomor versi juga dilampirkan di setiap [release](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/releases).

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
[docs/id/Pemasangan.md](docs/id/Pemasangan.md).

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

**Fitur yang tak bisa dijalankan tidak muncul.** Tanpa kunci Scopus, kelima tool Elsevier
tidak didaftarkan sama sekali — bukan muncul lalu gagal saat dipanggil. `tools/list`
mengembalikan 16; dengan kunci, 21. Yang tampil adalah yang benar-benar bisa dipakai.

**Tidak ada yang meninggalkan komputer Anda.** Tidak ada telemetri, tidak ada server
perantara. `scholar` memanggil API publik langsung; `zotero` mode lokal hanya berbicara
dengan aplikasi Zotero di `localhost`.

## Konfigurasi

`scr-toolkit` **tidak butuh konfigurasi apa pun** — tanpa kunci, tanpa isian. Dua
sisanya membaca konfigurasinya dari **variabel lingkungan**. Di Claude Desktop,
`manifest.json` yang mengisikannya dari formulir ekstensi sehingga Anda tidak perlu
menyentuhnya; daftar berikut untuk pemakaian manual (Claude Code, atau menjalankan server
langsung):

| Variabel | Server | Wajib | Untuk apa |
|---|---|---|---|
| `CONTACT_EMAIL` | scholar | tidak | *polite pool* Crossref/OpenAlex + mengaktifkan pencarian PDF via Unpaywall |
| `S2_API_KEY` | scholar | tidak | melonggarkan kuota Semantic Scholar |
| `DOWNLOAD_DIR` | scholar | tidak | folder unduhan; bila kosong → `~/Downloads`, lalu folder sementara sistem |
| `SCOPUS_API_KEY` | scholar | tidak | menyalakan 5 tool Elsevier |
| `SCIENCEDIRECT_API_KEY` | scholar | tidak | teks lengkap ScienceDirect |
| `ELSEVIER_INSTTOKEN` | scholar | tidak | token institusi, bila akses dari luar jaringan kampus ditolak 401/403 |
| `ZOTERO_LOCAL` | zotero | tidak | `true` (bawaan) — bicara dengan aplikasi Zotero di komputer ini |
| `ZOTERO_API_KEY` · `ZOTERO_LIBRARY_ID` · `ZOTERO_LIBRARY_TYPE` | zotero | hanya mode Web API | alternatif tanpa aplikasi Zotero lokal |

**Tidak ada berkas `.env`.** Tidak satu pun server di sini membacanya — konfigurasi
hanya mengalir lewat variabel lingkungan proses.

## Prasyarat

| Kebutuhan | Untuk apa | Catatan |
|---|---|---|
| Claude Desktop | memasang `.mcpb` | Node.js-nya sudah disertakan — tidak perlu memasang apa pun |
| Node.js 20+ | membangun dari sumber / memakai di Claude Code | `.nvmrc` menunjuk 24 |
| Zotero 7+ | server `zotero` mode lokal | Settings → Advanced → centang *"Allow other applications on this computer to communicate with Zotero"* |
| Kunci Elsevier | 5 tool Scopus/ScienceDirect | daftar di [dev.elsevier.com](https://dev.elsevier.com) dengan akun institusi |
| `pdftotext` (poppler) | pemeriksaan teks PDF yang lebih tajam di `scr-toolkit` | opsional — tanpanya pemeriksa hanya boleh *membuktikan* kecocokan, tidak pernah menyangkal |

## Dokumentasi

Panduan lengkap ada di **[`docs/id/`](docs/id/)** — pemasangan, satu halaman per server,
dan tanya jawab. Mulai dari [`docs/id/README.md`](docs/id/README.md) bila belum tahu server
mana yang Anda butuhkan.

Versi Inggrisnya ada di [`docs/`](docs/). Keduanya dijaga sejajar isinya.

Isi yang sama dicerminkan ke
[Wiki](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/wiki), dua bahasa.
**`docs/` adalah sumbernya** — ia ikut versi bersama server yang dijelaskannya; wiki
dibangkitkan ulang dengan `./sync-wiki.sh` dan jangan pernah disunting langsung.

## Membangun ulang

```bash
./build-mcpb.sh          # membangun ketiganya, menghasilkan dist/<nama>-<versi>.mcpb
```

Skripnya menolak menghasilkan bundle yang kehilangan `NOTICE.md`, membawa
`node_modules/`, `src/`, atau `.env`, memuat kunci API tertanam di `mcp_config.env`, atau
**mengumumkan versi yang berbeda dari manifest-nya** — dan bundle yang gagal gerbang
**dihapus**, bukan sekadar tidak diumumkan. Gerbang terakhir itu menjalankan server hasil
pack lewat handshake MCP sungguhan lalu membandingkan versi yang diucapkannya; versi yang
dikeraskan di dalam kode justru jenis penyimpangan yang luput dari pemeriksaan berkas.

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

**[CC BY-NC 4.0](LICENSE)** — Creative Commons Attribution-NonCommercial 4.0 International.

Boleh dipakai, disalin, diubah, dan disebarkan **untuk keperluan non-komersial**, dengan
mencantumkan atribusi. Pemakaian komersial — termasuk pelatihan berbayar dan produk
berbayar — memerlukan izin terpisah dari pemegang hak.

Peneliti, mahasiswa, dosen, dan lembaga pendidikan yang memakainya untuk riset dan
pengajaran tidak perlu meminta izin apa pun; cukup cantumkan sumbernya.

### Atribusi pihak ketiga

Setiap server mem-*bundle* pustaka berlisensi MIT ke dalam `dist/index.js`-nya. Lisensi
MIT tetap berlaku atas kode pustaka itu, dan pemberitahuannya wajib menyertai setiap
salinan — karena itu ada `NOTICE.md` di dalam **setiap** `.mcpb`, bukan hanya di repo.
Proses build menolak menghasilkan bundle tanpa berkas itu. Gambaran lengkapnya, termasuk
layanan luar yang diakses beserta syaratnya masing-masing, ada di [`NOTICE.md`](NOTICE.md).
