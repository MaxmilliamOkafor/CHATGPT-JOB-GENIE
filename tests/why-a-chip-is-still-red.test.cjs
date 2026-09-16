// WHY A CHIP IS STILL RED AFTER A FULL TAILORING RUN.
//
// There is one honest reason and there were three bugs. The honest
// reason is that the profile does not evidence the requirement: a CV
// cannot claim Salesforce for someone who has never opened it, and that
// chip is red because it is true. Every other red chip was this tool's
// fault.
//
//   1. The gate read the structured profile fields and not the
//      candidate's own uploaded CV, so work they plainly did was
//      invisible and the keyword was withheld.
//   2. Prose lifted out of the responsibilities list arrived as chips
//      that no CV could ever match, and sat in the denominator red
//      forever.
//   3. The same requirement appeared twice, decorated and bare, so the
//      panel showed it once green and once red.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));
const TX = global.KeywordTaxonomy;
const sandbox = {
  window: { addEventListener() {}, KeywordTaxonomy: TX, DynamicScore: global.DynamicScore },
  KeywordTaxonomy: TX, DynamicScore: global.DynamicScore,
  document: { addEventListener() {}, getElementById: () => null },
  console: { log() {}, warn() {}, error() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const P = sandbox.P;

console.log('PROSE FROM THE RESPONSIBILITIES LIST IS NOT A REQUIREMENT');
{
  // Every one of these was a red chip on a real posting. None of them
  // names anything a candidate could put on a CV, so none could ever go
  // green however well the run went.
  for (const prose of ['sales performance', 'custom reports', 'independence',
    'data-driven recommendations', 'complex data sets', 'future results',
    'potential opportunities', 'diverse audiences']) {
    t('  dropped: ' + prose, P.requirementsOnly([prose]).length === 0,
      'still a permanent red chip');
  }
}

console.log('\nAND A REAL SKILL MADE OF ORDINARY WORDS IS STILL A REQUIREMENT');
{
  // Both halves of the rule are required: every word ordinary AND no
  // requirement named anywhere in the phrase. These are built from plain
  // English and survive on the table's say-so.
  for (const real of ['Machine Learning', 'Data Engineering', 'Infrastructure as Code',
    'Google Cloud Platform', 'Attention to Detail', 'Site Reliability Engineering',
    'Continuous Improvement', 'Data Quality', 'Problem Solving', 'Time Management',
    'Decision Making', 'Strategic Planning', 'Customer Success']) {
    t('  kept: ' + real, P.requirementsOnly([real]).length === 1, 'a real skill was dropped');
  }
}

console.log('\nTHE SAME REQUIREMENT DECORATED IS NOT A SECOND REQUIREMENT');
{
  // Only the bare form carries a taxonomy group, so dedupe kept both and
  // the panel showed one requirement twice, routinely once green and
  // once red. That is the chips disagreeing with themselves.
  for (const [phrase, want] of [
    ['forecasting models', 'Forecasting'],
    ['ad-hoc data analysis', 'Data Analysis'],
    ['5 years of Python', 'Python'],
  ]) {
    t('  ' + phrase.padEnd(22) + ' collapses to ' + want,
      P.collapseDecoratedPhrases([phrase])[0] === want,
      JSON.stringify(P.collapseDecoratedPhrases([phrase])));
  }

  // It can only merge, never discard: a phrase naming two requirements
  // would lose one, and a phrase naming none has nothing to merge into.
  // A job TITLE is not a requirement to merge into either: "senior data
  // engineer" names no entry in the table, so it is left exactly as it is.
  for (const keep of ['Python and SQL experience', 'AWS and Kubernetes',
    'some unknown tooling', 'senior data engineer']) {
    t('  left alone: ' + keep, P.collapseDecoratedPhrases([keep])[0] === keep,
      JSON.stringify(P.collapseDecoratedPhrases([keep])));
  }
  t('  and a bare requirement is untouched',
    P.collapseDecoratedPhrases(['Machine Learning'])[0] === 'Machine Learning', 'collapsed itself');
}

console.log('\nONE POSTING, END TO END');
{
  // The chips as they appeared on a real Revenue Operations posting.
  const chips = ['Salesforce', 'Data Analysis', 'Python', 'R', 'Qlik', 'Tableau',
    'Excel', 'Problem Solving', 'Communication', 'sales performance',
    'Operational Efficiency', 'Automation', 'Revenue Operations', 'AI',
    'Data Quality', 'Decision Making', 'KPI', 'Data Science', 'Forecasting',
    'Strategic Planning', 'data-driven recommendations', 'forecasting models',
    'custom reports', 'ad-hoc data analysis', 'Presentation',
    'Attention to Detail', 'Accuracy', 'Collaboration', 'independence'];
  // Through the same three steps the panel uses: collapse, then drop
  // prose, then dedupe by requirement. Collapsing "forecasting models"
  // to "Forecasting" deliberately creates a duplicate of the Forecasting
  // chip; dedupe is what turns two chips into one.
  const filtered = P.requirementsOnly(P.collapseDecoratedPhrases(chips));
  const out = TX.dedupe(filtered).map((e) => e.label);
  const distinct = new Set(out.map((k) => TX.keyOf(k)));
  t('  four prose chips are gone', !out.some((k) =>
    /sales performance|custom reports|independence|data-driven/i.test(k)), out.join(', '));
  t('  two duplicates merged into the requirement they decorate',
    !out.some((k) => /forecasting models|ad-hoc/i.test(k))
      && out.includes('Forecasting') && out.includes('Data Analysis'), out.join(', '));
  t('  no requirement is listed twice', distinct.size === out.length,
    out.length + ' entries, ' + distinct.size + ' distinct');
  t('  and the real requirements all survive',
    ['Salesforce', 'Python', 'Qlik', 'Tableau', 'Excel', 'Forecasting', 'Data Analysis',
      'Communication', 'Presentation'].every((k) => out.includes(k)), out.join(', '));
}

console.log('\nTHE CANDIDATE\'S OWN CV IS EVIDENCE OF WHAT THEY DID');
{
  // The gate read the structured profile fields alone, which are a
  // summary of a CV rather than the CV. On a real profile that is about
  // two thousand characters against seven thousand, so a CV saying
  // "presenting proposed solutions to client CTOs" could not evidence
  // Presentation and the chip stayed red with the proof in the file.
  const thin = { skills: ['Python', 'SQL'] };
  const rich = 'Acted as technical lead on five pre-sales bids, authoring the '
    + 'architecture sections and presenting proposed solutions to client CTOs.';

  const withoutCV = Object.create(P.prototype);
  withoutCV._cachedProfile = thin; withoutCV.baseCVContent = null;
  const withCV = Object.create(P.prototype);
  withCV._cachedProfile = thin; withCV.baseCVContent = rich;

  t('  without it, the profile alone cannot prove Presentation',
    !withoutCV._profileEvidences('Presentation', withoutCV._profileEvidenceBlob()),
    'the thin profile proved it on its own, so this test proves nothing');
  t('  with it, the same candidate can',
    withCV._profileEvidences('Presentation', withCV._profileEvidenceBlob()),
    'the uploaded CV is still not reaching the gate');
  t('  ...and it still refuses what the CV does not show',
    !withCV._profileEvidences('Salesforce', withCV._profileEvidenceBlob()),
    'the gate now waves everything through');

  // The UPLOADED CV, never the generated one: reading back what this tool
  // just wrote would prove only that this tool wrote it.
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  const blob = src.slice(src.indexOf('_profileEvidenceBlob()'),
    src.indexOf('_profileEvidenceBlob()') + 2600);
  t('  the blob reads the uploaded base CV', /getOriginalCVText\(\)/.test(blob), blob.slice(0, 200));
  t('  ...and never the generated one',
    !/generatedDocuments/.test(blob), 'the gate would be marking its own homework');
}

console.log('\nAND THE POSTING\'S WORDING IS PAIRED ON AFTER THE COVERAGE PASS');
{
  // alignToPostingWording sat ABOVE the coverage pass while its own
  // comment claimed it ran last, so nothing that pass added was ever
  // considered for pairing.
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  const flow = src.slice(src.indexOf('async tailorDocuments('));
  const inject = flow.indexOf('this.fastKeywordInjection(');
  const align = flow.indexOf('this.alignToPostingWording(');
  const review = flow.indexOf('const review = this.calculateMatchScore(');
  t('  the coverage pass runs first', inject !== -1 && inject < align,
    'alignment would run over a half-built skills block');
  t('  ...then the alignment', align !== -1 && align < review, 'alignment runs after the measurement');
  t('  ...then the measurement that feeds the chips', review !== -1, 'no final measurement');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
