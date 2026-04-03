# DocSearch Pro

> Instant full-text search across your document library — 100% client-side, zero dependencies, privacy-first.

[![Deploy with GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue?logo=github)](https://luke-pekala.github.io/doc-search-pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-1.0.0-informational)

---

## ✨ Features

- **TF-IDF full-text search** — relevance-ranked results with highlighted snippets
- **Drag & drop ingestion** — `.txt`, `.md`, `.csv`, `.log`, `.json` files
- **Paste text** — add content directly without a file
- **Live search** — results render as you type
- **Filter & sort** — by document, relevance score, or position
- **Whole-word & case-sensitive** modes
- **Export** results as structured JSON
- **Copy** results to clipboard
- **Dark / light theme** persisted in `localStorage`
- **Keyboard shortcut** — `Cmd/Ctrl + K` to focus search
- **Zero dependencies** — pure HTML, CSS, JavaScript
- **Privacy-first** — documents never leave the browser

---

## 📁 Project Structure

```
doc-search-pro/
├── index.html          ← App shell & markup
├── style.css           ← Design system (shadcn/ui dark, Geist fonts)
├── src/
│   ├── search-engine.js  ← TF-IDF inverted index engine
│   └── app.js            ← UI logic, file ingestion, search, export
├── .github/
│   └── workflows/
│       └── deploy.yml  ← GitHub Pages auto-deploy workflow
├── README.md
└── LICENSE
```

---

## 🚀 Deployment

### Option 1 — GitHub Pages (recommended, free)

1. **Push to GitHub** (see [Git setup](#git-setup) below).
2. Go to your repository → **Settings** → **Pages**.
3. Under *Source*, select **GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) will automatically deploy on every push to `main`.
5. Your app will be live at:  
   `https://luke-pekala.github.io/doc-search-pro`

> The workflow is already included in this repo — no extra configuration needed.

---

### Option 2 — Netlify (drag & drop, instant)

1. Go to [netlify.com](https://netlify.com) and log in.
2. Drag the entire project folder onto the Netlify dashboard.
3. Done! Netlify gives you a random URL like `https://amazing-name-12345.netlify.app`.
4. (Optional) Connect to your GitHub repo for automatic deploys on push.

---

### Option 3 — Vercel

1. Install Vercel CLI:  
   ```bash
   npm i -g vercel
   ```
2. From the project root:  
   ```bash
   vercel
   ```
3. Follow the prompts. Vercel detects a static site automatically.

---

### Option 4 — Local development (no build step required)

```bash
# Clone
git clone https://github.com/luke-pekala/doc-search-pro.git
cd doc-search-pro

# Serve with any static server, e.g.:
npx serve .
# or
python3 -m http.server 8080
# or
npx http-server . -p 8080
```

Then open `http://localhost:8080` in your browser.

> **Note:** Opening `index.html` directly via `file://` works in most browsers,  
> but a local server is recommended for `FileReader` API compatibility.

---

## 🔧 Git Setup

```bash
# 1. Initialise (if not already a git repo)
git init
git branch -M main

# 2. Connect to your GitHub repo
git remote add origin https://github.com/luke-pekala/doc-search-pro.git

# 3. Stage and commit all files
git add .
git commit -m "feat: initial release — DocSearch Pro v1.0.0"

# 4. Push
git push -u origin main
```

GitHub Pages will deploy automatically within ~60 seconds.

---

## 🛠 Customisation

### Change the app name / branding
Edit `index.html` — search for `DocSearch Pro` and update the brand name, tagline, and footer.

### Adjust supported file types
In `index.html`, update the `accept` attribute on the `<input type="file">`:
```html
<input ... accept=".txt,.md,.csv,.log,.json,.xml" />
```

### Tune search behaviour
In `src/search-engine.js`, modify:
- `STOP_WORDS` — add/remove stop words
- `CONTEXT` constant in `_extractSnippets` — change snippet context window (default: 80 chars)
- `maxSnippets` option — change how many snippets are shown per result

### Remove demo documents
In `src/app.js`, delete or modify the `demos` array near the bottom of the file.

---

## 📖 How It Works

DocSearch Pro uses an **inverted index** with **TF-IDF scoring**:

1. **Indexing** — each document is tokenised; a posting list maps every token to the documents containing it and their positions.
2. **TF-IDF** — *term frequency* (how often the term appears in the doc) × *inverse document frequency* (how rare the term is across all docs) = relevance score.
3. **Snippets** — for each result, regex matches extract 80-character context windows around the first two match positions.
4. **Highlighting** — match terms are wrapped in `<mark>` tags, rendered safely with HTML escaping.

All computation runs synchronously on the main thread. For libraries up to ~50,000 words per document, indexing typically completes in under 5 ms.

---

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md) or the in-app changelog panel (click the version tag in the header).

---

## 📄 License

[MIT](LICENSE) © 2025 luke-pekala
