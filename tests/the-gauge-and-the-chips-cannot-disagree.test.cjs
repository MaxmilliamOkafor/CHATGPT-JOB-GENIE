// NINETEEN CHIPS ABOVE A BADGE READING "10 OF 10".
//
// The panel drew eleven green chips and eight red ones, and the gauge
// over them said 100%, ten of ten. Three separate faults, each of which
// could put a different number on the same screen:
//
//   1. TWO LISTS. The gauge measured requirementsOnly(keywords.all);
//      the chips rendered the raw tiers through their own dedupe. The
//      benefits lines and screening criteria the gauge had discarded
//      were still drawn as chips.
//
//   2. TWO DENOMINATORS. The gauge divided by "requirements the profile
//      can support" rather than by all of them, so a run could read
//      100% with red chips underneath it.
//
//   3. A RESCUE THAT RAN TOO LATE. cleanKeywordList dropped any single
//      word under three characters, then a second pass let "ai", "ml",
//      "qa" back in -- but the second pass only saw what the first had
//      kept. AI was deleted and never restored, so the badge counted
//      one fewer than the chips showed.
//
// And the percentage MOVED ON REFRESH, because the denominator depended
// on _unevidencedKeywords, which lives in memory and is gone when the
// popup is reopened. The same document scored differently the second
// time it was looked at.
//
// WHAT THIS FILE HOLDS. One requirement list, measured once and drawn
// once. The badge total is the number of chips. The badge count is the
// number of green chips. The tier counts sum to the badge. 100% happens
// when, and only when, no chip is red. And rendering the same documents
// twice produces the same numbers.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));

const el = {};
const mk = (id) => { const n = { id, textContent: '', innerHTML: '',
  setAttribute(k, v) { n[k] = v; },
  getAttribute: (k) => (k in n ? n[k] : null), addEventListener() {},
  querySelectorAll: () => [],
  classList: { add() {}, remove() {}, contains: () => false } }; return n; };
for (const id of ['matchGaugeCircle', 'matchPercentage', 'matchSubtitle', 'keywordCountBadge',
  'matchPanelProvider', 'highPriorityChips', 'highPriorityCount', 'mediumPriorityChips',
  'mediumPriorityCount', 'lowPriorityChips', 'lowPriorityCount', 'documentsCard',
  'aiMatchAnalysis', 'keywordsContainer']) el[id] = mk(id);

const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: global.KeywordTaxonomy },
  KeywordTaxonomy: global.KeywordTaxonomy, DynamicScore: global.DynamicScore,
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
popup.aiProvider = 'openai';
popup.prepareDocumentText = () => {};

const chipHtml = () => el.highPriorityChips.innerHTML + el.mediumPriorityChips.innerHTML
  + el.lowPriorityChips.innerHTML;
const green = () => (chipHtml().match(/keyword-chip matched/g) || []).length;
const red = () => (chipHtml().match(/keyword-chip missing/g) || []).length;
const badge = () => /^(\d+) of (\d+) keywords matched$/.exec(el.keywordCountBadge.textContent);
const tierSum = () => ['highPriorityCount', 'mediumPriorityCount', 'lowPriorityCount']
  .reduce((acc, id) => {
    const m = /^(\d+)\/(\d+)$/.exec(el[id].textContent || '0/0');
    return m ? { hit: acc.hit + +m[1], all: acc.all + +m[2] } : acc;
  }, { hit: 0, all: 0 });

const render = (cv, tiers) => {
  popup.generatedDocuments = { cv, keywords: Object.assign({}, tiers, {
    all: [].concat(tiers.highPriority || [], tiers.mediumPriority || [], tiers.lowPriority || []) }) };
  popup._renderMatchAnalysis();
};

// The reported posting, verbatim from the panel that showed 10 of 10.
const TIERS = {
  highPriority: ['AI', 'Automation', 'Product Management', 'engineering', 'short-term rental',
    'property management', 'Team Restructuring', 'shipping AI products', 'Ownership',
    'Decision Making', 'Communication', 'Leadership', 'SaaS', 'Guesty', 'Collaboration'],
  mediumPriority: ['Hostaway', 'Breezeway'],
  lowPriority: ['Internal Tools', 'Customer Success'],
};
const CV = ['NAME', '', 'TECHNICAL SKILLS', 'Programming: Python, SQL',
  'Cloud & DevOps: AWS, Automation',
  'Domain: AI, Product Management, engineering, Ownership, Decision Making, '
    + 'Communication, Leadership, SaaS, Collaboration, Internal Tools'].join('\n');

console.log('THE BADGE COUNTS THE CHIPS ON THE SCREEN');
{
  render(CV, TIERS);
  const b = badge();
  t('  the badge parses', !!b, el.keywordCountBadge.textContent);
  t('  its total is the number of chips drawn', b && +b[2] === green() + red(),
    b && (b[2] + ' vs ' + (green() + red()) + ' chips'));
  t('  its count is the number of GREEN chips', b && +b[1] === green(),
    b && (b[1] + ' vs ' + green() + ' green'));
  const sum = tierSum();
  t('  and the tier counts add up to it', sum.hit === +b[1] && sum.all === +b[2],
    JSON.stringify(sum) + ' vs ' + el.keywordCountBadge.textContent);
  t('  the reported posting is nineteen requirements, not ten',
    +b[2] === 19, el.keywordCountBadge.textContent);
  t('  ...eleven of them on the CV', +b[1] === 11, el.keywordCountBadge.textContent);
  t('  ...so it reads 58%, not 100%', el.matchPercentage.textContent === '58%',
    el.matchPercentage.textContent);
}

console.log('\nAI IS NOT DROPPED FOR BEING TWO LETTERS');
{
  // cleanKeywordList deleted any single word under three characters and
  // then tried to let AI back in, one pass too late. The chips never
  // used that helper, so the badge came up one short of the chips.
  const kept = popup.cleanKeywordList(['AI', 'ML', 'QA', 'UX', 'Go', 'Python', 'of', 'the']);
  // Survives as itself, or under the canonical name of its requirement:
  // ML is a surface form of Machine Learning and prints as that, as UX
  // is of User Experience. The posting's own short form is paired back on
  // later by alignToPostingWording, so a literal screen still finds it.
  for (const [want, canonical] of [['AI', 'AI'], ['ML', 'Machine Learning'],
    ['QA', 'QA'], ['UX', 'User Experience'], ['Go', 'Go']]) {
    t('  ' + want.padEnd(7) + ' survives', kept.some((k) =>
      String(k).toLowerCase() === want.toLowerCase()
      || String(k).toLowerCase() === canonical.toLowerCase()), JSON.stringify(kept));
  }
  t('  ...and grammar still does not', !kept.some((k) => /^(of|the)$/i.test(k)),
    JSON.stringify(kept));
}

console.log('\n100% MEANS NO RED CHIP, AND NOTHING ELSE');
{
  // Everything the posting asked for is on this CV.
  const full = ['Python', 'AWS', 'Kubernetes', 'Docker'];
  render('TECHNICAL SKILLS\nProgramming: Python\nCloud: AWS, Kubernetes, Docker',
    { highPriority: full, mediumPriority: [], lowPriority: [] });
  t('  it reads 100%', el.matchPercentage.textContent === '100%', el.matchPercentage.textContent);
  t('  ...with no red chip', red() === 0, red() + ' red');
  t('  ...and the subtitle says exactly that',
    /Every requirement the posting listed is on the CV/.test(el.matchSubtitle.textContent),
    el.matchSubtitle.textContent);

  // And one missing term is enough to stop it being 100%.
  render('TECHNICAL SKILLS\nProgramming: Python\nCloud: AWS, Kubernetes',
    { highPriority: full, mediumPriority: [], lowPriority: [] });
  t('  one red chip means it is not 100%', el.matchPercentage.textContent !== '100%',
    el.matchPercentage.textContent);
  t('  ...and there IS a red chip to justify that', red() === 1, red() + ' red');
}

console.log('\nTHE SAME DOCUMENTS GIVE THE SAME NUMBER, EVERY TIME');
{
  // The percentage moved on refresh because the denominator depended on
  // _unevidencedKeywords, which does not survive the popup closing.
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    if (i === 2) popup._unevidencedKeywords = ['short-term rental', 'Guesty', 'Hostaway'];
    if (i === 3) popup._unevidencedKeywords = undefined;
    if (i === 4) popup._unevidencedKeywords = ['nonsense from a previous job'];
    render(CV, TIERS);
    seen.add(el.matchPercentage.textContent + '|' + el.keywordCountBadge.textContent);
  }
  t('  five renders, one answer', seen.size === 1, [...seen].join('  ///  '));
  t('  ...and in-memory state cannot change it',
    [...seen][0] === '58%|11 of 19 keywords matched', [...seen][0]);
}

console.log('\nFURNITURE IS NOT DRAWN AS A CHIP EITHER');
{
  // The gauge dropped these and the chips did not, which is how the two
  // halves came to be counting different things in the first place.
  render('TECHNICAL SKILLS\nProgramming: Python', {
    highPriority: ['Python', 'competitive salary', '401k', '7+ years',
      'experience at a competitor', 'dental'],
    mediumPriority: [], lowPriority: [] });
  const b = badge();
  t('  six strings are one requirement', b && +b[2] === 1, el.keywordCountBadge.textContent);
  t('  ...and one chip is drawn', green() + red() === 1, (green() + red()) + ' chips');
  t('  ...so it reads 100%', el.matchPercentage.textContent === '100%',
    el.matchPercentage.textContent);
  t('  no benefits line appears as a chip', !/401k|dental|salary/i.test(chipHtml()), chipHtml());
}

console.log('\nAND MID-RUN IT SHOWS NOTHING AT ALL');
{
  // Coverage is measured four times during a tailoring run: on the raw
  // response, after the evidence pass, after the spelling pass, and on
  // the delivered document. Each render put a number on screen that was
  // true of a document that was not finished, so it appeared early,
  // changed twice and settled somewhere else.
  popup._coverageFinal = false;
  render(CV, TIERS);
  t('  no percentage while the run is in flight',
    el.matchPercentage.textContent === '\u2026', el.matchPercentage.textContent);
  t('  ...and no colour on the dial',
    el.matchGaugeCircle.stroke === '#3f3f5a', String(el.matchGaugeCircle.stroke));
  t('  ...with the dial empty rather than part-filled',
    Math.abs(Number(el.matchGaugeCircle['stroke-dashoffset']) - 2 * Math.PI * 45) < 0.01,
    String(el.matchGaugeCircle['stroke-dashoffset']));
  t('  ...and the badge says why', /Measuring/.test(el.keywordCountBadge.textContent),
    el.keywordCountBadge.textContent);
  t('  ...as does the subtitle',
    /once the document is final/.test(el.matchSubtitle.textContent),
    el.matchSubtitle.textContent);

  // And the moment the run finishes, the real answer.
  popup._coverageFinal = true;
  render(CV, TIERS);
  t('  the number appears when the document is final',
    el.matchPercentage.textContent === '58%', el.matchPercentage.textContent);
  t('  ...with its colour back', el.matchGaugeCircle.stroke !== '#3f3f5a',
    String(el.matchGaugeCircle.stroke));

  // A popup reopened after a completed run has no in-memory flag. It
  // must show the result it stored, not a blank dial.
  delete popup._coverageFinal;
  render(CV, TIERS);
  t('  a restored run shows its result rather than a blank dial',
    el.matchPercentage.textContent === '58%', el.matchPercentage.textContent);
}

console.log('\nAND THE FLOW ACTUALLY SETS THE FLAG');
{
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  cleared when a tailoring run starts',
    /async tailorDocuments\([\s\S]{0,1400}this\._coverageFinal = false;/.test(src),
    'the gauge would never go pending');
  t('  ...and set when it reaches the end',
    /Documents prepared[\s\S]{0,400}this\._coverageFinal = true;/.test(src),
    'the gauge would never come back');
  t('  ...followed by one more render, so the answer is drawn',
    /this\._coverageFinal = true;\s*\n\s*this\.updateMatchAnalysisUI\(\);/.test(src),
    'the flag flips but nothing redraws');
}

console.log('\nAND AN EMPTY RUN SAYS NOTHING RATHER THAN ZERO');
{
  render('', { highPriority: [], mediumPriority: [], lowPriority: [] });
  t('  the gauge shows a dash', el.matchPercentage.textContent === '—',
    el.matchPercentage.textContent);
  t('  ...and the subtitle explains it',
    /No keywords available to measure/.test(el.matchSubtitle.textContent),
    el.matchSubtitle.textContent);
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
