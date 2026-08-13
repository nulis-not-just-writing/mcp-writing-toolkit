# MCP Writing Toolkit

*[Baca dalam bahasa Indonesia](README.md)*

Two MCP servers for literature work: **search the scholarly record, verify citations, and
read your own Zotero library** — from inside Claude.

Both are TypeScript, run by Node.js. **No Python, no `pip install`, no virtualenv.** For
Claude Desktop, download one `.mcpb` file and double-click it.

## The servers

| Server | Tools | Answers |
|---|---|---|
| [`scholar-node`](scholar-node/) → `scholar-paper-search` **0.5.0** | 21 | does this paper actually exist, and where is a legal PDF? |
| [`zotero-node`](zotero-node/) → `zotero-mcp` **0.4.0** | 8 | what is already in my own library? |

`scholar` searches **seven open scholarly APIs** — arXiv, OpenAlex, Crossref, Semantic
Scholar, PubMed, Europe PMC, DOAJ — with no key required. If you have Elsevier
credentials, eight Scopus/ScienceDirect tools switch on as well.

`zotero` talks to the **Zotero 7+ app on your own machine**. Local mode is the default:
no API key, no upload, nothing leaves your computer.

## ⚠ A note on language

**The servers reply in whatever language you write in.** Ask in English, get English.

**Tool descriptions inside `manifest.json` are written in Indonesian.** That text is read
by the model, not by you — Claude handles it fine and answers in your language. It is
also what Claude Desktop displays in the extension window, so that particular screen will
read as Indonesian.

**The documentation in [`docs/`](docs/) is in Indonesian.** If you want to read the guides
rather than just use the servers, you will need a translation. This is a real limitation,
stated plainly rather than hidden.

## Install

**Claude Desktop** — download from [`dist/`](dist/), then double-click (or
**Settings → Extensions**):

- [`scholar-paper-search-0.5.0.mcpb`](dist/scholar-paper-search-0.5.0.mcpb)
- [`zotero-mcp-0.4.0.mcpb`](dist/zotero-mcp-0.4.0.mcpb)

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

**Features that cannot run do not appear.** Without a Scopus key, the eight Elsevier
tools are never registered at all — rather than appearing and failing when called. What
is listed is what actually works.

**Nothing leaves your machine.** No telemetry, no relay server. `scholar` calls public
APIs directly; `zotero` in local mode only talks to the Zotero app on `localhost`.

## Configuration

Both servers read configuration from **environment variables**. In Claude Desktop,
`manifest.json` populates these from the extension form — you never touch them. This list
is for manual use (Claude Code, or running a server directly):

| Variable | Server | Required | Purpose |
|---|---|---|---|
| `CONTACT_EMAIL` | scholar | no | Crossref/OpenAlex polite pool + enables Unpaywall PDF lookup |
| `S2_API_KEY` | scholar | no | higher Semantic Scholar rate limit |
| `DOWNLOAD_DIR` | scholar | no | download folder; falls back to `~/Downloads`, then the system temp dir |
| `SCOPUS_API_KEY` | scholar | no | switches on the 8 Scopus tools |
| `SCIENCEDIRECT_API_KEY` | scholar | no | ScienceDirect full text |
| `ELSEVIER_INSTTOKEN` | scholar | no | institutional token, if off-campus access is refused with 401/403 |
| `ZOTERO_LOCAL` | zotero | no | `true` (default) — talk to the Zotero app on this machine |
| `ZOTERO_API_KEY` · `ZOTERO_LIBRARY_ID` · `ZOTERO_LIBRARY_TYPE` | zotero | Web API mode only | alternative to the local Zotero app |

**There is no `.env` file.** Neither server ever reads one — configuration flows only
through process environment variables.

## Requirements

| Requirement | For | Note |
|---|---|---|
| Claude Desktop | installing `.mcpb` | ships its own Node.js — nothing else to install |
| Node.js 20+ | building from source / Claude Code | `.nvmrc` pins 24 |
| Zotero 7+ | `zotero` local mode | Settings → Advanced → tick *"Allow other applications on this computer to communicate with Zotero"* |
| Elsevier key | the 8 Scopus/ScienceDirect tools | register at [dev.elsevier.com](https://dev.elsevier.com) with an institutional account |

## Rebuilding

```bash
./build-mcpb.sh          # builds both servers, emits dist/<name>-<version>.mcpb
```

The script refuses to emit a bundle carrying `node_modules/`, `src/`, or an embedded API
key — the gates fail hard rather than warning and continuing.

## Relationship to the `skills` repo

This repo provides the **tools**; [`nulis-not-just-writing/skills`](https://github.com/nulis-not-just-writing/skills)
provides the **procedures** — five Claude skills for writing, polishing, submitting, and
revising Q1 journal articles, plus one for running a systematic review.

They **complement each other; neither requires the other**. The skills work fully without
these servers (citation verification falls back to DOI resolution over the web, then to
explicit flagging). These servers are useful without the skills. Installed together,
citation verification and Scopus search become direct rather than mediated.

## Licence

**[MIT](LICENSE)** — free to use, copy, modify, and distribute, including commercially,
as long as the copyright notice is retained.

The licence deliberately differs from the `skills` repo (CC BY-NC 4.0). This is code, and
Creative Commons themselves recommend against using their licences for software.

Every bundled dependency is MIT too — details in [`NOTICE.md`](NOTICE.md), along with
notes on the services accessed and their respective terms.
