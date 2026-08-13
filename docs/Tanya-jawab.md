# Tanya jawab

## Pemasangan

**Server sudah dipasang tapi tidak muncul di Claude Desktop.**
Tutup Claude Desktop **sepenuhnya**, lalu buka lagi. Menutup jendela saja tidak memuat
ulang daftar server. Di macOS, pastikan ikonnya benar-benar hilang dari Dock (⌘Q).

**Perlu memasang Node.js dulu?**
Untuk Claude Desktop, tidak — ia menyertakan Node.js sendiri. Node.js hanya diperlukan
bila Anda membangun dari sumber atau memakainya di Claude Code.

**Perlu Python, `pip`, atau `uv`?**
Tidak. Kedua server sepenuhnya Node.js. Bila Anda menemukan petunjuk yang menyuruh
menjalankan `install.sh` atau memasang paket PyPI, petunjuk itu untuk pack versi lama dan
sudah tidak berlaku.

**Di mana saya isi berkas `.env`?**
Tidak ada. Kedua server tidak pernah membaca `.env`. Di Claude Desktop, isian ada di
formulir jendela ekstensi; di Claude Code, pakai `-e NAMA=nilai` pada `claude mcp add`.

## scholar

**Tool Scopus tidak muncul sama sekali.**
Itu perilaku yang benar bila `SCOPUS_API_KEY` kosong. Kedelapan tool Elsevier memang
tidak didaftarkan tanpa kunci, alih-alih muncul lalu gagal saat dipanggil. Isi kuncinya,
pasang ulang ekstensinya, lalu jalankan ulang Claude Desktop.

**Kunci sudah diisi tapi Scopus menolak dengan 401 atau 403.**
Jalankan `elsevier_status` — ia melaporkan apakah kunci terbaca dan apakah benar-benar
diterima. Penyebab paling umum: Anda mengakses dari luar jaringan kampus. Mintalah
**insttoken** ke pustakawan atau admin lisensi, lalu isikan ke `ELSEVIER_INSTTOKEN`.

**Berapa sisa kuota saya?**
`elsevier_status` melaporkannya. Jalankan **sebelum** memulai pencarian sistematis, bukan
setelah kuotanya habis di tengah jalan.

**`get_open_access_pdf` tidak menemukan apa pun padahal artikelnya jelas ada.**
Dua kemungkinan. Pertama, `CONTACT_EMAIL` belum diisi — jalur Unpaywall menuntutnya.
Kedua, artikel itu memang tidak punya salinan open access yang legal. Tool ini hanya
menunjuk salinan yang sah terbuka; ia tidak mencari salinan bajakan.

**Bisakah saya mempercayai metadata dari `search_*`?**
Untuk keperluan sitasi, verifikasi dengan `get_paper_by_doi`. Hasil pencarian berguna
untuk menemukan, tetapi yang mengikat adalah apa yang terdaftar di Crossref. Sitasi yang
*terlihat* masuk akal justru pola khas referensi karangan.

**PDF-nya tersimpan di mana?**
`DOWNLOAD_DIR` bila diisi, lalu `~/Downloads`, lalu folder sementara sistem. Jalankan
`server_status` untuk melihat folder mana yang benar-benar dipakai sekarang.

## zotero

**"Zotero tidak terjangkau" padahal aplikasinya terbuka.**
Buka Zotero → **Settings → Advanced** → centang **"Allow other applications on this
computer to communicate with Zotero"**. Ini langkah yang paling sering terlewat.

**Teks penuh kosong padahal PDF-nya ada di item itu.**
Server membaca indeks teks penuh milik Zotero, bukan mengurai PDF ulang. Bila Zotero
belum selesai mengindeks berkas itu, hasilnya kosong. Klik kanan item → **Reindex Item**,
lalu coba lagi.

**Apakah server ini bisa mengubah pustaka saya?**
Tidak. Seluruh panggilannya `GET`; tidak ada satu pun jalur tulis di kodenya.

**Kunci sitasi BibTeX-nya berbeda dari yang saya pakai.**
`zotero_export_bibtex` memakai data Zotero sendiri. Bila Anda memakai **Better BibTeX**,
kunci yang Anda kelola di sana dikelola plugin itu dan tidak selalu sama. Periksa dulu
sebelum menempelkannya ke naskah LaTeX yang sudah berjalan.

## Umum

**Apakah ada data saya yang dikirim ke suatu tempat?**
Tidak ada telemetri dan tidak ada server perantara. `scholar` memanggil API publik
langsung dari komputer Anda; `zotero` mode lokal hanya berbicara dengan aplikasi Zotero
di `localhost`.

**Saya bukan penutur bahasa Indonesia. Bisa dipakai?**
Bisa — server membalas dalam bahasa yang Anda pakai, dan README utamanya berbahasa
Inggris. Yang masih berbahasa Indonesia adalah deskripsi tool di `manifest.json` (dibaca
model, bukan Anda — tetapi itulah yang tampil di jendela ekstensi Claude Desktop) dan
seluruh halaman `docs/` ini.

**Apa hubungannya dengan repo `skills`?**
Repo ini alatnya; [`nulis-not-just-writing/skills`](https://github.com/nulis-not-just-writing/skills)
prosedurnya. Keduanya saling melengkapi dan tidak saling menuntut — skill di sana
berfungsi penuh tanpa server ini, dan server ini berguna tanpa skill itu.

**Apa lisensinya?**
**CC BY-NC 4.0**, sama dengan repo `skills`. Boleh dipakai, disalin, diubah, dan
disebarkan untuk keperluan non-komersial dengan mencantumkan atribusi. Peneliti,
mahasiswa, dosen, dan lembaga pendidikan tidak perlu meminta izin apa pun; cukup
cantumkan sumbernya. Pemakaian komersial memerlukan izin terpisah dari pemegang hak.

**Kalau kodenya CC BY-NC, bagaimana dengan pustaka MIT yang ikut ter-*bundle*?**
Lisensi MIT tetap berlaku atas kode pustaka itu sendiri; CC BY-NC hanya berlaku atas
karya aslinya. MIT mengizinkan hasil gabungan disebarkan dengan syarat berbeda selama
pemberitahuan hak ciptanya dipertahankan — karena itu `NOTICE.md` ada di dalam **setiap**
berkas `.mcpb`, bukan hanya di repo. Berkas yang diunduh orang satuan tidak membawa serta
isi repo, jadi atribusinya harus ikut di dalam bundle. `build-mcpb.sh` menolak
menghasilkan bundle tanpa berkas itu.

---

[← Kembali](README.md) · [Pemasangan](Pemasangan.md) · [scholar](scholar.md) · [zotero](zotero.md)
