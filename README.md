# MCP Writing Toolkit

*[Baca dalam bahasa Indonesia](README.id.md)*

Three MCP servers for literature work: **search the scholarly record, verify citations,
read your own Zotero library, and run the deterministic checks a scoping review needs** —
from inside Claude.

All three run on Node.js. **No Python, no `pip install`, no virtualenv.** For Claude
Desktop, download one `.mcpb` file and double-click it. `scholar` and `zotero` are
TypeScript bundled by esbuild; `scr-toolkit` is plain JavaScript with no dependencies at
all.

## The servers

| Server | Tools | Answers |
|---|---|---|
| [`scholar-node`](scholar-node/) → `scholar-paper-search` **0.6.0** | 21 | does this paper actually exist, and where is a legal PDF? |
| [`zotero-node`](zotero-node/) → `zotero-mcp` **0.5.0** | 8 | what is already in my own library? |
| [`scr-toolkit`](scr-toolkit/) **1.5.0** | 9 | is this PDF really the article it claims to be, and do the two screening passes agree? |

`scholar` searches **seven open scholarly APIs** — arXiv, OpenAlex, Crossref, Semantic
Scholar, PubMed, Europe PMC, DOAJ — with no key required. If you have Elsevier
credentials, five more Scopus/ScienceDirect tools switch on — 16 without a key, 21 with.

`zotero` talks to the **Zotero 7+ app on your own machine**. Local mode is the default:
no API key, no upload, nothing leaves your computer.

`scr-toolkit` does the **deterministic** half of a scoping review — checking, counting,
matching, retrieving. Not one of its tools decides eligibility; judgement stays with the
researcher. It is the companion tool to the **Alur SLR AI** scoping review course modules
and remains so: each tool names the module step it serves. It needs no key, and has **zero
npm dependencies**.

## Install

**Claude Desktop** — download from [`dist/`](dist/), then double-click (or
**Settings → Extensions**):

- [`scholar-paper-search-0.6.0.mcpb`](dist/scholar-paper-search-0.6.0.mcpb)
- [`zotero-mcp-0.5.0.mcpb`](dist/zotero-mcp-0.5.0.mcpb)
- [`scr-toolkit-1.5.0.mcpb`](dist/scr-toolkit-1.5.0.mcpb)

Versioned builds are also attached to each [release](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/releases).

Configuration appears as a form in the extension window. Everything is **optional** for
`scholar`; fields marked sensitive are stored in your OS keychain, not in a text file.

**Claude Code** — build from source, then register:

```bash
git clone https://github.com/nulis-not-just-writing/mcp-writing-toolkit.git
cd mcp-writing-toolkit/scholar-node && npm install && npm run build
claude mcp add scholar -- node "$PWD/dist/index.js"
```

## What makes them different

**Citations are verified, not guessed.** `get_paper_by_doi` resolves a DOI against
Crossref and returns what is actually registered. This is a direct countermeasure to
fabricated references — a plausible-*looking* author–year–journal combination is the
signature pattern, and the only way to tell is to ask the registrar.

**Scopus queries are passed through verbatim.** `search_scopus` does not translate,
normalise, or "fix" your query. The consequence is that the search string you report in
the manuscript is identical to the one actually executed — a reproducibility requirement
that collapses the moment some layer silently rewrites the query.

**API keys never leak through error messages.** Every Elsevier error passes through
`scrub()`, which replaces the key and any `apiKey=` in a URL with `«redacted»` before it
reaches the caller. Elsevier 401s routinely echo the full URL, key included.

**Features that cannot run do not appear.** Without a Scopus key, the five Elsevier tools
are never registered at all — rather than appearing and failing when called. `tools/list`
returns 16; with a key, 21. What is listed is what actually works.

**Nothing leaves your machine.** No telemetry, no relay server. `scholar` calls public
APIs directly; `zotero` in local mode only talks to the Zotero app on `localhost`.

## Configuration

`scr-toolkit` needs **no configuration at all** — no keys, no fields. The other two read
theirs from **environment variables**. In Claude Desktop, `manifest.json` populates these
from the extension form, so you never touch them; this list is for manual use (Claude Code,
or running a server directly):

| Variable | Server | Required | Purpose |
|---|---|---|---|
| `CONTACT_EMAIL` | scholar | no | Crossref/OpenAlex polite pool + enables Unpaywall PDF lookup |
| `S2_API_KEY` | scholar | no | higher Semantic Scholar rate limit |
| `DOWNLOAD_DIR` | scholar | no | download folder; falls back to `~/Downloads`, then the system temp dir |
| `SCOPUS_API_KEY` | scholar | no | switches on the 5 Elsevier tools |
| `SCIENCEDIRECT_API_KEY` | scholar | no | ScienceDirect full text |
| `ELSEVIER_INSTTOKEN` | scholar | no | institutional token, if off-campus access is refused with 401/403 |
| `ZOTERO_LOCAL` | zotero | no | `true` (default) — talk to the Zotero app on this machine |
| `ZOTERO_API_KEY` · `ZOTERO_LIBRARY_ID` · `ZOTERO_LIBRARY_TYPE` | zotero | Web API mode only | alternative to the local Zotero app |

**There is no `.env` file.** No server here ever reads one — configuration flows only
through process environment variables.

## Requirements

| Requirement | For | Note |
|---|---|---|
| Claude Desktop | installing `.mcpb` | ships its own Node.js — nothing else to install |
| Node.js 20+ | building from source / Claude Code | `.nvmrc` pins 24 |
| Zotero 7+ | `zotero` local mode | Settings → Advanced → tick *"Allow other applications on this computer to communicate with Zotero"* |
| Elsevier key | the 5 Scopus/ScienceDirect tools | register at [dev.elsevier.com](https://dev.elsevier.com) with an institutional account |
| `pdftotext` (poppler) | sharper PDF text checks in `scr-toolkit` | optional — without it the checker may only *prove* a match, never deny one |

## Documentation

Full guides live in [`docs/`](docs/) — [installation](docs/Installation.md), one page per
server ([scholar](docs/scholar.md), [zotero](docs/zotero.md),
[scr-toolkit](docs/scr-toolkit.md)), and a [troubleshooting FAQ](docs/FAQ.md).

Indonesian versions of the same pages are in [`docs/id/`](docs/id/), kept in step with the
English ones.

**One thing is still Indonesian: the tool descriptions inside `manifest.json`**, which is
what Claude Desktop shows in the extension window. That text is read by the model, not by
you — Claude handles it and answers in whatever language you write in — but the extension
screen itself will read as Indonesian. Same for `scr-toolkit`'s own README, which documents
its measured limits in Indonesian; the [scr-toolkit page](docs/scr-toolkit.md) covers the
same ground in English.

## Rebuilding

```bash
./build-mcpb.sh          # builds all three, emits dist/<name>-<version>.mcpb
```

The script refuses to emit a bundle that is missing `NOTICE.md`, carries `node_modules/`,
`src/`, or `.env`, has an embedded API key in `mcp_config.env`, or **announces a version
different from its manifest** — and it **deletes** the failed bundle rather than merely
declining to announce it. That last gate runs the packed server through a real MCP
handshake and compares what it reports; a version hardcoded in source is exactly the kind
of drift a file-level check misses.

## Relationship to the `skills` repo

This repo provides the **tools**; [`nulis-not-just-writing/skills`](https://github.com/nulis-not-just-writing/skills)
provides the **procedures** — five Claude skills for writing, polishing, submitting, and
revising Q1 journal articles, plus one for running a systematic review.

They **complement each other; neither requires the other**. The skills work fully without
these servers (citation verification falls back to DOI resolution over the web, then to
explicit flagging). These servers are useful without the skills. Installed together,
citation verification and Scopus search become direct rather than mediated.

## Licence

**[CC BY-NC 4.0](LICENSE)** — Creative Commons Attribution-NonCommercial 4.0 International.

Free to use, copy, adapt, and share **for non-commercial purposes** with attribution.
Commercial use — including paid training and paid products — requires separate permission
from the rights holder.

Researchers, students, lecturers, and educational institutions using these for research
and teaching need no permission at all; just credit the source.

### Third-party attribution

Each server bundles MIT-licensed libraries into its `dist/index.js`. Their MIT licence
continues to govern their own code, and the MIT notice must travel with every copy — which
is why a `NOTICE.md` sits inside **each** `.mcpb` as well as in each server folder. The
build refuses to produce a bundle without one. See [`NOTICE.md`](NOTICE.md) at the root for
the full picture, including the external services accessed and their respective terms.
