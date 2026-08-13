# scr-toolkit-nulis — the deterministic half of a scoping review

*[Baca dalam bahasa Indonesia](id/scr-toolkit.md)*

`scr-toolkit-nulis` **2.0.0** · 9 tools · [source](../scr-toolkit-nulis/)

Nine tools that do the **deterministic** part of a scoping review: checking, counting,
matching, retrieving. **Not one of them decides eligibility** — judgement stays with the
researcher.

> **This is a companion to the Alur SLR AI course modules, and stays that way.** Each
> tool's description names the module step it serves (`M6 Langkah 2`, `M5 L3`, `M9 L8`).
> Those references are kept deliberately: inside the course they tell participants exactly
> when a tool is used. The table below is enough to use the tools without following the
> course — the tools themselves require no course to run.

## What it is actually for

Screening a few hundred records by hand is where scoping reviews quietly go wrong — not
through bad judgement, but through arithmetic, filenames, and fatigue. These four tools
handle the parts that should never depend on attention. Outputs below are real.

### 1. Two screening passes disagree and you need to know exactly where

Doing two independent passes is the easy part. Comparing them, counting agreement, and
building a list of what needs settling is tedious and error-prone by hand.

> *"Reconcile my two screening passes and give me the arbitration queue."*

```json
{ "summary": {
    "records_compared": 5, "identical_decisions": 3, "identical_pct": 60,
    "arbitration_queue": 2,
    "forwarded_union": 3, "forwarded_intersection": 1, "forwarded_final_range": [1, 3],
    "disagreement_patterns": { "EXCLUDE vs INCLUDE": 1, "UNCERTAIN vs EXCLUDE": 1 } } }
```

`forwarded_final_range` is the honest answer to "how many studies go forward?" before
arbitration: somewhere between 1 and 3. Not a single invented number.

The queue itself comes back as rows with both passes side by side and **empty
`Author_Decision` / `Author_Reason` columns waiting for you** — the tool prepares the
decision, it does not make it.

One detail worth seeing: in that run, one record was `Reason_Code: "-"` in pass 1 and
`"NA"` in pass 2. It did **not** enter the queue. Treating `-`, `NA`, `n/a`, and blank as
the same value is deliberate — the distinction once produced 182 false disputes in a single
real review.

### 2. Your calibration sample has to be defensible

> *"Draw a stratified calibration sample of 4, seed 42."*

Run it twice, get the same four records:

```
run 1: S03, S04, S06, S07
run 2: S03, S04, S06, S07
seed 7: S04, S06, S07, S09
```

That is why `seed` is **required** and not optional. `Math.random` cannot be seeded, so a
sample drawn with it can never be re-drawn — and being able to re-draw it is the entire
reason the calibration step exists. Report the seed in your Methods and anyone can reproduce
your sample exactly.

### 3. You are not sure the PDFs are the articles they claim to be

This sounds paranoid until it happens. A downloader returns HTTP 200 and a file that starts
with `%PDF` — and contains a completely different article. Filename checks cannot see it,
because files from `scholar-nulis` or Zotero are not named `SCR[ID]_` in the first place.

> *"Check the integrity of every PDF in this folder, then match them to my records by
> content."*

The three tools run in order — `nulis_pdf_integrity` → `nulis_pdf_match_records` → `nulis_pdf_verify_record` —
and matching is **position-weighted**, so a title found only in the bibliography is read as
"this article is cited here", not "this is that article".

### 4. The numbers in your manuscript have to match your data

`nulis_manuscript_numeric_audit` compares every figure in the draft against a fact list you
supply. This is the last gate before submission, where "we screened 412 records" in the
abstract and "411" in the flow diagram is exactly the kind of discrepancy a reviewer finds
and you do not.

## Tools

| Tool | Purpose | Module step |
|---|---|---|
| `nulis_pdf_integrity` | Detect truncated downloads that pass the magic-byte check | M6 L2 |
| `nulis_pdf_verify_record` | Search for a record title across the **whole** PDF, not just page one | M6 L2 |
| `nulis_pdf_match_records` | Match PDFs to records by **content**, not filename | M6 L2 |
| `nulis_reconcile_two_pass` | Reconcile two independent passes + arbitration queue | M5 L3 · M6 L5 · M7 L5 |
| `nulis_calibration_sample` | Seeded, stratified random calibration sample | M5 L3 |
| `nulis_retrieve_fulltext` | Full-text acquisition via Unpaywall + `citation_pdf_url` | M6 L1 |
| `nulis_xlsx_read` / `nulis_xlsx_write` | Read and write `.xlsx` | every module touching `screening.xlsx` |
| `nulis_manuscript_numeric_audit` | Audit manuscript numbers against a fact list | M9 L8 |

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
nulis_pdf_integrity  →  nulis_pdf_match_records  →  nulis_pdf_verify_record
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

**`nulis_xlsx_write` rewrites the entire file.** It is not a cell editor — include every sheet you
want to keep, or write to a new file.

**`nulis_calibration_sample` requires a `seed`.** `Math.random` cannot be seeded, so the sample
would not be reproducible — and reproducibility is the entire reason that step exists.

## Alongside scholar and zotero

There is no tool-name collision. The danger is not the names but the **files** — which is
what `nulis_pdf_match_records` addresses.

Zotero is an advantage when used together: it holds PDFs already obtained through
institutional access, precisely the group of records `nulis_retrieve_fulltext` cannot reach.

`nulis_retrieve_fulltext` separates `NEED_MANUAL` from `NEED_INSTITUTIONAL`. The first is open
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

Fuller detail is in [this server's README](../scr-toolkit-nulis/README.md) (Indonesian).

---

[← Back](README.md) · [Installation](Installation.md) · [scholar](scholar.md) · [zotero](zotero.md) · [FAQ](FAQ.md)
