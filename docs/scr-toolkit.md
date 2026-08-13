# scr-toolkit — the deterministic half of a scoping review

*[Baca dalam bahasa Indonesia](id/scr-toolkit.md)*

`scr-toolkit` **1.5.0** · 9 tools · [source](../scr-toolkit/)

Nine tools that do the **deterministic** part of a scoping review: checking, counting,
matching, retrieving. **Not one of them decides eligibility** — judgement stays with the
researcher.

> **This is a companion to the Alur SLR AI course modules, and stays that way.** Each
> tool's description names the module step it serves (`M6 Langkah 2`, `M5 L3`, `M9 L8`).
> Those references are kept deliberately: inside the course they tell participants exactly
> when a tool is used. The table below is enough to use the tools without following the
> course — the tools themselves require no course to run.

## Tools

| Tool | Purpose | Module step |
|---|---|---|
| `pdf_integrity` | Detect truncated downloads that pass the magic-byte check | M6 L2 |
| `pdf_verify_record` | Search for a record title across the **whole** PDF, not just page one | M6 L2 |
| `pdf_match_records` | Match PDFs to records by **content**, not filename | M6 L2 |
| `reconcile_two_pass` | Reconcile two independent passes + arbitration queue | M5 L3 · M6 L5 · M7 L5 |
| `calibration_sample` | Seeded, stratified random calibration sample | M5 L3 |
| `retrieve_fulltext` | Full-text acquisition via Unpaywall + `citation_pdf_url` | M6 L1 |
| `xlsx_read` / `xlsx_write` | Read and write `.xlsx` | every module touching `screening.xlsx` |
| `manuscript_numeric_audit` | Audit manuscript numbers against a fact list | M9 L8 |

## No dependencies, on purpose

No `package.json`, no `node_modules/`, no bundler. ZIP, `.xlsx`, and PDF handling are
implemented directly on Node's built-in modules.

The reason was verified against Claude Desktop 1.24012.9's own code: `node`-type extensions
are run with the **built-in Node** when no system Node is present, whereas `python` type
only gets "*falling back to system exec and hoping*". That built-in Node **has no npm** and
cannot install packages. A single dependency would break the extension on exactly the
machines it is meant to serve — participants who are not IT people and have no toolchain.

## The required order before any PDF is used

```
pdf_integrity  →  pdf_match_records  →  pdf_verify_record
```

This is not theoretical caution. PDFs downloaded by other tools are named
`core_11443100.pdf` or after a Zotero attachment — not `SCR[ID]_` — so they are **invisible**
to filename-based checks, even though files from outside are precisely the ones that most
need verifying. In one real review, `download_with_fallback` returned a valid PDF containing
**an entirely different article**.

**Matching is position-weighted.** A title appearing only near the end of a file comes from
the reference list — meaning that article is *cited*, not the article in this file. One file
was once matched to a different record purely because that record appeared in footnote 56.

**Files already named `SCR[ID]_` are never renamed on the basis of content.** Measured over
92 real PDFs, content matching assigned a different ID to 2 files. Discrepancies like that
are **reported as a conflict for the researcher to settle**, not acted on.

## Limits to know before trusting it

**Text extraction.** Tools that read a PDF's text layer use `pdftotext` (poppler) when
installed, and fall back to a built-in extractor when not. Measured over 432 quotations from
a real corpus: the built-in extractor found 73%, and of those it missed, **18 of 23 were
genuinely present** according to `pdftotext`.

> **The built-in extractor may only PROVE a match; it never denies one.** A record title not
> found without `pdftotext` is reported `TIDAK_DAPAT_DIPERIKSA` (cannot be checked), never
> `MISMATCH`. An accusing verdict is issued only when `pdftotext` is available.

Installing poppler raises the quality of the check but is not a requirement for use.

**Scanned PDFs** are recognised by **text density**, not by whether extraction succeeded — a
scanned file still returns page numbers and headers, so extraction appears to work. The
threshold is 800 characters per page; the real-corpus median is 2,713. One scanned file at
399 characters per page was once declared not to contain its article, when in fact the
content was valid and simply an image.

**`xlsx_write` rewrites the entire file.** It is not a cell editor — include every sheet you
want to keep, or write to a new file.

**`calibration_sample` requires a `seed`.** `Math.random` cannot be seeded, so the sample
would not be reproducible — and reproducibility is the entire reason that step exists.

## Alongside scholar and zotero

There is no tool-name collision. The danger is not the names but the **files** — which is
what `pdf_match_records` addresses.

Zotero is an advantage when used together: it holds PDFs already obtained through
institutional access, precisely the group of records `retrieve_fulltext` cannot reach.

`retrieve_fulltext` separates `NEED_MANUAL` from `NEED_INSTITUTIONAL`. The first is open
access but the server refuses scripts — it just needs opening in a browser. Merging the two
sends participants to the library for articles that are in fact freely available.

## Token cost

Reading PDFs is the largest cost driver in the whole workflow. Measured on a real corpus
(sample of 5 PDFs near the median):

| Stage | Per source | At 92 / 60 sources |
|---|---|---|
| M6 full-text screening (Pass 1) | ≈38,000 tokens | ≈3.5M for 92 sources |
| M7 charting (Pass 1 + Pass 2) | ≈40,000 tokens per pass | ≈4.8M for 60 sources |

This is why the modules instruct stopping and reporting **every 5–10 PDFs** rather than
running to exhaustion. Accumulated context makes cost grow quadratically, not linearly.

Fuller detail is in [this server's README](../scr-toolkit/README.md) (Indonesian).

---

[← Back](README.md) · [Installation](Installation.md) · [scholar](scholar.md) · [zotero](zotero.md) · [FAQ](FAQ.md)
