#!/usr/bin/env bash
# Cerminkan docs/ ke GitHub Wiki, dua bahasa.
#
# docs/ adalah SUMBER KANONIK — ia ikut versi bersama server yang dijelaskannya.
# Wiki hanyalah cerminan. Jangan pernah menyunting wiki langsung: perubahannya
# akan tertimpa saat sinkronisasi berikutnya.
#
# Pemetaan halaman:
#   docs/README.md        →  Home              docs/id/README.md      →  ID-Beranda
#   docs/Installation.md  →  Installation      docs/id/Pemasangan.md  →  ID-Pemasangan
#   docs/scholar.md       →  scholar           docs/id/scholar.md     →  ID-scholar
#   docs/zotero.md        →  zotero            docs/id/zotero.md      →  ID-zotero
#   docs/scr-toolkit.md   →  scr-toolkit       docs/id/scr-toolkit.md →  ID-scr-toolkit
#   docs/FAQ.md           →  FAQ               docs/id/Tanya-jawab.md →  ID-Tanya-jawab
#
# Tiga kelas tautan yang harus ditulis ulang — dan wiki TIDAK berada di dalam
# pohon repo, jadi jalur relatif ke luar docs/ pasti mati kalau dibiarkan:
#
#   1. sesama halaman docs   →  nama halaman wiki, tanpa ekstensi .md
#   2. lintas bahasa         →  nama halaman wiki pasangannya
#   3. ke berkas repo (../)  →  URL absolut github.com/.../blob|tree/main/...
#
# Arti "../" bergantung kedalaman berkas sumbernya: di docs/ ia menunjuk akar
# repo, di docs/id/ ia menunjuk docs/. Karena itu kedua folder diproses dengan
# aturan yang berbeda, bukan satu regex untuk semuanya.
#
# Prasyarat sekali seumur repo: wiki harus sudah punya minimal satu halaman.
# GitHub baru membuat repo wiki setelah halaman pertama dibuat lewat antarmuka
# web — tidak ada API-nya.

set -euo pipefail
cd "$(dirname "$0")"

SLUG="nulis-not-just-writing/mcp-writing-toolkit"
REMOTE="https://github.com/$SLUG.wiki.git"
BLOB="https://github.com/$SLUG/blob/main"
TREE="https://github.com/$SLUG/tree/main"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if ! git clone -q "$REMOTE" "$WORK/wiki" 2>/dev/null; then
  echo "✗ Repo wiki belum ada."
  echo "  Buka https://github.com/$SLUG/wiki"
  echo "  → 'Create the first page' → isi apa saja → Save Page."
  echo "  Lalu jalankan skrip ini lagi."
  exit 1
fi

W="$WORK/wiki"
find "$W" -maxdepth 1 -name '*.md' -delete

# ── Halaman Inggris (docs/*.md) ────────────────────────────────────────
for src in docs/*.md; do
  base=$(basename "$src")
  [ "$base" = "README.md" ] && dst="$W/Home.md" || dst="$W/$base"
  sed -E "
    # ke berkas repo: folder -> /tree/main, berkas -> /blob/main
    s#\]\(\.\./([^)]*/)\)#](${TREE}/\1)#g
    s#\]\(\.\./([^)]+)\)#](${BLOB}/\1)#g
    # lintas bahasa
    s#\]\(id/README\.md\)#](ID-Beranda)#g
    s#\]\(id/([A-Za-z0-9_-]+)\.md\)#](ID-\1)#g
    # sesama halaman Inggris
    s#\]\(README\.md\)#](Home)#g
    s#\]\(([A-Za-z0-9_-]+)\.md\)#](\1)#g
  " "$src" > "$dst"
done

# ── Halaman Indonesia (docs/id/*.md) ───────────────────────────────────
for src in docs/id/*.md; do
  base=$(basename "$src")
  case "$base" in
    README.md)      dst="$W/ID-Beranda.md" ;;
    *)              dst="$W/ID-${base}" ;;
  esac
  sed -E "
    # ke berkas repo (dua tingkat naik)
    s#\]\(\.\./\.\./([^)]*/)\)#](${TREE}/\1)#g
    s#\]\(\.\./\.\./([^)]+)\)#](${BLOB}/\1)#g
    # ke halaman Inggris (satu tingkat naik) — '../README.md' di sini berarti
    # indeks docs Inggris, BUKAN README akar repo
    s#\]\(\.\./README\.md\)#](Home)#g
    s#\]\(\.\./([A-Za-z0-9_-]+)\.md\)#](\1)#g
    # sesama halaman Indonesia
    s#\]\(README\.md\)#](ID-Beranda)#g
    s#\]\(([A-Za-z0-9_-]+)\.md\)#](ID-\1)#g
  " "$src" > "$dst"
done

# ── Sidebar & footer (khusus wiki, tidak ada padanannya di docs/) ──────
cat > "$W/_Sidebar.md" <<EOF
**[Home](Home)** · [Bahasa Indonesia](ID-Beranda)

**Start**
- [Installation](Installation)

**Servers**
- [scholar](scholar)
- [zotero](zotero)
- [scr-toolkit](scr-toolkit)

**More**
- [FAQ](FAQ)

---

**[Bahasa Indonesia](ID-Beranda)**
- [Pemasangan](ID-Pemasangan)
- [scholar](ID-scholar)
- [zotero](ID-zotero)
- [scr-toolkit](ID-scr-toolkit)
- [Tanya jawab](ID-Tanya-jawab)
EOF

# Footer muncul di SETIAP halaman wiki, jadi kata penutupnya cukup ditulis
# sekali di sini — tidak perlu disalin ke tiap halaman.
cat > "$W/_Footer.md" <<EOF
---

> **Knowledge unshared dies. Knowledge shared keeps living.**
>
> It grows in hands you will never meet and is carried on in work you will never read — and what
> never stops living never stops returning to you.

**Mubaroq ADB** · Akademi Digital Bandung | RPI Institute · <mubaroq@digitalbdg.ac.id>

<sub>Mirror of \`docs/\` — do not edit here; edit in the [repository]($TREE/docs). ·
Cerminan \`docs/\`, jangan disunting di sini. · CC BY-NC 4.0</sub>
EOF

# ── Gerbang: tidak boleh ada tautan yang pasti mati di wiki ────────────
sisa=$(grep -rlE '\]\((\.\./|[A-Za-z0-9_-]+\.md\))' "$W" 2>/dev/null || true)
if [ -n "$sisa" ]; then
  echo "✗ Masih ada tautan relatif/berekstensi yang akan mati di wiki:"
  for f in $sisa; do
    printf '  %s\n' "$(basename "$f")"
    grep -oE '\]\((\.\./[^)]*|[A-Za-z0-9_-]+\.md)\)' "$f" | sed 's/^/     /' | sort -u
  done
  exit 1
fi

cd "$W"
if [ -z "$(git status --porcelain)" ]; then
  echo "  Tidak ada perubahan — wiki sudah sama dengan docs/."
  exit 0
fi

git add -A
git -c user.name="Mubaroq ADB" -c user.email="isma@upi.edu" \
    commit -q -m "Segarkan dari docs/ (cerminan otomatis, dua bahasa)"
git push -q origin HEAD
echo "  ✓ Wiki disegarkan: $(ls *.md | wc -l | tr -d ' ') halaman"
