# Pemasangan

## Claude Desktop — cara termudah

1. Unduh berkas `.mcpb` yang Anda mau dari [`dist/`](../dist/):
   - `scholar-paper-search-0.5.0.mcpb`
   - `zotero-mcp-0.4.0.mcpb`
2. **Klik dua kali** berkasnya. Claude Desktop membuka jendela pemasangan.
   (Alternatif: **Settings → Extensions**, lalu seret berkasnya ke sana.)
3. Isi kolom konfigurasi bila perlu — semuanya opsional untuk `scholar`.
4. Klik **Install**, lalu tutup Claude Desktop **sepenuhnya** dan buka lagi.

Menutup jendela saja tidak cukup; server hanya dibaca ulang saat aplikasi benar-benar
dijalankan ulang.

Tidak ada yang perlu dipasang lebih dulu. Claude Desktop menyertakan Node.js-nya sendiri.

## Claude Code — bangun dari sumber

```bash
git clone https://github.com/nulis-not-just-writing/mcp-writing-toolkit.git
cd mcp-writing-toolkit

# scholar
cd scholar-node && npm install && npm run build && cd ..
claude mcp add scholar -- node "$PWD/scholar-node/dist/index.js"

# zotero
cd zotero-node && npm install && npm run build && cd ..
claude mcp add zotero -- node "$PWD/zotero-node/dist/index.js"
```

Untuk meneruskan konfigurasi, pakai `-e` sebelum `--`:

```bash
claude mcp add scholar \
  -e CONTACT_EMAIL=nama@kampus.ac.id \
  -e SCOPUS_API_KEY=xxxxx \
  -- node "$PWD/scholar-node/dist/index.js"
```

Periksa hasilnya dengan `/mcp` di dalam sesi Claude Code.

## Konfigurasi

Kedua server hanya membaca **variabel lingkungan**. Di Claude Desktop, `manifest.json`
yang mengisikannya dari formulir ekstensi; Anda tidak perlu menyentuhnya sama sekali.

**Tidak ada berkas `.env`.** Kedua server tidak pernah membacanya. Bila Anda menemukan
petunjuk lama yang menyuruh menyalin `.env.example`, petunjuk itu untuk pack versi
sebelumnya yang berbasis Python dan sudah tidak berlaku.

### scholar

| Kolom / variabel | Wajib | Efek bila diisi |
|---|---|---|
| `CONTACT_EMAIL` | tidak | Masuk *polite pool* Crossref & OpenAlex (kuota lebih longgar) **dan** mengaktifkan pencarian PDF open access lewat Unpaywall. Cukup email aktif, tanpa registrasi. |
| `S2_API_KEY` | tidak | Melonggarkan kuota Semantic Scholar. Gratis di [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api). |
| `DOWNLOAD_DIR` | tidak | Folder penyimpanan PDF. Bila kosong: `~/Downloads`, lalu folder sementara sistem bila `~/Downloads` tidak bisa ditulis. |
| `SCOPUS_API_KEY` | tidak | Menyalakan `search_scopus`, `scopus_abstract`, `scopus_export_csv`, `elsevier_status`. |
| `SCIENCEDIRECT_API_KEY` | tidak | Menyalakan `sciencedirect_fulltext`. Kosongkan bila kunci Scopus Anda sudah mencakupnya. |
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
(`scholar-node/build-team-bundle.sh`), ingat bahwa berkas hasilnya **memuat kunci itu di
dalam manifest-nya**. Bundle tersebut tidak boleh diunggah ke tempat publik; `.gitignore`
repo ini sudah menolaknya lewat pola `*-api.mcpb`, dan `build-mcpb.sh` menolak
menerbitkan bundle apa pun yang manifest-nya membawa kunci harfiah.

## Membangun ulang bundle

```bash
./build-mcpb.sh                 # kedua server
./build-mcpb.sh zotero-node     # satu saja
```

Hasilnya `dist/<nama>-<versi>.mcpb`. Skripnya berhenti dan **menghapus** bundle yang
gagal gerbang — bundle bermasalah yang tetap tergeletak di `dist/` cepat atau lambat akan
tersebar tanpa sengaja.

Gerbangnya: versi `manifest.json` harus sama dengan `package.json`; bundle tidak boleh
memuat `node_modules/`, `src/`, `.env`, atau berkas sampah; dan tidak boleh ada nilai
kredensial harfiah di `mcp_config.env`.

---

[← Kembali](README.md) · [scholar](scholar.md) · [zotero](zotero.md) · [Tanya jawab](Tanya-jawab.md)
