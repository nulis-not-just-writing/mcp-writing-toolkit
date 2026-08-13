# FAQ

*[Baca dalam bahasa Indonesia](id/Tanya-jawab.md)*

## Installation

**The server is installed but does not appear in Claude Desktop.**
Quit Claude Desktop **completely**, then reopen it. Closing the window does not reload the
server list. On macOS, make sure the icon is gone from the Dock (⌘Q).

**Do I need to install Node.js first?**
Not for Claude Desktop — it ships its own. Node.js is only needed if you build from source
or use these in Claude Code.

**Do I need Python, `pip`, or `uv`?**
No. All three servers are pure Node.js. If you find instructions telling you to run
`install.sh` or install a PyPI package, they belong to an older pack and no longer apply.

**Where do I put the `.env` file?**
There isn't one. No server here ever reads `.env`. In Claude Desktop the fields are in the
extension window; in Claude Code, use `-e NAME=value` with `claude mcp add`. `scr-toolkit`
has no fields at all.

## scholar

**The Scopus tools do not appear at all.**
That is correct behaviour when `SCOPUS_API_KEY` is empty. The five Elsevier tools are not
registered without a key, rather than appearing and failing when called — `tools/list`
returns 16 instead of 21. Set the key, reinstall the extension, then restart Claude Desktop.

**The key is set but Scopus refuses with 401 or 403.**
Run `elsevier_status` — it reports whether the key is read and whether it is actually
accepted. The most common cause is accessing from outside the campus network. Ask your
librarian or licence admin for an **insttoken** and set `ELSEVIER_INSTTOKEN`.

**How much quota do I have left?**
`elsevier_status` reports it. Run it **before** starting a systematic search, not after the
quota runs out mid-way.

**`get_open_access_pdf` finds nothing even though the article clearly exists.**
Two possibilities. First, `CONTACT_EMAIL` is not set — the Unpaywall route requires it.
Second, the article genuinely has no legal open-access copy. This tool only points at
legitimately open copies; it does not look for pirated ones.

**Can I trust the metadata from `search_*`?**
For citation purposes, verify with `get_paper_by_doi`. Search results are useful for
finding, but what binds is what Crossref has registered. A citation that merely *looks*
plausible is the signature pattern of invented references.

**Where are the PDFs saved?**
`DOWNLOAD_DIR` if set, then `~/Downloads`, then the system temp folder. Run `server_status`
to see which folder is actually in use right now.

## zotero

**"Zotero unreachable" even though the app is open.**
Open Zotero → **Settings → Advanced** → tick **"Allow other applications on this computer to
communicate with Zotero"**. This is the step most often missed.

**Full text is empty even though the item clearly has a PDF.**
The server reads Zotero's own full-text index rather than re-parsing the PDF. If Zotero has
not finished indexing that file, the result is empty. Right-click the item → **Reindex
Item**, then try again.

**Can this server modify my library?**
No. Every call it makes is a `GET`; there is no write path in the code at all.

**The BibTeX citation keys differ from the ones I use.**
`zotero_export_bibtex` uses Zotero's own data. If you use **Better BibTeX**, the keys you
manage there are handled by that plugin and will not always match. Check before pasting into
a LaTeX manuscript already underway.

## scr-toolkit

**What are `M6 Langkah 2`, `M5 L3`, `M9 L8` in the tool descriptions?**
Module steps in the **Alur SLR AI** course — this tool is a companion to those modules and
deliberately stays one. Inside the course, those references tell participants exactly when a
tool is used. Outside it, the table on the [scr-toolkit page](scr-toolkit.md) is enough; the
tools require no course to run.

**Does this decide which studies are included?**
No. None of its nine tools decides eligibility. It checks, counts, matches, and retrieves —
the decision stays with the researcher.

**The result is `TIDAK_DAPAT_DIPERIKSA` rather than match or mismatch.**
That is the correct answer, not a failure. It means "cannot be checked". Without
`pdftotext`, the built-in extractor may only **prove** a match and never deny one — measured
over 432 quotations, of those it missed, 18 of 23 were genuinely present. Install poppler if
you need accusing verdicts. The same answer is returned for scanned PDFs, recognised by text
density below 800 characters per page.

**Do I have to install poppler?**
No. Everything still runs without it; only the authority of the check is reduced, as above.
On macOS: `brew install poppler`.

**My PDFs were downloaded by another MCP (scholar/Zotero) — safe to use directly?**
No. Files from elsewhere are not named `SCR[ID]_`, so filename-based checks cannot see them
— even though those are precisely the ones needing verification. One download once returned
a valid PDF containing an entirely different article. Run `pdf_integrity` →
`pdf_match_records` → `pdf_verify_record` first.

**`xlsx_write` deleted my other sheets.**
It rewrites the whole file and is not a cell editor. Include every sheet you want to keep,
or write to a new file.

## General

**Is any of my data sent anywhere?**
No telemetry and no relay server. `scholar` calls public APIs directly from your computer;
`zotero` in local mode only talks to the Zotero app on `localhost`; `scr-toolkit` only
touches the files you point it at, plus Unpaywall and publisher pages when you ask it to
download.

**Is anything still only in Indonesian?**
Two things. The tool descriptions inside `manifest.json` — that text is read by the model,
not by you, but it is also what Claude Desktop prints in the extension window, so that
screen reads as Indonesian. And `scr-toolkit`'s own README, which records its measured
limits; the [scr-toolkit page](scr-toolkit.md) covers the same ground in English. Everything
else on this site has an English page, and the Indonesian originals live in
[`docs/id/`](id/README.md).

**What is the relationship with the `skills` repo?**
This repo is the tools; [`nulis-not-just-writing/skills`](https://github.com/nulis-not-just-writing/skills)
is the procedures. They complement each other and neither requires the other — those skills
work fully without these servers, and these servers are useful without the skills.

**What is the licence?**
**CC BY-NC 4.0**, the same as the `skills` repo. Free to use, copy, adapt, and share for
non-commercial purposes with attribution. Researchers, students, lecturers, and educational
institutions need no permission at all; just credit the source. Commercial use requires
separate permission from the rights holder.

**If the code is CC BY-NC, what about the bundled MIT libraries?**
The MIT licence continues to govern those libraries' own code; CC BY-NC applies to the
original work only. MIT permits a combined work to be distributed under different terms as
long as its copyright notice is retained — which is why `NOTICE.md` sits inside **every**
`.mcpb`, not just in the repo. A file downloaded on its own does not carry the repo with it,
so the attribution has to be inside the bundle. `build-mcpb.sh` refuses to produce a bundle
without one.

`scr-toolkit` bundles no third-party code at all — zero npm dependencies — so there is no
other copyright to reproduce for it.

---

[← Back](README.md) · [Installation](Installation.md) · [scholar](scholar.md) · [zotero](zotero.md) · [scr-toolkit](scr-toolkit.md)
