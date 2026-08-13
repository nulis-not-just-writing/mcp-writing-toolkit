# zotero — your own library

*[Baca dalam bahasa Indonesia](id/zotero.md)*

`zotero-mcp` **0.5.0** · 8 tools · [source](../zotero-node/)

Gives Claude read access to your Zotero library: search items, read metadata and full text,
browse collections, and export BibTeX.

**Read-only.** Not one tool here adds, changes, or deletes anything in your library — every
call it makes is a `GET`.

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
