#!/usr/bin/env node
// Menolak manifest.json yang membawa kredensial tertanam di mcp_config.env.
//
//   node scripts/cek-kunci-tertanam.js <path/manifest.json>
//
// Keluar 0 bila bersih, 1 bila ada temuan.
//
// Dipanggil build-mcpb.sh pada manifest DI DALAM bundle hasil pack — bukan pada
// berkas sumber — karena yang tersebar ke pengguna adalah yang di dalam bundle.
//
// Bukan "setiap nilai harfiah itu rahasia". ZOTERO_LIBRARY_TYPE="user" adalah
// konstanta Zotero yang sah, dan gerbang yang menolaknya akan segera dimatikan
// orang karena dianggap cerewet. Dua aturan di bawah menyasar rahasianya saja.

const fs = require("fs");

const berkas = process.argv[2];
if (!berkas) {
  console.error("pemakaian: node scripts/cek-kunci-tertanam.js <path/manifest.json>");
  process.exit(2);
}

const m = JSON.parse(fs.readFileSync(berkas, "utf8"));
const env = m?.server?.mcp_config?.env ?? {};

const PLACEHOLDER = /^\$\{user_config\./;
// Nama yang menurut namanya sendiri menyimpan rahasia.
const NAMA_RAHASIA = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH)/i;
// Bentuk khas kredensial: panjang, tanpa spasi, campuran huruf-angka.
const BENTUK_RAHASIA = /^[A-Za-z0-9_\-]{16,}$/;

const temuan = [];

for (const [nama, nilai] of Object.entries(env)) {
  const v = String(nilai);
  if (PLACEHOLDER.test(v)) continue; // diisi dari formulir ekstensi — aman

  // Aturan A — nama berbau rahasia wajib placeholder, apa pun isinya.
  if (NAMA_RAHASIA.test(nama)) {
    temuan.push(`${nama} = nilai harfiah (nama ini wajib memakai \${user_config.*})`);
    continue;
  }

  // Aturan B — nilai apa pun yang berbentuk kredensial, sekalipun namanya polos.
  if (BENTUK_RAHASIA.test(v)) {
    temuan.push(`${nama} = nilai sepanjang ${v.length} karakter berbentuk kredensial`);
  }
}

if (temuan.length) {
  console.error("     " + temuan.join("\n     "));
  process.exit(1);
}
process.exit(0);
