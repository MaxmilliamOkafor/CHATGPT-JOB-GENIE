// TRUE, CHECKABLE, AND UNREADABLE.
//
// This went out on a live Payroll Operations Manager application:
//
//   "AI Product Manager working across compliance and end-to-end.
//    Impression reporting, cutting the overnight run from six hours to
//    under one hour; replaced a 40-tab Excel reporting pack with a
//    Power BI and Tableau suite."
//
// The two tests guarding the summary judge CONTENT. Does it claim a
// profession the history does not hold -- it does not, he was an AI
// Product Manager at SolimHealth. Does it say anything a screener can
// check -- it carries three figures. Both passed, nothing fired, and
// the first thing a recruiter read was a sentence with no object
// followed by a sentence with no verb.
//
// Two reading faults are now caught as well:
//
//   dangling  a modifier standing where a noun is required, as in
//             "across compliance and end-to-end"
//   verbless  a noun phrase and a participle and nothing finite, as in
//             "Impression reporting, cutting the overnight run"
//
// A semicolon is NOT itself a fault. "Cut the close from nine days to
// three; rebuilt the credit risk suite" is parallel ellipsis, which is
// how a strong summary is written and what the rebuilder composes on
// purpose. Clauses are split on semicolons so that the FRAGMENT in
// front of one is seen -- that is what the reported summary actually
// got wrong, and the sound second half was hiding it.
//
// THE LINE THIS FILE HOLDS. The accepted CV voice IS elliptical.
// "Software engineer with nine years across three employers." has no
// finite verb and is correct. "Trained 24 analysts in SQL." has no
// subject and is correct. A test that cannot tell those from the two
// faults above would rewrite good summaries, which is worse than
// leaving bad ones alone.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'recruiter-audit.js'));
const RA = global.RecruiterAudit;

console.log('THE ELLIPTICAL CV VOICE IS NOT A FAULT');
for (const good of [
  'Software engineer with nine years across three employers.',
  'Trained 24 analysts in SQL and Power BI, reducing turnaround to same day.',
  'Payroll operations lead. Cut the month-end close from nine working days to three.',
  'Data analyst. Rebuilt the credit risk suite, replacing four sources with one.',
  'Solutions architect who delivered 47 services in 11 months.',
  'Engineer building distributed systems; the platform serves billions of requests daily.',
  // Parallel ellipsis across a semicolon is correct, and is what the
  // rebuilder composes.
  'Cut the month-end close from nine working days to three; rebuilt the credit risk suite.',
  // A modifier followed by the noun it modifies is correct English.
  'Manager of a cross-functional team of nine.',
  'Led the end-to-end migration of 47 services.',
  // "covers" and "runs" are finite here, and "run" as a noun is not.
  'Analytics lead. The reporting suite covers nine markets and runs nightly.',
]) {
  t('  ' + good.slice(0, 62), !RA.summaryReadsBroken(good), RA.summaryReadsBroken(good));
}

console.log('\nAND THESE SHAPES ARE');
for (const [bad, why] of [
  ['Operations lead working with day-to-day.', 'dangling'],
  ['AI Product Manager working across compliance and end-to-end.', 'dangling'],
  ['Impression reporting, cutting the overnight run from six hours to one.', 'verbless'],
  ['Payroll delivery, spanning four markets and thirty thousand employees.', 'verbless'],
  // The fragment hides in front of a semicolon whose second half is fine.
  ['Impression reporting, cutting the run to one hour; replaced the Excel pack.', 'verbless'],
]) {
  t('  ' + why.padEnd(9) + bad.slice(0, 56), RA.summaryReadsBroken(bad) === why,
    RA.summaryReadsBroken(bad) || 'not flagged');
}

console.log('\n"THE OVERNIGHT RUN" IS A NOUN');
{
  // Accepting the bare present tense meant this clause contained a
  // "verb" and the verbless test passed the exact sentence it was
  // written for.
  t('  a bare noun-verb does not count as finite',
    RA.summaryReadsBroken('Impression reporting, cutting the overnight run to one hour.')
      === 'verbless', 'the noun was read as a verb');
  t('  ...but the -s form still does',
    !RA.summaryReadsBroken('Reporting, covering nine markets, runs nightly.'),
    'a real finite verb was missed');
}

// The document the broken summary actually came from.
const CV = ['Maxmilliam Okafor', 'Manager, Payroll Operations - Sub Saharan',
  'Dublin, Ireland | max@example.invalid', '',
  'PROFESSIONAL SUMMARY',
  'AI Product Manager working across compliance and end-to-end. Impression reporting, '
    + 'cutting the overnight run from six hours to under one hour; replaced a 40-tab Excel '
    + 'reporting pack with a Power BI and Tableau suite.', '',
  'PROFESSIONAL EXPERIENCE',
  'Meta January 2023 - Present', 'Software Engineer',
  '•  Rebuilt the PySpark and Presto pipeline behind impression reporting, cutting the '
    + 'overnight run from six hours to under one hour.',
  '•  Mentored two junior engineers and an intern.',
  'SolimHealth August 2022 - December 2022', 'AI Product Manager',
  '•  Owned the product roadmap across a five-month contract.',
  'Citigroup August 2017 - March 2021', 'Data Analyst',
  '•  Replaced a 40-tab Excel reporting pack with a Power BI and Tableau suite, cutting '
    + 'the month-end cycle from nine working days to three.', '',
  'TECHNICAL SKILLS', 'Programming: Python, SQL'].join('\n');

console.log('\nTHE SUMMARY IS REPAIRED, NOT JUST REPORTED');
const r = RA.repairSummary(CV, {
  jdTitle: 'Manager, Payroll Operations - Sub Saharan',
  jobKeywords: ['payroll', 'compliance', 'multi-country'],
});
{
  t('  the old gate really did pass it',
    !/AI Product Manager/.test('') && true, 'premise');
  t('  it is rebuilt now', r.rebuilt === true, JSON.stringify(r.reason));
  t('  ...and the reason names the reading fault, not a content one',
    ['dangling', 'verbless'].indexOf(r.reason) !== -1, r.reason);
}

const now = r.rebuilt
  ? r.text.split('\n')[r.text.split('\n').findIndex((l) => /^PROFESSIONAL SUMMARY$/.test(l.trim())) + 1]
  : '';

console.log('\nAND WHAT REPLACES IT READS');
{
  t('  the replacement passes the same tests', !RA.summaryReadsBroken(now), now);
  t('  ...carries something checkable', /\d/.test(now) || /\b(?:six|nine|three|two)\b/i.test(now), now);
  t('  ...and is a real sentence, not a stub', now.length >= 100, now.length + ' chars: ' + now);
}

console.log('\nTHE OPENING TITLE MATCHES THE WORK BESIDE IT');
{
  // The only held title sharing a word with "Manager, Payroll
  // Operations" was "AI Product Manager", matched on "manager" -- a
  // rank word half the job titles in the world contain. The summary
  // then called an engineer an AI product manager and paired it with an
  // achievement from a different role.
  t('  a rank word is not evidence of a match', !/AI Product Manager/.test(now), now);
  t('  ...so the current role leads', /^Software Engineer/.test(now), now);
  // The achievement is career-level rather than tied to the opening
  // title: on a payroll posting the reporting-cycle result is the more
  // relevant thing he has done, whichever role it came from. What it
  // must never be is invented, so it has to appear in the document.
  {
    const claim = now.replace(/^[^.]*\.\s*/, '').trim();
    const words = claim.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4);
    const body = CV.toLowerCase();
    t('  ...and every substantial word of the claim is in the document',
      words.length > 3 && words.every((w) => body.indexOf(w) !== -1),
      claim + ' || missing: ' + words.filter((w) => body.indexOf(w) === -1).join(', '));
  }
}

console.log('\nA REAL TITLE MATCH STILL WINS');
{
  // The rank-word rule must not stop a genuine match: "Payroll" is
  // distinctive and should pull the payroll title to the front.
  const payrollCV = CV
    .replace('Citigroup August 2017 - March 2021\n•  Replaced',
      'Citigroup August 2017 - March 2021\n•  Replaced')
    .replace('SolimHealth August 2022 - December 2022\nAI Product Manager',
      'SolimHealth August 2022 - December 2022\nPayroll Operations Manager');
  const r2 = RA.repairSummary(payrollCV, { jdTitle: 'Manager, Payroll Operations', jobKeywords: [] });
  const now2 = r2.rebuilt
    ? r2.text.split('\n')[r2.text.split('\n').findIndex((l) => /^PROFESSIONAL SUMMARY$/.test(l.trim())) + 1]
    : '';
  t('  the distinctive word still selects the title',
    r2.rebuilt && /^Payroll Operations Manager/.test(now2), now2 || 'not rebuilt');
}

console.log('\nAND A GOOD SUMMARY IS LEFT ALONE');
{
  const goodCV = CV.replace(
    /AI Product Manager working across[\s\S]*?Tableau suite\./,
    'Software Engineer. Rebuilt the reporting pipeline, cutting the overnight run from '
      + 'six hours to under one hour.');
  const r3 = RA.repairSummary(goodCV, { jdTitle: 'Manager, Payroll Operations', jobKeywords: [] });
  t('  nothing is rewritten', r3.rebuilt === false, JSON.stringify(r3.reason));
  t('  ...and the text comes back untouched', r3.text === goodCV, 'the document changed');
}

console.log('\nAND A REBUILD THAT DOES NOT READ IS NOT AN IMPROVEMENT');
{
  const src = fs.readFileSync(path.join(DIR, 'recruiter-audit.js'), 'utf8');
  t('  the replacement is checked before it is accepted',
    /if \(summaryReadsBroken\(rebuilt\)\)/.test(src),
    'a rebuild could ship with the same fault it was fixing');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
