# Pemasangan

*[Read this in English](../Installation.md)*

## Claude Desktop — cara termudah

1. Unduh berkas `.mcpb` yang Anda mau dari [`dist/`](../../dist/):
   - `scholar-nulis-0.8.0.mcpb`
   - `zotero-nulis-0.7.0.mcpb`
   - `scr-toolkit-nulis-2.0.0.mcpb`
2. **Klik dua kali** berkasnya. Claude Desktop membuka jendela pemasangan.
   (Alternatif: **Settings → Extensions**, lalu seret berkasnya ke sana.)
3. Isi kolom konfigurasi bila perlu — semuanya opsional untuk `scholar-nulis`.
4. Klik **Install**, lalu tutup Claude Desktop **sepenuhnya** dan buka lagi.

Menutup jendela saja tidak cukup; server hanya dibaca ulang saat aplikasi benar-benar
dijalankan ulang.

Tidak ada yang perlu dipasang lebih dulu. Claude Desktop menyertakan Node.js-nya sendiri.

### Naik dari nama lama

**Setiap nama tool kini berawalan `nulis_`** — `nulis_search_arxiv`,
`nulis_zotero_search_items`, `nulis_pdf_integrity`, dan seterusnya. Ini perubahan yang
memutus kompatibilitas, dan alasannya: Claude Desktop menampilkan nama tool secara
**rata** — tidak ada ruang nama per server seperti `mcp__scholar__` di Claude Code. Dua
ekstensi yang sama-sama mendaftarkan `search_arxiv` karena itu bertabrakan, dan yang
menang tidak dapat diprediksi. Diukur pada satu mesin nyata, server di repo ini berbagi
**sembilan** nama tool dengan MCP lain yang sudah terpasang; setelah diberi awalan, nol.

Cara Anda berbicara dengan Claude tidak perlu berubah — ia membaca sendiri daftar
tool-nya. Yang perlu disesuaikan hanya skrip atau instruksi tertulis yang menyebut nama
tool secara harfiah.

Server ini sebelumnya bernama `scholar-paper-search`, `zotero-mcp`, dan `scr-toolkit`.
Claude Desktop mengenali ekstensi dari `name` di manifest-nya, jadi server yang berganti
nama adalah **ekstensi yang berbeda** baginya — memasang yang baru tidak menggantikan yang
lama, dan Anda akan berakhir dengan keduanya sekaligus, memunculkan tool kembar.

**Hapus dulu entri lamanya** di **Settings → Extensions**, baru pasang yang ini. Akhiran
`-nulis` ada justru untuk mencegah keambiguan semacam ini: `scholar` cukup umum sebagai
nama, sehingga MCP server lain yang tak berkaitan bisa saja sudah memakainya.

## Claude Code — bangun dari sumber

```bash
git clone https://github.com/nulis-not-just-writing/mcp-writing-toolkit.git
cd mcp-writing-toolkit

# scholar
cd scholar-nulis && npm install && npm run build && cd ..
claude mcp add scholar -- node "$PWD/scholar-nulis/dist/index.js"

# zotero
cd zotero-nulis && npm install && npm run build && cd ..
claude mcp add zotero -- node "$PWD/zotero-nulis/dist/index.js"

# scr-toolkit-nulis — tanpa dependensi, jadi tanpa npm install dan tanpa build
claude mcp add scr-toolkit -- node "$PWD/scr-toolkit-nulis/server/index.js"
```

Untuk meneruskan konfigurasi, pakai `-e` sebelum `--`:

```bash
claude mcp add scholar \
  -e CONTACT_EMAIL=nama@kampus.ac.id \
  -e SCOPUS_API_KEY=xxxxx \
  -- node "$PWD/scholar-nulis/dist/index.js"
```

Periksa hasilnya dengan `/mcp` di dalam sesi Claude Code.

## Konfigurasi

`scr-toolkit-nulis` **tidak punya isian konfigurasi sama sekali** — pasang lalu pakai. Dua
server lainnya hanya membaca **variabel lingkungan**; di Claude Desktop, `manifest.json`
yang mengisikannya dari formulir ekstensi sehingga Anda tidak perlu menyentuhnya.

**Tidak ada berkas `.env`.** Tidak satu pun server di sini membacanya. Bila Anda menemukan
petunjuk lama yang menyuruh menyalin `.env.example`, petunjuk itu untuk pack versi
sebelumnya yang berbasis Python dan sudah tidak berlaku.

### scholar

| Kolom / variabel | Wajib | Efek bila diisi |
|---|---|---|
| `CONTACT_EMAIL` | tidak | Masuk *polite pool* Crossref & OpenAlex (kuota lebih longgar) **dan** menambah jalur Unpaywall untuk pencarian akses terbuka, yang sekalian melaporkan lisensi tiap PDF. Cukup email aktif, tanpa registrasi. |
| `S2_API_KEY` | tidak | Melonggarkan kuota Semantic Scholar. Gratis di [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api). |
| `DOWNLOAD_DIR` | tidak | Folder penyimpanan PDF. Bila kosong: `~/Downloads`, lalu folder sementara sistem bila `~/Downloads` tidak bisa ditulis. |
| `SCOPUS_API_KEY` | tidak | Menyalakan `nulis_search_scopus`, `nulis_scopus_abstract`, `nulis_scopus_export_csv`, `nulis_elsevier_status`. |
| `SCIENCEDIRECT_API_KEY` | tidak | Menyalakan `nulis_sciencedirect_fulltext`. Kosongkan bila kunci Scopus Anda sudah mencakupnya. |
| `ELSEVIER_INSTTOKEN` | tidak | Token institusi dari pustakawan/admin lisensi. Diperlukan hanya bila akses dari luar jaringan kampus ditolak dengan 401/403. |

Kunci Elsevier didaftarkan gratis dengan akun institusi di
[dev.elsevier.com](https://dev.elsevier.com). Kuotanya terikat pada langganan kampus Anda.

### zotero

| Kolom / variabel | Wajib | Efek |
|---|---|---|
| `ZOTERO_LOCAL` | tidak | `true` adalah bawaannya — berbicara dengan aplikasi Zotero di komputer ini. |
| `ZOTERO_API_KEY` | mode Web API | Kunci dari [zotero.org/settings/keys](https://www.zotero.org/settings/keys). |
| `ZOTERO_LIBRARY_ID` | mode Web API | User ID Anda, di halaman yang sama. |
| `ZOTERO_LIBRARY_TYPE` | mode Web API | `user` atau `group`. |

**Mode lokal menuntut satu langkah di aplikasi Zotero:** buka Zotero →
**Settings → Advanced** → centang **"Allow other applications on this computer to
communicate with Zotero"**. Tanpa itu, server akan melapor bahwa Zotero tidak terjangkau.

Aplikasi Zotero harus **sedang berjalan** saat tool dipanggil.

## Menyimpan kunci dengan aman

Kolom yang ditandai rahasia di jendela ekstensi disimpan Claude Desktop di **keychain
sistem operasi**, bukan sebagai teks biasa.

Kalau Anda membangun bundle varian dengan kunci tertanam untuk tim
(`scholar-nulis/build-team-bundle.sh`), ingat bahwa berkas hasilnya **memuat kunci itu di
dalam manifest-nya**. Bundle tersebut tidak boleh diunggah ke tempat publik; `.gitignore`
repo ini sudah menolaknya lewat pola `*-api.mcpb`, dan `build-mcpb.sh` menolak
menerbitkan bundle apa pun yang manifest-nya membawa kunci harfiah.

## Membangun ulang bundle

```bash
./build-mcpb.sh                 # ketiganya
./build-mcpb.sh zotero-nulis    # satu saja
```

Hasilnya `dist/<nama>-<versi>.mcpb`. Skripnya berhenti dan **menghapus** bundle yang
gagal gerbang — bundle bermasalah yang tetap tergeletak di `dist/` cepat atau lambat akan
tersebar tanpa sengaja.

Gerbangnya:

- Versi `manifest.json` harus sama dengan `package.json` (untuk server yang punya).
- **Versi yang diumumkan server** lewat handshake MCP harus sama dengan manifest-nya.
  Gerbang ini menjalankan server hasil pack dan menanyakannya langsung — versi yang
  dikeraskan di dalam kode justru jenis penyimpangan yang luput dari pemeriksaan berkas,
  dan itu benar-benar pernah terjadi pada ketiga server di repo ini.
- **`NOTICE.md` wajib ada di dalam bundle** — atribusi pustaka yang ter-*bundle* harus
  menyertai setiap salinan, dan berkas `.mcpb` yang diunduh satuan tidak membawa serta
  isi repo.
- Bundle tidak boleh memuat `node_modules/`, `src/`, `.env`, atau berkas sampah.
- Tidak boleh ada nilai kredensial harfiah di `mcp_config.env`.

Server tanpa `package.json` (seperti `scr-toolkit-nulis`) dipak apa adanya tanpa langkah build;
gerbangnya memastikan `entry_point` yang ditunjuk manifest benar-benar ada.

---

[← Kembali](README.md) · [scholar](scholar.md) · [zotero](zotero.md) · [scr-toolkit](scr-toolkit.md) · [Tanya jawab](Tanya-jawab.md)
