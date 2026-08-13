# scholar — literature search and citation verification

*[Baca dalam bahasa Indonesia](id/scholar.md)*

`scholar-paper-search` **0.6.0** · 16 tools, or 21 with an Elsevier key · [source](../scholar-node/)

Searches seven open scholarly APIs, verifies citations by DOI, finds legal open-access
PDFs, downloads them, and reads their text. Five Scopus/ScienceDirect tools switch on if
you have Elsevier credentials.

## What it is actually for

Four situations that come up constantly in real writing, and what you do about them. Every
output below is real — copied from an actual run, not illustrative.

### 1. You have a reference list and you are not certain all of it is real

The failure mode is specific. Invented references do not look invented; they look
*ordinary*. A plausible author, a plausible year, a plausible journal. Reading them more
carefully will not help, because there is nothing on the page to notice.

> *"Check every DOI in my reference list against Crossref and tell me which ones do not
> resolve."*

A real one comes back with its registered record:

```json
{ "verified": true, "retracted": false,
  "paper": { "title": "The PRISMA 2020 statement: an updated guideline for reporting
             systematic reviews", "authors": ["Matthew J Page", "Joanne E McKenzie", …] } }
```

An invented one comes back unambiguously:

```json
{ "verified": false,
  "doi": "10.1016/j.jclinepi.2023.99999",
  "note": "DOI tidak ditemukan di Crossref — tandai [VERIFY]." }
```

That is the whole point of the tool. It converts "this looks fine" into a yes or a no.

### 2. You are about to cite a study that has been retracted

Citing retracted work is a serious error, and nothing in the PDF you downloaded will
necessarily tell you. `get_paper_by_doi` checks retraction status on every lookup — you do
not have to ask for it:

```json
{ "verified": true,
  "retracted": true,
  "retraction_evidence": {
    "dari_judul": "RETRACTED: Ileal-lymphoid-nodular hyperplasia, non-specific colitis,
                   and pervasive developmental disorder in children" },
  "peringatan": "STUDI INI DICABUT (retracted) … Jangan disintesis. Bila tetap dibahas
                 karena alasan tertentu, nyatakan statusnya secara eksplisit di teks." }
```

Note what it does **not** do: it does not delete the reference for you. A retracted study is
sometimes cited deliberately — in a paper about research integrity, for instance. It tells
you, and leaves the decision where it belongs.

### 3. You need the actual PDF, legally

> *"Find me an open-access PDF for this DOI."*

```json
{ "found": true, "via": "unpaywall", "oa_status": "hybrid", "license": "cc-by",
  "pdf_url": "https://www.bmj.com/content/bmj/372/bmj.n71.full.pdf" }
```

The `license` field matters more than it looks: it is the difference between "I may read
this" and "I may redistribute this to my students". Without `CONTACT_EMAIL` the same lookup
still succeeds through OpenAlex, but returns no licence.

### 4. You are running a systematic search that a reviewer will re-run

`search_scopus` returns the total hit count for the identification box of your PRISMA
diagram, and `scopus_export_csv` pages through the whole result set into a screening-ready
file. Because the query is passed through untouched, the number you report and the string
you report agree with each other — see [below](#queries-are-passed-through-verbatim).

## Search — no key required

| Tool | Purpose |
|---|---|
| `search_arxiv` | Search arXiv |
| `search_openalex` | Search OpenAlex (year filter) |
| `search_crossref` | Search Crossref |
| `search_semantic_scholar` | Search Semantic Scholar |
| `search_pubmed` | Search PubMed |
| `search_europepmc` | Search Europe PMC |
| `search_doaj` | Search open-access journal articles in DOAJ |

All seven work without registration. Setting `CONTACT_EMAIL` puts you in the Crossref and
OpenAlex *polite pool* — a more generous quota, and your requests are no longer treated as
anonymous traffic.

## Verification and access

| Tool | Purpose |
|---|---|
| `get_paper_by_doi` | Verify and retrieve paper metadata by DOI (Crossref) |
| `get_open_access_pdf` | Find a legal open-access PDF link for a DOI |
| `download_pdf` | Download a PDF from a URL |
| `download_arxiv` | Download an arXiv paper's PDF |
| `read_arxiv_paper` | Read the full text of an arXiv paper |
| `read_pdf` | Extract text from a PDF (URL or local file) |
| `pdf_to_text` | Extract a PDF's text and save it as `.md` under `fulltext/` |
| `batch_acquire_pdfs` | Attempt PDF downloads for a whole set of studies at once |

**`get_paper_by_doi` is the most important tool here.** It resolves a DOI against Crossref
and returns what is actually registered — authors, title, journal, year. This is the only
way to tell a real citation from a fabricated one: a plausible-*looking*
author–year–journal combination is the signature pattern of invented references, and no
amount of careful reading substitutes for asking the registrar.

`get_open_access_pdf` only points at copies that are genuinely, **legally** open. It does
not look for pirated copies. It works without `CONTACT_EMAIL` by going through OpenAlex;
setting the email adds the Unpaywall route, which also reports the **licence** of the copy
it found — worth having when you need to know whether you may redistribute it.

## Scopus & ScienceDirect — Elsevier key required

The five tools below are **not registered at all** when `SCOPUS_API_KEY` and
`SCIENCEDIRECT_API_KEY` are empty. They do not appear and then fail when called; they
simply are not there — `tools/list` returns 16 instead of 21.

| Tool | Purpose |
|---|---|
| `search_scopus` | Search Scopus using its own query syntax, passed through verbatim |
| `scopus_abstract` | Full abstract, author keywords, citation count (by DOI or Scopus ID) |
| `sciencedirect_fulltext` | ScienceDirect full text by DOI |
| `scopus_export_csv` | Run a query, collect every page, save as screening-ready CSV |
| `elsevier_status` | Check that keys are present, accepted, and what quota remains |

### Queries are passed through verbatim

`search_scopus` accepts native Scopus syntax — `TITLE-ABS-KEY`, `AND/OR/NOT`, `W/n`,
`PUBYEAR`, `DOCTYPE`, `LANGUAGE`, `SRCTYPE` — and **does not translate it**:

```
TITLE-ABS-KEY("islamic contract" W/3 freedom) AND PUBYEAR > 2014 AND DOCTYPE(ar)
```

This is a design decision, not a limitation. The search string you report in Methods must
be identical to the one actually executed. The moment some layer silently normalises or
"fixes" your query, the reproducibility claim in your manuscript stops being true — and a
reviewer re-running your query gets a different number with nothing to explain it.

For the same reason, `search_scopus` returns **total hits** — the number that goes in the
identification box of a PRISMA flow diagram.

### Run `elsevier_status` before you start

Elsevier quota is tied to an institutional subscription and can run out mid-way.
`elsevier_status` reports whether the key is read, whether it is actually accepted, and how
much quota is left — far cheaper than discovering it in the middle of a systematic search.

If off-campus access is refused with 401/403, ask your librarian or licence admin for an
**insttoken** and set `ELSEVIER_INSTTOKEN`.

### Keys never leak through error messages

Elsevier errors routinely echo the full URL with `apiKey=` in it. Every error message here
passes through `scrub()`, which replaces the key and any `apiKey=…` pattern with
`«redacted»` before it reaches the caller.

## Diagnostics

`server_status` reports the running version, the folder PDFs will be saved to, and which
optional features are active. It is the right first step when something behaves unexpectedly
— including confirming that Claude Desktop really loaded the version you just installed.

## Download folder

The order used: `DOWNLOAD_DIR` if set to a valid value → `~/Downloads` → the system temp
folder. `.md` files produced by `pdf_to_text` go into a `fulltext/` subfolder.

---

[← Back](README.md) · [Installation](Installation.md) · [zotero](zotero.md) · [scr-toolkit](scr-toolkit.md) · [FAQ](FAQ.md)
