/**
 * DocSearch Pro — app.js
 * Orchestrates UI interactions, file ingestion, live search results and exports.
 */

'use strict';

(function () {

  /* ─── Engine ───────────────────────────────────────────────── */
  const index = new SearchEngine.InvertedIndex();

  /* ─── DOM refs ─────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  const themeToggle     = $('theme-toggle');
  const changelogBtn    = $('changelog-btn');
  const changelogPanel  = $('changelog-panel');
  const dropZone        = $('drop-zone');
  const fileInput       = $('file-input');
  const docListWrap     = $('doc-list-wrap');
  const docList         = $('doc-list');
  const clearAllBtn     = $('clear-all-btn');
  const docCountBadge   = $('doc-count-badge');
  const pasteToggleBtn  = $('paste-toggle-btn');
  const pasteArea       = $('paste-area');
  const pasteTitle      = $('paste-title');
  const pasteContent    = $('paste-content');
  const addPasteBtn     = $('add-paste-btn');
  const cancelPasteBtn  = $('cancel-paste-btn');
  const statDocs        = $('stat-docs');
  const statWords       = $('stat-words');
  const statTokens      = $('stat-tokens');
  const searchInput     = $('search-input');
  const searchClearBtn  = $('search-clear-btn');
  const filterDoc       = $('filter-doc');
  const sortBy          = $('sort-by');
  const wholeWord       = $('whole-word');
  const caseSensitive   = $('case-sensitive');
  const resultList      = $('result-list');
  const resultsEmpty    = $('results-empty');
  const emptyMessage    = $('empty-message');
  const resultFooter    = $('result-footer');
  const resultCountText = $('result-count-text');
  const resultTimeText  = $('result-time-text');
  const copyBtn         = $('copy-btn');
  const exportBtn       = $('export-btn');
  const liveDot         = $('live-dot');

  /* ─── State ────────────────────────────────────────────────── */
  let lastResults = [];
  let searchDebounce = null;

  /* ══════════════════════════════════════════════════════════════
     THEME
  ══════════════════════════════════════════════════════════════ */
  (function initTheme() {
    const stored = localStorage.getItem('dsp-theme');
    const prefer = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', stored || prefer);
  })();

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dsp-theme', next);
    themeToggle.classList.add('toggling');
    themeToggle.addEventListener('animationend', () => themeToggle.classList.remove('toggling'), { once: true });
  });

  /* ══════════════════════════════════════════════════════════════
     CHANGELOG
  ══════════════════════════════════════════════════════════════ */
  changelogBtn.addEventListener('click', () => {
    const expanded = changelogBtn.getAttribute('aria-expanded') === 'true';
    changelogBtn.setAttribute('aria-expanded', String(!expanded));
    if (expanded) {
      changelogPanel.hidden = true;
    } else {
      changelogPanel.hidden = false;
    }
  });

  /* ══════════════════════════════════════════════════════════════
     FILE INGESTION
  ══════════════════════════════════════════════════════════════ */

  /** Read a File object as text, then index it. */
  async function ingestFile(file) {
    const text = await readFileAsText(file);
    addDocument(file.name, text);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = ()  => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file, 'utf-8');
    });
  }

  /** Add a named document to the index and update UI. */
  function addDocument(name, text) {
    const cleanName = name.trim() || `document-${index.docCount + 1}.txt`;
    const cleanText = text.trim();
    if (!cleanText) return;

    const docId = index.addDocument(cleanName, cleanText);
    addDocToList(docId, cleanName, index.docs.get(docId).wordCount);
    updateStats();
    updateFilterDropdown();
    runSearch();
  }

  function addDocToList(docId, name, wordCount) {
    docListWrap.hidden = false;

    const li = document.createElement('li');
    li.className = 'doc-item';
    li.dataset.docId = docId;
    li.setAttribute('role', 'listitem');

    li.innerHTML = `
      <svg class="doc-item-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span class="doc-item-name" title="${SearchEngine.escHtml(name)}">${SearchEngine.escHtml(name)}</span>
      <span class="doc-item-words">${fmtNum(wordCount)}w</span>
      <button class="doc-item-remove" aria-label="Remove ${SearchEngine.escHtml(name)}" title="Remove document">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    li.querySelector('.doc-item-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeDocument(docId, li);
    });

    docList.appendChild(li);

    // Enable clear-all button
    clearAllBtn.disabled = false;
  }

  function removeDocument(docId, li) {
    index.removeDocument(docId);
    li.remove();
    if (docList.children.length === 0) {
      docListWrap.hidden = true;
      clearAllBtn.disabled = true;
    }
    updateStats();
    updateFilterDropdown();
    runSearch();
  }

  /* ── Drag and drop ─────────────────────────────────────────── */
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    for (const f of files) await ingestFile(f);
    fileInput.value = '';
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', async e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) await ingestFile(f);
  });

  /* ── Clear all ─────────────────────────────────────────────── */
  clearAllBtn.addEventListener('click', () => {
    index.clear();
    docList.innerHTML = '';
    docListWrap.hidden = true;
    clearAllBtn.disabled = true;
    updateStats();
    updateFilterDropdown();
    runSearch();
  });

  /* ── Paste area ────────────────────────────────────────────── */
  pasteToggleBtn.addEventListener('click', () => {
    const expanded = pasteToggleBtn.getAttribute('aria-expanded') === 'true';
    pasteToggleBtn.setAttribute('aria-expanded', String(!expanded));
    pasteArea.hidden = expanded;
    if (!expanded) pasteTitle.focus();
  });

  cancelPasteBtn.addEventListener('click', () => {
    pasteToggleBtn.setAttribute('aria-expanded', 'false');
    pasteArea.hidden = true;
    pasteTitle.value = '';
    pasteContent.value = '';
  });

  addPasteBtn.addEventListener('click', () => {
    const title   = pasteTitle.value.trim();
    const content = pasteContent.value.trim();
    if (!content) { pasteContent.focus(); return; }
    addDocument(title || 'pasted-document.txt', content);
    pasteTitle.value   = '';
    pasteContent.value = '';
    pasteToggleBtn.setAttribute('aria-expanded', 'false');
    pasteArea.hidden = true;
  });

  /* ══════════════════════════════════════════════════════════════
     SEARCH
  ══════════════════════════════════════════════════════════════ */
  searchInput.addEventListener('input', () => {
    searchClearBtn.hidden = !searchInput.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(runSearch, 120);
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.hidden = true;
    searchInput.focus();
    runSearch();
  });

  [filterDoc, sortBy, wholeWord, caseSensitive].forEach(el => {
    el.addEventListener('change', runSearch);
  });

  function runSearch() {
    const query = searchInput.value.trim();
    const opts  = {
      wholeWord:     wholeWord.checked,
      caseSensitive: caseSensitive.checked,
      filterDocId:   filterDoc.value
    };

    if (!query) {
      lastResults = [];
      renderEmpty(index.docCount === 0
        ? 'Add documents to get started, then type a query above.'
        : 'Type a query above to search across your documents.');
      resultFooter.hidden = true;
      liveDot.style.display = 'none';
      copyBtn.disabled  = true;
      exportBtn.disabled = true;
      return;
    }

    const { results, elapsed } = index.search(query, opts);
    lastResults = sortResults(results, sortBy.value);

    liveDot.style.display = '';
    renderResults(lastResults, query, opts);

    resultCountText.textContent = `${lastResults.length} result${lastResults.length !== 1 ? 's' : ''}`;
    resultTimeText.textContent  = `${elapsed.toFixed(1)} ms`;
    resultFooter.hidden = false;

    copyBtn.disabled   = lastResults.length === 0;
    exportBtn.disabled = lastResults.length === 0;
  }

  function sortResults(results, by) {
    if (by === 'doc')  return [...results].sort((a, b) => a.docName.localeCompare(b.docName));
    if (by === 'pos')  return [...results];  // already in positional order via index
    return [...results].sort((a, b) => b.score - a.score);  // relevance (default)
  }

  function renderResults(results, query, opts) {
    resultList.innerHTML = '';
    if (results.length === 0) {
      renderEmpty(`No results for "${SearchEngine.escHtml(query)}"`);
      resultsEmpty.style.display = 'flex';
      return;
    }
    resultsEmpty.style.display = 'none';

    const queryTerms = SearchEngine.tokenize(query, {
      removeStopWords: false,
      lowercase: !opts.caseSensitive
    });

    results.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'result-card';
      li.style.animationDelay = `${i * 0.025}s`;
      li.setAttribute('role', 'listitem');

      const snippetHtml = r.snippets.map(s =>
        `<div class="result-snippet">${
          SearchEngine.highlightSnippet(s.text, queryTerms, opts)
        }</div>`
      ).join('');

      li.innerHTML = `
        <div class="result-card-header">
          <span class="result-doc-name" title="${SearchEngine.escHtml(r.docName)}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.5;flex-shrink:0;" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            ${SearchEngine.escHtml(r.docName)}
          </span>
          <span class="result-score" aria-label="Relevance score ${r.score.toFixed(0)}">score ${r.score.toFixed(0)}</span>
        </div>
        ${snippetHtml}
        <div class="result-meta">${fmtNum(r.wordCount)} words</div>
      `;

      resultList.appendChild(li);
    });
  }

  function renderEmpty(message) {
    resultList.innerHTML = '';
    emptyMessage.textContent = message;
    resultsEmpty.style.display = 'flex';
  }

  /* ══════════════════════════════════════════════════════════════
     STATS
  ══════════════════════════════════════════════════════════════ */
  function updateStats() {
    animateStat(statDocs,   index.docCount);
    animateStat(statWords,  index.totalWords);
    animateStat(statTokens, index.tokenCount);
    docCountBadge.textContent = `${index.docCount} doc${index.docCount !== 1 ? 's' : ''}`;
  }

  function animateStat(el, value) {
    el.textContent = fmtNum(value);
    el.classList.remove('updated');
    void el.offsetWidth;  // reflow
    el.classList.add('updated');
  }

  /* ══════════════════════════════════════════════════════════════
     FILTER DROPDOWN
  ══════════════════════════════════════════════════════════════ */
  function updateFilterDropdown() {
    const current = filterDoc.value;
    filterDoc.innerHTML = '<option value="">All documents</option>';
    index.docs.forEach((doc) => {
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = doc.name.length > 30 ? doc.name.slice(0, 28) + '…' : doc.name;
      filterDoc.appendChild(opt);
    });
    // Restore selection if still valid
    if ([...filterDoc.options].some(o => o.value === current)) {
      filterDoc.value = current;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     COPY / EXPORT
  ══════════════════════════════════════════════════════════════ */
  copyBtn.addEventListener('click', async () => {
    if (lastResults.length === 0) return;
    const text = lastResults.map(r =>
      `[${r.docName}] (score: ${r.score.toFixed(0)})\n` +
      r.snippets.map(s => s.text).join('\n') + '\n'
    ).join('\n---\n\n');

    try {
      await navigator.clipboard.writeText(text);
      flashBtn(copyBtn, 'Copied!', 'btn--success');
    } catch {
      flashBtn(copyBtn, 'Failed', 'btn--warn');
    }
  });

  exportBtn.addEventListener('click', () => {
    if (lastResults.length === 0) return;
    const query = searchInput.value.trim();
    const payload = {
      query,
      date: new Date().toISOString(),
      totalResults: lastResults.length,
      results: lastResults.map(r => ({
        document:  r.docName,
        score:     parseFloat(r.score.toFixed(2)),
        snippets:  r.snippets.map(s => s.text),
        wordCount: r.wordCount
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `search-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flashBtn(exportBtn, 'Exported', 'btn--success');
  });

  function flashBtn(btn, label, cls) {
    const original = btn.innerHTML;
    btn.textContent = label;
    btn.classList.add(cls);
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove(cls);
    }, 1800);
  }

  /* ══════════════════════════════════════════════════════════════
     KEYBOARD SHORTCUTS
  ══════════════════════════════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    // Cmd/Ctrl + K → focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // Escape → clear search or close paste area
    if (e.key === 'Escape') {
      if (document.activeElement === searchInput && searchInput.value) {
        searchInput.value = '';
        searchClearBtn.hidden = true;
        runSearch();
      } else if (!pasteArea.hidden) {
        cancelPasteBtn.click();
      }
    }
  });

  /* ══════════════════════════════════════════════════════════════
     DEMO DATA  (loaded on first visit)
  ══════════════════════════════════════════════════════════════ */
  if (!localStorage.getItem('dsp-demo-loaded')) {
    const demos = [
      {
        name: 'getting-started.md',
        text: `# Getting Started with DocSearch Pro

DocSearch Pro is a fast, client-side full-text search tool.
All processing happens in your browser — your documents never leave your device.

## How to use

1. Drag and drop text files (.txt, .md, .csv, .log) onto the left panel.
2. Or paste content directly using the "Paste text" button.
3. Type a search query in the right panel.

## Features

- TF-IDF relevance ranking
- Live search with highlighted snippets
- Filter results by document
- Sort by relevance, document name, or position
- Whole-word and case-sensitive search modes
- Export results as JSON

## Keyboard shortcuts

- Cmd/Ctrl + K — focus search
- Escape — clear search query
`
      },
      {
        name: 'release-notes.txt',
        text: `DocSearch Pro v1.0.0 Release Notes
===================================

Released: April 2025

New features
------------
- Full-text inverted index with TF-IDF scoring
- Drag-and-drop file ingestion for txt, md, csv, log and json files
- Paste text directly into the library with a custom document name
- Live search with real-time result rendering
- Highlighted match snippets with surrounding context
- Filter results by individual document
- Sort results by relevance score, document name, or position
- Whole-word and case-sensitive search toggles
- Export search results as structured JSON
- One-click copy results to clipboard
- Dark / light theme toggle persisted in localStorage
- Keyboard shortcut: Ctrl/Cmd+K to focus search
- Zero external dependencies — pure HTML, CSS, and JavaScript
- Fully responsive layout (mobile-first breakpoints at 860px and 560px)

Performance
-----------
Indexing is synchronous on the main thread; typically <5ms for documents
under 50,000 words. Search queries return in <2ms for libraries up to
10,000 unique tokens.

Known limitations
-----------------
- No persistence across sessions (by design — privacy-first)
- PDF and DOCX parsing not yet supported (planned for v1.1)
- No fuzzy matching (planned for v1.2)
`
      }
    ];

    demos.forEach(d => addDocument(d.name, d.text));
    localStorage.setItem('dsp-demo-loaded', '1');
  }

  /* ══════════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════════ */
  function fmtNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }

  /* ── Init ───────────────────────────────────────────────────── */
  updateStats();
  runSearch();

})();
