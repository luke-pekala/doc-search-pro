/**
 * DocSearch Pro — search-engine.js
 * Zero-dependency TF-IDF full-text search engine.
 * Exposed as window.SearchEngine.
 */

'use strict';

(function (global) {

  /* ─── Stop-word list ───────────────────────────────────────── */
  const STOP_WORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'by','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall',
    'this','that','these','those','i','you','he','she','it','we','they',
    'me','him','her','us','them','my','your','his','its','our','their',
    'what','which','who','from','as','not','no','so','if','then','than',
    'into','up','out','about','over','after','before','between','during',
    'each','more','also','just','very','can','its','there','here'
  ]);

  /* ─── Tokenizer ────────────────────────────────────────────── */
  function tokenize(text, { removeStopWords = true, lowercase = true } = {}) {
    let t = lowercase ? text.toLowerCase() : text;
    const tokens = t
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .map(w => w.replace(/^['-]+|['-]+$/g, ''))
      .filter(w => w.length > 1);
    return removeStopWords ? tokens.filter(w => !STOP_WORDS.has(w)) : tokens;
  }

  /* ─── Inverted index ───────────────────────────────────────── */
  class InvertedIndex {
    constructor() {
      // term → Map<docId, [{pos, lineNo}]>
      this.index = new Map();
      this.docs  = new Map();  // docId → { id, name, text, wordCount }
      this._nextId = 0;
    }

    addDocument(name, text) {
      const id = String(this._nextId++);
      const words = tokenize(text, { removeStopWords: false });
      const wordCount = words.length;

      this.docs.set(id, { id, name, text, wordCount });

      // Build term → positions map
      const termPositions = new Map();
      words.forEach((rawWord, pos) => {
        const term = rawWord.toLowerCase();
        if (!termPositions.has(term)) termPositions.set(term, []);
        termPositions.get(term).push(pos);
      });

      // Merge into global inverted index
      termPositions.forEach((positions, term) => {
        if (!this.index.has(term)) this.index.set(term, new Map());
        this.index.get(term).set(id, positions);
      });

      return id;
    }

    removeDocument(docId) {
      if (!this.docs.has(docId)) return false;
      this.docs.delete(docId);
      // Remove docId from every posting list
      this.index.forEach((postings, term) => {
        postings.delete(docId);
        if (postings.size === 0) this.index.delete(term);
      });
      return true;
    }

    clear() {
      this.index.clear();
      this.docs.clear();
      this._nextId = 0;
    }

    get docCount()      { return this.docs.size; }
    get tokenCount()    { return this.index.size; }
    get totalWords()    { let s = 0; this.docs.forEach(d => s += d.wordCount); return s; }

    /**
     * Search returns an array of result objects sorted by score desc.
     * @param {string} query
     * @param {{ wholeWord?: boolean, caseSensitive?: boolean, filterDocId?: string }} opts
     */
    search(query, opts = {}) {
      const { wholeWord = false, caseSensitive = false, filterDocId = '' } = opts;
      const t0 = performance.now();

      if (!query.trim() || this.docs.size === 0) return { results: [], elapsed: 0 };

      const queryTerms = tokenize(query, { removeStopWords: false, lowercase: !caseSensitive });
      if (queryTerms.length === 0) return { results: [], elapsed: 0 };

      // Accumulate TF-IDF scores per doc
      const N = this.docs.size;
      const docScores = new Map();  // docId → score

      queryTerms.forEach(term => {
        const lookupTerm = caseSensitive ? term : term.toLowerCase();
        const postings = this.index.get(lookupTerm);
        if (!postings) return;

        const df = postings.size;             // document frequency
        const idf = Math.log((N + 1) / (df + 1)) + 1;  // smoothed IDF

        postings.forEach((positions, docId) => {
          if (filterDocId && docId !== filterDocId) return;
          const doc = this.docs.get(docId);
          if (!doc) return;

          const tf = positions.length / doc.wordCount;  // normalized TF
          const score = tf * idf;

          docScores.set(docId, (docScores.get(docId) || 0) + score);
        });
      });

      // Build results
      const results = [];
      docScores.forEach((score, docId) => {
        const doc = this.docs.get(docId);
        if (!doc) return;

        const snippets = this._extractSnippets(doc.text, queryTerms, {
          wholeWord, caseSensitive, maxSnippets: 2
        });

        results.push({
          docId,
          docName: doc.name,
          score: Math.min(score * 100, 100),  // normalised to 0-100
          snippets,
          wordCount: doc.wordCount
        });
      });

      results.sort((a, b) => b.score - a.score);

      return { results, elapsed: performance.now() - t0 };
    }

    /**
     * Extract context snippets around query term matches.
     */
    _extractSnippets(text, queryTerms, { wholeWord, caseSensitive, maxSnippets = 2 }) {
      const flags = caseSensitive ? 'g' : 'gi';
      const escTerms = queryTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = wholeWord
        ? `\\b(${escTerms.join('|')})\\b`
        : `(${escTerms.join('|')})`;

      let re;
      try { re = new RegExp(pattern, flags); }
      catch { return [{ text: text.slice(0, 150) + '…', hasMatch: false }]; }

      const snippets = [];
      const CONTEXT = 80;  // chars either side

      let m;
      while ((m = re.exec(text)) !== null && snippets.length < maxSnippets) {
        const start = Math.max(0, m.index - CONTEXT);
        const end   = Math.min(text.length, m.index + m[0].length + CONTEXT);
        const raw   = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
        snippets.push({ text: raw, hasMatch: true, matchIndex: m.index });
        // Advance to avoid overlapping snippets
        re.lastIndex = Math.min(re.lastIndex, m.index + CONTEXT * 2);
      }

      if (snippets.length === 0) {
        snippets.push({ text: text.slice(0, 200) + (text.length > 200 ? '…' : ''), hasMatch: false });
      }

      return snippets;
    }
  }

  /* ─── Highlight helper ─────────────────────────────────────── */
  function highlightSnippet(snippet, queryTerms, { wholeWord = false, caseSensitive = false } = {}) {
    const escTerms = queryTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const flags    = caseSensitive ? 'g' : 'gi';
    const pattern  = wholeWord
      ? `\\b(${escTerms.join('|')})\\b`
      : `(${escTerms.join('|')})`;
    let re;
    try { re = new RegExp(pattern, flags); }
    catch { return escHtml(snippet); }

    return escHtml(snippet).replace(
      re,
      (_, m) => `<mark>${escHtml(m)}</mark>`
    );
  }

  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─── Export ───────────────────────────────────────────────── */
  global.SearchEngine = {
    InvertedIndex,
    tokenize,
    highlightSnippet,
    escHtml,
    STOP_WORDS
  };

}(window));
