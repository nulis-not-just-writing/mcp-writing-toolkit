# MCP Writing Toolkit

*[Baca dalam bahasa Indonesia](README.id.md)*

Three MCP servers for literature work: **search the scholarly record, verify citations,
read your own Zotero library, and run the deterministic checks a scoping review needs** —
from inside Claude.

All three run on Node.js. **No Python, no `pip install`, no virtualenv.** For Claude
Desktop, download one `.mcpb` file and double-click it. `scholar-nulis` and `zotero-nulis` are
TypeScript bundled by esbuild; `scr-toolkit-nulis` is plain JavaScript with no dependencies at
all.

## The servers

| Server | Tools | Answers |
|---|---|---|
| [`scholar-nulis`](scholar-nulis/) **0.8.0** | 21 | does this paper actually exist, and where is a legal PDF? |
| [`zotero-nulis`](zotero-nulis/) **0.7.0** | 8 | what is already in my own library? |
| [`scr-toolkit-nulis`](scr-toolkit-nulis/) **2.0.0** | 9 | is this PDF really the article it claims to be, and do the two screening passes agree? |

`scholar-nulis` searches **seven open scholarly APIs** — arXiv, OpenAlex, Crossref, Semantic
Scholar, PubMed, Europe PMC, DOAJ — with no key required. If you have Elsevier
credentials, five more Scopus/ScienceDirect tools switch on — 16 without a key, 21 with.

`zotero-nulis` talks to the **Zotero 7+ app on your own machine**. Local mode is the default:
no API key, no upload, nothing leaves your computer.

`scr-toolkit-nulis` does the **deterministic** half of a scoping review — checking, counting,
matching, retrieving. Not one of its tools decides eligibility; judgement stays with the
researcher. It is the companion tool to the **Alur SLR AI** scoping review course modules
and remains so: each tool names the module step it serves. It needs no key, and has **zero
npm dependencies**.

## Install

**Not sure which one you have?** If you use Claude in a browser or a desktop application, you want
**Claude Desktop**. If you type `claude` into a terminal, you want **Claude Code**.

### Claude Desktop — no git, no terminal

1. **Download** the server you want. Each link saves the file straight to your computer:

   | Server | What it does | Download |
   |---|---|---|
   | `scholar-nulis` | search literature, verify citations | [scholar-nulis-0.8.0.mcpb](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/raw/main/dist/scholar-nulis-0.8.0.mcpb) |
   | `zotero-nulis` | read your own Zotero library | [zotero-nulis-0.7.0.mcpb](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/raw/main/dist/zotero-nulis-0.7.0.mcpb) |
   | `scr-toolkit-nulis` | deterministic scoping-review checks | [scr-toolkit-nulis-2.0.0.mcpb](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/raw/main/dist/scr-toolkit-nulis-2.0.0.mcpb) |

2. **Double-click** the downloaded `.mcpb`. Claude Desktop opens an install window.
   *If nothing happens*, open Claude Desktop → **Settings** → **Extensions** and drag the file in.
3. Fill in the configuration form if you want to. **You can leave it all blank** — `scholar-nulis`
   works without any key, and `scr-toolkit-nulis` has no fields at all.
4. Click **Install**, then **quit Claude Desktop completely** and open it again. Closing the
   window is not enough; on macOS press ⌘Q and check the icon is gone from the Dock.

Nothing else needs installing. Claude Desktop ships its own Node.js.

⚠ If you previously installed `scholar-paper-search`, `zotero-mcp`, or `scr-toolkit`, **remove
those first** — a renamed server counts as a different extension, so you would end up with both.

Step-by-step detail, including every configuration field, is in
[docs/Installation.md](docs/Installation.md).

### Claude Code — for the terminal

```bash
git clone https://github.com/nulis-not-just-writing/mcp-writing-toolkit.git
cd mcp-writing-toolkit/scholar-nulis && npm install && npm run build
claude mcp add scholar-nulis -- node "$PWD/dist/index.js"
```

Versioned builds are also attached to each
[release](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/releases).
## What makes them different

**Citations are verified, not guessed.** `nulis_get_paper_by_doi` resolves a DOI against
Crossref and returns what is actually registered. This is a direct countermeasure to
fabricated references — a plausible-*looking* author–year–journal combination is the
signature pattern, and the only way to tell is to ask the registrar.

**Scopus queries are passed through verbatim.** `nulis_search_scopus` does not translate,
normalise, or "fix" your query. The consequence is that the search string you report in
the manuscript is identical to the one actually executed — a reproducibility requirement
that collapses the moment some layer silently rewrites the query.

**API keys never leak through error messages.** Every Elsevier error passes through
`scrub()`, which replaces the key and any `apiKey=` in a URL with `«redacted»` before it
reaches the caller. Elsevier 401s routinely echo the full URL, key included.

**Features that cannot run do not appear.** Without a Scopus key, the five Elsevier tools
are never registered at all — rather than appearing and failing when called. `tools/list`
returns 16; with a key, 21. What is listed is what actually works.

**Nothing leaves your machine.** No telemetry, no relay server. `scholar-nulis` calls public
APIs directly; `zotero-nulis` in local mode only talks to the Zotero app on `localhost`.

## Configuration

`scr-toolkit-nulis` needs **no configuration at all** — no keys, no fields. The other two read
theirs from **environment variables**. In Claude Desktop, `manifest.json` populates these
from the extension form, so you never touch them; this list is for manual use (Claude Code,
or running a server directly):

| Variable | Server | Required | Purpose |
|---|---|---|---|
| `CONTACT_EMAIL` | scholar | no | Crossref/OpenAlex polite pool + adds the Unpaywall route, which also reports each PDF's licence |
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
| Zotero 7+ | `zotero-nulis` local mode | Settings → Advanced → tick *"Allow other applications on this computer to communicate with Zotero"* |
| Elsevier key | the 5 Scopus/ScienceDirect tools | register at [dev.elsevier.com](https://dev.elsevier.com) with an institutional account |
| `pdftotext` (poppler) | sharper PDF text checks in `scr-toolkit-nulis` | optional — without it the checker may only *prove* a match, never deny one |

## Documentation

Full guides live in [`docs/`](docs/) — [installation](docs/Installation.md), one page per
server ([scholar](docs/scholar.md), [zotero](docs/zotero.md),
[scr-toolkit](docs/scr-toolkit.md)), and a [troubleshooting FAQ](docs/FAQ.md).

Indonesian versions of the same pages are in [`docs/id/`](docs/id/), kept in step with the
English ones.

The same content is mirrored to the
[Wiki](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/wiki), both languages.
**`docs/` is the source** — it is versioned alongside the servers it describes; the wiki is
regenerated with `./sync-wiki.sh` and should never be edited directly.

**One thing is still Indonesian: the tool descriptions inside `manifest.json`**, which is
what Claude Desktop shows in the extension window. That text is read by the model, not by
you — Claude handles it and answers in whatever language you write in — but the extension
screen itself will read as Indonesian. Same for `scr-toolkit-nulis`'s own README, which documents
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

---

> **Knowledge unshared dies. Knowledge shared keeps living.**
>
> It grows in hands you will never meet and is carried on in work you will never read — and what
> never stops living never stops returning to you.

**Mubaroq ADB** · Akademi Digital Bandung | RPI Institute · <mubaroq@digitalbdg.ac.id>
