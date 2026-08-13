#!/usr/bin/env node
// Menyalakan server di dalam bundle hasil pack, lalu membandingkan nama dan versi
// yang DIUMUMKANNYA lewat handshake MCP dengan yang tertulis di manifest.json.
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
//
// Nama diperiksa dengan alasan yang sama. Saat server diganti nama, nama yang
// dikeraskan di sumber gampang tertinggal — dan akibatnya lebih buruk daripada
// versi yang salah: dua ekstensi berbeda bisa mengumumkan diri dengan nama sama.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// Dijadikan absolut lebih dulu. Anaknya dijalankan dengan cwd = folder bundle,
// jadi jalur relatif akan teresolusi dua kali ("b" + "b/dist/index.js") dan
// prosesnya mati diam-diam sampai kehabisan waktu.
const dir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!dir) {
  console.error("pemakaian: node scripts/cek-versi-server.js <dir-bundle-terekstrak>");
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const diharapkanVersi = manifest.version;
const diharapkanNama = manifest.name;
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

    const si = o?.result?.serverInfo ?? {};
    const salah = [];
    if (si.name !== diharapkanNama) {
      salah.push(
        `nama tidak sinkron: manifest.json=${diharapkanNama} ` +
        `tetapi server mengumumkan ${si.name ?? "(tidak ada)"}`
      );
    }
    if (si.version !== diharapkanVersi) {
      salah.push(
        `versi tidak sinkron: manifest.json=${diharapkanVersi} ` +
        `tetapi server mengumumkan ${si.version ?? "(tidak ada)"}`
      );
    }
    if (salah.length) {
      console.error("     " + salah.join("\n     "));
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
