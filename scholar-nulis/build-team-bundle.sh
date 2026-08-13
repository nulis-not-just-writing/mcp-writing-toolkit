#!/usr/bin/env bash
# Bangun varian bundle dengan kunci Elsevier tertanam, untuk tim riset.
#
# Kunci TIDAK disimpan di repo ini. Ia dibaca dari variabel lingkungan saat build,
# lalu hanya berada di dalam berkas .mcpb hasilnya. Jalankan:
#
#   ELSEVIER_KEY=xxxxx ./build-team-bundle.sh
#
# Keluaran default: ../scholar-nulis-api.mcpb (diabaikan git).
set -euo pipefail

# Kunci dicari berurutan: variabel lingkungan → keychain macOS.
if [ -z "${ELSEVIER_KEY:-}" ] && command -v security >/dev/null 2>&1; then
  ELSEVIER_KEY="$(security find-generic-password -s elsevier-api-key -w 2>/dev/null || true)"
fi

if [ -z "${ELSEVIER_KEY:-}" ]; then
  cat >&2 <<'PESAN'
Kunci Elsevier belum tersedia.

Sekali saja, simpan ke keychain macOS:
  security add-generic-password -s elsevier-api-key -a "$USER" -w '<kunci>'

Setelah itu skrip ini cukup dijalankan tanpa argumen apa pun.
Alternatif sekali pakai:
  ELSEVIER_KEY=<kunci> ./build-team-bundle.sh

Pakai kunci yang BELUM pernah dikirim lewat chat, email, atau tiket —
terbitkan yang baru di dev.elsevier.com bila ragu.
PESAN
  exit 1
fi

cd "$(dirname "$0")"
OUT="${1:-../scholar-nulis-api.mcpb}"
BUILD=".build-api"

export npm_config_cache="${npm_config_cache:-${TMPDIR:-/tmp}/npmcache}"
if [ -x node_modules/.bin/esbuild ]; then
  node_modules/.bin/esbuild src/index.ts --bundle --platform=node --target=node20 \
    --format=cjs --outfile=dist/index.js --log-level=warning
else
  npm run build >/dev/null
fi

rm -rf "$BUILD" && mkdir -p "$BUILD/dist"
cp dist/index.js "$BUILD/dist/index.js"
cp package.json "$BUILD/package.json"
printf '.mcpbignore\n*.log\n' > "$BUILD/.mcpbignore"

ELSEVIER_KEY="$ELSEVIER_KEY" python3 - "$BUILD" <<'PY'
import json, io, os, sys
b = sys.argv[1]
m = json.load(io.open("manifest.json", encoding="utf-8"))
m["name"] = "scholar-nulis-api"
m["display_name"] = "Scholar Nulis (kunci tim tertanam)"
m["description"] = (m["description"].split(" Scopus/ScienceDirect tools")[0] +
                    " BUILD TIM RISET: kunci Elsevier tertanam di dalam berkas ini — "
                    "dapat dibaca siapa pun yang membuka arsipnya. Jangan diunggah atau dibagikan di luar tim.")
env = m["server"]["mcp_config"]["env"]
env["SCOPUS_API_KEY"] = os.environ["ELSEVIER_KEY"]
env["SCIENCEDIRECT_API_KEY"] = os.environ["ELSEVIER_KEY"]
for k in ("scopus_api_key", "sciencedirect_api_key"):
    m["user_config"].pop(k, None)
json.dump(m, io.open(f"{b}/manifest.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
PY

( cd "$BUILD" && npx --yes @anthropic-ai/mcpb pack . "../$OUT" >/dev/null )
rm -rf "$BUILD"
echo "Selesai: $OUT"
echo "Kunci hanya ada di dalam berkas itu — tidak ada salinan di repo."
