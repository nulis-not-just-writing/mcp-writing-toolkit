# Installation

*[Baca dalam bahasa Indonesia](id/Pemasangan.md)*

## Claude Desktop — the easy path

**Not sure which Claude you have?** If you use Claude in a browser or a desktop application, this
is your section. If you type `claude` into a terminal, skip to
[Claude Code](#claude-code--build-from-source).

1. **Download** the server you want. Each link saves the file straight to your computer:

   | Server | What it does | Download |
   |---|---|---|
   | `scholar-nulis` | search literature, verify citations | [scholar-nulis-0.8.0.mcpb](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/raw/main/dist/scholar-nulis-0.8.0.mcpb) |
   | `zotero-nulis` | read your own Zotero library | [zotero-nulis-0.7.0.mcpb](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/raw/main/dist/zotero-nulis-0.7.0.mcpb) |
   | `scr-toolkit-nulis` | deterministic scoping-review checks | [scr-toolkit-nulis-2.0.0.mcpb](https://github.com/nulis-not-just-writing/mcp-writing-toolkit/raw/main/dist/scr-toolkit-nulis-2.0.0.mcpb) |
2. **Double-click** the file. Claude Desktop opens an install window.
   (Alternative: **Settings → Extensions**, then drag the file in.)
3. Fill in the configuration fields if you need them — all optional for `scholar-nulis`, and
   `scr-toolkit-nulis` has none at all.
4. Click **Install**, then quit Claude Desktop **completely** and reopen it.

Closing the window is not enough; servers are only re-read when the application actually
restarts. On macOS, make sure the icon is gone from the Dock (⌘Q).

Nothing needs to be installed first. Claude Desktop ships its own Node.js.

### Upgrading from the old names

**Every tool name now begins with `nulis_`** — `nulis_search_arxiv`,
`nulis_zotero_search_items`, `nulis_pdf_integrity`, and so on. This is a breaking change,
and it exists because Claude Desktop presents tool names **flat**: there is no per-server
namespace like Claude Code's `mcp__scholar__`. Two extensions that both register
`search_arxiv` therefore collide, and which one wins is not predictable. Measured on one
real machine, this repo's servers shared **nine** tool names with unrelated MCP servers
already installed; after the prefix, zero.

You do not need to change how you talk to Claude — it reads the tool list itself. Only
scripts or written instructions that name a tool literally need updating.

These servers were previously called `scholar-paper-search`, `zotero-mcp`, and
`scr-toolkit`. Claude Desktop identifies an extension by the `name` in its manifest, so a
renamed server is a **different extension** as far as it is concerned — installing the new
one does not replace the old one, and you will end up with both, exposing duplicate tools.

**Remove the old entries first** in **Settings → Extensions**, then install these. The
suffix exists precisely to stop this kind of ambiguity: `scholar` is a common enough name
that a second, unrelated MCP server may well already be using it.

## Claude Code — build from source

```bash
git clone https://github.com/nulis-not-just-writing/mcp-writing-toolkit.git
cd mcp-writing-toolkit

# scholar
cd scholar-nulis && npm install && npm run build && cd ..
claude mcp add scholar -- node "$PWD/scholar-nulis/dist/index.js"

# zotero
cd zotero-nulis && npm install && npm run build && cd ..
claude mcp add zotero -- node "$PWD/zotero-nulis/dist/index.js"

# scr-toolkit-nulis — no dependencies, so no npm install and no build
claude mcp add scr-toolkit -- node "$PWD/scr-toolkit-nulis/server/index.js"
```

To pass configuration, use `-e` before `--`:

```bash
claude mcp add scholar \
  -e CONTACT_EMAIL=you@university.edu \
  -e SCOPUS_API_KEY=xxxxx \
  -- node "$PWD/scholar-nulis/dist/index.js"
```

Check the result with `/mcp` inside a Claude Code session.

## Configuration

`scr-toolkit-nulis` **has no configuration fields at all** — install and use. The other two read
theirs only from **environment variables**; in Claude Desktop, `manifest.json` populates
them from the extension form, so you never touch them.

**There is no `.env` file.** No server here reads one. If you find older instructions
telling you to copy `.env.example`, they belong to the previous Python-based pack and no
longer apply.

### scholar

| Field / variable | Required | Effect when set |
|---|---|---|
| `CONTACT_EMAIL` | no | Joins the Crossref & OpenAlex *polite pool* (higher quota) **and** adds the Unpaywall route for open-access lookup, which additionally reports each PDF's licence. Any working address; no registration. |
| `S2_API_KEY` | no | Raises the Semantic Scholar rate limit. Free at [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api). |
| `DOWNLOAD_DIR` | no | Where PDFs are stored. If empty: `~/Downloads`, then the system temp folder if `~/Downloads` is not writable. |
| `SCOPUS_API_KEY` | no | Switches on `nulis_search_scopus`, `nulis_scopus_abstract`, `nulis_scopus_export_csv`, `nulis_elsevier_status`. |
| `SCIENCEDIRECT_API_KEY` | no | Switches on `nulis_sciencedirect_fulltext`. Leave empty if your Scopus key already covers it. |
| `ELSEVIER_INSTTOKEN` | no | Institutional token from your librarian or licence admin. Needed only when off-campus access is refused with 401/403. |

Elsevier keys are free to register with an institutional account at
[dev.elsevier.com](https://dev.elsevier.com). The quota is tied to your campus subscription.

### zotero

| Field / variable | Required | Effect |
|---|---|---|
| `ZOTERO_LOCAL` | no | `true` is the default — talks to the Zotero app on this computer. |
| `ZOTERO_API_KEY` | Web API mode | Key from [zotero.org/settings/keys](https://www.zotero.org/settings/keys). |
| `ZOTERO_LIBRARY_ID` | Web API mode | Your user ID, on the same page. |
| `ZOTERO_LIBRARY_TYPE` | Web API mode | `user` or `group`. |

**Local mode needs one step inside Zotero:** open Zotero → **Settings → Advanced** → tick
**"Allow other applications on this computer to communicate with Zotero"**. Without it the
server will report that Zotero is unreachable.

The Zotero application must be **running** when a tool is called.

## Keeping keys safe

Fields marked sensitive in the extension window are stored by Claude Desktop in your
**operating system keychain**, not as plain text.

If you build the variant bundle with an embedded key for a team
(`scholar-nulis/build-team-bundle.sh`), remember that the resulting file **carries that key
inside its manifest**. That bundle must never be uploaded anywhere public; this repo's
`.gitignore` already refuses it through the `*-api.mcpb` pattern, and `build-mcpb.sh`
refuses to publish any bundle whose manifest carries a literal key.

## Rebuilding bundles

```bash
./build-mcpb.sh                 # all three
./build-mcpb.sh zotero-nulis    # just one
```

Output goes to `dist/<name>-<version>.mcpb`. The script stops and **deletes** any bundle
that fails a gate — a broken bundle left lying in `dist/` will eventually be distributed by
accident.

The gates:

- The `manifest.json` version must match `package.json` (for servers that have one).
- **The version the server announces** over an MCP handshake must match its manifest. This
  gate runs the packed server and asks it directly — a version hardcoded in source is
  exactly the kind of drift a file-level check misses, and it really did happen to all
  three servers in this repo.
- **`NOTICE.md` must be inside the bundle** — attribution for bundled libraries has to
  travel with every copy, and a `.mcpb` downloaded on its own does not carry the repo.
- No `node_modules/`, `src/`, `.env`, or junk files.
- No literal credential values in `mcp_config.env`.

Servers without a `package.json` (like `scr-toolkit-nulis`) are packed as-is with no build step;
the gate then confirms the `entry_point` named in the manifest actually exists.

---

[← Back](README.md) · [scholar](scholar.md) · [zotero](zotero.md) · [scr-toolkit](scr-toolkit.md) · [FAQ](FAQ.md)
