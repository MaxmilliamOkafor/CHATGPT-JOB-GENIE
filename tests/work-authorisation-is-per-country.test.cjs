// EVERY APPLICATION ON EARTH GOT THE SAME TWO ANSWERS.
//
//   DEFAULTS = { authorized: 'Yes', sponsorship: 'No', ... }
//
// Returned for every posting in every country. For an applicant with
// Irish citizenship that is true of Ireland, the EEA and the UK -- the
// Common Travel Area -- and false of the United States, Brazil, Canada
// and everywhere else.
//
// It fails in the direction that LOOKS like success. A blanket "yes,
// authorised" and "no, no sponsorship needed" clears the knockout
// filter, so the application reaches a human, and the first screening
// call establishes that the form said something untrue. That does not
// read as a form-filling bug to a recruiter. It ends the conversation,
// and at that employer it ends the next one too.
//
// THE OVERCORRECTION WAS ITS OWN FAULT.
//
// A later rewrite answered NOTHING unless a hand-written country array
// was present -- so "are you authorised to work in Ireland", asked of
// an Irish citizen, went unanswered on a required field. An unanswered
// required question is a rejection too.
//
// The line sits where the fact is: RESIDENCE proves nothing (a person
// on a study visa lives in Ireland), CITIZENSHIP is a legal fact the
// applicant has stated in their own profile, and the rights that come
// with it are matters of law rather than guesses. Nothing here guesses
// in the applicant's favour: a country the profile does not claim is
// answered honestly, which may cost the application, which is the
// correct outcome for a job they cannot lawfully take.
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
const A = global.AutofillCore;
const IE = { city: 'Dublin', country: 'Ireland', citizenship: 'Irish' };

console.log('AN IRISH CITIZEN, ASKED ABOUT EACH COUNTRY');
for (const [country, want] of [
  ['Ireland', 'Yes'],
  ['the United Kingdom', 'Yes'],     // Common Travel Area
  ['Germany', 'Yes'],                // EEA
  ['the Netherlands', 'Yes'],
  ['the United States', 'No'],
  ['Canada', 'No'],
  ['Brazil', 'No'],
  ['Australia', 'No'],
  ['Singapore', 'No'],
]) {
  const q = 'Are you legally authorised to work in ' + country + '?';
  t('  ' + country.padEnd(20) + ' -> ' + want, A.yesNoFor(q, IE) === want, A.yesNoFor(q, IE));
}

console.log('\nAND "EU CITIZEN" IS THE SAME CLAIM, HOWEVER IT IS WRITTEN');
for (const profile of [{ citizenship: 'EU Citizen' }, { nationality: 'Irish' },
  { citizenship: 'Irish and British' }, { citizenship: 'Ireland' }, { citizenships: ['IE'] }]) {
  const q = (c) => 'Are you legally authorised to work in ' + c + '?';
  t('  ' + JSON.stringify(profile),
    A.yesNoFor(q('Germany'), profile) === 'Yes' && A.yesNoFor(q('the United States'), profile) === 'No',
    A.yesNoFor(q('Germany'), profile) + ' / ' + A.yesNoFor(q('the United States'), profile));
}

console.log('\nBUT LIVING SOMEWHERE IS NOT PERMISSION TO WORK THERE');
{
  const resident = { city: 'Dublin', country: 'Ireland' };
  t('  residence alone claims no country at all',
    A.authorisedCountries(resident).length === 0, JSON.stringify(A.authorisedCountries(resident)));
  t('  ...so the question goes unanswered rather than guessed',
    A.yesNoFor('Are you legally authorised to work in Ireland?', resident) === '',
    A.yesNoFor('Are you legally authorised to work in Ireland?', resident));
}

console.log('\nSPONSORSHIP IS THE SAME FACT ASKED BACKWARDS');
for (const [q, want] of [
  ['Will you now or in the future require sponsorship to work in the United States?', 'Yes'],
  ['Will you now or in the future require sponsorship to work in Ireland?', 'No'],
  ['Do you require visa sponsorship for employment in Canada?', 'Yes'],
  ['Can you work in the United States without sponsorship?', 'No'],
  ['Are you able to work in Ireland without sponsorship?', 'Yes'],
]) {
  t('  "' + q.slice(0, 62) + '" -> ' + want, A.yesNoFor(q, IE) === want, A.yesNoFor(q, IE));
}
{
  // The two phrasings must never contradict each other on one form.
  const pos = A.yesNoFor('Do you require sponsorship to work in the United States?', IE);
  const neg = A.yesNoFor('Can you work in the United States without sponsorship?', IE);
  t('  the positive and inverted forms agree', pos === 'Yes' && neg === 'No',
    JSON.stringify([pos, neg]));
}

console.log('\nA QUESTION THAT NAMES NO COUNTRY IS LOCAL');
for (const q of ['Are you legally authorised to work?', 'Do you have the right to work?',
  'Are you eligible to work for this employer?']) {
  t('  "' + q + '" -> Yes', A.yesNoFor(q, { work_authorized: true }) === 'Yes',
    A.yesNoFor(q, { work_authorized: true }));
}
{
  // ...and a country-less flag cannot answer a question about a
  // country. This is the Greenhouse defect: "unrestricted right to work
  // for any employer in the United States" answered Yes from a boolean
  // meaning "I can work where I live".
  const flag = { work_authorized: true };
  t('  but it cannot answer for a country it knows nothing about',
    A.yesNoFor('Do you have the unrestricted right to work for any employer in the United States?', flag) === '',
    A.yesNoFor('Do you have the unrestricted right to work for any employer in the United States?', flag));
}

console.log('\nAND THE PROFILE CAN SAY SO EXPLICITLY');
{
  // A visa, a second citizenship, a green card: facts this code cannot
  // derive and must not override.
  const dual = { citizenship: 'Irish', work_authorized_countries: ['IE', 'US', 'GB'] };
  t('  a stated US authorisation is honoured',
    A.yesNoFor('Are you legally authorised to work in the United States?', dual) === 'Yes',
    A.yesNoFor('Are you legally authorised to work in the United States?', dual));
  t('  ...and does not leak to countries it does not list',
    A.yesNoFor('Are you legally authorised to work in Canada?', dual) === 'No',
    A.yesNoFor('Are you legally authorised to work in Canada?', dual));
  t('  ...and it removes the sponsorship claim there too',
    A.yesNoFor('Do you require sponsorship to work in the United States?', dual) === 'No',
    A.yesNoFor('Do you require sponsorship to work in the United States?', dual));
}
{
  const us = { citizenship: 'American' };
  t('  a US citizen is authorised in the US',
    A.yesNoFor('Are you legally authorised to work in the United States?', us) === 'Yes',
    A.yesNoFor('Are you legally authorised to work in the United States?', us));
  t('  ...and not automatically in the EEA',
    A.yesNoFor('Are you legally authorised to work in Germany?', us) === 'No',
    A.yesNoFor('Are you legally authorised to work in Germany?', us));
}
{
  const uk = { citizenship: 'British' };
  t('  the Common Travel Area runs both ways',
    A.yesNoFor('Are you legally authorised to work in Ireland?', uk) === 'Yes',
    A.yesNoFor('Are you legally authorised to work in Ireland?', uk));
}

console.log('\nAND NOTHING IS GUESSED FROM NOTHING');
{
  const blank = {};
  t('  an empty profile answers nothing rather than inventing a country',
    A.yesNoFor('Are you legally authorised to work in the United States?', blank) === '',
    'it answered from a country it does not know');
  t('  countryInQuestion returns nothing when none is named',
    A.countryInQuestion('Are you legally authorised to work?') === '',
    A.countryInQuestion('Are you legally authorised to work?'));
  t('  ...and "state your eligibility" is not the state of Georgia',
    A.countryInQuestion('Please state your eligibility to work') === '',
    A.countryInQuestion('Please state your eligibility to work'));
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
