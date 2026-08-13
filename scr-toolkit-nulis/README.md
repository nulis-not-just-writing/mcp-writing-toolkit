# ScR Toolkit Nulis v1.6.0 — ekstensi MCP untuk pekerjaan deterministik scoping review

Sembilan alat yang mengerjakan bagian **deterministik** alur ScR: memeriksa, menghitung, mencocokkan, mengunduh. Tidak satu pun memutuskan eligibility — penilaian tetap milik peserta dan Claude.

> **Alat ini pelengkap modul kursus Alur SLR AI, dan tetap begitu.** Deskripsi tiap alat
> menyebut titik modul yang dilayaninya — `M6 Langkah 2`, `M5 L3`, `M9 L8` — dan rujukan itu
> sengaja dipertahankan: di dalam kursus, ia memberi tahu peserta persis kapan sebuah alat
> dipakai. Di luar kursus, tabel [Alat dan titik modul](#alat-dan-titik-modul-yang-dilayaninya)
> di bawah cukup untuk memahami fungsinya tanpa perlu mengikuti modulnya. Alatnya sendiri
> tidak menuntut kursus apa pun untuk berjalan.

## Mengapa Node, bukan Python

Modul 1 menetapkan pekerjaan deterministik dikerjakan skrip, bukan LLM: hemat token, hasilnya identik tiap dijalankan, dan bisa diaudit ulang. Tetapi peserta umumnya bukan orang IT, dan menyuruh mereka memasang Python beserta pandas hanya untuk menjalankan gerbang mutu adalah beban yang tidak proporsional.

Claude Desktop menyelesaikan itu untuk Node, dan hanya untuk Node. Diverifikasi langsung dari kode aplikasinya (versi 1.24012.9):

| Tipe ekstensi | Saat runtime sistem tidak ada |
|---|---|
| `node` | `"system Node.js not available"` → dijalankan dengan **Node bawaan** lewat UtilityProcess Electron |
| `python` | `"Could not find system python, falling back to system exec and hoping"` |

`built-in-node` muncul 7 kali di dalam kode aplikasi; `built-in-python` **nol**. Tidak ada Python maupun Pyodide di dalam bundle.

Karena itu seluruh alat di sini ditulis **tanpa satu pun dependensi npm** — Node bawaan tidak punya npm dan tidak dapat memasang paket. ZIP, xlsx, dan PDF semuanya ditangani dengan modul bawaan Node (`zlib`, `fs`, `fetch`).

## Pemasangan

1. Unduh [`scr-toolkit-nulis-1.6.0.mcpb`](../dist/scr-toolkit-nulis-1.6.0.mcpb) dari folder
   [`dist/`](../dist/), atau dari halaman
   [Releases](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/releases)
2. Buka Claude Desktop → **Settings → Extensions**
3. Pilih **Install extension…** lalu arahkan ke berkas `.mcpb` itu
4. Setelah terpasang, sembilan alat tersedia di percakapan

Berkas `.mcpb` adalah arsip ZIP biasa. Bila perlu diperiksa isinya, ganti ekstensinya menjadi `.zip` dan buka seperti arsip biasa.

## Alat dan titik modul yang dilayaninya

| Alat | Titik modul |
|---|---|
| `pdf_integrity` | M6 Langkah 2 |
| `pdf_verify_record` | M6 Langkah 2 |
| `pdf_match_records` | M6 Langkah 2 — wajib bila PDF berasal dari MCP lain |
| `reconcile_two_pass` | M5 L3 · M6 L5 · M7 L5 |
| `calibration_sample` | M5 L3 |
| `retrieve_fulltext` | M6 Langkah 1 |
| `xlsx_read` / `xlsx_write` | seluruh modul yang menyentuh `screening.xlsx` |
| `manuscript_numeric_audit` | M9 L8 |

## Batas yang harus diketahui sebelum dipercaya

**Ekstraksi teks PDF.** Alat yang membaca lapisan teks PDF memakai `pdftotext` (poppler) bila terpasang, dan jatuh ke pengekstrak bawaan bila tidak. Pengekstrak bawaan memetakan font CID/Identity-H lewat `/ToUnicode` — tanpa itu, teks jurnal akademik akan terbaca kacau. Namun pemetaannya tidak sempurna.

Diukur pada 432 kutipan dari korpus nyata: pengekstrak bawaan menemukan 73%, dan dari yang tidak ditemukan, **18 dari 23 sesungguhnya ADA** menurut `pdftotext`. Karena itu:

> **Pengekstrak bawaan hanya boleh MEMBUKTIKAN kecocokan. Ia tidak pernah menyangkal.** Judul record yang tidak ditemukan tanpa `pdftotext` dilaporkan `TIDAK_DAPAT_DIPERIKSA`, bukan `MISMATCH`. Verdict yang menuduh hanya keluar bila `pdftotext` tersedia.

Memasang poppler menaikkan mutu pemeriksaan, tetapi bukan syarat pemakaian.

**PDF hasil scan** tanpa lapisan teks tidak dapat dibaca siapa pun tanpa OCR. Alat mengenalinya lewat **kepadatan teks**, bukan lewat berhasil-tidaknya ekstraksi: berkas hasil scan tetap mengembalikan nomor halaman dan header sehingga ekstraksi tampak berhasil. Ambangnya 800 karakter per halaman (median korpus nyata: 2.713). Di bawah itu, hasil pencarian teks dilaporkan `TIDAK_DAPAT_DIPERIKSA` dan tidak pernah dipakai untuk menuduh — pernah terjadi satu berkas hasil scan (399 karakter/halaman) dinyatakan tidak memuat artikelnya padahal isinya sah, hanya berupa gambar.

**`xlsx_write` menulis ulang seluruh berkas.** Ia bukan penyunting sel. Sertakan semua sheet yang ingin dipertahankan, atau tulis ke berkas baru.

## Tiga artefak PDF yang sudah dikodekan

Perbandingan verbatim dilakukan atas **deret huruf-angka saja**, karena lapisan teks PDF berbeda secara karakter dari apa yang terbaca di halaman. Tiga artefak ini terbukti muncul dan **bukan** kesalahan pengutip:

1. **Tanda hubung hilang** — "Sharia-based" pada halaman terbaca `Shariabased`
2. **Tanda hubung/en dash sebelum ganti baris** — `Council-\nIndonesian`
3. **Ligatur dan smart quotes** — `ﬁ`, `ﬂ`, `"` `"`

Membandingkan mentah-mentah akan melaporkan kutipan sah sebagai palsu. Ini pernah terjadi: satu pemeriksa versi awal melaporkan 6 kegagalan yang seluruhnya artefak.

## Catatan lain yang dikodekan sebagai perilaku, bukan sekadar dokumentasi

- **Kode alasan `-`, `NA`, `n/a`, dan sel kosong diperlakukan SAMA.** Perbedaan penulisan pernah melahirkan 182 sengketa palsu pada satu tinjauan nyata.
- **`calibration_sample` mewajibkan `seed`.** `Math.random` tidak dapat diberi benih, sehingga sampel tidak akan reproducible — padahal reproducibility justru alasan langkah itu ada. Ganti seed bila sampel digambar ulang.
- **`retrieve_fulltext` memisahkan `NEED_MANUAL` dari `NEED_INSTITUTIONAL`.** Yang pertama Open Access tetapi servernya menolak skrip — cukup dibuka di browser. Menyatukan keduanya membuat peserta menelusuri perpustakaan untuk artikel yang sebenarnya terbuka.
- **Unduhan dianggap berhasil hanya bila berkasnya PDF utuh.** HTTP 200 bukan bukti: halaman error, halaman login, dan balasan berbadan kosong juga mengembalikan 200. Berkas terpotong bahkan lolos pemeriksaan magic byte `%PDF`.
- **`citation_pdf_url` wajib dicoba.** Unpaywall kerap menandai artikel Open Access tetapi hanya menyimpan halaman landing-nya. Pada satu tinjauan nyata, melewatkan langkah ini akan membuat 19 dari 162 artikel yang sepenuhnya terbuka tercatat gagal unduh.

## Berdampingan dengan MCP lain (scholar, Zotero)

Tidak ada tabrakan nama alat — diverifikasi terhadap daftar alat MCP scholar yang aktif. Yang berbahaya bukan namanya, melainkan **berkasnya**.

PDF yang diunduh alat lain bernama `core_11443100.pdf`, `336-352-1-PB.pdf`, atau nama lampiran Zotero — bukan `SCR[ID]_`. Berkas seperti itu **tidak terlihat** oleh pemeriksaan berbasis nama, padahal justru berkas dari luar itulah yang paling perlu diverifikasi. Pada satu tinjauan nyata, `download_with_fallback` mengembalikan PDF valid berisi **artikel yang sepenuhnya berbeda**.

Karena itu, apa pun alat yang dipakai mengunduh, urutan ini wajib dilalui sebelum satu PDF pun dipakai untuk screening:

```
pdf_integrity  →  pdf_match_records  →  pdf_verify_record
```

**Pencocokan memakai bobot posisi, bukan sekadar keberadaan judul.** Judul yang muncul hanya di bagian belakang berkas berasal dari daftar pustaka — artinya artikel itu *disitir*, bukan artikel yang ada di berkas ini. Ini bukan kehati-hatian teoretis: sebuah berkas berisi *"Legal Adaptation for Muslim Minorities"* tercocokkan ke record lain semata karena record itu ada di catatan kaki ke-56. Tanpa penjagaan posisi, artikel salah akan di-rename menjadi ID yang sah lalu masuk ke screening.

**Berkas yang sudah bernama `SCR[ID]_` tidak pernah di-rename atas dasar isi.** Diukur pada 92 PDF nyata, pencocokan isi menetapkan ID berbeda pada 2 berkas karena judul record lain terkutip cukup awal. Ketidaksesuaian semacam itu **dilaporkan sebagai konflik untuk diputus peneliti**, tidak dieksekusi.

Zotero justru menguntungkan bila peserta memakainya: ia menyimpan PDF yang sudah diperoleh lewat akses institusi — persis kelompok record yang `retrieve_fulltext` tidak dapat jangkau.

## Disiplin batch dan biaya

Membaca PDF adalah penyumbang biaya token terbesar di seluruh alur. Dua angka terukur pada korpus nyata (sampel 5 PDF di sekitar median):

| Tahap | Biaya per sumber | Pada 92 / 60 sumber |
|---|---|---|
| M6 full-text screening (Pass 1, dari PDF) | ±38.000 token | ±3,5 juta untuk 92 sumber |
| M7 charting (Pass 1 + Pass 2, dari PDF) | ±40.000 token per pass | ±4,8 juta untuk 60 sumber |

Karena itu M6 Langkah 3-4 dan M7 Langkah 3-4 memerintahkan berhenti dan melapor **tiap 5-10 PDF**, bukan jalan sampai habis. Konteks yang dibiarkan menumpuk membuat biayanya naik kuadratik, bukan linear — gejalanya sesi melambat drastis lalu mati sebelum antrean habis.

Pegangan menyambungnya ada di spreadsheet, bukan di catatan progres: sebuah baris dihitung selesai hanya bila keputusannya lengkap **dengan kutipan bukti**. Baris berkeputusan tanpa bukti adalah sisa sesi yang mati saat menulis — kosongkan dan masukkan kembali ke antrean.

## Lisensi

**CC BY-NC 4.0** — Creative Commons Attribution-NonCommercial 4.0 International. Bebas
dipakai, disalin, diubah, dan disebarkan untuk keperluan non-komersial dengan mencantumkan
atribusi; pemakaian komersial memerlukan izin terpisah. Teks lengkapnya di
[`LICENSE`](../LICENSE), rinciannya di [`NOTICE.md`](NOTICE.md).

Alat ini **tidak mem-*bundle* kode pihak ketiga sama sekali** — tidak ada dependensi npm,
hanya modul bawaan Node. Karena itu tidak ada hak cipta pihak lain yang perlu direproduksi
di sini.
