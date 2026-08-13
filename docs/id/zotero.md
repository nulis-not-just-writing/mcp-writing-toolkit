# zotero — pustaka Anda sendiri

*[Read this in English](../zotero.md)*

`zotero-mcp` **0.5.0** · 8 tool · [sumber](../../zotero-node/)

Memberi Claude akses baca ke pustaka Zotero Anda: mencari item, membaca metadata dan teks
penuhnya, menelusuri koleksi, dan mengekspor BibTeX.

**Baca saja.** Tidak ada satu pun tool di sini yang menambah, mengubah, atau menghapus
item di pustaka Anda.

## Untuk apa sebenarnya alat ini

Pustaka Zotero kebanyakan orang lebih besar daripada ingatannya sendiri tentang isi pustaka
itu. Server ini menutup jarak tersebut: Claude bisa melihat apa yang benar-benar Anda
kumpulkan, alih-alih meminta Anda mengingatnya, atau mencari ke seluruh dunia padahal
jawabannya sudah ada di cakram Anda.

Berbeda dari dua server lain, tidak ada contoh keluaran terverifikasi di bawah — ini
skenarionya, bukan transkrip.

### 1. "Saya sudah punya apa soal ini?"

Langkah pertama yang tepat sebelum mencari ke basis data mana pun. Anda mengumpulkan bahan
bertahun-tahun; sebagiannya menjawab pertanyaan yang Anda ajukan hari ini.

> *"Cari di pustaka Zotero saya apa pun tentang efikasi diri guru di SMK, lalu sebutkan apa
> yang sudah saya punya."*

`zotero_search_items` berjalan di pustaka Anda sendiri. Tidak berbiaya, tidak menyentuh
kuota mana pun, dan sering membuat pencarian ke luar jadi tidak perlu.

### 2. Menulis bagian yang berpijak pada yang benar-benar Anda baca

> *"Ambil teks penuh keenam item ini, lalu susun kerangka teoretisnya dari apa yang
> sungguh-sungguh mereka katakan."*

`zotero_get_item_fulltext` memberi Claude teks yang sudah Anda baca dan anotasi, bukan
abstrak atau terkaan. Inilah pembeda antara paragraf yang dibangun dari isi sumber dan
paragraf yang dibangun dari kesan judulnya.

Teksnya berasal dari indeks Zotero sendiri — lihat [bagian di bawah](#teks-penuh-datang-dari-indeks-zotero)
untuk apa yang terjadi bila sebuah item belum terindeks.

### 3. Daftar pustaka persis untuk yang Anda sitir

> *"Ekspor BibTeX untuk item yang saya sitir di draf ini."*

`zotero_export_bibtex` menerima sekumpulan kunci item dan mengembalikan BibTeX untuk subset
itu saja — bukan seluruh pustaka Anda. Bila Anda menulis dengan LaTeX, inilah langkah yang
mencegah berkas `.bib` berisi 900 entri terus mengikuti artikel 6.000 kata ke mana-mana.

### 4. Menemukan kembali pekerjaan yang Anda lupakan

> *"Apa saja yang saya tambahkan ke Zotero sebulan terakhir?"* · *"Daftarkan semua isi
> koleksi 'Revisi R2' saya."*

`zotero_get_recent` dan `zotero_get_collection_items` diperuntukkan bagi bacaan yang sudah
Anda lakukan, sudah Anda arsipkan dengan rapi, lalu Anda lupakan — dan itu nasib sebagian
besar bacaan.

### Yang sengaja TIDAK dilakukannya

Ia tidak menambah, menyunting, memberi tag, atau menghapus apa pun. Seluruh panggilannya
`GET`. Kalau Anda ingin Claude menata ulang pustaka Anda, ini bukan alatnya — dan itu
disengaja: pustaka referensi adalah kerja bertahun-tahun, dan akses baca sudah cukup untuk
berguna tanpa perlu bisa merusaknya.

## Tool

| Tool | Fungsi |
|---|---|
| `zotero_search_items` | Cari item di pustaka berdasarkan kata kunci |
| `zotero_get_item_metadata` | Metadata lengkap / BibTeX satu item |
| `zotero_get_item_fulltext` | Teks penuh item (dari indeks Zotero) |
| `zotero_get_item_children` | Lampiran & catatan sebuah item |
| `zotero_list_collections` | Daftar koleksi pustaka |
| `zotero_get_collection_items` | Item di dalam sebuah koleksi |
| `zotero_get_recent` | Item yang terakhir ditambahkan |
| `zotero_export_bibtex` | Ekspor item terpilih sebagai BibTeX |

## Dua mode

### Mode lokal — bawaan, dan yang disarankan

Server berbicara dengan aplikasi **Zotero 7+ di komputer yang sama** lewat `localhost`.
Tidak ada kunci API, tidak ada unggahan, tidak ada satu byte pun yang meninggalkan mesin
Anda.

Dua syarat:

1. Aplikasi Zotero **sedang berjalan**.
2. Zotero → **Settings → Advanced** → centang **"Allow other applications on this
   computer to communicate with Zotero"**.

Syarat kedua sering terlewat, dan gejalanya adalah galat "Zotero tidak terjangkau"
meskipun aplikasinya jelas terbuka.

### Mode Web API

Untuk mesin yang tidak menjalankan aplikasi Zotero. Isi ketiganya:

| Variabel | Dari mana |
|---|---|
| `ZOTERO_API_KEY` | [zotero.org/settings/keys](https://www.zotero.org/settings/keys) |
| `ZOTERO_LIBRARY_ID` | User ID Anda, di halaman yang sama |
| `ZOTERO_LIBRARY_TYPE` | `user` atau `group` |

Mode ini membaca pustaka yang **tersinkron ke server Zotero**. Item yang belum tersinkron
tidak akan terlihat.

## Teks penuh datang dari indeks Zotero

`zotero_get_item_fulltext` membaca **indeks teks penuh milik Zotero**, bukan mengurai PDF
ulang. Konsekuensinya: item yang PDF-nya belum selesai diindeks Zotero akan
mengembalikan teks kosong meskipun berkasnya jelas ada.

Bila itu terjadi, klik kanan item di Zotero → **Reindex Item**, lalu coba lagi.

## BibTeX

`zotero_export_bibtex` menghasilkan BibTeX dari data Zotero sendiri. Bila Anda memakai
**Better BibTeX**, kunci sitasi yang Anda kelola di sana (mis. `sugeng2024analisis`)
adalah milik plugin itu dan tidak selalu sama dengan kunci yang dihasilkan di sini —
periksa dulu sebelum menempelkannya ke naskah LaTeX yang sudah berjalan.

---

[← Kembali](README.md) · [Pemasangan](Pemasangan.md) · [scholar](scholar.md) · [scr-toolkit](scr-toolkit.md) · [Tanya jawab](Tanya-jawab.md)
