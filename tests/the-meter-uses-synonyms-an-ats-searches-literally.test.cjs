// A GREEN CHIP AND A FILTERED APPLICATION.
//
// The taxonomy exists so a CV saying "PostgreSQL" is credited for a
// posting asking for "Postgres". They are one requirement and the
// candidate plainly has it, so the chip is green and the chip is right.
//
// A Workday or Taleo keyword screen does not use a taxonomy. It runs the
// requisition's OWN string against the document, finds nothing, and
// filters the application out:
//
//   posting says   CV says                        literal search
//   Postgres       PostgreSQL                     no match
//   K8s            Kubernetes                     no match
//   GCP            Google Cloud Platform          no match
//   SRE            Site Reliability Engineering   no match
//
// Four requirements the candidate genuinely has, invisible to the thing
// that decides whether a human ever reads the CV. And it is not a rare
// shape: every posting writes some of its tools the short way.
//
// So where the CV satisfies a requirement through a DIFFERENT surface
// form than the posting used, the posting's form is paired onto the one
// already there: "PostgreSQL (Postgres)". Both strings are in the
// document and either search finds it.
//
// WHAT THIS MUST NOT BECOME. It only ever PAIRS. It cannot add a
// requirement the CV did not already carry, which is why it needs no
// evidence gate: the requirement was already satisfied and already
// counted, and this writes the second name for the same thing. And it
// stays out of the experience section, because appending "(Postgres)"
// to a sentence about a piece of work rewrites a claim, while appending
// it to a skills entry states the same skill twice, which is what a CV
// does anyway.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));
const TX = global.KeywordTaxonomy;
const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: TX },
  KeywordTaxonomy: TX, document: { addEventListener() {} },
  console: { log() {}, warn() {}, error() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const popup = Object.create(sandbox.P.prototype);

const CV = ['Maxmilliam Okafor', 'Engineer', 'Dublin | max@example.invalid', '',
  'TECHNICAL SKILLS',
  'Cloud & DevOps: Kubernetes, Google Cloud Platform, Docker',
  'Data: PostgreSQL, Snowflake',
  'Reliability: Site Reliability Engineering, Observability', '',
  'PROFESSIONAL EXPERIENCE', 'Meta | Software Engineer | 2023 - Present',
  '- Ran Kubernetes in production and owned the PostgreSQL upgrade.', '',
  'EDUCATION', 'Imperial College London'].join('\n');

const lit = (hay, term) => new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  + '\\b', 'i').test(hay);

console.log('THE POSTING\'S OWN WORDING IS NOT IN THE DOCUMENT');
for (const [asked, has] of [['Postgres', 'PostgreSQL'], ['K8s', 'Kubernetes'],
  ['GCP', 'Google Cloud Platform'], ['SRE', 'Site Reliability Engineering']]) {
  t('  ' + asked.padEnd(9) + ' counts as matched (the CV says ' + has + ')',
    TX.appearsIn(CV, asked), 'the taxonomy missed it');
  t('    ...but a literal search finds nothing', !lit(CV, asked), 'premise is wrong');
}

const out = popup.alignToPostingWording(CV,
  { all: ['Postgres', 'K8s', 'GCP', 'SRE', 'Docker', 'Snowflake'] });

console.log('\nSO IT IS PAIRED ON');
{
  t('  four requirements were paired', out.paired.length === 4, JSON.stringify(out.paired));
  for (const asked of ['Postgres', 'K8s', 'GCP', 'SRE']) {
    t('    a literal search for "' + asked + '" now finds it', lit(out.text, asked),
      out.text.slice(out.text.indexOf('TECHNICAL SKILLS'), out.text.indexOf('PROFESSIONAL EX')));
  }
  for (const had of ['PostgreSQL', 'Kubernetes', 'Google Cloud Platform',
    'Site Reliability Engineering']) {
    t('    ...and "' + had + '" is still there too', lit(out.text, had), 'the original was replaced');
  }
}

console.log('\nTHE LONGEST FORM WINS, SO NOTHING IS BRACKETED MID-PHRASE');
{
  // "Google Cloud" is a variant of the same requirement as "Google Cloud
  // Platform". Matching the short one inside the long one produced
  // "Google Cloud (GCP) Platform".
  t('  "Google Cloud Platform (GCP)", not "Google Cloud (GCP) Platform"',
    /Google Cloud Platform \(GCP\)/.test(out.text),
    (out.text.split('\n').find((l) => /GCP/.test(l)) || ''));
}

console.log('\nAND IT TOUCHES NOTHING BUT THE SKILLS BLOCK');
{
  const exp = out.text.slice(out.text.indexOf('PROFESSIONAL EXPERIENCE'));
  t('  the experience bullet is byte-identical',
    /- Ran Kubernetes in production and owned the PostgreSQL upgrade\.$/m.test(exp), exp);
  t('  ...so no claim about a piece of work was rewritten',
    !/\(K8s\)|\(Postgres\)/.test(exp), exp);
  t('  and the education section is untouched',
    /EDUCATION\nImperial College London/.test(out.text), 'a section was damaged');
  t('  every skill that was there before still is',
    ['Kubernetes', 'Docker', 'PostgreSQL', 'Snowflake', 'Observability']
      .every((s) => lit(out.text, s)), 'something was lost');
}

console.log('\nIT PAIRS, IT NEVER ADDS');
{
  // A requirement the CV does not satisfy at all is not this pass's job:
  // adding it would be claiming a skill, which is what the evidence gate
  // exists to prevent.
  const r = popup.alignToPostingWording(CV, { all: ['Rust', 'Zendesk', 'COBOL'] });
  t('  an unheld requirement is not written', r.paired.length === 0, JSON.stringify(r.paired));
  t('  ...and the document comes back unchanged', r.text === CV, 'the CV was edited');

  // Nor is one the CV already states in the posting's own words.
  const same = popup.alignToPostingWording(CV, { all: ['Docker', 'Snowflake'] });
  t('  a requirement already written that way is left alone',
    same.paired.length === 0 && same.text === CV, JSON.stringify(same.paired));
  t('  ...so no "Docker (Docker)"', !/Docker \(Docker\)/.test(same.text), same.text);
}

console.log('\nAND IT IS SAFE TO RUN TWICE');
{
  const again = popup.alignToPostingWording(out.text,
    { all: ['Postgres', 'K8s', 'GCP', 'SRE'] });
  t('  a second pass pairs nothing', again.paired.length === 0, JSON.stringify(again.paired));
  t('  ...and does not double a bracket',
    !/\(\s*\(|\)\s*\)/.test(again.text)
      && (out.text.match(/\(Postgres\)/g) || []).length === 1, 'brackets nested');
}

console.log('\nAND A CV WITH NO SKILLS BLOCK IS LEFT ALONE');
{
  const bare = ['NAME', '', 'PROFESSIONAL EXPERIENCE', '- Ran Kubernetes.'].join('\n');
  const r = popup.alignToPostingWording(bare, { all: ['K8s'] });
  t('  nothing is invented to hold it', r.text === bare && r.paired.length === 0, r.text);
  t('  ...and an empty CV is returned as it came',
    popup.alignToPostingWording('', { all: ['K8s'] }).text === '', 'wrote into nothing');
}

console.log('\nAND THE FLOW RUNS IT LAST, ON THE FINISHED SKILLS BLOCK');
{
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  the tailoring flow calls it',
    /this\.alignToPostingWording\(this\.generatedDocuments\.cv, keywords\)/.test(src),
    'the pass exists but nothing runs it');
  // Measured between the two calls in the TAILORING FLOW, not the first
  // textual occurrence anywhere in the file. fastKeywordInjection is also
  // called from an earlier helper, so indexOf found that one and the
  // assertion passed for as long as the flow had them the wrong way round.
  const flow = src.slice(src.indexOf('async tailorDocuments('));
  t('  ...after the coverage pass has added what it is going to add',
    flow.indexOf('this.fastKeywordInjection(') !== -1
      && flow.indexOf('this.fastKeywordInjection(') < flow.indexOf('this.alignToPostingWording('),
    'it would run over a half-built skills block');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
