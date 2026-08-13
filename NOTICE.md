# NOTICE — karya pihak ketiga di dalam repo ini

Kode kedua server di repo ini **ditulis sendiri**, bukan fork atau turunan proyek lain.
Yang berasal dari pihak ketiga hanyalah pustaka npm yang ikut ter-*bundle* ke dalam
`dist/index.js` oleh esbuild — dan karena ia ter-bundle, lisensinya ikut tersebar
bersama setiap berkas `.mcpb`. Berkas ini mencatatnya.

Dasar pencatatannya: **lisensi yang belum diperiksa bukan bukti lisensi permisif.**
Setiap baris di bawah dibaca dari `package.json` pustaka yang bersangkutan di
`node_modules/`, bukan dari ingatan atau dugaan.

## Dependensi runtime — semuanya MIT

| Pustaka | Dipakai oleh | Lisensi | Untuk apa |
|---|---|---|---|
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | scholar, zotero | MIT | protokol MCP, transport stdio |
| [`zod`](https://github.com/colinhacks/zod) | scholar, zotero | MIT | validasi skema argumen tool |
| [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) | scholar | MIT | membaca respons XML arXiv & PubMed |
| [`unpdf`](https://github.com/unjs/unpdf) | scholar | MIT | ekstraksi teks dari PDF |

Dependensi *build* tidak ikut ter-bundle dan tidak tersebar bersama `.mcpb`:
`esbuild` (MIT), `@types/node` (MIT), dan `typescript` (**Apache-2.0**). Apache-2.0
menuntut atribusi bila karyanya didistribusikan — karena `typescript` hanya dipakai
untuk memeriksa tipe di mesin pengembang dan tidak ada sepotong pun kodenya yang masuk
ke `dist/index.js`, tuntutan itu tidak berlaku pada `.mcpb` yang Anda unduh.

Lisensi MIT mengizinkan pemakaian, modifikasi, dan distribusi ulang selama
pemberitahuan hak ciptanya dipertahankan. Karena repo ini juga MIT, tidak ada
pertentangan lisensi.

## Layanan yang diakses, bukan disalin

Kedua server **memanggil** API pihak luar; tidak ada data, indeks, atau kode dari
layanan itu yang disalin ke repo ini. Syarat pemakaiannya milik masing-masing penyedia
dan menjadi tanggung jawab pemakai:

| Layanan | Kunci | Catatan |
|---|---|---|
| arXiv, Crossref, OpenAlex, PubMed, Europe PMC, DOAJ | tidak perlu | terbuka; sebagian meminta *contact email* agar kuotanya lebih longgar |
| Semantic Scholar | opsional | tanpa kunci pun jalan, dengan kuota lebih ketat |
| Scopus & ScienceDirect (Elsevier) | wajib | tunduk pada perjanjian langganan institusi Anda — lihat [dev.elsevier.com](https://dev.elsevier.com) |
| Zotero | tidak perlu di mode lokal | aplikasi Zotero di komputer Anda sendiri |

**Teks penuh berhak cipta yang diambil lewat `sciencedirect_fulltext` tunduk pada
langganan institusi Anda.** Server ini hanya menyalurkan; ia tidak memberi Anda hak
akses yang tidak Anda punya, dan tidak menyimpan apa pun di luar komputer Anda.
