// A COVER LETTER THAT READS OUT THE CV IS A WASTED PAGE.
//
// Measured on a real pair of documents this extension produced, both
// substantive paragraphs of the letter were restatements of CV bullets:
//
//   61%  "I led the migration of a UK retail client's legacy application
//         to AWS microservices, delivering all 47 services in 11 months"
//   vs   "Architected a UK retail client's migration from a legacy
//         application to AWS microservices on EKS, delivering all 47
//         services in 11 months"
//
// The recruiter reads the letter, then the CV, and gets the same two
// stories twice. The CV answers what the candidate has DONE. The letter
// is the only document that can say what they would do HERE, and
// spending it on repetition throws that away.
//
// This reports rather than rewrites. Rewriting a paragraph well needs
// the source material and a judgement about what the work involved,
// which is the writing model's job. What was missing was anyone
// noticing.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
global.window = global;
const realConsole = console;
global.console = Object.assign({}, realConsole, { log() {}, warn() {} });
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'recruiter-audit.js'));
global.console = realConsole;
const RA = global.RecruiterAudit;

const CV = ['Maxmilliam Okafor', 'Senior Security Engineer',
  'Dublin, Ireland | +353 087 426 1508 | Email: max@example.invalid', '',
  'PROFESSIONAL EXPERIENCE',
  'Accenture | Solutions Architect | April 2021 - July 2022',
  '• Architected a UK retail client’s migration from a legacy application to AWS '
    + 'microservices on EKS, delivering all 47 services in 11 months and cutting annual '
    + 'infrastructure cost through right sizing and reserved instances.',
  '• Hold primary on-call responsibility for two critical services. Authored the incident '
    + 'response documentation the team now uses and led the review that resolved a failure '
    + 'which had recurred monthly for over a year.',
  '• Raised automated test coverage with pytest and added checks to the build pipeline.'].join('\n');

console.log('A PARAGRAPH THAT RESTATES A BULLET IS FOUND');
{
  const restating = ['Dear Hiring Manager,', '',
    'I led the migration of a UK retail client’s legacy application to AWS microservices, '
      + 'delivering all 47 services in 11 months, which significantly reduced annual '
      + 'infrastructure costs.', '',
    'In my role at Meta, I authored incident response documentation that resolved a recurring '
      + 'failure over a year, enhancing our team’s efficiency and response capabilities.'].join('\n');
  const found = RA.coverLetterRestatesCv(CV, restating);
  t('  both paragraphs are flagged', found.length === 2, JSON.stringify(found.map((f) => f.overlap)));
  t('  ...each naming the bullet it repeats',
    found.every((f) => f.bullet && f.bullet.length > 20), JSON.stringify(found));
  t('  ...and the overlap is reported as a number',
    found.every((f) => f.overlap >= 40 && f.overlap <= 100),
    JSON.stringify(found.map((f) => f.overlap)));
}

console.log('\nAND A FORWARD-LOOKING LETTER IS NOT');
{
  // The same candidate, the same evidence, written as what he would do
  // for THEM. One brief proof point per paragraph, never the bullet.
  const good = ['Dear Hiring Manager,', '',
    'Your posting describes turning every incident into intelligence the next team can use. '
      + 'That is a documentation and review discipline more than a tooling problem, and it is '
      + 'the part of security work I would want to own here.', '',
    'In the first quarter I would expect to spend most of my time on your detection backlog '
      + 'and on whatever the on-call rota is currently absorbing by hand, because that is '
      + 'usually where the recurring failures hide.', '',
    'QuintoAndar operates at a scale where a single misconfigured rule is expensive, so I would '
      + 'want the review loop tight before adding any new coverage.'].join('\n');
  const found = RA.coverLetterRestatesCv(CV, good);
  t('  nothing is flagged', found.length === 0, JSON.stringify(found.map((f) =>
    f.overlap + '% ' + f.paragraph.slice(0, 40))));
}

console.log('\nAND IT DOES NOT FIRE ON ORDINARY SHARED VOCABULARY');
{
  // Two texts about the same job share words. The threshold is measured
  // against the SMALLER word set, so a short paragraph lifted from a long
  // bullet still scores, while two texts merely on the same subject do not.
  const sameSubject = ['Dear Hiring Manager,', '',
    'Security engineering at scale is mostly about what happens after the alert fires, and '
      + 'I have spent the last four years on that side of the problem rather than on '
      + 'building new detection from scratch.'].join('\n');
  t('  a paragraph on the same subject is left alone',
    RA.coverLetterRestatesCv(CV, sameSubject).length === 0,
    JSON.stringify(RA.coverLetterRestatesCv(CV, sameSubject)));
}

console.log('\nAND THE AWKWARD SHAPES DO NOT BREAK IT');
{
  for (const [name, cv, cl] of [
    ['no cover letter', CV, ''],
    ['no CV', '', 'Dear Hiring Manager, I would bring a great deal to this role indeed.'],
    ['both empty', '', ''],
    ['null', null, null],
    ['a CV with no bullets', 'Maxmilliam Okafor\nEngineer', 'Dear Hiring Manager, I am writing to you.'],
  ]) {
    let threw = false;
    let out = null;
    try { out = RA.coverLetterRestatesCv(cv, cl); } catch (e) { threw = true; }
    t('  ' + name.padEnd(22) + ' returns nothing rather than throwing',
      !threw && Array.isArray(out) && out.length === 0, threw ? 'threw' : JSON.stringify(out));
  }
}

console.log('\nAND THE AUDIT REPORTS IT');
{
  const src = fs.readFileSync(path.join(DIR, 'recruiter-audit.js'), 'utf8');
  t('  runRecruiterAudit calls it', /coverLetterRestatesCv\(outCV, outCL\)/.test(src),
    'the check exists but the audit never runs it');
  t('  ...as a warning with its own kind',
    /kind: 'cover-letter-restates-cv'/.test(src), 'it would be invisible in the report');
  t('  ...and it reports rather than rewrites',
    !/outCL = .*coverLetterRestatesCv/.test(src),
    'rewriting a paragraph needs the source material, which this does not have');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
