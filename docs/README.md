# MCP Writing Toolkit — documentation

*[Baca dalam bahasa Indonesia](id/README.md)*

Three MCP servers for literature work inside Claude: search the scholarly record, verify
citations, read your own Zotero library, and run the deterministic checks a scoping review
needs.

## Which one do I need?

Start from your situation, not from the server names.

| Your situation | Server |
|---|---|
| Need to confirm a citation actually exists | **[scholar](scholar.md)** — `nulis_get_paper_by_doi` |
| Searching several databases at once | **[scholar](scholar.md)** |
| Running a Scopus search for a systematic review | **[scholar](scholar.md)** — needs an Elsevier key |
| Need a legal open-access PDF for a DOI | **[scholar](scholar.md)** — `nulis_get_open_access_pdf` |
| Want Claude to read what is already in your library | **[zotero](zotero.md)** |
| Need BibTeX for a LaTeX manuscript | **[zotero](zotero.md)** — `nulis_zotero_export_bibtex` |
| Need to confirm a PDF really is the article it claims | **[scr-toolkit](scr-toolkit.md)** — `nulis_pdf_match_records` |
| Reconciling two screening passes and building an arbitration queue | **[scr-toolkit](scr-toolkit.md)** — `nulis_reconcile_two_pass` |
| Auditing the numbers in a manuscript against a fact list | **[scr-toolkit](scr-toolkit.md)** — `nulis_manuscript_numeric_audit` |

All three stand alone. Installing one does not require any of the others.

## Pages

- **[Installation](Installation.md)** — Claude Desktop, Claude Code, and where the API keys go
- **[scholar](scholar.md)** — 16 tools over seven open APIs, plus 5 Elsevier tools with a key
- **[zotero](zotero.md)** — 8 read-only tools, local and Web API modes
- **[scr-toolkit](scr-toolkit.md)** — 9 deterministic scoping-review tools, no key, no dependencies
- **[FAQ](FAQ.md)** — the errors that actually come up, and why

## What to know up front

**No Python.** All three run on the Node.js that ships inside Claude Desktop — there is
nothing to install first. `scholar-nulis` and `zotero-nulis` are TypeScript bundled into a single
JavaScript file; `scr-toolkit-nulis` is plain JavaScript with no dependencies at all.

**Every `scholar-nulis` setting is optional.** With no key at all, 16 tools work fully through
arXiv, OpenAlex, Crossref, Semantic Scholar, PubMed, Europe PMC, and DOAJ. A key only adds
— taking it to 21 — and is never a prerequisite.

**Zotero defaults to local mode.** It talks to the Zotero app on your own computer over
`localhost`. No API key, no upload, nothing leaves your machine.

**`scr-toolkit-nulis` needs no configuration whatsoever.** No key, no fields. It also decides
nothing — its nine tools check, count, match, and retrieve; eligibility decisions stay with
the researcher.

**Features that cannot run are not shown.** Without a Scopus key the five Elsevier tools
are never registered at all. The tool list you see is the list that actually works — not a
menu of options that will fail.

---

[Installation](Installation.md) · [scholar](scholar.md) · [zotero](zotero.md) · [scr-toolkit](scr-toolkit.md) · [FAQ](FAQ.md)
