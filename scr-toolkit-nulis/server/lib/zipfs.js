'use strict';
/**
 * Pembaca & penulis ZIP minimal, hanya memakai modul bawaan Node (zlib).
 * Dipakai untuk membaca/menulis .xlsx — yang pada dasarnya arsip ZIP berisi XML.
 *
 * Sengaja tanpa dependensi npm: ekstensi ini harus dapat berjalan di atas Node
 * bawaan Claude Desktop, yang tidak punya npm dan tidak dapat memasang paket.
 */
const zlib = require('node:zlib');

/** Baca seluruh entri ZIP dari buffer. Mengembalikan Map<nama, Buffer>. */
function unzip(buf) {
  const files = new Map();
  // Cari End Of Central Directory (signature 0x06054b50), telusuri dari belakang.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Bukan berkas ZIP yang sah (EOCD tidak ditemukan)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Central directory rusak');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');

    // Header lokal: panjang name/extra bisa berbeda dari central directory.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(dataStart, dataStart + csize);

    files.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Bangun buffer ZIP dari Map<nama, Buffer|string>. Semua entri di-deflate. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, dataIn] of entries) {
    const data = Buffer.isBuffer(dataIn) ? dataIn : Buffer.from(String(dataIn), 'utf8');
    const comp = zlib.deflateRawSync(data, { level: 6 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);          // versi minimum
    lh.writeUInt16LE(0, 6);           // flag
    lh.writeUInt16LE(8, 8);           // metode: deflate
    lh.writeUInt16LE(0, 10);          // waktu (nol: hasil deterministik)
    lh.writeUInt16LE(0x21, 12);       // tanggal (1980-01-01)
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + comp.length;
  }

  const cdStart = offset;
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.size ?? entries.length, 8);
  eocd.writeUInt16LE(entries.size ?? entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(cdStart, 16);

  return Buffer.concat([...locals, cd, eocd]);
}

module.exports = { unzip, zip, crc32 };
