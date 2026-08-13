# scholar-nulis — pencarian literatur & verifikasi sitasi

*[Read this in English](../scholar.md)*

`scholar-nulis` **0.8.0** · 16 tool, atau 21 dengan kunci Elsevier · [sumber](../../scholar-nulis/)

Mencari di tujuh API ilmiah terbuka, memverifikasi sitasi lewat DOI, menemukan PDF open
access yang legal, mengunduhnya, dan membaca teksnya. Lima tool Scopus/ScienceDirect
menyala bila Anda punya kunci Elsevier.

## Untuk apa sebenarnya alat ini

Empat keadaan yang terus berulang dalam penulisan nyata, dan apa yang Anda lakukan
menghadapinya. Semua keluaran di bawah **nyata** — disalin dari eksekusi sungguhan, bukan
contoh rekaan.

### 1. Anda punya daftar pustaka dan tidak yakin semuanya nyata

Modus kegagalannya khas. Referensi karangan tidak terlihat seperti karangan; ia terlihat
**biasa saja**. Penulis yang masuk akal, tahun yang masuk akal, jurnal yang masuk akal.
Membacanya lebih teliti tidak menolong, karena memang tidak ada yang janggal di halaman itu.

> *"Periksa setiap DOI di daftar pustaka saya ke Crossref, lalu sebutkan mana yang tidak
> teresolusi."*

Yang asli kembali beserta rekaman terdaftarnya:

```json
{ "verified": true, "retracted": false,
  "paper": { "title": "The PRISMA 2020 statement: an updated guideline for reporting
             systematic reviews", "authors": ["Matthew J Page", "Joanne E McKenzie", …] } }
```

Yang karangan kembali tanpa keraguan:

```json
{ "verified": false,
  "doi": "10.1016/j.jclinepi.2023.99999",
  "note": "DOI tidak ditemukan di Crossref — tandai [VERIFY]." }
```

Itulah seluruh gunanya alat ini: mengubah "sepertinya beres" menjadi ya atau tidak.

### 2. Anda hampir menyitir studi yang sudah dicabut

Menyitir karya yang dicabut adalah kesalahan serius, dan PDF yang Anda unduh belum tentu
memberi tahu apa pun. `nulis_get_paper_by_doi` memeriksa status retraksi di **setiap** pencarian —
Anda tidak perlu memintanya:

```json
{ "verified": true,
  "retracted": true,
  "retraction_evidence": {
    "dari_judul": "RETRACTED: Ileal-lymphoid-nodular hyperplasia, non-specific colitis,
                   and pervasive developmental disorder in children" },
  "peringatan": "STUDI INI DICABUT (retracted) … Jangan disintesis. Bila tetap dibahas
                 karena alasan tertentu, nyatakan statusnya secara eksplisit di teks." }
```

Perhatikan yang **tidak** ia lakukan: ia tidak menghapus referensi itu untuk Anda. Studi
yang dicabut kadang disitir dengan sengaja — misalnya dalam tulisan tentang integritas riset.
Ia memberi tahu, lalu meninggalkan keputusannya pada tempatnya.

### 3. Anda butuh PDF-nya, secara legal

> *"Carikan PDF akses terbuka untuk DOI ini."*

```json
{ "found": true, "via": "unpaywall", "oa_status": "hybrid", "license": "cc-by",
  "pdf_url": "https://www.bmj.com/content/bmj/372/bmj.n71.full.pdf" }
```

Field `license` lebih penting dari kelihatannya: itulah pembeda antara "saya boleh membaca
ini" dan "saya boleh membagikannya ke mahasiswa saya". Tanpa `CONTACT_EMAIL`, pencarian yang
sama tetap berhasil lewat OpenAlex, hanya tanpa keterangan lisensi.

### 4. Anda menjalankan pencarian sistematis yang akan diulang reviewer

`nulis_search_scopus` mengembalikan total hits untuk kotak identifikasi diagram PRISMA Anda, dan
`nulis_scopus_export_csv` menyusuri seluruh halaman hasil menjadi berkas siap-screening. Karena
query diteruskan tanpa disentuh, angka yang Anda laporkan dan string yang Anda laporkan
saling bersesuaian — lihat [bagian di bawah](#query-diteruskan-apa-adanya).

## Pencarian — tanpa kunci apa pun

| Tool | Fungsi |
|---|---|
| `nulis_search_arxiv` | Cari paper di arXiv |
| `nulis_search_openalex` | Cari paper di OpenAlex (filter tahun) |
| `nulis_search_crossref` | Cari paper di Crossref |
| `nulis_search_semantic_scholar` | Cari paper di Semantic Scholar |
| `nulis_search_pubmed` | Cari paper di PubMed |
| `nulis_search_europepmc` | Cari paper di Europe PMC |
| `nulis_search_doaj` | Cari artikel jurnal open access di DOAJ |

Ketujuhnya berfungsi tanpa registrasi. Mengisi `CONTACT_EMAIL` memasukkan Anda ke
*polite pool* Crossref dan OpenAlex — kuotanya lebih longgar, dan permintaan Anda tidak
diperlakukan sebagai lalu lintas anonim.

## Verifikasi & akses

| Tool | Fungsi |
|---|---|
| `nulis_get_paper_by_doi` | Verifikasi & ambil metadata paper via DOI (Crossref) |
| `nulis_get_open_access_pdf` | Cari link PDF open access legal untuk sebuah DOI |
| `nulis_download_pdf` | Unduh PDF dari URL |
| `nulis_download_arxiv` | Unduh PDF paper arXiv |
| `nulis_read_arxiv_paper` | Baca teks penuh paper arXiv |
| `nulis_read_pdf` | Ekstrak teks dari PDF (URL atau file lokal) |
| `nulis_pdf_to_text` | Ekstrak teks sebuah PDF lalu simpan sebagai berkas `.md` di subfolder `fulltext/` |
| `nulis_batch_acquire_pdfs` | Coba unduh PDF untuk sekumpulan studi sekaligus (daftar INCLUDED hasil screening) |

**`nulis_get_paper_by_doi` adalah tool terpenting di server ini.** Ia meresolusi DOI ke
Crossref dan mengembalikan apa yang benar-benar terdaftar di sana — penulis, judul,
jurnal, tahun. Inilah satu-satunya cara membedakan sitasi asli dari sitasi karangan:
kombinasi penulis–tahun–jurnal yang *terlihat* masuk akal justru pola khas referensi
fabrikasi, dan tidak ada jumlah kewaspadaan membaca yang bisa menggantikan pertanyaan ke
registrarnya.

`nulis_get_open_access_pdf` hanya menunjuk salinan yang memang **legal** terbuka; ia tidak
mencari salinan bajakan. Tanpa `CONTACT_EMAIL` pun ia berfungsi lewat OpenAlex; mengisi
email menambah jalur Unpaywall yang sekalian melaporkan **lisensi** salinan yang ditemukan
— berguna ketika Anda perlu tahu boleh-tidaknya menyebarkannya ulang.

## Scopus & ScienceDirect — butuh kunci Elsevier

Kelima tool berikut **tidak didaftarkan sama sekali** bila `SCOPUS_API_KEY` dan
`SCIENCEDIRECT_API_KEY` kosong. Ia tidak muncul lalu gagal saat dipanggil; ia memang tidak
ada — `tools/list` mengembalikan 16 alih-alih 21.

| Tool | Fungsi |
|---|---|
| `nulis_search_scopus` | Cari di Scopus dengan sintaks query aslinya, diteruskan apa adanya |
| `nulis_scopus_abstract` | Abstrak lengkap, kata kunci penulis, jumlah sitasi (via DOI atau Scopus ID) |
| `nulis_sciencedirect_fulltext` | Teks lengkap artikel ScienceDirect via DOI |
| `nulis_scopus_export_csv` | Jalankan query, kumpulkan seluruh halaman, simpan sebagai CSV siap-screening |
| `nulis_elsevier_status` | Periksa kunci terpasang, berfungsi, dan sisa kuotanya |

### Query diteruskan apa adanya

`nulis_search_scopus` menerima sintaks Scopus asli — `TITLE-ABS-KEY`, `AND/OR/NOT`, `W/n`,
`PUBYEAR`, `DOCTYPE`, `LANGUAGE`, `SRCTYPE` — dan **tidak menerjemahkannya**:

```
TITLE-ABS-KEY("islamic contract" W/3 freedom) AND PUBYEAR > 2014 AND DOCTYPE(ar)
```

Ini keputusan desain, bukan keterbatasan. *Search string* yang Anda laporkan di bagian
Methods harus identik dengan yang benar-benar dieksekusi. Begitu ada lapisan yang diam-diam
menormalkan atau "memperbaiki" query, klaim keterulangan di manuskrip Anda menjadi tidak
benar — dan reviewer yang menjalankan ulang query Anda akan mendapat angka berbeda tanpa
ada yang bisa menjelaskan sebabnya.

Untuk alasan yang sama, `nulis_search_scopus` mengembalikan **total hits** — angka yang masuk
ke kotak identifikasi diagram alir PRISMA.

### Jalankan `nulis_elsevier_status` sebelum memulai

Kuota Elsevier terikat pada langganan institusi dan bisa habis di tengah jalan.
`nulis_elsevier_status` melaporkan apakah kunci terbaca, apakah ia benar-benar diterima, dan
berapa sisa kuotanya — jauh lebih murah daripada menemukannya di tengah pencarian
sistematis.

Bila akses dari luar jaringan kampus ditolak dengan 401/403, mintalah **insttoken** ke
pustakawan atau admin lisensi, lalu isikan ke `ELSEVIER_INSTTOKEN`.

### Kunci tidak bocor lewat pesan galat

Galat Elsevier lazimnya menggemakan URL lengkap beserta `apiKey=` di dalamnya. Setiap
pesan galat di server ini melewati `scrub()` yang mengganti kunci dan pola `apiKey=…`
dengan `«redacted»` sebelum sampai ke pemanggil.

## Diagnostik

`nulis_server_status` melaporkan versi yang sedang berjalan, folder tempat PDF akan disimpan,
dan fitur opsional mana yang aktif. Ini langkah pertama yang benar ketika sesuatu
berperilaku di luar dugaan — termasuk untuk memastikan Claude Desktop benar-benar memuat
versi yang baru Anda pasang.

## Folder unduhan

Urutan yang dipakai: `DOWNLOAD_DIR` bila diisi dengan nilai yang sah → `~/Downloads` →
folder sementara sistem. Berkas `.md` hasil `nulis_pdf_to_text` masuk ke subfolder `fulltext/`.

---

[← Kembali](README.md) · [Pemasangan](Pemasangan.md) · [zotero](zotero.md) · [scr-toolkit](scr-toolkit.md) · [Tanya jawab](Tanya-jawab.md)
