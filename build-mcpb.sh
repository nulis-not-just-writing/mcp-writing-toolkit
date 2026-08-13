#!/usr/bin/env bash
# Bangun bundle .mcpb bernomor versi untuk setiap server, lalu periksa hasilnya.
#
#   ./build-mcpb.sh                 # ketiga server
#   ./build-mcpb.sh zotero-nulis    # satu server saja
#
# Keluaran: dist/<nama-manifest>-<versi>.mcpb
#
# Gerbangnya gagal KERAS. Bundle yang kehilangan NOTICE.md, membawa node_modules/,
# src/, atau kunci API tertanam tidak diterbitkan — bukan diberi peringatan lalu
# diteruskan; berkasnya dihapus.
set -euo pipefail
cd "$(dirname "$0")"

SERVERS=("${@:-}")
if [ -z "${SERVERS[0]:-}" ]; then SERVERS=(scholar-nulis zotero-nulis scr-toolkit-nulis); fi

mkdir -p dist
gagal=0

for s in "${SERVERS[@]}"; do
  [ -d "$s" ] || { echo "✗ $s: folder tidak ada"; gagal=1; continue; }
  echo "── $s"
  # Terpisah dari $gagal supaya kegagalan satu server tidak membungkam
  # laporan sukses server berikutnya.
  rusak=0

  nama=$(node -p "require('./$s/manifest.json').name")
  versi=$(node -p "require('./$s/manifest.json').version")

  # Dua bentuk server didukung:
  #   - ada package.json  -> TypeScript, di-bundle esbuild ke dist/index.js
  #   - tanpa package.json -> Node murni tanpa dependensi, dipak apa adanya
  # scr-toolkit-nulis sengaja tidak punya dependensi npm: Node bawaan Claude
  # Desktop tidak punya npm dan tidak bisa memasang paket.
  if [ -f "$s/package.json" ]; then
    versi_pkg=$(node -p "require('./$s/package.json').version")

    # Versi di manifest dan package.json harus sama — kalau berbeda, nomor versi
    # pada nama berkas kehilangan artinya.
    if [ "$versi" != "$versi_pkg" ]; then
      echo "  ✗ versi tidak sinkron: manifest=$versi package.json=$versi_pkg"
      gagal=1; continue
    fi

    [ -d "$s/node_modules" ] || (cd "$s" && npm install --silent)
    (cd "$s" && npm run --silent build)
  else
    echo "  · tanpa dependensi npm — dipak langsung, tanpa langkah build"

    # Tanpa langkah build, entry_point harus sudah ada di repo. Kalau tidak,
    # bundle-nya akan terpasang lalu mati saat dijalankan.
    masuk=$(node -p "require('./$s/manifest.json').server.entry_point || ''")
    if [ -z "$masuk" ] || [ ! -f "$s/$masuk" ]; then
      echo "  ✗ entry_point '$masuk' tidak ada di $s/"
      gagal=1; continue
    fi
  fi

  out="dist/$nama-$versi.mcpb"
  rm -f "$out"
  npx --yes @anthropic-ai/mcpb pack "$s" "$out" >/dev/null

  # ── Gerbang 1: isi bundle ──────────────────────────────────────────────
  # Listing ditampung ke variabel dulu. Menyalurkannya ke `grep -q` membuat grep
  # menutup pipe lebih awal, dan dengan `set -o pipefail` SIGPIPE itu terbaca
  # sebagai kegagalan yang tidak pernah terjadi.
  listing=$(unzip -l "$out")

  for terlarang in "node_modules/" "src/" ".env"; do
    case "$listing" in
      *"$terlarang"*) echo "  ✗ $out memuat $terlarang"; rusak=1 ;;
    esac
  done

  # Atribusi MIT dependensi yang ter-bundle ke dalam dist/index.js wajib ikut
  # DI DALAM bundle — NOTICE.md di akar repo tidak menyertai berkas .mcpb yang
  # diunduh orang satuan.
  case "$listing" in
    *"NOTICE.md"*) ;;
    *) echo "  ✗ $out tidak memuat NOTICE.md — atribusi MIT wajib ikut"; rusak=1 ;;
  esac

  sampah=$(printf '%s\n' "$listing" | grep -cE '\.DS_Store|__MACOSX|\.log$' || true)
  if [ "$sampah" -gt 0 ]; then
    echo "  ✗ $out memuat $sampah berkas sampah (.DS_Store/__MACOSX/*.log)"
    rusak=1
  fi

  # ── Gerbang 2: tidak ada kunci tertanam ────────────────────────────────
  tmp=$(mktemp -d); unzip -qo "$out" -d "$tmp"
  if ! node ./scripts/cek-kunci-tertanam.js "$tmp/manifest.json"; then
    echo "  ✗ $out memuat kunci tertanam di manifest.json"
    rusak=1
  fi

  # ── Gerbang 3: identitas yang diumumkan server = manifest ──────────────
  # Nama, versi, dan daftar tool bisa berbeda antara manifest dan kode tanpa
  # satu pun error muncul. Yang dibaca Claude Desktop adalah yang diucapkan
  # server saat handshake.
  if ! node ./scripts/cek-identitas-server.js "$tmp"; then
    echo "  ✗ $out mengumumkan identitas yang berbeda dari manifest-nya"
    rusak=1
  fi
  rm -rf "$tmp"

  if [ "$rusak" -eq 0 ]; then
    ukuran=$(du -h "$out" | cut -f1)
    jml=$(printf '%s\n' "$listing" | tail -1 | awk '{print $2}')
    echo "  ✓ $out  ($ukuran, $jml berkas)"
  else
    # Dibuang, bukan sekadar tidak diumumkan — bundle gagal-gerbang yang tetap
    # tergeletak di dist/ cepat atau lambat akan tersebar tanpa sengaja.
    rm -f "$out"
    echo "  → $out dihapus"
    gagal=1
  fi
done

if [ "$gagal" -ne 0 ]; then
  echo
  echo "Ada gerbang yang gagal — bundle di atas JANGAN disebarkan."
  exit 1
fi

# ── Gerbang: dokumentasi harus menautkan bundle versi terkini ──────────
# Nomor versi di README dan docs adalah salinan manual yang bisa basi diam-diam.
# Kalau basi, tautan unduhnya menunjuk berkas yang sudah tidak ada dan menjawab
# 404 — persis yang pernah terjadi pada repo skills.
echo
doc_gagal=0
for s in "${SERVERS[@]}"; do
  nama=$(node -p "require('./$s/manifest.json').name")
  versi=$(node -p "require('./$s/manifest.json').version")
  for doc in README.md README.id.md docs/Installation.md docs/id/Pemasangan.md; do
    [ -f "$doc" ] || continue
    if ! grep -q "$nama-$versi.mcpb" "$doc"; then
      echo "  ✗ $doc tidak menyebut $nama-$versi.mcpb"
      doc_gagal=1
    fi
  done
done
if [ "$doc_gagal" -ne 0 ]; then
  echo
  echo "Dokumentasi tidak sinkron dengan versi bundle — perbaiki sebelum commit."
  exit 1
fi
echo "  ✓ README dan halaman pemasangan menyebut bundle versi terkini"

echo
echo "Selesai. Isi dist/:"
ls -1 dist/*.mcpb
