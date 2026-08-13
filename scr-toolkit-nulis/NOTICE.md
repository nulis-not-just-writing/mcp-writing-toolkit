# NOTICE — scr-toolkit-nulis

Copyright (c) 2026 Mubaroq ADB | RPI

This server is licensed under **Creative Commons Attribution-NonCommercial 4.0
International (CC BY-NC 4.0)**. Full text: <https://creativecommons.org/licenses/by-nc/4.0/legalcode>

Free to use, copy, adapt, and share for **non-commercial purposes** with attribution.
Commercial use requires separate permission from the rights holder.

Originally built as the deterministic-work companion to the **Alur SLR AI** scoping review
course modules, and still maintained as such — its tool descriptions cite module steps
(M5 L3, M6 Langkah 2, M9 L8) by design.

---

## No third-party code is bundled

Unlike the other two servers in this repo, `scr-toolkit-nulis` has **no npm dependencies at
all** — no `package.json`, no `node_modules/`, no bundler. ZIP, `.xlsx`, and PDF handling
are implemented directly on Node's built-in modules (`node:zlib`, `node:fs`, `node:path`,
`node:child_process`, and global `fetch`).

That is a deliberate constraint, not an oversight. Claude Desktop runs `node`-type
extensions on its **built-in Node**, which has no npm and cannot install packages. A
dependency would make the extension fail on exactly the machines it is meant to serve —
participants who are not IT people and have no toolchain installed.

**Consequence for this notice:** there is no third-party copyright to reproduce here. The
CC BY-NC 4.0 term above governs the whole of it.

## External tools called, not bundled

| Tool | Required | Role |
|---|---|---|
| `pdftotext` (part of [poppler](https://poppler.freedesktop.org/)) | no | higher-quality PDF text extraction when installed |

`pdftotext` is **invoked as a separate process if present on the system**; none of its code
is copied or bundled here, and it is not a dependency of this package. Poppler is licensed
GPL-2.0-only OR GPL-3.0-only — but executing a program as a subprocess is not linking
against it, so those terms do not extend to this server. If you install poppler yourself,
your copy is governed by its own licence.

Without `pdftotext`, the built-in extractor takes over — and the server deliberately
downgrades its own authority: it may then only **prove** a match, never deny one. A record
title not found in low-quality text is reported `TIDAK_DAPAT_DIPERIKSA`, never `MISMATCH`.

## Services accessed

| Service | Key | Note |
|---|---|---|
| [Unpaywall](https://unpaywall.org/) | not required | open-access full-text lookup |
| Publisher `citation_pdf_url` | not required | fetched directly from the article landing page |

Nothing is transmitted anywhere else, and no telemetry is collected. Whether a given PDF
may be downloaded and retained is governed by the publisher's terms and your institution's
subscription — this server only performs the retrieval you ask for.
