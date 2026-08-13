#!/usr/bin/env node
// Menyalakan server di dalam bundle hasil pack, lalu membandingkan NAMA, VERSI,
// dan DAFTAR TOOL yang diumumkannya lewat handshake MCP dengan manifest.json.
//
//   node scripts/cek-identitas-server.js <dir-bundle-terekstrak>
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
//
// Daftar tool diperiksa karena manifest.json dan kode adalah DUA sumber terpisah.
// manifest.json yang dibaca halaman ekstensi; kode yang menentukan tool mana yang
// benar-benar ada. Keduanya bisa berbeda tanpa satu pun error muncul — pengguna
// melihat tool di daftar lalu memanggilnya dan gagal, atau sebaliknya.
//
// Sebagian tool didaftarkan BERSYARAT: scholar-nulis hanya mendaftarkan lima tool
// Elsevier bila ada kunci. Manifest mendaftar semua yang MUNGKIN ditawarkan
// ekstensi, jadi tanpa kunci keduanya wajar berbeda. Supaya perbandingannya tetap
// bermakna, server dijalankan dengan kunci tiruan berbentuk sah — pendaftaran
// hanya memeriksa bentuk kunci, tidak memanggil jaringan apa pun.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// Dijadikan absolut lebih dulu. Anaknya dijalankan dengan cwd = folder bundle,
// jadi jalur relatif akan teresolusi dua kali ("b" + "b/dist/index.js") dan
// prosesnya mati diam-diam sampai kehabisan waktu.
const dir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!dir) {
  console.error("pemakaian: node scripts/cek-identitas-server.js <dir-bundle-terekstrak>");
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const diharapkanVersi = manifest.version;
const diharapkanNama = manifest.name;
const diharapkanTool = (manifest.tools ?? []).map((t) => t.name).sort();
const masuk = manifest?.server?.entry_point;

if (!masuk) {
  console.error("     manifest tidak punya server.entry_point");
  process.exit(1);
}

const KUNCI_TIRUAN = "0".repeat(32); // 32 heksadesimal: lolos pemeriksaan bentuk

const anak = spawn(process.execPath, [path.join(dir, masuk)], {
  stdio: ["pipe", "pipe", "ignore"],
  // Dijalankan dari folder bundle, bukan dari cwd pemanggil.
  cwd: dir,
  env: {
    ...process.env,
    SCOPUS_API_KEY: KUNCI_TIRUAN,
    SCIENCEDIRECT_API_KEY: KUNCI_TIRUAN,
  },
});

let keluaran = "";
let selesai = false;
const hasil = { serverInfo: {} };

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
    if (o.id === 1) {
      // Lanjutkan ke tools/list sebelum menilai apa pun.
      hasil.serverInfo = o?.result?.serverInfo ?? {};
      anak.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
      anak.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
      continue;
    }
    if (o.id !== 2) continue;

    selesai = true;
    clearTimeout(jam);
    anak.kill("SIGKILL");

    const si = hasil.serverInfo;
    const toolDiumumkan = (o?.result?.tools ?? []).map((t) => t.name).sort();
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
    // Perbandingan dua arah: yang dijanjikan manifest tetapi tidak ada, DAN
    // yang benar-benar ada tetapi tidak dijanjikan.
    const hilang = diharapkanTool.filter((n) => !toolDiumumkan.includes(n));
    const asing  = toolDiumumkan.filter((n) => !diharapkanTool.includes(n));
    if (hilang.length) salah.push(`tool ada di manifest tetapi tidak didaftarkan server: ${hilang.join(", ")}`);
    if (asing.length)  salah.push(`tool didaftarkan server tetapi tidak ada di manifest: ${asing.join(", ")}`);

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
