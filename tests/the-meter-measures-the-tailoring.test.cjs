// 47% ON A CV THAT COULD NOT HAVE DONE BETTER.
//
// A short-term-rental company asked for short-term-rental experience
// and property management. The candidate has neither, and never will
// have on that application. The coverage pass put every term his
// profile could support onto the page, and the meter still read 47%.
//
// That number answered a question nobody asked. The panel exists to say
// whether the DOCUMENT was tailored properly; dividing by every
// requirement the posting listed makes it rate how well a career
// matches a job instead, and no amount of tailoring can move it.
//
// So the gauge reads COMPLETENESS: of the requirements this background
// can support, how many reached the page. It hits 100% exactly when the
// tool has done everything available to it, which is the thing worth
// knowing and the only thing worth acting on.
//
// WHAT THIS MUST NOT BECOME. A flattering number is worse than a low
// one, because it is acted on. Requirements outside the background are
// still counted, still named on the badge and in the subtitle, and
// still listed in the gap panel. Nothing is dropped to reach 100%, and
// a posting with nothing in common with the profile must not read as
// fully tailored.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));

const el = {};
const mk = (id) => ({ id, textContent: '', innerHTML: '', children: [],
  setAttribute() {}, getAttribute: () => null, addEventListener() {},
  querySelectorAll: () => [], classList: { add() {}, remove() {}, contains: () => false } });
for (const id of ['matchGaugeCircle', 'matchPercentage', 'matchSubtitle', 'keywordCountBadge',
  'matchPanelProvider', 'profileGapSection', 'profileGapChips', 'profileGapCount',
  'claimGapBtn', 'profileGapStatus']) el[id] = mk(id);

const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: global.KeywordTaxonomy },
  KeywordTaxonomy: global.KeywordTaxonomy,
  document: { addEventListener() {}, getElementById: (id) => el[id] || null,
    createElement: () => ({ textContent: '', get innerHTML() { return this.textContent; } }) },
  console: { log() {}, warn() {}, error() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const popup = Object.create(sandbox.P.prototype);
popup.aiProvider = 'openai';

/** total requirements, how many matched, which are outside the background */
const render = (total, matched, outside) => {
  popup._unevidencedKeywords = outside;
  popup.generatedDocuments = { missingKeywords: outside };
  popup.updateMatchGauge(0, matched, total);
  return {
    pct: el.matchPercentage.textContent,
    badge: el.keywordCountBadge.textContent,
    subtitle: el.matchSubtitle.textContent,
  };
};

console.log('EVERYTHING THE BACKGROUND SUPPORTS IS ON THE PAGE');
{
  // 19 requirements, 11 matched, 8 the candidate does not have.
  const r = render(19, 11, ['short-term rental', 'property management', 'customer success',
    'scrappy', 'Product Management', 'performance framework', 'SaaS', 'decision making']);
  t('  the gauge reads 100%', r.pct === '100%', r.pct);
  t('  ...and the badge says what that is over',
    /11 of 11 you can evidence/.test(r.badge), r.badge);
  t('  ...and names the eight it is not', /8 outside your background/.test(r.badge), r.badge);
  t('  the subtitle says the tailoring is complete',
    /Fully tailored/.test(r.subtitle), r.subtitle);
  t('  ...and still names what is missing, in the open',
    /short-term rental/.test(r.subtitle) && /not in your background/.test(r.subtitle),
    r.subtitle);
}

console.log('\nBUT A HALF-DONE JOB STILL READS AS ONE');
{
  // 19 requirements, 4 outside, 15 supportable, only 9 on the page.
  const r = render(19, 9, ['short-term rental', 'property management', 'customer success', 'scrappy']);
  t('  the gauge is not 100%', r.pct !== '100%', r.pct);
  t('  ...it is 60%, nine of the fifteen it could have had', r.pct === '60%', r.pct);
  t('  the subtitle counts what is still owed',
    /6 supported requirement\(s\) not yet on the CV/.test(r.subtitle), r.subtitle);
  t('  ...and mentions the rest separately',
    /further 4 are not in your background/.test(r.subtitle), r.subtitle);
}

console.log('\nAND WITH NOTHING OUTSIDE IT IS THE PLAIN READING');
{
  const r = render(12, 12, []);
  t('  full coverage reads 100%', r.pct === '100%', r.pct);
  t('  ...with the ordinary badge', /12 of 12 keywords matched/.test(r.badge), r.badge);
  t('  ...and says every requirement is on the CV',
    /every requirement the posting listed/.test(r.subtitle), r.subtitle);
  const s = render(12, 7, []);
  t('  and a short one is not flattered', s.pct === '58%', s.pct);
}

console.log('\nA POSTING WITH NOTHING IN COMMON IS NOT "FULLY TAILORED"');
{
  // The dangerous case: every requirement is outside the background, so
  // "everything supportable is on the page" is vacuously true.
  const outside = ['short-term rental', 'property management', 'hospitality',
    'revenue management', 'channel manager'];
  const r = render(5, 0, outside);
  t('  it does not claim 100%', r.pct !== '100%', r.pct);
  t('  ...and says so plainly',
    /None of the 5 requirements in this posting are in your profile/.test(r.subtitle),
    r.subtitle);
  t('  ...without calling it fully tailored', !/Fully tailored/.test(r.subtitle), r.subtitle);
}

console.log('\nAND A TERM THE GENERATOR PLACED IS NOT COUNTED AS OUTSIDE');
{
  // _unevidencedKeywords is recorded during injection. If the PDF
  // pipeline later places one, it is on the CV and must not still be
  // treated as missing background -- that would shrink the denominator
  // for a term that was actually satisfied.
  popup._unevidencedKeywords = ['Linux', 'Ansible'];
  popup.generatedDocuments = { missingKeywords: ['Ansible'] };
  popup.updateMatchGauge(0, 9, 10);
  t('  only what is still absent counts as outside',
    /1 outside your background/.test(el.keywordCountBadge.textContent),
    el.keywordCountBadge.textContent);
  t('  ...so the denominator is nine, not eight',
    /9 of 9 you can evidence/.test(el.keywordCountBadge.textContent),
    el.keywordCountBadge.textContent);
}

console.log('\nAND NOTHING IS DROPPED TO REACH THE NUMBER');
{
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  the outside terms still reach the gap panel',
    /renderProfileGap/.test(src) && /_unevidencedKeywords/.test(src),
    'the list stopped being shown');
  t('  ...and the real total is still computed',
    /const count = Math\.max\(0, Math\.floor\(Number\(total\)/.test(src),
    'the posting total was discarded');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
