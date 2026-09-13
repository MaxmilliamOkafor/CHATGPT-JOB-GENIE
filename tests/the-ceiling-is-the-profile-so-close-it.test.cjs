// EIGHT POSTINGS IN HIS OWN FIELD, AND NOT ONE REACHED 96%.
//
// Not a matching fault. The coverage pass put every term the saved
// profile could support onto the CV and still stopped, because the
// words were not in the profile at all:
//
//   Linux, code review, Agile, dbt, Ansible, shell scripting,
//   networking, PostgreSQL, Redis, Scala, hiring, experimentation
//
// Writing those anyway is inventing experience, so the tailoring is
// right to refuse. The ceiling is the profile.
//
// The profile is a ONE-TIME cost: each missing skill is either
// something he has done or something he has not, answered once and
// true forever. So the console warning nobody reads became a section
// he can act on -- tick what you have, it is saved, every posting from
// then on counts it. Measured across the same eight postings, a
// profile that records them reaches 100% on all of them.
//
// WHAT THIS FILE HOLDS. Claiming is a statement by the candidate, never
// an inference by the tool: nothing is ticked by default, nothing is
// saved without a click, and a term the profile already covers under
// another name is not written twice.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));
const TX = global.KeywordTaxonomy;

// A DOM just real enough for the section to be built and clicked.
const nodes = new Map();
const mkNode = (id) => {
  const n = {
    id, _html: '', textContent: '', disabled: false, onclick: null,
    _classes: new Set(), children: [], _listeners: {},
    classList: {
      add: (c) => n._classes.add(c), remove: (c) => n._classes.delete(c),
      contains: (c) => n._classes.has(c),
    },
    get innerHTML() { return n._html; },
    set innerHTML(v) {
      n._html = v;
      n.children = [];
      const re = /data-gap-term="([^"]*)"/g;
      let m;
      while ((m = re.exec(v))) {
        const term = m[1];
        const child = { term, _listeners: {},
          getAttribute: (a) => (a === 'data-gap-term' ? term : null),
          addEventListener: (ev, fn) => { child._listeners[ev] = fn; },
          click: () => child._listeners.click && child._listeners.click() };
        n.children.push(child);
      }
    },
    querySelectorAll: () => n.children,
    addEventListener: (ev, fn) => { n._listeners[ev] = fn; },
    setAttribute() {}, getAttribute: () => null,
  };
  return n;
};
for (const id of ['profileGapSection', 'profileGapChips', 'profileGapCount', 'claimGapBtn',
  'profileGapStatus', 'matchGaugeCircle', 'matchPercentage', 'matchSubtitle',
  'keywordCountBadge', 'matchPanelProvider']) nodes.set(id, mkNode(id));

let patched = null;
const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: TX },
  KeywordTaxonomy: TX,
  document: {
    addEventListener() {},
    getElementById: (id) => nodes.get(id) || null,
    createElement: () => ({
      _t: '',
      set textContent(v) { this._t = String(v); },
      get textContent() { return this._t; },
      get innerHTML() {
        return this._t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      },
    }),
  },
  console: { log() {}, warn() {}, error() {} },
  fetch: async (url, opts) => {
    patched = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200 };
  },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const popup = Object.create(sandbox.P.prototype);
popup.session = { access_token: 'token', user: { id: 'user-1' } };
popup.aiProvider = 'openai';

console.log('THE GAP IS SHOWN, NOT BURIED IN A CONSOLE WARNING');
{
  popup._cachedProfile = { skills: ['Python', 'AWS', 'Kubernetes'] };
  popup._unevidencedKeywords = ['Linux', 'dbt', 'Ansible'];
  popup.generatedDocuments = { missingKeywords: ['Linux', 'dbt', 'Ansible'] };
  popup.renderProfileGap();
  const section = nodes.get('profileGapSection');
  t('  the section appears when something is short',
    !section.classList.contains('hidden'), 'stayed hidden');
  t('  ...with one chip per missing term',
    nodes.get('profileGapChips').children.length === 3,
    nodes.get('profileGapChips').children.length + ' chips');
  t('  ...and a count', nodes.get('profileGapCount').textContent === '3',
    nodes.get('profileGapCount').textContent);
}

console.log('\nNOTHING IS CLAIMED THAT THE CANDIDATE DID NOT CLAIM');
{
  t('  no term starts ticked',
    !/class="keyword-chip gap claimed"/.test(nodes.get('profileGapChips').innerHTML),
    'something was pre-selected');
  t('  ...and the button is dead until one is',
    nodes.get('claimGapBtn').disabled === true, 'the button was live with nothing chosen');
}

console.log('\nCLICKING A CHIP CLAIMS IT, AND CLICKING AGAIN TAKES IT BACK');
{
  const chip = nodes.get('profileGapChips').children.find((c) => c.term === 'Linux');
  chip.click();
  t('  Linux is claimed', popup._claimedGapTerms.has('Linux'), 'not registered');
  t('  ...the button says how many', /Add 1 to my profile/.test(nodes.get('claimGapBtn').textContent),
    nodes.get('claimGapBtn').textContent);
  t('  ...and it reads as claimed, not as a miss',
    /gap claimed/.test(nodes.get('profileGapChips').innerHTML), 'no claimed state');
  nodes.get('profileGapChips').children.find((c) => c.term === 'Linux').click();
  t('  clicking again unclaims it', !popup._claimedGapTerms.has('Linux'), 'stuck on');
  t('  ...and the button goes dead again', nodes.get('claimGapBtn').disabled === true,
    'button stayed live');
}

console.log('\nCLAIMING WRITES TO THE PROFILE, ADDITIVELY');
{
  nodes.get('profileGapChips').children.find((c) => c.term === 'Linux').click();
  nodes.get('profileGapChips').children.find((c) => c.term === 'dbt').click();
  return_ = popup.claimProfileGap();
  return_.then(() => {
    t('  the profile row is patched', !!patched && /profiles\?user_id=eq\.user-1/.test(patched.url),
      JSON.stringify(patched && patched.url));
    t('  ...with the existing skills kept',
      ['Python', 'AWS', 'Kubernetes'].every((s) => patched.body.skills.indexOf(s) !== -1),
      JSON.stringify(patched.body.skills));
    t('  ...and the two claimed added',
      patched.body.skills.indexOf('Linux') !== -1 && patched.body.skills.indexOf('dbt') !== -1,
      JSON.stringify(patched.body.skills));
    t('  ...and nothing that was not claimed',
      patched.body.skills.indexOf('Ansible') === -1, JSON.stringify(patched.body.skills));
    t('  the cached profile moves with it',
      popup._cachedProfile.skills.indexOf('Linux') !== -1, 'still stale');
    t('  ...and what was saved leaves the gap list',
      (popup._unevidencedKeywords || []).join(',') === 'Ansible',
      JSON.stringify(popup._unevidencedKeywords));

    console.log('\nAND A SKILL ALREADY HELD UNDER ANOTHER NAME IS NOT WRITTEN TWICE');
    {
      patched = null;
      popup._cachedProfile = { skills: ['PostgreSQL', 'Node.js'] };
      popup._unevidencedKeywords = ['Postgres', 'NodeJS'];
      popup.generatedDocuments = { missingKeywords: ['Postgres', 'NodeJS'] };
      popup.renderProfileGap();
      nodes.get('profileGapChips').children.forEach((c) => c.click());
      popup.claimProfileGap().then(() => {
        t('  nothing was written', patched === null,
          JSON.stringify(patched && patched.body));
        t('  ...and it says so',
          /already on your profile/i.test(nodes.get('profileGapStatus').textContent),
          nodes.get('profileGapStatus').textContent);

        console.log('\nAND THE SECTION DISAPPEARS WHEN THERE IS NO GAP');
        {
          popup._unevidencedKeywords = [];
          popup.renderProfileGap();
          t('  hidden with nothing to ask for',
            nodes.get('profileGapSection').classList.contains('hidden'), 'still showing');
        }

        console.log('\nAND A TERM THE GENERATOR PLACED IS NOT ASKED FOR AGAIN');
        {
          popup._unevidencedKeywords = ['Linux', 'Ansible'];
          popup.generatedDocuments = { missingKeywords: ['Ansible'] };
          popup.renderProfileGap();
          const terms = nodes.get('profileGapChips').children.map((c) => c.term);
          t('  only what is still absent is listed', terms.join(',') === 'Ansible',
            JSON.stringify(terms));
        }

        console.log('\nSIGNED OUT, IT ASKS RATHER THAN FAILS');
        {
          patched = null;
          const saved = popup.session;
          popup.session = null;
          popup._cachedProfile = { skills: [] };
          popup._unevidencedKeywords = ['Linux'];
          popup.generatedDocuments = { missingKeywords: ['Linux'] };
          popup.renderProfileGap();
          nodes.get('profileGapChips').children[0].click();
          popup.claimProfileGap().then(() => {
            t('  nothing is sent', patched === null, 'a signed-out write was attempted');
            t('  ...and it says to sign in',
              /sign in/i.test(nodes.get('profileGapStatus').textContent),
              nodes.get('profileGapStatus').textContent);
            popup.session = saved;

            console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
            process.exit(FAIL ? 1 : 0);
          });
        }
      });
    }
  });
}
