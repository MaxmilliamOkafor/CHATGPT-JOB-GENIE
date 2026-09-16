// HE HAD DELIBERATELY REMOVED THE DATES, AND THE TOOL PUT THEM BACK.
//
// A graduation year dates a candidate to within a year or two, and it
// is one of the standard age proxies. He had taken the years off his
// education on purpose; the rebuild wrote them again from the profile,
// and the tailoring service wrote them whenever it composed the section
// itself.
//
// This is the principle the summary work already settled on: keep off
// the page the things a reader forms a prior from before reading any
// substance. Employer prestige, total years, place names, and this.
//
// WHAT STAYS. Employment dates: a reader needs the shape of a career
// and their absence is conspicuous in a way a missing degree year is
// not. And the years stay in the PROFILE, because application forms
// demand a graduation year and autofill reads it from the education
// row, never from this text. Nothing is lost by leaving it off the
// document a human reads.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));
const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: global.KeywordTaxonomy },
  KeywordTaxonomy: global.KeywordTaxonomy, document: { addEventListener() {} },
  console: { log() {}, warn() {}, error() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const popup = Object.create(sandbox.P.prototype);

const CV = ['Candidate Name', 'Engineer', 'Dublin | c@example.invalid', '',
  'PROFESSIONAL EXPERIENCE', 'Meta January 2023 - Present', 'Software Engineer',
  '- Rebuilt the pipeline, cutting the 2019 - 2021 backlog.', '',
  'TECHNICAL SKILLS', 'Programming: Python, SQL'].join('\n');

// Years ARE saved on the profile. That is where autofill needs them.
const PROFILE = { education: [
  { institution: 'Northgate University', degree: 'MSc Machine Learning',
    start_year: 'August 2020', end_year: 'June 2021' },
  { institution: 'Riverside College', degree: 'BSc Computer Science',
    start_year: 'August 2016', end_year: 'July 2020' }] };

console.log('THE REBUILD WRITES THE DEGREES AND NOT THE YEARS');
{
  const built = popup.ensureEducationSection(CV, PROFILE);
  const section = built.slice(built.indexOf('EDUCATION'));
  t('  both institutions are there',
    /Northgate University/.test(section) && /Riverside College/.test(section), section);
  t('  both qualifications are there',
    /MSc Machine Learning/.test(section) && /BSc Computer Science/.test(section), section);
  t('  and no year appears anywhere in the section', !/(?:19|20)\d{2}/.test(section), section);
  t('  ...nor a month', !/\b(?:January|August|June|July|Sept?|Aug|Jun|Jul)\b/.test(section), section);
  t('  the years are still on the profile, untouched',
    PROFILE.education[0].end_year === 'June 2021', 'the profile was mutated');
}

console.log('\nAND A SECTION THE SERVICE COMPOSED LOSES THEM TOO');
{
  // Rebuilding without dates only covers the case where the section was
  // MISSING. When the service returns one it writes the years it finds,
  // and the same exposure is back through the other door.
  const served = ['Candidate Name', '', 'PROFESSIONAL EXPERIENCE',
    'Meta January 2023 - Present', 'Software Engineer',
    '- Cut the 2019 - 2021 backlog.', '',
    'EDUCATION',
    'Northgate University August 2020 - June 2021',
    'MSc Machine Learning',
    'Riverside College | BSc Computer Science | 2016 - 2020',
    'Trinity College Dublin',
    '2014',
    'BA History',
    'Class of 2012',
    "St Anne's, Sept 2009 - Jul 2011", '',
    'TECHNICAL SKILLS', 'Programming: Python'].join('\n');
  const out = popup.stripEducationDates(served);
  const section = out.slice(out.indexOf('EDUCATION'), out.indexOf('TECHNICAL SKILLS'));

  t('  a trailing month-year range goes', !/August 2020/.test(section), section);
  t('  a pipe-separated range goes', !/2016 - 2020/.test(section), section);
  t('  a bare year on its own line goes', !/^\s*2014\s*$/m.test(section), section);
  t('  "Class of 2012" goes', !/Class of/i.test(section), section);
  t('  an abbreviated month range goes', !/Sept 2009/.test(section), section);
  t('  no year survives at all', !/(?:19|20)\d{2}/.test(section), section);

  t('  every institution survives',
    ['Northgate University', 'Riverside College', 'Trinity College Dublin', "St Anne's"]
      .every((s) => section.indexOf(s) !== -1), section);
  t('  every qualification survives',
    ['MSc Machine Learning', 'BSc Computer Science', 'BA History']
      .every((s) => section.indexOf(s) !== -1), section);
  t('  ...and a trailing separator is not left behind',
    !/[|,-]\s*$/m.test(section.trim()), JSON.stringify(section));

  console.log('\nBUT EMPLOYMENT DATES ARE NOT TOUCHED');
  {
    const exp = out.slice(out.indexOf('PROFESSIONAL EXPERIENCE'), out.indexOf('\nEDUCATION'));
    t('  the role still carries its dates', /January 2023 - Present/.test(exp), exp);
    t('  ...and a year inside a bullet is left alone', /2019 - 2021/.test(exp), exp);
  }

  console.log('\nAND IT IS SAFE TO RUN TWICE');
  {
    t('  a second pass changes nothing', popup.stripEducationDates(out) === out,
      'not idempotent');
    t('  a CV with no education section is returned unchanged',
      popup.stripEducationDates(CV) === CV, 'something was edited');
    t('  ...and so is an empty one', popup.stripEducationDates('') === '', 'wrote into nothing');
  }
}

console.log('\nTHE FORM STILL GETS A GRADUATION YEAR');
{
  // The CV and the application form are different audiences. A form
  // field that demands a year is answered from the profile row, so
  // taking the year off the document costs nothing there.
  const core = fs.readFileSync(path.join(DIR, 'autofill-core.js'), 'utf8');
  t('  autofill reads graduation_year from the education row',
    /take\('graduation_year',\s*_firstOf\(p\.education/.test(core),
    'autofill would have to read it off the CV text');
  t('  ...including end_year, which is what is actually saved',
    /take\('graduation_year',[^)]*\[[^\]]*'end_year'/.test(core.replace(/\s+/g, ' ')),
    'the saved field is not among those read');
}

console.log('\nAND THE FLOW APPLIES IT');
{
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  on the CV the DOCX is built from',
    /generatedDocuments\.cv = this\.stripEducationDates\(this\.generatedDocuments\.cv\)/.test(src),
    'the guard exists but nothing runs it');
  t('  ...after the section is restored, not before',
    src.indexOf('this.ensureEducationSection(this.generatedDocuments.cv')
      < src.indexOf('this.stripEducationDates(this.generatedDocuments.cv'),
    'a restored section would keep its dates');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
