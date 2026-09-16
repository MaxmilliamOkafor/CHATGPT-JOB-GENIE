// THE RUN WENT QUIET AND OFFERED NOTHING TO DO.
//
// On a Workday or Taleo role the posting publishes no address, its
// mailto links and JSON-LD carry none, and the employer's careers page
// has none either. All correct: the follow-up is skipped rather than
// sent to a guess. But the panel then said nothing actionable, and two
// things that HAD been found were thrown away on the way through --
// the name of whoever posted the role, often with their public LinkedIn
// handle, and the employer's real domain.
//
// Both are routes to a human, so they are offered. As LINKS.
//
// WHAT THIS MUST NOT BECOME. No message is composed here, nothing is
// sent, and no address is invented to fill the To field: the whole
// point of skipping was that there is nobody to write to. And it must
// never appear when an address WAS found, or it reads as a failure on
// a run that succeeded.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));
const _log = console.log; console.log = () => {};
require(path.join(DIR, 'careers-address-finder.js'));
console.log = _log;

const el = {};
const mk = (id) => ({ id, value: '', textContent: '', innerHTML: '', dataset: {},
  _hidden: new Set(), setAttribute() {}, getAttribute: () => null, addEventListener() {},
  querySelectorAll: () => [],
  classList: { add(c) { el[id]._hidden.add(c); }, remove(c) { el[id]._hidden.delete(c); },
    contains: (c) => el[id]._hidden.has(c) } });
for (const id of ['followupManualRoutes', 'followupManualList', 'followupManualNote',
  'followupTo']) el[id] = mk(id);
el.followupManualRoutes.classList.add('hidden');

const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: global.KeywordTaxonomy },
  KeywordTaxonomy: global.KeywordTaxonomy,
  CareersAddressFinder: global.CareersAddressFinder,
  document: { addEventListener() {}, getElementById: (id) => el[id] || null,
    createElement: () => ({ _t: '', set textContent(v) { this._t = String(v); },
      get textContent() { return this._t; },
      get innerHTML() { return this._t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;'); } }) },
  console: { log() {}, warn() {}, error() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const popup = Object.create(sandbox.P.prototype);

const reset = () => {
  el.followupManualList.innerHTML = '';
  el.followupManualNote.textContent = '';
  el.followupManualRoutes._hidden = new Set(['hidden']);
  el.followupTo.value = '';
};
const shown = () => !el.followupManualRoutes.classList.contains('hidden');

(async () => {
  popup.currentJob = { company: 'Acme', url: 'https://acme.com/jobs/1' };
  popup.followupHarvestPageSources = async () => ({
    emails: [], names: [{ name: 'Jane Okonkwo', profile: 'jane-okonkwo', source: 'linkedin' }],
    org: 'Acme', jobId: 'R123' });

  console.log('WITH NOTHING PUBLISHED, THE ROUTES APPEAR');
  {
    reset();
    await popup.followupShowManualRoutes({ hasPublishedEmail: false, email: '' });
    t('  the block is shown', shown(), 'stayed hidden');
    const html = el.followupManualList.innerHTML;
    t('  the poster is named', /Jane Okonkwo/.test(html), html);
    t('  ...with a link to their public profile',
      /linkedin\.com\/in\/jane-okonkwo/.test(html), html);
    t('  the employer careers page is offered',
      /acme\.com\/careers/.test(html), html);
    t('  ...and the contact form', /acme\.com\/contact/.test(html), html);
    t('  and the posting itself, so applying is one click',
      /acme\.com\/jobs\/1/.test(html), html);
    t('  every route is a link, not a button',
      (html.match(/<a /g) || []).length >= 4 && !/<button/.test(html), html);
    t('  ...opened safely', /rel="noopener noreferrer"/.test(html), html);
    t('  and it says plainly that nothing is sent',
      /Nothing is sent from here/.test(el.followupManualNote.textContent),
      el.followupManualNote.textContent);
  }

  console.log('\nA NAME WITH NO HANDLE IS STILL A ROUTE');
  {
    reset();
    popup.followupHarvestPageSources = async () => ({
      emails: [], names: [{ name: 'Sam Reilly', source: 'json-ld' }], org: '', jobId: '' });
    await popup.followupShowManualRoutes({ hasPublishedEmail: false, email: '' });
    const html = el.followupManualList.innerHTML;
    t('  the name is offered as a search', /Sam Reilly/.test(html)
      && /linkedin\.com\/search/.test(html), html);
    t('  ...scoped to the employer', /Acme/.test(html), html);
  }

  console.log('\nBUT NOT WHEN AN ADDRESS WAS FOUND');
  {
    // The whole block reads as a failure. On a run that found somebody it
    // must not appear at all.
    reset();
    popup.followupHarvestPageSources = async () => ({
      emails: [], names: [{ name: 'Jane Okonkwo', profile: 'jane-okonkwo' }], org: '', jobId: '' });
    await popup.followupShowManualRoutes({ hasPublishedEmail: true, email: 'careers@acme.com' });
    t('  hidden when the posting published one', !shown(), 'shown on a successful run');

    reset();
    el.followupTo.value = 'talent@acme.com';
    await popup.followupShowManualRoutes({ hasPublishedEmail: false, email: '' });
    t('  ...and hidden when a later step filled the To field', !shown(),
      'shown while an address is in the box');
  }

  console.log('\nAND IT NEVER PUTS AN ADDRESS IN THE BOX');
  {
    reset();
    await popup.followupShowManualRoutes({ hasPublishedEmail: false, email: '' });
    t('  the To field is left empty', el.followupTo.value === '', el.followupTo.value);
    const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
    const body = src.slice(src.indexOf('async followupShowManualRoutes'),
      src.indexOf('// ---- contact lookup settings'));
    t('  ...and the code cannot write to it',
      !/followupTo['"]\)\s*\.value\s*=/.test(body) && !/to\.value\s*=/.test(body),
      'the routes block assigns a recipient');
    t('  ...nor send anything',
      !/sendFollowup|gmailSend|composeFollowup/.test(body), 'it can send');
  }

  console.log('\nAND IT NEVER GUESSES A DOMAIN');
  {
    // The finder stopped building domains out of company names for a
    // reason: "Acme Ltd" -> acme.com may be somebody else entirely. This
    // block reuses the finder's answer rather than inventing a second one.
    reset();
    popup.currentJob = { company: 'Acme', url: 'https://job-boards.greenhouse.io/acme/jobs/1' };
    popup.followupHarvestPageSources = async () => ({ emails: [], names: [], org: '', jobId: '' });
    await popup.followupShowManualRoutes({ hasPublishedEmail: false, email: '' });
    const html = el.followupManualList.innerHTML;
    t('  an ATS url yields no employer domain', !/acme\.com\/careers/.test(html), html);
    t('  ...but the posting is still offered', /greenhouse\.io\/acme\/jobs\/1/.test(html), html);
    popup.currentJob = { company: 'Acme', url: 'https://acme.com/jobs/1' };
  }

  console.log('\nAND NOTHING AT ALL MEANS NOTHING SHOWN');
  {
    reset();
    popup.currentJob = {};
    popup.followupHarvestPageSources = async () => ({ emails: [], names: [], org: '', jobId: '' });
    await popup.followupShowManualRoutes({ hasPublishedEmail: false, email: '' });
    t('  the block stays hidden with no routes to offer', !shown(), 'an empty box was shown');
  }

  console.log('\nAND A FAILURE HERE CANNOT TAKE THE RUN WITH IT');
  {
    reset();
    popup.currentJob = { company: 'Acme', url: 'https://acme.com/jobs/1' };
    popup.followupHarvestPageSources = async () => { throw new Error('tab closed'); };
    let threw = false;
    try { await popup.followupShowManualRoutes({ hasPublishedEmail: false, email: '' }); }
    catch (e) { threw = true; }
    t('  a harvest failure is swallowed', !threw, 'it propagated');
    t('  ...and the block is hidden rather than half-drawn', !shown(), 'left showing');
  }

  console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
  process.exit(FAIL ? 1 : 0);
})();
