#!/usr/bin/env node
// Menyalakan server di dalam bundle hasil pack, lalu membandingkan versi yang
// DIUMUMKANNYA lewat handshake MCP dengan versi di manifest.json.
//
//   node scripts/cek-versi-server.js <dir-bundle-terekstrak>
//
// Keluar 0 bila cocok, 1 bila tidak.
//
// Kenapa handshake, bukan grep: versi bisa ditulis di mana saja di dalam kode —
// konstanta, template, hasil require. Satu-satunya jawaban yang tidak bisa keliru
// adalah yang diucapkan server itu sendiri. Inilah yang dibaca Claude Desktop.
//
// Pernah terjadi: scr-toolkit 1.5.0 mengumumkan dirinya 1.4.0 karena versinya
// dikeraskan di server/index.js, terpisah dari manifest.json.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const dir = process.argv[2];
if (!dir) {
  console.error("pemakaian: node scripts/cek-versi-server.js <dir-bundle-terekstrak>");
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const diharapkan = manifest.version;
const masuk = manifest?.server?.entry_point;

if (!masuk) {
  console.error("     manifest tidak punya server.entry_point");
  process.exit(1);
}

const anak = spawn(process.execPath, [path.join(dir, masuk)], {
  stdio: ["pipe", "pipe", "ignore"],
  // Dijalankan dari folder bundle, bukan dari cwd pemanggil.
  cwd: dir,
});

let keluaran = "";
let selesai = false;

// Server yang menggantung tidak boleh menggantungkan build.
const jam = setTimeout(() => {
  if (selesai) return;
  selesai = true;
  anak.kill("SIGKILL");
  console.error("     server tidak menjawab handshake dalam 15 detik");
  process.exit(1);
}, 15000);

anak.stdout.on("data", (b) => {
  keluaran += b.toString();
  for (const baris of keluaran.split("\n")) {
    const s = baris.trim();
    if (!s) continue;
    let o;
    try { o = JSON.parse(s); } catch { continue; }
    if (o.id !== 1) continue;

    selesai = true;
    clearTimeout(jam);
    anak.kill("SIGKILL");

    const diumumkan = o?.result?.serverInfo?.version;
    if (diumumkan !== diharapkan) {
      console.error(
        `     versi tidak sinkron: manifest.json=${diharapkan} ` +
        `tetapi server mengumumkan ${diumumkan ?? "(tidak ada)"}`
      );
      process.exit(1);
    }
    process.exit(0);
  }
});

anak.on("error", (e) => {
  if (selesai) return;
  selesai = true;
  clearTimeout(jam);
  console.error(`     server gagal dijalankan: ${e.message}`);
  process.exit(1);
});

anak.stdin.write(JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "cek-versi-server", version: "1" },
  },
}) + "\n");
