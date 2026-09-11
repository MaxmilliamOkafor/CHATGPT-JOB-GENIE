// THE DOCUMENT WENT OUT WITH NO EDUCATION IN IT.
//
// A generated CV carried a summary, four employers, a skills block and
// three projects, and no EDUCATION heading anywhere. Both degrees were
// in the saved profile the whole time.
//
// The section is composed by the tailoring service, and when a response
// came back without one, nothing downstream noticed. The coverage pass
// only ever touches skills. The DOCX renderer can only lay out sections
// that exist in the text it is handed, and it is handed
// generatedDocuments.cv. So a response that quietly dropped education
// produced a file missing it, every time, with no error raised.
//
// Education is not something to tailor or regenerate. It is a fact held
// in the profile. If the section is absent it is rebuilt from the
// profile verbatim -- nothing invented, nothing reworded -- and if the
// profile has no education either, nothing is added.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));
const _log = console.log;
console.log = () => {};
require(path.join(DIR, 'openresume-generator.js'));
console.log = _log;
const OR = global.OpenResumeGenerator;
const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: global.KeywordTaxonomy },
  KeywordTaxonomy: global.KeywordTaxonomy, document: { addEventListener() {} },
  console: { log() {}, warn() {}, error() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const popup = Object.create(sandbox.P.prototype);

// The shape that shipped: everything except education.
const CV = ['Maxmilliam Okafor', 'Manager, Payroll Operations', 'Dublin, Ireland | max@example.invalid', '',
  'PROFESSIONAL SUMMARY', 'Payroll operations across multiple countries.', '',
  'PROFESSIONAL EXPERIENCE', 'Meta January 2023 - Present', 'Software Engineer',
  '- Built backend services in Python.', '',
  'TECHNICAL SKILLS', 'Programming: Python, SQL', '',
  'PROJECTS', 'SignalDesk Python, FastAPI',
  '- Streams live financial news through an LLM.'].join('\n');

// His profile: one degree with no years saved at all, one with both.
const PROFILE = { education: [
  { institution: 'Imperial College London', degree: 'MSc Computing',
    field_of_study: 'Computer Science', start_year: '', end_year: '' },
  { institution: 'University of Manchester', degree: 'BSc Computer Science',
    field_of_study: 'Computer Science', start_year: '2014', end_year: '2017' }] };

const fixed = popup.ensureEducationSection(CV, PROFILE);

console.log('THE SECTION COMES BACK');
{
  t('  the shipped CV really had none', !/^EDUCATION$/m.test(CV), 'the premise is wrong');
  t('  ...and now it does', /^EDUCATION$/m.test(fixed), 'still missing');
  for (const want of ['Imperial College London', 'MSc Computing',
    'University of Manchester', 'BSc Computer Science']) {
    t('    ' + want.padEnd(26) + ' is on the page', fixed.indexOf(want) !== -1, 'dropped');
  }
  t('  the years that exist are shown', /University of Manchester 2014 - 2017/.test(fixed),
    'dates lost');
}

console.log('\nAND A DEGREE WITH NO YEARS IS STILL A DEGREE');
{
  // Both his rows had empty year fields. "undefined - undefined" or a
  // dropped entry would be worse than no dates at all.
  t('  no undefined reaches the document', !/undefined|null|NaN/.test(fixed),
    fixed.slice(fixed.indexOf('EDUCATION')));
  t('  ...and the entry is kept anyway',
    /Imperial College London\s*\n\s*MSc Computing/.test(fixed),
    fixed.slice(fixed.indexOf('EDUCATION')));
  t('  ...with no empty date separator left behind',
    !/Imperial College London\s+-\s*$/m.test(fixed), 'a dangling dash');
}

console.log('\nTHE SUBJECT IS NOT NAMED TWICE');
{
  // "MSc Computing" does not CONTAIN "Computer Science", so a substring
  // test appended it and produced "MSc Computing, Computer Science".
  t('  a degree that already names its subject is left alone',
    fixed.indexOf('MSc Computing, Computer Science') === -1,
    'the subject was written twice');
  const bare = popup.ensureEducationSection(CV,
    { education: [{ institution: 'UCD', degree: 'BSc', field_of_study: 'Physics' }] });
  t('  ...but a bare level gets its subject', /BSc Physics/.test(bare),
    bare.slice(bare.indexOf('EDUCATION')));
  const only = popup.ensureEducationSection(CV,
    { education: [{ institution: 'UCD', field_of_study: 'Physics' }] });
  t('  ...and a row with only a subject still says something',
    /Physics/.test(only), only.slice(only.indexOf('EDUCATION')));
}

console.log('\nIT NEVER RUNS TWICE, AND NEVER INVENTS');
{
  t('  a CV that already has education is untouched',
    popup.ensureEducationSection(fixed, PROFILE) === fixed, 'a second section was added');
  t('  ...including one written as ACADEMIC QUALIFICATIONS',
    popup.ensureEducationSection(CV + '\n\nACADEMIC QUALIFICATIONS\nUCD\nBSc Physics',
      PROFILE).indexOf('Imperial') === -1, 'duplicated under a second heading');
  t('  a profile with no education adds nothing',
    popup.ensureEducationSection(CV, { education: [] }) === CV, 'something was invented');
  t('  ...and neither does a missing profile',
    popup.ensureEducationSection(CV, null) === CV, 'something was invented');
  t('  an empty CV is left alone', popup.ensureEducationSection('', PROFILE) === '',
    'wrote into nothing');
}

console.log('\nAND A DEGREE IS NOT READ AS A SECOND UNIVERSITY');
{
  // The generator understood only "Institution | Degree | Dates" and
  // made every other line its own entry, so a CV written the ordinary
  // way rendered as two schools with no qualification between them.
  const parsed = OR.parseEducationText(
    'Imperial College London\nMSc Computing\n\nUniversity of Manchester 2014 - 2017\n'
    + 'BSc Computer Science');
  t('  four lines are two degrees', parsed.length === 2,
    parsed.length + ': ' + JSON.stringify(parsed));
  t('  ...each with its institution', parsed[0].institution === 'Imperial College London'
    && parsed[1].institution === 'University of Manchester',
    JSON.stringify(parsed.map((e) => e.institution)));
  t('  ...and its qualification', parsed[0].degree === 'MSc Computing'
    && parsed[1].degree === 'BSc Computer Science',
    JSON.stringify(parsed.map((e) => e.degree)));
  t('  the trailing years become dates, not part of the name',
    parsed[1].dates === '2014 - 2017', JSON.stringify(parsed[1]));
  t('  ...and a place name is not mistaken for a month',
    parsed[1].institution.indexOf('Manchester') !== -1,
    'the institution was truncated at a capitalised word');

  const piped = OR.parseEducationText('Trinity College Dublin | BA History | 2010 - 2013 | 2:1');
  t('  the pipe form still works', piped.length === 1 && piped[0].degree === 'BA History'
    && piped[0].gpa === '2:1', JSON.stringify(piped));

  const graded = OR.parseEducationText('UCD 2016 - 2019\nBSc Physics, First-Class Honours');
  t('  and a classification is read off the degree line',
    graded.length === 1 && /First-Class/i.test(graded[0].gpa)
      && graded[0].degree === 'BSc Physics', JSON.stringify(graded));
}

console.log('\nAND IT SURVIVES THE PDF PIPELINE');
{
  const structured = OR.parseAndStructureCV(fixed, { first_name: 'Maxmilliam',
    last_name: 'Okafor', email: 'max@example.invalid', phone: '+353871234567' });
  OR.sanitiseStructuredData(structured);
  const rendered = OR.generateCVText(structured);
  t('  the delivered document has an education section',
    /\nEDUCATION\n/.test(rendered), 'lost between the CV text and the PDF');
  for (const want of ['Imperial College London', 'University of Manchester',
    'BSc Computer Science']) {
    t('    ' + want.padEnd(26) + ' reaches the file', rendered.indexOf(want) !== -1, 'dropped');
  }
}

console.log('\nAND THE TAILORING FLOW ACTUALLY CALLS IT');
{
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  on the same CV the DOCX is built from',
    /generatedDocuments\.cv = this\.ensureEducationSection\(this\.generatedDocuments\.cv/.test(src),
    'the repair exists but nothing runs it');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
