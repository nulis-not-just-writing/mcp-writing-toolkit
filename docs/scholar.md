# scholar — pencarian literatur & verifikasi sitasi

`scholar-paper-search` **0.6.0** · 16 tool, atau 21 dengan kunci Elsevier · [sumber](../scholar-node/)

Mencari di tujuh API ilmiah terbuka, memverifikasi sitasi lewat DOI, menemukan PDF open
access yang legal, mengunduhnya, dan membaca teksnya. Lima tool Scopus/ScienceDirect
menyala bila Anda punya kunci Elsevier.

## Pencarian — tanpa kunci apa pun

| Tool | Fungsi |
|---|---|
| `search_arxiv` | Cari paper di arXiv |
| `search_openalex` | Cari paper di OpenAlex (filter tahun) |
| `search_crossref` | Cari paper di Crossref |
| `search_semantic_scholar` | Cari paper di Semantic Scholar |
| `search_pubmed` | Cari paper di PubMed |
| `search_europepmc` | Cari paper di Europe PMC |
| `search_doaj` | Cari artikel jurnal open access di DOAJ |

Ketujuhnya berfungsi tanpa registrasi. Mengisi `CONTACT_EMAIL` memasukkan Anda ke
*polite pool* Crossref dan OpenAlex — kuotanya lebih longgar, dan permintaan Anda tidak
diperlakukan sebagai lalu lintas anonim.

## Verifikasi & akses

| Tool | Fungsi |
|---|---|
| `get_paper_by_doi` | Verifikasi & ambil metadata paper via DOI (Crossref) |
| `get_open_access_pdf` | Cari link PDF open access legal untuk sebuah DOI |
| `download_pdf` | Unduh PDF dari URL |
| `download_arxiv` | Unduh PDF paper arXiv |
| `read_arxiv_paper` | Baca teks penuh paper arXiv |
| `read_pdf` | Ekstrak teks dari PDF (URL atau file lokal) |
| `pdf_to_text` | Ekstrak teks sebuah PDF lalu simpan sebagai berkas `.md` di subfolder `fulltext/` |
| `batch_acquire_pdfs` | Coba unduh PDF untuk sekumpulan studi sekaligus (daftar INCLUDED hasil screening) |

**`get_paper_by_doi` adalah tool terpenting di server ini.** Ia meresolusi DOI ke
Crossref dan mengembalikan apa yang benar-benar terdaftar di sana — penulis, judul,
jurnal, tahun. Inilah satu-satunya cara membedakan sitasi asli dari sitasi karangan:
kombinasi penulis–tahun–jurnal yang *terlihat* masuk akal justru pola khas referensi
fabrikasi, dan tidak ada jumlah kewaspadaan membaca yang bisa menggantikan pertanyaan ke
registrarnya.

`get_open_access_pdf` hanya menunjuk salinan yang memang **legal** terbuka (jalur
Unpaywall, yang menuntut `CONTACT_EMAIL` diisi). Ia tidak mencari salinan bajakan.

## Scopus & ScienceDirect — butuh kunci Elsevier

Kelima tool berikut **tidak didaftarkan sama sekali** bila `SCOPUS_API_KEY` dan
`SCIENCEDIRECT_API_KEY` kosong. Ia tidak muncul lalu gagal saat dipanggil; ia memang tidak
ada — `tools/list` mengembalikan 16 alih-alih 21.

| Tool | Fungsi |
|---|---|
| `search_scopus` | Cari di Scopus dengan sintaks query aslinya, diteruskan apa adanya |
| `scopus_abstract` | Abstrak lengkap, kata kunci penulis, jumlah sitasi (via DOI atau Scopus ID) |
| `sciencedirect_fulltext` | Teks lengkap artikel ScienceDirect via DOI |
| `scopus_export_csv` | Jalankan query, kumpulkan seluruh halaman, simpan sebagai CSV siap-screening |
| `elsevier_status` | Periksa kunci terpasang, berfungsi, dan sisa kuotanya |

### Query diteruskan apa adanya

`search_scopus` menerima sintaks Scopus asli — `TITLE-ABS-KEY`, `AND/OR/NOT`, `W/n`,
`PUBYEAR`, `DOCTYPE`, `LANGUAGE`, `SRCTYPE` — dan **tidak menerjemahkannya**:

```
TITLE-ABS-KEY("islamic contract" W/3 freedom) AND PUBYEAR > 2014 AND DOCTYPE(ar)
```

Ini keputusan desain, bukan keterbatasan. *Search string* yang Anda laporkan di bagian
Methods harus identik dengan yang benar-benar dieksekusi. Begitu ada lapisan yang diam-diam
menormalkan atau "memperbaiki" query, klaim keterulangan di manuskrip Anda menjadi tidak
benar — dan reviewer yang menjalankan ulang query Anda akan mendapat angka berbeda tanpa
ada yang bisa menjelaskan sebabnya.

Untuk alasan yang sama, `search_scopus` mengembalikan **total hits** — angka yang masuk
ke kotak identifikasi diagram alir PRISMA.

### Jalankan `elsevier_status` sebelum memulai

Kuota Elsevier terikat pada langganan institusi dan bisa habis di tengah jalan.
`elsevier_status` melaporkan apakah kunci terbaca, apakah ia benar-benar diterima, dan
berapa sisa kuotanya — jauh lebih murah daripada menemukannya di tengah pencarian
sistematis.

Bila akses dari luar jaringan kampus ditolak dengan 401/403, mintalah **insttoken** ke
pustakawan atau admin lisensi, lalu isikan ke `ELSEVIER_INSTTOKEN`.

### Kunci tidak bocor lewat pesan galat

Galat Elsevier lazimnya menggemakan URL lengkap beserta `apiKey=` di dalamnya. Setiap
pesan galat di server ini melewati `scrub()` yang mengganti kunci dan pola `apiKey=…`
dengan `«redacted»` sebelum sampai ke pemanggil.

## Diagnostik

`server_status` melaporkan versi yang sedang berjalan, folder tempat PDF akan disimpan,
dan fitur opsional mana yang aktif. Ini langkah pertama yang benar ketika sesuatu
berperilaku di luar dugaan — termasuk untuk memastikan Claude Desktop benar-benar memuat
versi yang baru Anda pasang.

## Folder unduhan

Urutan yang dipakai: `DOWNLOAD_DIR` bila diisi dengan nilai yang sah → `~/Downloads` →
folder sementara sistem. Berkas `.md` hasil `pdf_to_text` masuk ke subfolder `fulltext/`.

---

[← Kembali](README.md) · [Pemasangan](Pemasangan.md) · [zotero](zotero.md) · [scr-toolkit](scr-toolkit.md) · [Tanya jawab](Tanya-jawab.md)
