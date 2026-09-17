// THE FILE THE EMPLOYER ACTUALLY READS.
//
// Every coverage number in this extension has been measured against a
// string held in memory: the text we MEANT to write. The file that
// reaches the employer is a .docx built from that string by a separate
// renderer, and until now nothing ever read it back.
//
// That gap is where the worst bugs in this project have lived. A second
// scorer reported a number for a document nobody sent. The PDF fallback
// silently dropped every injected keyword. The recruiter audit rewrote
// the CV after the coverage pass had measured it. Each time the number
// described one document and the employer received another, and each
// time it took a real application to notice.
//
// An applicant tracking system does not read the page. It reads the text
// layer, which for a .docx is word/document.xml. So that is what this
// reads: the actual bytes of the actual attachment.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
global.window = global;
// The generator announces itself on load; keep the test output readable.
const realConsole = console;
global.console = Object.assign({}, realConsole, { log() {} });
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'docx-generator.js'));
require(path.join(DIR, 'docx-verify.js'));
global.console = realConsole;
const D = global.DocxGenerator;
const V = global.DocxVerify;

const CV = ['Maxmilliam Okafor', 'Data Engineer',
  'Dublin, Ireland | +353 087 426 1508 | maxokafordev@gmail.com',
  'https://linkedin.com/in/maxokafor', '',
  'PROFESSIONAL SUMMARY',
  'Data engineer with eight years building pipelines in Python and SQL.', '',
  'TECHNICAL SKILLS',
  'Programming: Python, SQL, C++',
  'Cloud & DevOps: AWS, Kubernetes, Docker',
  'Data Engineering: Airflow, Snowflake, dbt', '',
  'PROFESSIONAL EXPERIENCE',
  'Meta | Software Engineer | January 2023 - Present',
  '• Built pipelines in Python and Airflow serving 2.6bn events daily.', '',
  'EDUCATION',
  'Imperial College London',
  'MSc Artificial Intelligence and Machine Learning',
  'University of Derby',
  'BSc Computer Science'].join('\n');

const built = D.fromCvText(CV, { name: 'Maxmilliam_Okafor', filename: 'Maxmilliam_Okafor.docx' });
const KEYWORDS = ['Python', 'SQL', 'C++', 'AWS', 'Kubernetes', 'Docker', 'Airflow',
  'Snowflake', 'dbt', 'Machine Learning', 'Computer Science'];
const report = V.verify(built.base64, {
  name: 'Maxmilliam Okafor', email: 'maxokafordev@gmail.com', keywords: KEYWORDS,
});

console.log('THE ATTACHMENT IS A REAL DOCX AND ITS TEXT LAYER READS');
{
  t('  the generator produced one', built.success && !!built.base64, 'no attachment');
  t('  it is a zip', V.toBytes(built.base64)[0] === 0x50, 'not a zip');
  t('  word/document.xml is in it', report.entries.includes('word/document.xml'),
    report.entries.join(', '));
  t('  and it parses with no problems', report.ok, report.problems.join('; '));
  t('  ...producing actual text', report.text.length > 200, report.text.length + ' chars');
}

console.log('\nTHE CONTACT DETAILS ARE LITERAL TEXT, NOT ONLY A LINK');
{
  // A detail carried only by a hyperlink target is in the rels part,
  // which no parser reads, and the page still looks complete.
  t('  the email address is in the text layer',
    report.text.indexOf('maxokafordev@gmail.com') !== -1, report.text.slice(0, 200));
  t('  the phone number is too', /\+353/.test(report.text), report.text.slice(0, 200));
  t('  ...and no problem was raised about either',
    !report.problems.some((p) => /email|phone/i.test(p)), report.problems.join('; '));
}

console.log('\nTHE READING ORDER IS THE ORDER A PERSON READS');
{
  const lines = report.text.split('\n').filter((l) => l.trim());
  t('  the name is the first thing a parser sees', /Maxmilliam Okafor/.test(lines[0]), lines[0]);
  const at = (h) => report.text.indexOf(h);
  t('  summary, then experience, then education',
    at('PROFESSIONAL SUMMARY') < at('PROFESSIONAL EXPERIENCE')
      && at('PROFESSIONAL EXPERIENCE') < at('EDUCATION'),
    'sections interleaved, which is what a multi-column layout does');
}

console.log('\nEVERY SECTION SURVIVES THE RENDER');
{
  for (const heading of ['PROFESSIONAL SUMMARY', 'TECHNICAL SKILLS',
    'PROFESSIONAL EXPERIENCE', 'EDUCATION']) {
    t('  ' + heading.padEnd(24) + ' is in the delivered file',
      report.text.indexOf(heading) !== -1, 'lost between the string and the file');
  }
  t('  ...and the degrees with it',
    /Imperial College London/.test(report.text) && /BSc Computer Science/.test(report.text),
    'education rendered as a heading with nothing under it');
}

console.log('\nAND NOTHING IS GARBLED ON THE WAY OUT');
{
  t('  no unmapped glyphs or replacement characters',
    !/\(cid:\d+\)|�/.test(report.text), 'a parser would see garbage here');
  // Technical punctuation is where XML escaping goes wrong.
  t('  C++ survived the XML escape', /C\+\+/.test(report.text), 'punctuation was mangled');
  t('  the ampersand in "Cloud & DevOps" survived',
    /Cloud & DevOps/.test(report.text), 'the raw &amp; reached the text layer');
  t('  and the bullet did not become a question mark',
    !/\?\s*Built pipelines/.test(report.text), report.text.slice(report.text.indexOf('Built') - 10, 60));
}

console.log('\nCOVERAGE IS MEASURED ON THE FILE, NOT ON THE STRING');
{
  t('  a coverage report is produced', !!report.coverage, 'no coverage measured');
  t('  ...and every requirement is genuinely in the attachment',
    report.coverage.score === 100, report.coverage.missing.join(', '));
  t('  ...counted with the taxonomy, so "C++" is not lost to punctuation',
    report.coverage.matched.includes('C++'), report.coverage.matched.join(', '));
}

console.log('\nAND IT REPORTS WHAT IS MISSING RATHER THAN ASSUMING');
{
  // A CV with no education heading is exactly what this is for: the old
  // fixture in this repo had none, and nothing in the extension noticed.
  const noEdu = CV.slice(0, CV.indexOf('EDUCATION'));
  const r = V.verify(D.fromCvText(noEdu, { name: 'X', filename: 'x.docx' }).base64, {});
  t('  a missing education section is reported',
    r.warnings.some((w) => /education/i.test(w)), r.warnings.join('; '));

  const gap = V.verify(built.base64, { keywords: ['Python', 'Salesforce', 'Workday'] });
  t('  requirements absent from the file are named',
    gap.coverage.missing.includes('Salesforce') && gap.coverage.missing.includes('Workday'),
    JSON.stringify(gap.coverage));
  t('  ...and the ones present are not', gap.coverage.matched.includes('Python'),
    JSON.stringify(gap.coverage.matched));
}

console.log('\nAND IT NEVER TAKES THE RUN DOWN WITH IT');
{
  // A verifier that throws would be worse than the bug it looks for.
  for (const [name, input] of [['empty string', ''], ['null', null],
    ['not a zip', 'aGVsbG8gd29ybGQ='], ['undefined', undefined],
    ['garbage base64', '!!!!not base64!!!!']]) {
    let threw = false;
    let out = null;
    try { out = V.verify(input, {}); } catch (e) { threw = true; }
    t('  ' + name.padEnd(16) + ' is reported, not thrown', !threw && out && !out.ok,
      threw ? 'it threw' : JSON.stringify(out && out.problems));
  }
}

console.log('\nAND THE EXTENSION ACTUALLY RUNS IT');
{
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  the tailoring flow calls it after building the attachment',
    /this\.verifyDeliveredCv\(\);/.test(src), 'the check exists but nothing runs it');
  t('  ...and it reads the built docx, not the source string',
    /V\.verify\(docx, \{/.test(src), 'it would be measuring the string again');
  // Both loaders, because they are different places and the last module
  // shipped registered in one and loaded in neither.
  const html = fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8');
  t('  popup.html loads it', /<script src="docx-verify\.js">/.test(html),
    'it would never run in the popup, which is where popup.js lives');
  t('  ...after the generator whose output it reads',
    html.indexOf('docx-generator.js') < html.indexOf('docx-verify.js'), 'load order');
  const manifest = fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8');
  t('  and the manifest registers it', /docx-verify\.js/.test(manifest), 'not registered');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
