// EIGHTY LABEL RULES, FIFTY-THREE KEYS THE PROFILE DOES NOT HAVE.
//
// A field-by-field audit against a realistic application form -- the
// seventy-nine labels below, taken from Greenhouse, Workday, Lever,
// Ashby, SmartRecruiters and iCIMS -- found twenty-six of them coming
// back EMPTY on a profile that held the answer, and one coming back
// WRONG.
//
// The empties were nearly all one fault: the rules read a key the
// profile does not store.
//
//   the rules read        the profile stores
//   postal_code, zip      zip_code
//   degree                highest_education
//   ethnicity, race       race_ethnicity
//   drivers_license       driving_license
//   sponsorship_required  visa_required
//   years                 total_experience
//   school, major         inside education[]
//   current_company       inside professional_experience[]
//
// Postal code, degree, field of study and current employer are
// required on most applications, and every one of them was blank while
// the data sat in the row. Fixed once, in normaliseProfile, rather
// than by threading "|| P.other_name" through eighty rules -- so the
// adapter is the single readable list of what maps to what.
//
// The WRONG one was worse than any blank: "Phone Type" is a dropdown
// offering Mobile, Home and Work, and it matched the /phone/ rule, so a
// live form was submitted with "+353 874 261 508" typed into it.
//
// This file is that audit, kept. A rule that stops finding its data is
// a field the applicant has to fill in by hand and probably will not
// notice.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), Module = require('module');
const DIR = path.join(__dirname, '..');
global.window = global;
{
  const file = path.join(DIR, 'autofill-core.js');
  const m = new Module(file, null); m.filename = file;
  m.paths = Module._nodeModulePaths(DIR);
  m._compile(fs.readFileSync(file, 'utf8'), file);
}
const C = global.AutofillCore;

// THE ROW AS THE WEBSITE ACTUALLY STORES IT -- the column names from
// the profiles table, not the ones the rules used to hope for.
const ROW = {
  first_name: 'Maxmilliam', last_name: 'Okafor', email: 'max@example.invalid',
  phone: '+353 874 261 508',
  address: '12 Example Street', city: 'Dublin', state: '', zip_code: 'D02 X285',
  country: 'Ireland', citizenship: 'EU Citizen',
  linkedin: 'https://linkedin.com/in/example', github: 'https://github.com/example',
  portfolio: 'https://example.invalid',
  expected_salary: '85000', notice_period: '1 month',
  // highest_education is left empty on purpose: the level has to be
  // derivable from the qualification line, because that is the state a
  // real profile is in until someone fills the column in.
  total_experience: '8', highest_education: '',
  willing_to_relocate: true, driving_license: true, visa_required: false,
  work_authorized_countries: ['IE'],
  // THE SHAPES THE PROFILE ACTUALLY USES, not the ones this code hoped
  // for. There is no field_of_study: the subject sits inside the degree
  // line, after "in" and before the grade. There is no graduation_year
  // either -- it is end_year. And an experience entry has no `dates`:
  // the current role is marked by endDate "Present" and by dateRange.
  education: [{ degree: 'Master of Science in Artificial Intelligence and Machine Learning'
      + ' - Distinction (3.90/4.00)',
    institution: 'Trinity College Dublin', school: 'Trinity College Dublin',
    start_year: '2017', end_year: '2018' }],
  professional_experience: [
    { company: 'Stripe', title: 'Staff Software Engineer',
      dateRange: 'January 2022 - Present', endDate: 'Present' },
    { company: 'Revolut', title: 'Software Engineer',
      dateRange: '2018 - 2022', endDate: '2022' }],
  cover_letter: 'Dear Hiring Manager, I build payment systems.',
};

console.log('THE COLUMN NAMES THE PROFILE ACTUALLY USES');
for (const [label, want] of [
  ['Postal Code', 'D02 X285'],
  ['Zip Code', 'D02 X285'],
  ['Highest level of education completed', "Master's Degree"],
  ['Degree', "Master's Degree"],
  ['Field of Study', 'Artificial Intelligence and Machine Learning'],
  ['Major', 'Artificial Intelligence and Machine Learning'],
  ['School', 'Trinity College Dublin'],
  ['University', 'Trinity College Dublin'],
  ['Graduation Year', '2018'],
  ['Current Company', 'Stripe'],
  ['Current Employer', 'Stripe'],
  ['Current Title', 'Staff Software Engineer'],
  ['Years of experience', '8'],
]) {
  const got = C.answerFor(label, ROW);
  t('  ' + label.padEnd(38) + ' -> ' + want, got === want, JSON.stringify(got));
}

console.log('\nAND THE ONE THAT WAS WORSE THAN BLANK');
{
  const got = C.answerFor('Phone Type', ROW);
  t('  a phone NUMBER never lands in "Phone Type"', !/\d{4}/.test(String(got)), JSON.stringify(got));
  t('  ...it gets a phone TYPE', got === 'Mobile', JSON.stringify(got));
  t('  and the number still reaches the number field',
    C.answerFor('Phone', ROW) === '+353 874 261 508', C.answerFor('Phone', ROW));
  t('  and the country code is read off the number',
    C.answerFor('Phone Country Code', ROW) === '+353', C.answerFor('Phone Country Code', ROW));
}

console.log('\nA STATE OR A HOME NATION NAMES ITS COUNTRY');
for (const [question, want] of [
  ['Are you authorized to work in California?', 'No'],
  ['Are you legally authorised to work in England?', 'Yes'],
  ['Do you have the right to work in Ontario?', 'No'],
  ['Are you authorized to work in New York without sponsorship?', 'No'],
]) {
  t('  "' + question.slice(0, 52) + '" -> ' + want,
    C.yesNoFor(question, ROW) === want, C.yesNoFor(question, ROW));
}
{
  t('  and the country list is what decides, not the state name',
    C.yesNoFor('Are you authorized to work in Texas?',
      Object.assign({}, ROW, { work_authorized_countries: ['IE', 'US'] })) === 'Yes',
    'a stated US authorisation was ignored');
  // Georgia is a country as well as a state; a guess there costs the
  // application, so it is deliberately not in the table.
  t('  Georgia is not resolved to a country', C.countryInQuestion('authorised to work in Georgia') === '',
    C.countryInQuestion('authorised to work in Georgia'));
}

console.log('\nTHE EEO BLOCK IS ANSWERED, NOT LEFT TO BLOCK THE FORM');
for (const label of ['Gender', 'Race/Ethnicity', 'Hispanic or Latino?', 'Veteran Status',
  'Disability Status', 'Are you LGBTQ+?', 'Do you identify as transgender?']) {
  const got = C.answerFor(label, ROW);
  t('  ' + label.padEnd(34) + ' declines', C._isDecline(got), JSON.stringify(got));
}
{
  t('  and a stated answer always wins over declining',
    C.answerFor('Gender', Object.assign({}, ROW, { gender: 'Male' })) === 'Male',
    C.answerFor('Gender', Object.assign({}, ROW, { gender: 'Male' })));
}

console.log('\nWHAT THE HISTORY ITSELF PROVES');
{
  t('  a role with no end date means currently employed',
    C.yesNoFor('Are you currently employed?', ROW) === 'Yes',
    C.yesNoFor('Are you currently employed?', ROW));
  const past = Object.assign({}, ROW, {
    professional_experience: [{ company: 'Stripe', title: 'Engineer', dates: '2018 - 2022' }],
  });
  t('  ...and a history that has ended does not claim it',
    C.yesNoFor('Are you currently employed?', past) === '',
    C.yesNoFor('Are you currently employed?', past));
}

console.log('\nTHE SUBJECT IS INSIDE THE DEGREE LINE');
for (const [line, subject, level] of [
  ['Master of Science in Artificial Intelligence and Machine Learning - Distinction (3.90/4.00)',
    'Artificial Intelligence and Machine Learning', "Master's Degree"],
  ['BSc Computer Science', 'Computer Science', "Bachelor's Degree"],
  ['Bachelor of Arts, Economics', 'Economics', "Bachelor's Degree"],
  ['PhD in Statistics', 'Statistics', 'PhD'],
  ['Higher Diploma in Data Analytics', 'Data Analytics', 'Higher Diploma'],
]) {
  t('  "' + line.slice(0, 44) + '" -> ' + subject,
    C._fieldOfStudy(line) === subject, JSON.stringify(C._fieldOfStudy(line)));
  t('    ...and reads as ' + level, C._degreeLevel(line) === level,
    JSON.stringify(C._degreeLevel(line)));
}
{
  // A LEVEL BOX IS A SELECT. Seventy characters of degree title and
  // grade match none of its options and fail validation.
  const got = C.answerFor('Highest level of education completed', ROW);
  t('  a level box gets the level, not the whole line',
    got === "Master's Degree", JSON.stringify(got));
  t('  ...with no grade in it', !/distinction|3\.90/i.test(String(got)), JSON.stringify(got));
}

console.log('\nAND AN EMPTY YEAR IS LEFT EMPTY, NOT GUESSED');
{
  const noYears = Object.assign({}, ROW, {
    education: [{ degree: 'BSc Computer Science', school: 'DCU', start_year: '', end_year: '' }],
  });
  t('  graduation year stays blank when the profile has none',
    C.answerFor('Graduation Year', noYears) === '',
    JSON.stringify(C.answerFor('Graduation Year', noYears)));
  t('  ...and end_year fills it when it is there',
    C.answerFor('Graduation Year', ROW) === '2018', C.answerFor('Graduation Year', ROW));
}

console.log('\nTHE CURRENT ROLE IS MARKED BY endDate, NOT BY dates');
{
  const byEndDate = { professional_experience: [
    { company: 'Stripe', title: 'Engineer', endDate: 'Present' }] };
  const byRange = { professional_experience: [
    { company: 'Stripe', title: 'Engineer', dateRange: 'January 2023 - Present' }] };
  t('  endDate "Present" says currently employed',
    C.yesNoFor('Are you currently employed?', byEndDate) === 'Yes',
    C.yesNoFor('Are you currently employed?', byEndDate));
  t('  ...and so does dateRange on its own',
    C.yesNoFor('Are you currently employed?', byRange) === 'Yes',
    C.yesNoFor('Are you currently employed?', byRange));
  t('  and years of experience reads dateRange too',
    Number(C.answerFor('Years of experience', byRange)) >= 1,
    JSON.stringify(C.answerFor('Years of experience', byRange)));
}

console.log('\nAND THE TRAPS STILL CATCH');
for (const [label, why] of [
  ['Name of referring employee', 'asks for a person we do not have'],
  ['Please state your eligibility', '"state" is a verb here, not a region'],
  ['Middle Name', 'nothing in the profile says'],
]) {
  t('  ' + label.padEnd(30) + ' stays empty (' + why + ')',
    C.answerFor(label, ROW) === '', JSON.stringify(C.answerFor(label, ROW)));
}
{
  // The adapter must not invent: a row with no education or history
  // answers nothing rather than reaching for a neighbouring field.
  const bare = { first_name: 'Max', last_name: 'Okafor' };
  for (const label of ['School', 'Field of Study', 'Current Company', 'Postal Code', 'Degree']) {
    t('  ' + label.padEnd(30) + ' is empty when the row is',
      C.answerFor(label, bare) === '', JSON.stringify(C.answerFor(label, bare)));
  }
}

console.log('\nAND THE ADAPTER NEVER MUTATES THE CALLER\'S ROW');
{
  const before = JSON.stringify(ROW);
  C.answerFor('Postal Code', ROW);
  C.answerFor('Degree', ROW);
  t('  the profile object is untouched', JSON.stringify(ROW) === before,
    'the adapter wrote back into the stored profile');
  const adapted = C.normaliseProfile(ROW);
  t('  ...and the adapted copy carries the derived keys',
    adapted.postal_code === 'D02 X285' && adapted.degree_level === "Master's Degree"
      && adapted.major === 'Artificial Intelligence and Machine Learning'
      && adapted.current_company === 'Stripe',
    JSON.stringify({ postal_code: adapted.postal_code, degree_level: adapted.degree_level,
      major: adapted.major, current_company: adapted.current_company }));
  t('  ...and adapting twice gives the same object',
    C.normaliseProfile(ROW) === adapted, 'the adapter re-runs on every field');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
