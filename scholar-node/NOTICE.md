# NOTICE — scholar-paper-search

Copyright (c) 2026 Mubaroq ADB | RPI

This server is licensed under **Creative Commons Attribution-NonCommercial 4.0
International (CC BY-NC 4.0)**. Full text: <https://creativecommons.org/licenses/by-nc/4.0/legalcode>

Free to use, copy, adapt, and share for **non-commercial purposes** with attribution.
Commercial use requires separate permission from the rights holder.

---

## Third-party code bundled into `dist/index.js`

`dist/index.js` is an esbuild bundle. The following MIT-licensed libraries are compiled
**into that file** and are therefore distributed with it. Their MIT licence continues to
govern their own code; the CC BY-NC 4.0 term above applies to the original work only.

| Library | Copyright holder |
|---|---|
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | Copyright (c) 2024 Anthropic, PBC |
| [`zod`](https://github.com/colinhacks/zod) | Copyright (c) 2025 Colin McDonnell |
| [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) | Copyright (c) 2017 Amit Kumar Gupta |
| [`unpdf`](https://github.com/unjs/unpdf) | Copyright (c) 2023-PRESENT Johann Schopplich |

The MIT licence requires that its copyright notice and permission notice travel with every
copy of the software. That is the purpose of this file, and it must remain inside this
bundle when redistributed.

### The MIT License

> Permission is hereby granted, free of charge, to any person obtaining a copy of this
> software and associated documentation files (the "Software"), to deal in the Software
> without restriction, including without limitation the rights to use, copy, modify,
> merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
> permit persons to whom the Software is furnished to do so, subject to the following
> conditions:
>
> The above copyright notice and this permission notice shall be included in all copies
> or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
> INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
> PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
> LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT
> OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
> OTHER DEALINGS IN THE SOFTWARE.

## Services accessed, not copied

This server **calls** external APIs. No data, index, or code from those services is copied
into this bundle. Their terms of use belong to their respective providers and remain the
user's responsibility — in particular, Scopus and ScienceDirect access is governed by your
institution's Elsevier subscription agreement.
