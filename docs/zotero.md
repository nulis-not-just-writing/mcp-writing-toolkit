# zotero — your own library

*[Baca dalam bahasa Indonesia](id/zotero.md)*

`zotero-mcp` **0.5.0** · 8 tools · [source](../zotero-node/)

Gives Claude read access to your Zotero library: search items, read metadata and full text,
browse collections, and export BibTeX.

**Read-only.** Not one tool here adds, changes, or deletes anything in your library — every
call it makes is a `GET`.

## What it is actually for

Most people's Zotero library is larger than their memory of it. This server closes that gap:
Claude can look at what you have actually collected instead of asking you to remember it, or
searching the whole world when the answer is already on your disk.

Unlike the other two servers, there is no verified sample output below — these are the
situations, not a transcript.

### 1. "What do I already have on this?"

The right first move before searching any database. You have collected material for years;
some of it answers the question you are asking today.

> *"Search my Zotero library for anything on teacher self-efficacy in vocational schools,
> and tell me what I already have."*

`zotero_search_items` runs against your own library. It costs nothing, hits no quota, and
frequently makes an external search unnecessary.

### 2. Writing a section grounded in what you actually read

> *"Pull the full text of these six items and draft the theoretical framework from what they
> actually say."*

`zotero_get_item_fulltext` gives Claude the text you have already read and annotated, rather
than an abstract or a guess. This is the difference between a paragraph built from what the
sources say and one built from what their titles suggest.

The text comes from Zotero's own index — see [below](#full-text-comes-from-zoteros-index)
for what happens when an item has not been indexed yet.

### 3. Bibliography for exactly what you cited

> *"Export BibTeX for the items I cited in this draft."*

`zotero_export_bibtex` takes a set of item keys and returns BibTeX for that subset — not
your whole library. If you write in LaTeX, this is the step that stops a 900-entry `.bib`
file from following a 6,000-word article around.

### 4. Recovering work you forgot you did

> *"What have I added to Zotero in the last month?"* · *"List everything in my 'Revisi R2'
> collection."*

`zotero_get_recent` and `zotero_get_collection_items` are for the reading you did, filed
correctly, and then forgot about — which is most reading.

### What it deliberately will not do

It will not add, edit, tag, or delete anything. Every call is a `GET`. If you want Claude to
reorganise your library, this is not the tool, and that is on purpose: a reference library is
years of work, and read access is enough to be useful without being able to damage it.

## Tools

| Tool | Purpose |
|---|---|
| `zotero_search_items` | Search the library by keyword |
| `zotero_get_item_metadata` | Full metadata / BibTeX for one item |
| `zotero_get_item_fulltext` | An item's full text (from Zotero's index) |
| `zotero_get_item_children` | An item's attachments and notes |
| `zotero_list_collections` | List library collections |
| `zotero_get_collection_items` | Items inside a collection |
| `zotero_get_recent` | Most recently added items |
| `zotero_export_bibtex` | Export selected items as BibTeX |

## Two modes

### Local mode — the default, and the recommended one

The server talks to the **Zotero 7+ application on the same computer** over `localhost`.
No API key, no upload, not a single byte leaves your machine.

Two conditions:

1. The Zotero application is **running**.
2. Zotero → **Settings → Advanced** → tick **"Allow other applications on this computer to
   communicate with Zotero"**.

The second is frequently missed, and the symptom is a "Zotero unreachable" error even
though the application is plainly open.

### Web API mode

For machines not running the Zotero application. Set all three:

| Variable | Where from |
|---|---|
| `ZOTERO_API_KEY` | [zotero.org/settings/keys](https://www.zotero.org/settings/keys) |
| `ZOTERO_LIBRARY_ID` | your user ID, on the same page |
| `ZOTERO_LIBRARY_TYPE` | `user` or `group` |

This mode reads the library **as synced to Zotero's servers**. Items that have not synced
will not be visible.

## Full text comes from Zotero's index

`zotero_get_item_fulltext` reads **Zotero's own full-text index** rather than re-parsing the
PDF. The consequence: an item whose PDF Zotero has not finished indexing returns empty text
even though the file is plainly there.

When that happens, right-click the item in Zotero → **Reindex Item**, then try again.

## BibTeX

`zotero_export_bibtex` generates BibTeX from Zotero's own data. If you use **Better
BibTeX**, the citation keys you manage there (e.g. `sugeng2024analisis`) belong to that
plugin and will not always match the keys produced here — check before pasting into a LaTeX
manuscript that is already underway.

---

[← Back](README.md) · [Installation](Installation.md) · [scholar](scholar.md) · [scr-toolkit](scr-toolkit.md) · [FAQ](FAQ.md)
