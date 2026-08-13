#!/usr/bin/env bash
# Bangun bundle .mcpb bernomor versi untuk setiap server, lalu periksa hasilnya.
#
#   ./build-mcpb.sh                 # kedua server
#   ./build-mcpb.sh zotero-node     # satu server saja
#
# Keluaran: dist/<nama-manifest>-<versi>.mcpb
#
# Gerbangnya gagal KERAS. Bundle yang membawa node_modules/, src/, atau kunci API
# tertanam tidak diterbitkan — bukan diberi peringatan lalu diteruskan.
set -euo pipefail
cd "$(dirname "$0")"

SERVERS=("${@:-}")
if [ -z "${SERVERS[0]:-}" ]; then SERVERS=(scholar-node zotero-node); fi

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
  versi_pkg=$(node -p "require('./$s/package.json').version")

  # Versi di manifest dan package.json harus sama — kalau berbeda, nomor versi
  # pada nama berkas kehilangan artinya.
  if [ "$versi" != "$versi_pkg" ]; then
    echo "  ✗ versi tidak sinkron: manifest=$versi package.json=$versi_pkg"
    gagal=1; continue
  fi

  [ -d "$s/node_modules" ] || (cd "$s" && npm install --silent)
  (cd "$s" && npm run --silent build)

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

echo
echo "Selesai. Isi dist/:"
ls -1 dist/*.mcpb
