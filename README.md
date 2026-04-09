# DocSearch Pro

A browser-based full-text document search engine. Drop in `.txt`, `.md`, or `.csv` files, type a query, and get relevance-ranked results with highlighted snippets — instantly.

**Live App → [docsearchpro.vercel.app](https://docsearchpro.vercel.app/)**

---

## What It Does

DocSearch Pro builds an in-browser search index from documents you provide. Type any query and get TF-IDF ranked results with highlighted match snippets and surrounding context — all without sending a single byte to a server.

- Drop in files or paste text to build a document library
- Search across all documents simultaneously or filter to one
- Results ranked by relevance, with two highlighted snippets per match
- Export results as structured JSON or copy to clipboard

---

## Stack

- HTML · CSS · Vanilla JavaScript
- No frameworks, no build step, no dependencies
- Deploys as a static site on Vercel and GitHub Pages

---

## Features

- **TF-IDF search engine** — inverted index with relevance scoring built from scratch
- **Drag-and-drop ingestion** — `.txt`, `.md`, `.csv`, `.log`, `.json` files
- **Paste text** — add content directly with a custom document name
- **Live search** — results render on every keystroke
- **Match snippets** — highlighted terms with 80-character context windows
- **Filter by document** — narrow results to a single file
- **Sort modes** — relevance score, document name, or position
- **Whole-word & case-sensitive** toggles
- **Export as JSON** — structured result payload with scores and snippets
- **Copy to clipboard** — one-click copy of all results
- **Stats bar** — documents indexed, total word count, unique tokens
- **Dark / light theme toggle**
- **Keyboard shortcut** — `Cmd/Ctrl + K` to focus search

---

## Local Development

No build step needed. Clone the repo and open `index.html` in a browser, or use Live Server in VS Code.

```bash
git clone https://github.com/luke-pekala/doc-search-pro.git
cd doc-search-pro
# open index.html or use Live Server
```

---

## License

MIT
