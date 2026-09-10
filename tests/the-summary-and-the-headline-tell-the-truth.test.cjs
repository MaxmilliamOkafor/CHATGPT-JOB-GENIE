// A GENERATED CV, READ FROM THE TOP.
//
//   Maxmilliam Okafor
//   Manager, Payroll Operations - Sub Saharan
//   Manager, Payroll Operations
//   Dublin, Ireland | +353 087 426 1508 | ...
//
//   PROFESSIONAL SUMMARY
//   Manager of Payroll Operations with a strong background in team
//   leadership and operational excellence, ensuring compliance and
//   accuracy in payroll delivery across multi-country environments.
//
// THE TITLE TWICE. The tailoring model writes the target title on the
// line under the name -- the prompt tells it to -- and the extension
// inserted its own copy above it. The two cleaned the scraped title
// differently, so neither recognised the other, and every check in
// ensureHeadline only ever looked at ONE line. Worse, the pipeline took
// the repaired text only inside the `added` and `replaced` branches, so
// even once the duplicate was found the fix was computed and discarded.
//
// AND A SUMMARY THAT IS NEITHER TRUE NOR USEFUL. The employment block
// under it reads Software Engineer, AI Product Manager, Solutions
// Architect, Data Analyst. This candidate has never managed payroll
// operations. And the sentence says nothing anyone can check: no
// employer, no number, no year -- "strong background", "operational
// excellence", "ensuring compliance and accuracy". It is the shape of a
// summary with the content taken out.
//
// The rule that comes out of it: a summary is rebuilt from the
// document's own facts when it claims a role the history does not
// contain, or when it carries nothing checkable -- and NEVER when the
// rebuild would be worse than what it replaces.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), Module = require('module');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
for (const f of ['docx-generator.js', 'content-quality-engine.js', 'recruiter-audit.js']) {
  const file = path.join(DIR, f);
  const m = new Module(file, null); m.filename = file;
  m.paths = Module._nodeModulePaths(DIR);
  m._compile(fs.readFileSync(file, 'utf8'), file);
}
const RA = global.RecruiterAudit;

const HISTORY = [
  'PROFESSIONAL EXPERIENCE',
  'Meta January 2023 - Present',
  'Software Engineer',
  '- Held primary on-call responsibility for two critical services and led a review '
    + 'that resolved a recurring failure experienced monthly for over a year.',
  'Accenture April 2021 - July 2022',
  'Solutions Architect',
  '- Architected a migration to AWS microservices, delivering all 47 services in 11 months.',
  'Citigroup August 2017 - March 2021',
  'Data Analyst',
  '- Trained 24 analysts across the London and Belfast offices in SQL and Power BI, '
    + 'reducing turnaround on routine data requests to same day.',
  '',
  'TECHNICAL SKILLS',
  'Programming: Python, SQL',
  'Additional Skills: Payroll, People Leadership',
  '',
  'EDUCATION', 'Imperial College London',
];
const cvWith = (headlines, summary) => ['Maxmilliam Okafor'].concat(headlines,
  ['Dublin, Ireland | +353 87 426 1508 | max@example.invalid', '',
    'PROFESSIONAL SUMMARY', summary, ''], HISTORY).join('\n');

const audit = (cv, jdTitle, keywords) => RA.runRecruiterAudit({
  cvText: cv, jdText: 'payroll operations manager, multi-country',
  jdTitle: jdTitle, jdCompany: 'Remote',
  jobKeywords: { all: keywords || [] }, experience: [],
});

console.log('THE TITLE APPEARS ONCE');
{
  const out = audit(cvWith(['Manager, Payroll Operations - Sub Saharan',
    'Manager, Payroll Operations'], 'Data Analyst with eight years at Citigroup, Meta and Accenture.'),
  'Manager, Payroll Operations - Sub Saharan');
  const top = out.cvText.split('\n').filter((l) => l.trim()).slice(0, 3);
  t('  the duplicate is gone', top[2].indexOf('@') !== -1 || top[2].indexOf('|') !== -1,
    JSON.stringify(top));
  t('  ...and the surviving line is the FULL posting title',
    top[1] === 'Manager, Payroll Operations - Sub Saharan', JSON.stringify(top[1]));
  t('  the region is not treated as furniture and stripped',
    out.cvText.indexOf('Sub Saharan') !== -1, 'the specific req became a generic one');
}
{
  // The same two lines, in the other order.
  const out = audit(cvWith(['Manager, Payroll Operations',
    'Manager, Payroll Operations - Sub Saharan'], 'Data Analyst with eight years at Citigroup, Meta and Accenture.'),
  'Manager, Payroll Operations - Sub Saharan');
  const top = out.cvText.split('\n').filter((l) => l.trim()).slice(0, 3);
  t('  whichever order they arrive in', top[2].indexOf('|') !== -1, JSON.stringify(top));
}
{
  // A real second line that is NOT the headline must survive.
  const out = audit(cvWith(['Manager, Payroll Operations - Sub Saharan'],
    'Data Analyst with eight years at Citigroup, Meta and Accenture.'),
  'Manager, Payroll Operations - Sub Saharan');
  t('  and the contact line is never mistaken for an echo',
    /@|\+353/.test(out.cvText.split('\n').filter((l) => l.trim())[2]),
    JSON.stringify(out.cvText.split('\n').filter((l) => l.trim()).slice(0, 3)));
}

console.log('\nTHE SUMMARY DOES NOT CLAIM A JOB THE HISTORY DOES NOT CONTAIN');
{
  const bad = 'Manager of Payroll Operations with a strong background in team leadership '
    + 'and operational excellence, ensuring compliance and accuracy in payroll delivery '
    + 'across multi-country environments.';
  const out = audit(cvWith(['Manager, Payroll Operations - Sub Saharan'], bad),
    'Manager, Payroll Operations - Sub Saharan',
    ['payroll', 'people leadership', 'communication', 'leadership']);
  const lines = out.cvText.split('\n');
  const summary = lines[lines.findIndex((l) => /PROFESSIONAL SUMMARY/.test(l)) + 1];
  t('  the sentence was replaced', summary !== bad, JSON.stringify(summary));
  t('  ...and no longer says the candidate manages payroll operations',
    !/manager of payroll operations/i.test(summary), JSON.stringify(summary));
  t('  it leads with a title the history contains',
    /Software Engineer|Solutions Architect|Data Analyst/.test(summary), JSON.stringify(summary));
  // AND IT NAMES NO EMPLOYER AT ALL. An employer in the first line is a
  // prestige signal: it invites a judgement about where someone has
  // worked before any judgement about what they did, and it is already
  // in the employment block two inches below. Same for total years,
  // which is an age proxy, and for place names.
  t('  no employer name in the summary',
    !/Meta|Accenture|Citigroup|SolimHealth/.test(summary), JSON.stringify(summary));
  t('  no total-years claim', !/\b(five|six|seven|eight|nine|ten|\d+)\s+years\b/i.test(summary),
    JSON.stringify(summary));
  t('  no place names', !/London|Belfast|Dublin|Ireland/.test(summary), JSON.stringify(summary));
  t('  and no adjective about the person',
    !/\b(accomplished|seasoned|passionate|dynamic|results.driven|strong background|proven|highly)\b/i
      .test(summary), JSON.stringify(summary));
  t('  it carries a number a screener can check', /\d/.test(summary), JSON.stringify(summary));
  t('  and it is a real summary, not a stub',
    summary.length >= 100 && summary.length <= 220, summary.length + ' chars');
}

console.log('\nAND THE SKILLS LINE IS NOT EVIDENCE OF DOING THE WORK');
{
  // "Payroll" is on the skills line because the coverage pass put it
  // there. A rebuilt summary that reads it back would reintroduce the
  // exact claim the rebuild exists to remove.
  const bad = 'Manager of Payroll Operations with a strong background in operational excellence.';
  const out = audit(cvWith(['Manager, Payroll Operations - Sub Saharan'], bad),
    'Manager, Payroll Operations - Sub Saharan', ['payroll', 'people leadership']);
  const lines = out.cvText.split('\n');
  const summary = lines[lines.findIndex((l) => /PROFESSIONAL SUMMARY/.test(l)) + 1];
  t('  the rebuilt summary does not claim payroll',
    !/payroll/i.test(summary), JSON.stringify(summary));
  t('  ...though the skills section still carries the keyword',
    /Payroll/.test(out.cvText), 'the coverage term was lost from the skills section');
}

console.log('\nAND IT IS BUILT TO BE READ, NOT SKIMMED PAST');
{
  const bad = 'Accomplished and highly motivated professional with a proven track record '
    + 'of delivering results in fast-paced environments.';
  const out = audit(cvWith(['Staff Software Engineer'], bad), 'Staff Software Engineer, Platform',
    ['Python', 'AWS', 'incident response', 'mentorship', 'architecture']);
  const lines = out.cvText.split('\n');
  const summary = lines[lines.findIndex((l) => /PROFESSIONAL SUMMARY/.test(l)) + 1];

  t('  it opens with a role, not an adjective',
    /^(Software Engineer|Solutions Architect|Data Analyst)\b/.test(summary), JSON.stringify(summary));
  t('  the opening line names what the person works on',
    /working across/.test(summary), JSON.stringify(summary));
  t('  ...in the posting\'s own words where the experience earns them',
    /Python|AWS|incident response/i.test(summary), JSON.stringify(summary));
  t('  it carries a figure', /\d/.test(summary), JSON.stringify(summary));
  t('  it uses the space it has', summary.length >= 140, summary.length + ' chars');
  t('  ...and still fits two rendered lines', summary.length <= 220, summary.length + ' chars');
  t('  no bullet punctuation leaked in', !/^[-•*]/.test(summary) && summary.indexOf('•') === -1,
    JSON.stringify(summary));
}
{
  // SCALE IS WHAT GETS REMEMBERED. Given a choice between a bullet
  // carrying a magnitude and one carrying a small count, the magnitude
  // leads -- and the trimming that makes two outcomes fit must never
  // cut away the figure the bullet was chosen for.
  const history = ['PROFESSIONAL EXPERIENCE',
    'Citigroup August 2017 - March 2021', 'Data Analyst',
    '- Rebuilt the credit risk reporting suite in SQL and Python for a GBP 2.6bn consumer '
      + 'lending portfolio, replacing four conflicting sources with one agreed set of figures.',
    '- Reviewed 12 dashboards for consistency across the reporting pack.',
    '- Cut the month-end reporting cycle from nine working days to three by replacing a '
      + 'manual Excel rebuild with an automated Power BI suite.',
    '', 'TECHNICAL SKILLS', 'Programming: SQL, Python', '', 'EDUCATION', 'Imperial College London'];
  const cv = ['Maxmilliam Okafor', 'Data Analyst', 'Dublin | max@example.invalid', '',
    'PROFESSIONAL SUMMARY',
    'Accomplished analyst with a proven track record in fast-paced environments.', ''].concat(history).join('\n');
  const out = RA.runRecruiterAudit({ cvText: cv, jdText: 'credit risk reporting analyst',
    jdTitle: 'Data Analyst, Credit Risk', jobKeywords: { all: ['SQL', 'Python', 'credit risk'] },
    experience: [] });
  const lines = out.cvText.split('\n');
  const summary = lines[lines.findIndex((l) => /PROFESSIONAL SUMMARY/.test(l)) + 1];
  t('  the magnitude survives into the summary',
    /2\.6bn/.test(summary), JSON.stringify(summary));
  t('  ...and the small count did not displace it',
    !/12 dashboards/.test(summary), JSON.stringify(summary));
  t('  and it is trimmed at a clause, not mid-phrase',
    /portfolio\.$|three\.$|suite\.$/.test(summary), JSON.stringify(summary));
}
{
  // WHERE TWO FIT, TWO ARE USED. A single figure reads as the one good
  // thing that happened; a pair reads as a pattern. They are joined
  // with a semicolon rather than written as two sentences, because two
  // full stops in a two-line summary read as bullets that escaped.
  const cv = ['Maxmilliam Okafor', 'Data Analyst', 'Dublin | max@example.invalid', '',
    'PROFESSIONAL SUMMARY', 'Accomplished analyst with a proven track record.', '',
    'PROFESSIONAL EXPERIENCE', 'Citigroup August 2017 - March 2021', 'Data Analyst',
    '- Cut the month-end close from nine working days to three.',
    '- Cleared a two-year alert backlog after rescoring 40,000 cases.',
    '', 'TECHNICAL SKILLS', 'Programming: SQL', '', 'EDUCATION', 'Imperial'].join('\n');
  const out = RA.runRecruiterAudit({ cvText: cv, jdText: 'analyst',
    jdTitle: 'Data Analyst', jobKeywords: { all: [] }, experience: [] });
  const lines = out.cvText.split('\n');
  const summary = lines[lines.findIndex((l) => /PROFESSIONAL SUMMARY/.test(l)) + 1];
  t('  two outcomes are joined as one sentence, not two',
    summary.indexOf(';') !== -1, JSON.stringify(summary));
  t('  the before-and-after delta is kept',
    /nine working days to three/.test(summary), JSON.stringify(summary));
  t('  ...and both figures are there', /three/.test(summary) && /40,000|two-year/.test(summary),
    JSON.stringify(summary));
}

console.log('\nA GOOD SUMMARY IS LEFT ALONE');
for (const good of [
  'Data Analyst with eight years across Citigroup, Meta and Accenture, who rebuilt a '
    + 'credit risk reporting suite for a GBP 2.6bn portfolio.',
  'Solutions Architect with eight years at Accenture and Meta, delivering 47 services '
    + 'in an 11 month cloud migration.',
]) {
  const out = audit(cvWith(['Manager, Payroll Operations - Sub Saharan'], good),
    'Manager, Payroll Operations - Sub Saharan', ['payroll']);
  const lines = out.cvText.split('\n');
  const summary = lines[lines.findIndex((l) => /PROFESSIONAL SUMMARY/.test(l)) + 1];
  t('  "' + good.slice(0, 46) + '..." survives', summary === good, JSON.stringify(summary));
}

console.log('\nAND A REBUILD IS NEVER WORSE THAN WHAT IT REPLACES');
{
  // One employer, no quantified bullet: there is nothing better to
  // write, so the writer's sentence stands and the separate warning
  // names the closer true title instead.
  const thin = ['Maxmilliam Okafor', 'Reinsurance Analyst', 'Dublin | max@example.invalid', '',
    'PROFESSIONAL SUMMARY',
    'Experienced Software Engineer who has shipped payment services end to end.', '',
    'PROFESSIONAL EXPERIENCE', 'Citigroup August 2017 - March 2021', 'Data Analyst',
    '- Rebuilt the credit risk reporting suite in SQL and Python.', '',
    'TECHNICAL SKILLS', 'Programming: SQL', '', 'EDUCATION', 'Imperial'].join('\n');
  const out = RA.runRecruiterAudit({ cvText: thin, jdText: 'reinsurance',
    jdTitle: 'Reinsurance Analyst', jobKeywords: { all: [] }, experience: [] });
  const lines = out.cvText.split('\n');
  const summary = lines[lines.findIndex((l) => /PROFESSIONAL SUMMARY/.test(l)) + 1];
  t('  the thin rebuild is refused',
    /Experienced Software Engineer/.test(summary) && !/Citigroup/.test(summary),
    JSON.stringify(summary));
  t('  ...and the warning still names the closer true title',
    out.report.warnings.some((w) => w.kind === 'summary-names-another-profession'
      && w.better === 'Data Analyst'),
    JSON.stringify(out.report.warnings.map((w) => w.kind)));
}

console.log('\nAND THE FIX IS REPORTED, NOT SLIPPED IN');
{
  const bad = 'Manager of Payroll Operations with a strong background in operational excellence.';
  const out = audit(cvWith(['Manager, Payroll Operations - Sub Saharan'], bad),
    'Manager, Payroll Operations - Sub Saharan', ['payroll']);
  t('  a fix line explains the rewrite',
    out.report.fixes.some((f) => /Rewrote the professional summary/.test(f)),
    JSON.stringify(out.report.fixes.filter((f) => /summary/i.test(f))));
  t('  ...and the original is kept so it can be compared',
    out.report.warnings.some((w) => w.kind === 'summary-rebuilt-from-facts'
      && /Payroll Operations/i.test(w.was || '')),
    JSON.stringify(out.report.warnings.map((w) => w.kind)));
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
