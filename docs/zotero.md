# zotero — pustaka Anda sendiri

`zotero-mcp` **0.4.0** · 8 tool · [sumber](../zotero-node/)

Memberi Claude akses baca ke pustaka Zotero Anda: mencari item, membaca metadata dan teks
penuhnya, menelusuri koleksi, dan mengekspor BibTeX.

**Baca saja.** Tidak ada satu pun tool di sini yang menambah, mengubah, atau menghapus
item di pustaka Anda.

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

[← Kembali](README.md) · [Pemasangan](Pemasangan.md) · [scholar](scholar.md) · [Tanya jawab](Tanya-jawab.md)
