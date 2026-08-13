# NOTICE — karya pihak ketiga di dalam repo ini

Kode kedua server di repo ini **ditulis sendiri**, bukan fork atau turunan proyek lain,
dan dilisensikan **CC BY-NC 4.0** (lihat [`LICENSE`](LICENSE) dan [`COPYRIGHT`](COPYRIGHT)).

Yang berasal dari pihak ketiga adalah pustaka npm yang ikut ter-*bundle* ke dalam
`dist/index.js` oleh esbuild. **Pustaka itu tetap berlisensi MIT** — CC BY-NC 4.0 di atas
berlaku atas karya aslinya saja, tidak atas kode pustaka yang disertakan.

Dasar pencatatannya: **lisensi yang belum diperiksa bukan bukti lisensi permisif.**
Setiap baris di bawah dibaca dari `package.json` dan berkas `LICENSE` pustaka yang
bersangkutan di `node_modules/`, bukan dari ingatan atau dugaan.

## Dependensi runtime — semuanya MIT

| Pustaka | Dipakai oleh | Pemegang hak | Untuk apa |
|---|---|---|---|
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | scholar, zotero | Copyright (c) 2024 Anthropic, PBC | protokol MCP, transport stdio |
| [`zod`](https://github.com/colinhacks/zod) | scholar, zotero | Copyright (c) 2025 Colin McDonnell | validasi skema argumen tool |
| [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) | scholar | Copyright (c) 2017 Amit Kumar Gupta | membaca respons XML arXiv & PubMed |
| [`unpdf`](https://github.com/unjs/unpdf) | scholar | Copyright (c) 2023-PRESENT Johann Schopplich | ekstraksi teks dari PDF |

MIT mengizinkan hasil gabungan disebarkan dengan syarat berbeda — itulah sebabnya bundle
CC BY-NC ini sah memuatnya — **selama pemberitahuan hak ciptanya dipertahankan**.

### Karena itu NOTICE ada di dua tempat

Berkas ini mencatat keseluruhannya untuk pembaca repo. Tetapi orang yang mengunduh satu
berkas `.mcpb` dari `dist/` **tidak menerima isi repo ini** — mereka hanya menerima
bundle itu. Maka salinan atribusi juga ada di dalam **setiap** bundle:

- `scholar-node/NOTICE.md` → ikut ke `scholar-paper-search-*.mcpb`
- `zotero-node/NOTICE.md` → ikut ke `zotero-mcp-*.mcpb`

`build-mcpb.sh` **menolak menghasilkan bundle yang kehilangan `NOTICE.md`**, dan menghapus
bundle yang gagal gerbang itu. Keduanya wajib ikut bila Anda menyebarkan ulang.

## Dependensi build — tidak ikut tersebar

`esbuild` (MIT), `@types/node` (MIT), dan `typescript` (**Apache-2.0**) hanya dipakai di
mesin pengembang. Apache-2.0 menuntut atribusi bila karyanya didistribusikan — karena
tidak ada sepotong pun kode `typescript` yang masuk ke `dist/index.js`, tuntutan itu tidak
berlaku pada `.mcpb` yang Anda unduh.

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
