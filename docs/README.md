# MCP Writing Toolkit — dokumentasi

Dua MCP server untuk pekerjaan pustaka di dalam Claude: mencari literatur, memverifikasi
sitasi, dan membaca pustaka Zotero Anda sendiri.

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

Keduanya berdiri sendiri. Memasang satu tidak menuntut yang lain.

## Halaman

- **[Pemasangan](Pemasangan.md)** — Claude Desktop, Claude Code, dan cara mengisi kunci API
- **[scholar](scholar.md)** — 21 tool, tujuh API terbuka, delapan tool Elsevier opsional
- **[zotero](zotero.md)** — 8 tool, mode lokal dan mode Web API
- **[Tanya jawab](Tanya-jawab.md)** — galat yang sering muncul dan sebabnya

## Yang perlu diketahui sejak awal

**Tidak ada Python.** Kedua server adalah TypeScript yang di-*bundle* jadi satu berkas
JavaScript. Claude Desktop menjalankannya dengan Node.js bawaannya sendiri — tidak ada
yang perlu dipasang lebih dulu.

**Semua konfigurasi `scholar` opsional.** Tanpa satu kunci pun, tiga belas tool tetap
berfungsi penuh lewat arXiv, OpenAlex, Crossref, Semantic Scholar, PubMed, Europe PMC,
dan DOAJ. Kunci hanya menambah, tidak pernah menjadi syarat.

**Zotero bawaannya mode lokal.** Ia berbicara dengan aplikasi Zotero di komputer Anda
lewat `localhost`. Tidak ada kunci API, tidak ada unggahan, tidak ada yang keluar dari
mesin Anda.

**Fitur yang tak bisa jalan tidak ditampilkan.** Tanpa kunci Scopus, kedelapan tool
Elsevier tidak didaftarkan sama sekali. Daftar tool yang Anda lihat adalah daftar tool
yang benar-benar bisa dipanggil — bukan menu berisi pilihan yang akan gagal.

---

[Pemasangan](Pemasangan.md) · [scholar](scholar.md) · [zotero](zotero.md) · [Tanya jawab](Tanya-jawab.md)
