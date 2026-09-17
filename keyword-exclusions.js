/**
 * KEYWORDS THE OWNER HAS DECIDED NOT TO CARRY.
 *
 * Extraction gets a requirement wrong, or right and unwanted. "Salesforce"
 * on every posting when you have never opened it; a soft skill you refuse
 * to claim; a tool you used once in 2014 and will not defend at interview.
 * Until now the only remedy was to watch it reappear on every application
 * and delete it by hand each time.
 *
 * An exclusion is a standing decision. It is stored, it survives the
 * popup closing, and it applies to every posting from then on.
 *
 * IT LIVES ON THE ACCOUNT, NOT IN THE EXTENSION. chrome.storage.local
 * dies with the extension: uninstall it, switch machine, or let Chrome
 * clear it, and every decision is gone. The list is held in the user's
 * profile row and mirrored locally, so local storage is a cache that can
 * be thrown away rather than the only copy.
 *
 * IT IS NOT A BLOCKLIST OF STRINGS. "Machine Learning" and "ML" are one
 * requirement, so excluding either excludes both -- the same table that
 * decides a chip is green decides what an exclusion covers. A list keyed
 * on spelling would let the next posting's wording walk straight past it.
 *
 * WHERE IT APPLIES. One place: the funnel every list already passes
 * through. The gauge, the chips, the injection and the coverage score all
 * read from that, so an excluded term cannot be missing from the panel and
 * present in the document, which is the failure this project has had in
 * every other form.
 *
 *   window.KeywordExclusions
 */
(function (global) {
  'use strict';

  const KEY = 'jg_excluded_keywords';
  const COLUMN = 'excluded_keywords';
  const LIMIT = 200;

  const TX = () => (global && global.KeywordTaxonomy)
    || (typeof KeywordTaxonomy !== 'undefined' ? KeywordTaxonomy : null);

  /** The requirement identity, so a synonym cannot slip past. */
  function identityOf(term) {
    const tx = TX();
    const raw = String(term == null ? '' : term).trim();
    if (!raw) return '';
    if (tx && typeof tx.keyOf === 'function') {
      try { return tx.keyOf(raw); } catch (e) { /* fall through */ }
    }
    return 'raw:' + raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  // Held in memory so the filter below is synchronous: it runs inside
  // rendering and inside the coverage pass, neither of which can await.
  let _cache = null;
  let _remote = null;   // set by connect() once there is a signed-in session
  let _lastSync = null; // 'account' | 'local' | 'error', for the UI to report

  function _storage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return chrome.storage.local;
      }
    } catch (e) { /* not in an extension */ }
    return null;
  }

  function _clean(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const e of list) {
      if (!e || typeof e.term !== 'string' || !e.term.trim()) continue;
      // DERIVED FROM THE TERM, NEVER TRUSTED FROM THE ROW. A stored id is
      // whatever wrote it -- an older build, the website, a hand-edited
      // row -- and an id that is not the taxonomy's key for the term
      // matches nothing, so the entry sits in the list looking excluded
      // while every posting puts the term straight back.
      const id = identityOf(e.term) || e.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        term: e.term.trim(),
        covers: Array.isArray(e.covers) ? e.covers.slice(0, 12) : [e.term.trim()],
        note: String(e.note || ''),
        at: String(e.at || new Date().toISOString()),
      });
    }
    return out.slice(0, LIMIT);
  }

  /**
   * Point the store at the signed-in account.
   *
   * The popup calls this once it has a session. Without it everything
   * still works against local storage alone, which is what an offline
   * or signed-out popup gets.
   */
  function connect(config) {
    const c = config || {};
    if (!c.supabaseUrl || !c.anonKey || !c.accessToken || !c.userId) {
      _remote = null;
      return false;
    }
    _remote = {
      url: String(c.supabaseUrl).replace(/\/+$/, ''),
      anonKey: c.anonKey,
      token: c.accessToken,
      userId: c.userId,
      fetch: typeof c.fetch === 'function' ? c.fetch
        : (typeof fetch === 'function' ? fetch.bind(global) : null),
    };
    if (!_remote.fetch) { _remote = null; return false; }
    return true;
  }

  function disconnect() { _remote = null; }

  function _row() {
    return `${_remote.url}/rest/v1/profiles?user_id=eq.${encodeURIComponent(_remote.userId)}`;
  }

  function _headers(extra) {
    return Object.assign({
      apikey: _remote.anonKey,
      Authorization: `Bearer ${_remote.token}`,
    }, extra || {});
  }

  /** Read the account's list. Returns null when it could not be read. */
  async function _pull() {
    if (!_remote) return null;
    try {
      const res = await _remote.fetch(`${_row()}&select=${COLUMN}`, {
        headers: _headers(),
      });
      if (!res || !res.ok) return null;
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) return null;
      const raw = row[COLUMN];
      // The column is jsonb, but a text column holding JSON is a shape
      // this has to survive rather than throw on.
      if (typeof raw === 'string') {
        try { return _clean(JSON.parse(raw)); } catch (e) { return null; }
      }
      return _clean(raw);
    } catch (e) { return null; }
  }

  /** Write the account's list. Returns true when it landed. */
  async function _push(list) {
    if (!_remote) return false;
    try {
      const res = await _remote.fetch(_row(), {
        method: 'PATCH',
        headers: _headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ [COLUMN]: list }),
      });
      return !!(res && res.ok);
    } catch (e) { return false; }
  }

  async function _readLocal() {
    const store = _storage();
    if (!store) return [];
    return new Promise((resolve) => {
      try {
        store.get([KEY], (got) => resolve(_clean(got && got[KEY])));
      } catch (e) { resolve([]); }
    });
  }

  async function _writeLocal(list) {
    const store = _storage();
    if (!store) return;
    await new Promise((resolve) => {
      try { store.set({ [KEY]: list }, () => resolve()); } catch (e) { resolve(); }
    });
  }

  /**
   * Fill in the synonyms an entry was stored without.
   *
   * The website has no copy of the 918-group table, so a term excluded
   * there arrives with covers holding only the spelling that was typed.
   * That costs nothing here -- the identity is recomputed from the term,
   * so the extension already excludes the whole group -- but the site
   * matches on the stored covers, and so goes on counting "ML" against
   * someone who struck off "Machine Learning".
   *
   * So the extension writes the group back. The table lives in one place
   * and the answer reaches both. What the owner typed by hand comes
   * first and is never dropped: this adds, it does not replace.
   */
  function _enrich(list) {
    const tx = TX();
    if (!tx || typeof tx.variantsOf !== 'function' || typeof tx.groupOf !== 'function') {
      return { list, changed: false };
    }
    let changed = false;
    const out = list.map((entry) => {
      let known = [];
      try {
        // ONLY FOR A TERM THE TABLE ACTUALLY KNOWS. variantsOf is happy
        // to invent a plural for anything, so an in-house tool name would
        // otherwise be written back to the account decorated with a guess
        // at what else it might be called.
        if (!tx.groupOf(entry.term)) return entry;
        known = tx.variantsOf(entry.term) || [];
      } catch (e) { return entry; }
      if (!known.length) return entry;
      const held = Array.isArray(entry.covers) ? entry.covers : [];
      const seen = new Set();
      const merged = [];
      for (const c of held.concat(known)) {
        const text = String(c == null ? '' : c).trim();
        const k = text.toLowerCase();
        if (!text || seen.has(k)) continue;
        seen.add(k);
        merged.push(text);
      }
      const covers = merged.slice(0, 12);
      // Compared as written, so an entry already carrying its group is
      // left alone and this cannot push on every single load.
      if (covers.join(' ') === held.join(' ')) return entry;
      changed = true;
      return Object.assign({}, entry, { covers });
    });
    return { list: out, changed };
  }

  /**
   * Read the stored list, newest first.
   *
   * Local and account copies are UNIONED rather than one replacing the
   * other. A decision made while offline would otherwise be erased by the
   * next load, and an exclusion made on one machine would not reach the
   * next. The union errs towards keeping a term hidden, which is the
   * direction the owner chose when they excluded it; removing is an
   * explicit act that writes both copies at once.
   */
  async function load(opts) {
    if (_cache && !(opts && opts.force)) return _cache;
    const local = await _readLocal();
    const remote = await _pull();
    if (remote === null) {
      _lastSync = _remote ? 'error' : 'local';
      _cache = _enrich(local).list;
      return _cache;
    }
    _lastSync = 'account';
    const byId = new Map();
    for (const e of remote) byId.set(e.id, e);
    for (const e of local) if (!byId.has(e.id)) byId.set(e.id, e);
    const merged = _clean(Array.from(byId.values())
      .sort((a, b) => String(b.at).localeCompare(String(a.at))));
    const grew = merged.length !== remote.length;
    const { list, changed } = _enrich(merged);
    _cache = list;
    await _writeLocal(list);
    if (grew || changed) await _push(list);
    return _cache;
  }

  async function _save(list) {
    _cache = list;
    await _writeLocal(list);
    if (_remote) {
      const ok = await _push(list);
      _lastSync = ok ? 'account' : 'error';
    }
  }

  /** Everything currently excluded, newest first. */
  function all() { return (_cache || []).slice(); }

  /** Where the list last came from: 'account', 'local' or 'error'. */
  function syncState() { return _lastSync; }

  /**
   * Exclude a term. Returns the entry, or null when it was already
   * excluded under any of its names.
   */
  async function add(term, note) {
    const raw = String(term == null ? '' : term).trim();
    if (!raw) return null;
    const list = (await load()).slice();
    const id = identityOf(raw);
    if (!id || list.some((e) => e.id === id)) return null;
    const tx = TX();
    const entry = {
      id,
      term: raw,
      // What the exclusion actually covers, so the UI can say so rather
      // than leaving the owner to discover that "ML" went too.
      covers: (tx && typeof tx.variantsOf === 'function'
        ? tx.variantsOf(raw) : [raw]).slice(0, 12),
      note: String(note || ''),
      at: new Date().toISOString(),
    };
    list.unshift(entry);
    await _save(list.slice(0, LIMIT));
    return entry;
  }

  /** Stop excluding a term. Returns true when something was removed. */
  async function remove(term) {
    const id = identityOf(term);
    if (!id) return false;
    const list = await load();
    const next = list.filter((e) => e.id !== id);
    if (next.length === list.length) return false;
    await _save(next);
    return true;
  }

  async function clear() { await _save([]); }

  /** Is this term excluded, under this or any other of its names? */
  function isExcluded(term) {
    const id = identityOf(term);
    if (!id) return false;
    return (_cache || []).some((e) => e.id === id);
  }

  /**
   * The list with excluded requirements taken out.
   *
   * Synchronous and cache-backed on purpose: this runs inside chip
   * rendering and inside the coverage pass. load() is called once when
   * the popup opens, so by the time anything is tailored the cache is
   * warm; with an empty cache this returns the list untouched, which is
   * the safe direction -- a keyword shown that should have been hidden is
   * visible and fixable, one hidden that should have been shown is not.
   */
  function filter(list) {
    const items = Array.isArray(list) ? list : [];
    if (!_cache || !_cache.length) return items;
    return items.filter((k) => !isExcluded(k));
  }

  /** How many of these would be removed, without removing them. */
  function countIn(list) {
    return (Array.isArray(list) ? list : []).filter((k) => isExcluded(k)).length;
  }

  global.KeywordExclusions = {
    connect, disconnect, load, all, add, remove, clear,
    isExcluded, filter, countIn, identityOf, syncState,
    STORAGE_KEY: KEY,
    PROFILE_COLUMN: COLUMN,
    // Testing seam: the popup never sets these, and nothing else should.
    _setCache(list) { _cache = Array.isArray(list) ? list : null; },
    _reset() { _cache = null; _remote = null; _lastSync = null; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.KeywordExclusions;
})(typeof window !== 'undefined' ? window : globalThis);
