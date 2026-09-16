// A KEYWORD YOU NEVER WANT AGAIN.
//
// Extraction can be entirely right about the posting and entirely wrong
// about the candidate. "Salesforce" is in the advert; he has never opened
// it and will not defend it at interview. Until now the only remedy was
// to delete it by hand on this application, and then on the next one, and
// then on the one after that, because nothing remembered the decision.
//
// TWO THINGS HAVE TO BE TRUE, and the second is the one that makes it
// worth building:
//
//   1. Excluding a term excludes the REQUIREMENT, not the spelling.
//      Strike off "Machine Learning" and the next posting that says "ML"
//      must not walk straight past it.
//
//   2. The decision lives on the ACCOUNT. chrome.storage.local dies with
//      the extension -- uninstall, reinstall, new laptop, cleared site
//      data -- and a list of standing decisions that evaporates is worse
//      than none, because you only find out it went when the term is
//      already back on a CV you sent.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
global.window = global;

// A chrome.storage.local that behaves like the real one: callback-style,
// and holding nothing but what was put in it.
let DISK = {};
global.chrome = {
  storage: {
    local: {
      get(keys, cb) { const out = {}; for (const k of [].concat(keys)) if (k in DISK) out[k] = DISK[k]; cb(out); },
      set(obj, cb) { Object.assign(DISK, JSON.parse(JSON.stringify(obj))); cb && cb(); },
    },
  },
};

const realConsole = console;
global.console = Object.assign({}, realConsole, { log() {}, warn() {} });
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'keyword-exclusions.js'));
global.console = realConsole;
const X = global.KeywordExclusions;

// A Supabase stand-in. Records every request so the test can assert on
// what actually went over the wire, not on what the module says it did.
function server(initial) {
  const state = { column: initial === undefined ? [] : initial, calls: [], fail: false };
  state.fetch = async (url, opts) => {
    state.calls.push({ url, method: (opts && opts.method) || 'GET', opts });
    if (state.fail) throw new Error('offline');
    if (!opts || !opts.method || opts.method === 'GET') {
      return { ok: true, json: async () => [{ excluded_keywords: state.column }] };
    }
    if (opts.method === 'PATCH') {
      state.column = JSON.parse(opts.body).excluded_keywords;
      return { ok: true, json: async () => ({}) };
    }
    return { ok: false, json: async () => ({}) };
  };
  return state;
}

const CONNECT = (s) => X.connect({
  supabaseUrl: 'https://example.supabase.co', anonKey: 'anon-key',
  accessToken: 'token-123', userId: 'user-abc', fetch: s.fetch,
});

const fresh = () => { DISK = {}; X._reset(); };

console.log('AN EXCLUSION COVERS THE REQUIREMENT, NOT THE SPELLING');
(async () => {
  {
    fresh();
    await X.load();
    await X.add('Machine Learning');
    t('  the term itself is excluded', X.isExcluded('Machine Learning'), 'not excluded');
    t('  ...and so is the posting\'s other name for it', X.isExcluded('ML'),
      'the next advert saying ML would put it straight back');
    t('  ...and the exclusion says what it covers',
      (X.all()[0].covers || []).length > 1, JSON.stringify(X.all()[0]));
    t('  an unrelated requirement is untouched', !X.isExcluded('Kubernetes'), 'over-broad');
  }

  {
    fresh();
    await X.load();
    await X.add('PostgreSQL');
    const kept = X.filter(['Python', 'Postgres', 'AWS', 'PostgreSQL']);
    t('  filter removes every name for it, once',
      kept.join(',') === 'Python,AWS', kept.join(','));
    t('  countIn reports without removing',
      X.countIn(['Postgres', 'PostgreSQL', 'Python']) === 2,
      String(X.countIn(['Postgres', 'PostgreSQL', 'Python'])));
    t('  excluding the same requirement twice is not a second entry',
      (await X.add('Postgres')) === null, JSON.stringify(X.all()));
  }

  console.log('\nAND IT IS KEPT ON THE ACCOUNT, NOT IN THE EXTENSION');
  {
    fresh();
    const s = server([]);
    CONNECT(s);
    await X.load();
    await X.add('Salesforce');
    const patch = s.calls.filter((c) => c.method === 'PATCH').pop();
    t('  adding one writes it to the profile row', !!patch, JSON.stringify(s.calls.map((c) => c.method)));
    t('  ...to this user\'s row', /profiles\?user_id=eq\.user-abc/.test(patch.url), patch.url);
    t('  ...authenticated as this user',
      patch.opts.headers.Authorization === 'Bearer token-123'
        && patch.opts.headers.apikey === 'anon-key', JSON.stringify(patch.opts.headers));
    t('  ...into the excluded_keywords column',
      Array.isArray(s.column) && s.column[0].term === 'Salesforce', JSON.stringify(s.column));
    t('  ...with the synonyms it covers, so another client need not recompute them',
      (s.column[0].covers || []).length >= 1, JSON.stringify(s.column[0]));
    t('  and it is mirrored locally for the next popup open',
      Array.isArray(DISK[X.STORAGE_KEY]) && DISK[X.STORAGE_KEY].length === 1,
      JSON.stringify(DISK));
  }

  console.log('\nSO A REINSTALLED EXTENSION GETS THE DECISIONS BACK');
  {
    // The whole point. Local storage is empty, as it is on a fresh
    // install, and the account still knows.
    fresh();
    const s = server([{ id: 'x', term: 'Salesforce', covers: ['Salesforce'], at: '2026-01-01T00:00:00Z' }]);
    CONNECT(s);
    await X.load();
    t('  the account\'s list is loaded with nothing on disk',
      X.isExcluded('Salesforce'), JSON.stringify(X.all()));
    t('  ...and reported as coming from the account', X.syncState() === 'account', X.syncState());
    t('  ...and written back to disk as a cache',
      (DISK[X.STORAGE_KEY] || []).length === 1, JSON.stringify(DISK));
  }

  console.log('\nAND A DECISION MADE OFFLINE IS NOT ERASED BY ONE MADE ONLINE');
  {
    fresh();
    DISK[X.STORAGE_KEY] = [{ id: 'local', term: 'Workday', covers: ['Workday'], at: '2026-02-02T00:00:00Z' }];
    const s = server([{ id: 'remote', term: 'Salesforce', covers: ['Salesforce'], at: '2026-01-01T00:00:00Z' }]);
    CONNECT(s);
    await X.load();
    t('  both survive the merge', X.isExcluded('Workday') && X.isExcluded('Salesforce'),
      JSON.stringify(X.all().map((e) => e.term)));
    t('  ...and the account is brought up to date rather than left behind',
      s.column.length === 2, JSON.stringify(s.column.map((e) => e.term)));
    t('  newest first', X.all()[0].term === 'Workday', JSON.stringify(X.all().map((e) => e.term)));
  }

  console.log('\nAND A BACKEND THAT IS DOWN DOES NOT LOSE THE LIST');
  {
    fresh();
    DISK[X.STORAGE_KEY] = [{ id: 'local', term: 'Workday', covers: ['Workday'], at: '2026-02-02T00:00:00Z' }];
    const s = server([]);
    s.fail = true;
    CONNECT(s);
    await X.load();
    t('  the local copy is still used', X.isExcluded('Workday'), JSON.stringify(X.all()));
    t('  ...and the state says it did not reach the account',
      X.syncState() === 'error', String(X.syncState()));
    let threw = false;
    try { await X.add('Salesforce'); } catch (e) { threw = true; }
    t('  ...and a new exclusion still takes effect locally',
      !threw && X.isExcluded('Salesforce'), threw ? 'threw' : 'not excluded');
  }

  console.log('\nSIGNED OUT, IT IS STILL USABLE');
  {
    fresh();
    X.disconnect();
    await X.load();
    await X.add('Salesforce');
    t('  the exclusion applies', X.isExcluded('Salesforce'), 'not excluded');
    t('  ...and it says where it is kept', X.syncState() === 'local', String(X.syncState()));
  }

  console.log('\nREMOVING ONE REMOVES IT EVERYWHERE');
  {
    fresh();
    const s = server([]);
    CONNECT(s);
    await X.load();
    await X.add('Salesforce');
    t('  removing by another of its names works',
      (await X.remove('SFDC')) === true || (await X.remove('Salesforce')) === true, 'not removed');
    t('  ...it is no longer excluded', !X.isExcluded('Salesforce'), 'still excluded');
    t('  ...the account row is emptied too', s.column.length === 0, JSON.stringify(s.column));
    t('  ...and so is the local mirror',
      (DISK[X.STORAGE_KEY] || []).length === 0, JSON.stringify(DISK));
    t('  removing something never excluded reports false',
      (await X.remove('Kubernetes')) === false, 'reported a removal');
  }

  console.log('\nAND NOTHING HERE CAN TAKE A TAILORING RUN DOWN');
  {
    fresh();
    for (const [name, value] of [['null', null], ['undefined', undefined],
      ['empty string', ''], ['whitespace', '   '], ['a number', 42], ['an object', {}]]) {
      let threw = false;
      try { await X.add(value); X.isExcluded(value); X.filter(value); X.countIn(value); }
      catch (e) { threw = true; }
      t('  ' + name.padEnd(13) + ' is ignored, not thrown', !threw, 'it threw');
    }
    t('  an unloaded store filters nothing rather than everything',
      (X._setCache(null), X.filter(['Python', 'AWS']).join(',') === 'Python,AWS'),
      'a requirement would vanish from a CV with no way to see it went');
    fresh();
    await X.load();
    t('  an empty list filters nothing', X.filter(['Python']).join(',') === 'Python', 'over-filtered');
    t('  a corrupt stored value is survived',
      (DISK[X.STORAGE_KEY] = 'not an array', X._setCache(null), true), 'setup');
    const after = await X.load({ force: true });
    t('  ...and read as empty', Array.isArray(after) && after.length === 0, JSON.stringify(after));
  }

  // ── AND THE EXTENSION ACTUALLY APPLIES IT ────────────────────────────
  //
  // Every one of the assertions above is about a module in isolation.
  // The last module this project shipped was registered in the manifest,
  // never added to popup.html, and so never ran in the only place it
  // mattered. Both loaders, every time.
  console.log('\nAND THE EXTENSION ACTUALLY LOADS AND APPLIES IT');
  {
    const html = fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8');
    const manifest = fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8');
    const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');

    t('  popup.html loads it', /<script src="keyword-exclusions\.js">/.test(html),
      'it would never run in the popup, which is where popup.js lives');
    t('  ...after the taxonomy it takes its identities from',
      html.indexOf('keyword-taxonomy.js') < html.indexOf('keyword-exclusions.js'), 'load order');
    t('  the manifest registers it', /keyword-exclusions\.js/.test(manifest), 'not registered');

    t('  the popup loads the list before anything renders a keyword',
      /await this\.loadKeywordExclusions\(\);/.test(src), 'the cache would be cold on first draw');
    t('  ...and reloads it on sign-in, which is how a fresh install recovers them',
      (src.match(/loadKeywordExclusions\(\)/g) || []).length >= 3, 'only loaded once, at startup');
    t('  ...connecting with the signed-in session',
      /store\.connect\(\{[\s\S]{0,200}accessToken: this\.session\.access_token/.test(src),
      'it would only ever be local');

    // ONE FUNNEL. The gauge, the chips, the injection and the coverage
    // score all read from canonicaliseTiers and sweepKnownRequirements;
    // filtering anywhere else is how this project has previously shown
    // one document and sent another.
    const tiers = (/  canonicaliseTiers\(keywordsObj\)[\s\S]*?\n  \}/m.exec(src) || [''])[0];
    t('  the chip and gauge funnel drops excluded terms',
      /dropExcluded\(/.test(tiers), 'excluded terms would still be drawn and counted');
    const sweep = (/  sweepKnownRequirements\(jobDescription, keywords\)[\s\S]*?\n  \}/m.exec(src) || [''])[0];
    t('  the requirement sweep drops them on the way in',
      /all: ATSTailor\.dropExcluded\(given\.all\)/.test(sweep),
      'they would be sent for injection and written into the CV');
    t('  ...and does not sweep them back out of the posting',
      /if \(!ATSTailor\.dropExcluded\(\[label\]\)\.length\) continue;/.test(sweep),
      'the posting would reinstate what the owner struck off');
    t('  and the filter never removes more than it should when unloaded',
      /if \(!store \|\| typeof store\.filter !== 'function'\) return items;/.test(src),
      'a missing module would be treated as "exclude nothing known", which is right, or worse');

    // The two ways in that were asked for.
    t('  a chip is a control, not a label',
      /role="button" tabindex="0"[\s\S]{0,120}Click to exclude/.test(src), 'clicking a chip does nothing');
    t('  ...and clicking one excludes the term it shows',
      /chip\.querySelector\('\.chip-text'\)\?\.textContent/.test(src), 'no term to exclude');
    t('  a term can be typed instead', /excludeAddBtn/.test(src) && /excludeInput/.test(html),
      'only terms this posting happens to raise could ever be excluded');
    t('  ...and Enter submits it', /if \(event\.key === 'Enter'\) \{ event\.preventDefault\(\); submit\(\); \}/.test(src),
      'a text box that ignores Enter reads as broken');
    t('  an exclusion can be undone', /restoreKeyword\(/.test(src) && /excludedChips/.test(html),
      'a mis-click would be permanent');
    t('  ...and the panel redraws at once rather than at the next run',
      /this\.updateMatchAnalysisUI\(\);[\s\S]{0,400}Excluded \$\{/.test(src),
      'the click would look like it did nothing');
    t('  the chip markup cannot be broken by a quote in a keyword',
      /escapeAttr\(/.test(src), 'a term with a quote in it would break out of the attribute');
  }

  console.log('\nAND THE COLUMN IT WRITES TO EXISTS');
  {
    const mig = fs.readdirSync(path.join(DIR, 'migrations'))
      .map((f) => fs.readFileSync(path.join(DIR, 'migrations', f), 'utf8')).join('\n');
    t('  a migration adds it to profiles',
      /ADD COLUMN IF NOT EXISTS excluded_keywords jsonb/.test(mig), 'the PATCH would 400 forever');
    t('  ...with a default, so a profile that predates it reads as empty',
      /excluded_keywords jsonb NOT NULL DEFAULT '\[\]'::jsonb/.test(mig), 'null would need handling everywhere');
    t('  ...and the module writes to that same column',
      X.PROFILE_COLUMN === 'excluded_keywords', X.PROFILE_COLUMN);
    const site = path.join(DIR, 'website', 'supabase', 'migrations');
    t('  and the website carries the migration too',
      fs.readdirSync(site).some((f) => /ADD COLUMN IF NOT EXISTS excluded_keywords/
        .test(fs.readFileSync(path.join(site, f), 'utf8'))),
      'the extension and the site would disagree about the schema');
  }

  console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
  process.exit(FAIL ? 1 : 0);
})();
