# MCP Writing Toolkit — dokumentasi

*[Read this in English](../README.md)*

Tiga MCP server untuk pekerjaan pustaka di dalam Claude: mencari literatur, memverifikasi
sitasi, membaca pustaka Zotero Anda sendiri, dan menjalankan pemeriksaan deterministik
tinjauan cakupan.

## Saya butuh yang mana?

Mulai dari keadaan Anda, bukan dari nama server.

| Keadaan Anda | Server |
|---|---|
| Perlu memastikan sebuah sitasi benar-benar ada | **[scholar](scholar.md)** — `get_paper_by_doi` |
| Mencari literatur di banyak basis data sekaligus | **[scholar](scholar.md)** |
| Menjalankan pencarian Scopus untuk tinjauan sistematis | **[scholar](scholar.md)** — butuh kunci Elsevier |
| Perlu PDF open access yang legal untuk sebuah DOI | **[scholar](scholar.md)** — `get_open_access_pdf` |
| Ingin Claude membaca apa yang sudah ada di pustaka Anda | **[zotero](zotero.md)** |
| Perlu BibTeX untuk naskah LaTeX | **[zotero](zotero.md)** — `zotero_export_bibtex` |
| Perlu memastikan sebuah PDF benar-benar artikel yang diakuinya | **[scr-toolkit](scr-toolkit.md)** — `pdf_match_records` |
| Merekonsiliasi dua pass screening dan menyiapkan antrean arbitrase | **[scr-toolkit](scr-toolkit.md)** — `reconcile_two_pass` |
| Mengaudit angka di naskah terhadap daftar fakta | **[scr-toolkit](scr-toolkit.md)** — `manuscript_numeric_audit` |

Ketiganya berdiri sendiri. Memasang satu tidak menuntut yang lain.

## Halaman

- **[Pemasangan](Pemasangan.md)** — Claude Desktop, Claude Code, dan cara mengisi kunci API
- **[scholar](scholar.md)** — 16 tool, tujuh API terbuka, plus 5 tool Elsevier bila ada kunci
- **[zotero](zotero.md)** — 8 tool, mode lokal dan mode Web API
- **[scr-toolkit](scr-toolkit.md)** — 9 tool deterministik untuk tinjauan cakupan, tanpa kunci dan tanpa dependensi
- **[Tanya jawab](Tanya-jawab.md)** — galat yang sering muncul dan sebabnya

## Yang perlu diketahui sejak awal

**Tidak ada Python.** Ketiganya berjalan di atas Node.js bawaan Claude Desktop — tidak ada
yang perlu dipasang lebih dulu. `scholar-nulis` dan `zotero-nulis` adalah TypeScript yang di-*bundle*
jadi satu berkas JavaScript; `scr-toolkit-nulis` JavaScript biasa tanpa dependensi sama sekali.

**Semua konfigurasi `scholar-nulis` opsional.** Tanpa satu kunci pun, 16 tool tetap berfungsi
penuh lewat arXiv, OpenAlex, Crossref, Semantic Scholar, PubMed, Europe PMC, dan DOAJ.
Kunci hanya menambah — jadi 21 — tidak pernah menjadi syarat.

**Zotero bawaannya mode lokal.** Ia berbicara dengan aplikasi Zotero di komputer Anda
lewat `localhost`. Tidak ada kunci API, tidak ada unggahan, tidak ada yang keluar dari
mesin Anda.

**`scr-toolkit-nulis` tidak butuh konfigurasi apa pun.** Tidak ada kunci, tidak ada isian. Ia
juga tidak memutuskan apa pun — sembilan alatnya memeriksa, menghitung, mencocokkan, dan
mengunduh; keputusan eligibility tetap milik peneliti.

**Fitur yang tak bisa jalan tidak ditampilkan.** Tanpa kunci Scopus, kelima tool Elsevier
tidak didaftarkan sama sekali. Daftar tool yang Anda lihat adalah daftar tool yang
benar-benar bisa dipanggil — bukan menu berisi pilihan yang akan gagal.

---

[Pemasangan](Pemasangan.md) · [scholar](scholar.md) · [zotero](zotero.md) · [scr-toolkit](scr-toolkit.md) · [Tanya jawab](Tanya-jawab.md)
