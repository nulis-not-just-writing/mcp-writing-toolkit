# scr-toolkit — pekerjaan deterministik tinjauan cakupan

*[Read this in English](../scr-toolkit.md)*

`scr-toolkit` **1.5.0** · 9 tool · [sumber](../../scr-toolkit/)

Sembilan alat yang mengerjakan bagian **deterministik** alur *scoping review*: memeriksa,
menghitung, mencocokkan, mengunduh. **Tidak satu pun memutuskan eligibility** — penilaian
tetap milik peneliti.

> **Ini pelengkap modul kursus Alur SLR AI, dan tetap begitu.** Deskripsi tiap alat
> menyebut titik modul yang dilayaninya (`M6 Langkah 2`, `M5 L3`, `M9 L8`). Rujukan itu
> sengaja dipertahankan karena di dalam kursus ia memberi tahu peserta persis kapan sebuah
> alat dipakai. Tabel di bawah cukup untuk memakainya tanpa mengikuti modulnya — alatnya
> sendiri tidak menuntut kursus apa pun untuk berjalan.

## Tool

| Tool | Fungsi | Titik modul |
|---|---|---|
| `pdf_integrity` | Deteksi unduhan terpotong yang lolos cek *magic byte* | M6 L2 |
| `pdf_verify_record` | Cari judul record di **seluruh** teks PDF, bukan halaman pertama saja | M6 L2 |
| `pdf_match_records` | Cocokkan PDF ke record lewat **isi**, bukan nama berkas | M6 L2 |
| `reconcile_two_pass` | Rekonsiliasi dua pass mandiri + antrean arbitrase | M5 L3 · M6 L5 · M7 L5 |
| `calibration_sample` | Sampel kalibrasi acak berbenih dan terstratifikasi | M5 L3 |
| `retrieve_fulltext` | Akuisisi full-text via Unpaywall + `citation_pdf_url` | M6 L1 |
| `xlsx_read` / `xlsx_write` | Baca/tulis `.xlsx` | seluruh modul yang menyentuh `screening.xlsx` |
| `manuscript_numeric_audit` | Audit angka naskah terhadap daftar fakta | M9 L8 |

## Tanpa dependensi, dan itu disengaja

Tidak ada `package.json`, tidak ada `node_modules/`, tidak ada bundler. ZIP, `.xlsx`, dan
PDF ditangani langsung di atas modul bawaan Node.

Alasannya diverifikasi dari kode Claude Desktop 1.24012.9: ekstensi bertipe `node`
dijalankan dengan **Node bawaan** ketika Node sistem tidak ada, sedangkan tipe `python`
hanya "*falling back to system exec and hoping*". Node bawaan itu **tidak punya npm** dan
tidak dapat memasang paket. Satu dependensi saja akan membuat ekstensinya gagal justru di
mesin yang paling ia layani — peserta yang bukan orang IT dan tidak punya *toolchain*.

## Urutan wajib sebelum satu PDF pun dipakai

```
pdf_integrity  →  pdf_match_records  →  pdf_verify_record
```

Ini bukan kehati-hatian teoretis. PDF yang diunduh alat lain bernama `core_11443100.pdf`
atau nama lampiran Zotero — bukan `SCR[ID]_` — sehingga **tidak terlihat** oleh pemeriksaan
berbasis nama, padahal justru berkas dari luar itulah yang paling perlu diverifikasi. Pada
satu tinjauan nyata, `download_with_fallback` mengembalikan PDF valid berisi **artikel yang
sepenuhnya berbeda**.

**Pencocokan memakai bobot posisi.** Judul yang hanya muncul di bagian belakang berkas
berasal dari daftar pustaka — artinya artikel itu *disitir*, bukan artikel yang ada di
berkas ini. Sebuah berkas pernah tercocokkan ke record lain semata karena record itu ada di
catatan kaki ke-56.

**Berkas yang sudah bernama `SCR[ID]_` tidak pernah di-*rename* atas dasar isi.** Diukur
pada 92 PDF nyata, pencocokan isi menetapkan ID berbeda pada 2 berkas. Ketidaksesuaian
semacam itu **dilaporkan sebagai konflik untuk diputus peneliti**, tidak dieksekusi.

## Batas yang harus diketahui sebelum dipercaya

**Ekstraksi teks.** Alat yang membaca lapisan teks PDF memakai `pdftotext` (poppler) bila
terpasang, dan jatuh ke pengekstrak bawaan bila tidak. Diukur pada 432 kutipan dari korpus
nyata: pengekstrak bawaan menemukan 73%, dan dari yang tidak ditemukan, **18 dari 23
sesungguhnya ada** menurut `pdftotext`.

> **Pengekstrak bawaan hanya boleh MEMBUKTIKAN kecocokan; ia tidak pernah menyangkal.**
> Judul yang tidak ditemukan tanpa `pdftotext` dilaporkan `TIDAK_DAPAT_DIPERIKSA`, bukan
> `MISMATCH`. Verdict yang menuduh hanya keluar bila `pdftotext` tersedia.

Memasang poppler menaikkan mutu pemeriksaan, tetapi bukan syarat pemakaian.

**PDF hasil scan** dikenali lewat **kepadatan teks**, bukan lewat berhasil-tidaknya
ekstraksi — berkas hasil scan tetap mengembalikan nomor halaman dan header sehingga
ekstraksi tampak berhasil. Ambangnya 800 karakter per halaman; median korpus nyata 2.713.
Pernah terjadi satu berkas hasil scan (399 karakter/halaman) dinyatakan tidak memuat
artikelnya padahal isinya sah, hanya berupa gambar.

**`xlsx_write` menulis ulang seluruh berkas.** Ia bukan penyunting sel — sertakan semua
sheet yang ingin dipertahankan, atau tulis ke berkas baru.

**`calibration_sample` mewajibkan `seed`.** `Math.random` tidak dapat diberi benih, jadi
sampelnya tidak akan reproducible — padahal reproducibility justru alasan langkah itu ada.

## Berdampingan dengan scholar dan zotero

Tidak ada tabrakan nama alat. Yang berbahaya bukan namanya, melainkan **berkasnya** — dan
itulah yang ditangani `pdf_match_records`.

Zotero justru menguntungkan bila dipakai bersama: ia menyimpan PDF yang sudah diperoleh
lewat akses institusi, persis kelompok record yang `retrieve_fulltext` tidak dapat jangkau.

`retrieve_fulltext` memisahkan `NEED_MANUAL` dari `NEED_INSTITUTIONAL`. Yang pertama Open
Access tetapi servernya menolak skrip — cukup dibuka di browser. Menyatukan keduanya
membuat peserta menelusuri perpustakaan untuk artikel yang sebenarnya terbuka.

## Biaya token

Membaca PDF adalah penyumbang biaya terbesar di seluruh alur. Terukur pada korpus nyata
(sampel 5 PDF di sekitar median):

| Tahap | Per sumber | Pada 92 / 60 sumber |
|---|---|---|
| M6 full-text screening (Pass 1) | ±38.000 token | ±3,5 juta untuk 92 sumber |
| M7 charting (Pass 1 + Pass 2) | ±40.000 token per pass | ±4,8 juta untuk 60 sumber |

Karena itu modulnya memerintahkan berhenti dan melapor **tiap 5–10 PDF**, bukan jalan
sampai habis. Konteks yang menumpuk membuat biayanya naik kuadratik, bukan linear.

Detail selengkapnya ada di [README server ini](../../scr-toolkit/README.md).

---

[← Kembali](README.md) · [Pemasangan](Pemasangan.md) · [scholar](scholar.md) · [zotero](zotero.md) · [Tanya jawab](Tanya-jawab.md)
