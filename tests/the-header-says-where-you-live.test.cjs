// THE RELOCATION NOTE ONLY EVER APPEARED ON A BROKEN HEADER.
//
// The header rule bailed the moment the city was already correct. So the
// "(open to relocation)" note could only be added on a run that was
// FIXING a wrong city -- and on a CV that already said "Dublin, Ireland",
// which is every run after the first, a posting in Berlin got no note at
// all. The feature existed and almost never fired.
//
// The whole segment is composed now and compared against what is there.
// The only early exit is "what is there is already exactly right".
//
// WHAT THE HEADER IS FOR. It states where the candidate LIVES. An
// earlier version rewrote it to the job's city, which then answered
// every work-authorisation question on the same form against a country
// he does not live in -- read by a recruiter as a false statement rather
// than as ambition, ending that application and the next one at the same
// employer. Relocation is the honest way to say the same thing.
//
// AND "EU CITIZEN" IS A LEGAL STATUS, NOT AN INFERENCE. It answers what
// a European posting actually wants to know -- can this person work here
// and what does it cost us -- and it is worth more than a willingness to
// move. It is never derived from living in an EU country: residence is
// not citizenship.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'recruiter-audit.js'));
const RA = global.RecruiterAudit;

const CV = ['Maxmilliam Okafor', 'Head of Technology',
  'Dublin, Ireland  |  +353 87 426 1508  |  max@example.invalid', '',
  'PROFESSIONAL SUMMARY', 'Engineer.'].join('\n');
const EU = 'Irish citizen, EU Citizen';

const header = (job, citizenship, cv) => {
  const r = RA.ensureTruthfulLocation(cv || CV, 'Dublin, Ireland', job, citizenship);
  const line = ((r.changed ? r.text : (cv || CV)).split('\n')[2] || '');
  return line.split('|')[0].trim();
};

console.log('NOTHING IS ADDED WHERE IT SAYS NOTHING');
for (const [job, why] of [
  ['Dublin, Ireland', 'the same city'],
  ['Cork, Ireland', 'the same country, a move nobody needs reassuring about'],
  ['Remote', 'there is nothing to relocate to'],
  ['Remote (EMEA)', 'still remote'],
  ['', 'no posting location known'],
]) {
  t('  ' + ('"' + job + '"').padEnd(18) + ' -> plain (' + why + ')',
    header(job, EU) === 'Dublin, Ireland', header(job, EU));
}

console.log('\nAND IT IS ADDED WHERE SILENCE COSTS THE APPLICATION');
{
  t('  a UK posting gets the note',
    header('London, United Kingdom', EU) === 'Dublin, Ireland (open to relocation)',
    header('London, United Kingdom', EU));
  t('  ...and so does a US one',
    header('New York, United States', EU) === 'Dublin, Ireland (open to relocation)',
    header('New York, United States', EU));
}

console.log('\nAN EU POSTING GETS THE THING IT ACTUALLY WANTS TO KNOW');
for (const job of ['Berlin, Germany', 'Amsterdam, Netherlands', 'Madrid, Spain']) {
  t('  ' + job.padEnd(24) + ' names the right to work',
    header(job, EU) === 'Dublin, Ireland (EU citizen, open to relocation)', header(job, EU));
}

console.log('\nAND A REGION IS A PLACE TOO');
{
  // "Europe", "EMEA" and "EU-wide" name no country, so the country test
  // said nothing and the header stayed silent -- on exactly the postings
  // where a recruiter is choosing between candidates in several
  // countries.
  for (const job of ['Europe', 'EMEA', 'EU-wide', 'Nordics', 'DACH']) {
    t('  ' + job.padEnd(24) + ' is treated as abroad',
      header(job, EU) === 'Dublin, Ireland (EU citizen, open to relocation)', header(job, EU));
  }
  t('  ...but "Remote (EMEA)" is still remote',
    header('Remote (EMEA)', EU) === 'Dublin, Ireland', header('Remote (EMEA)', EU));
}

console.log('\nTHE UK IS NOT IN THE EU, AND THE HEADER KNOWS IT');
{
  t('  a London posting gets no EU claim',
    !/EU citizen/.test(header('London, United Kingdom', EU)),
    header('London, United Kingdom', EU));
  t('  ...nor does New York', !/EU citizen/.test(header('New York, United States', EU)),
    header('New York, United States', EU));
}

console.log('\nAND THE STATUS IS NEVER INFERRED');
{
  // Living in Dublin does not make somebody an EU citizen, and claiming
  // it when it is not stated is a false statement on an application.
  for (const cz of ['Nigerian citizen', '', undefined, 'Stamp 4 holder']) {
    t('  no EU claim without it on the profile (' + JSON.stringify(cz) + ')',
      header('Berlin, Germany', cz) === 'Dublin, Ireland (open to relocation)',
      header('Berlin, Germany', cz));
  }
  t('  ...and the willingness to move is still stated',
    /open to relocation/.test(header('Berlin, Germany', 'Nigerian citizen')),
    header('Berlin, Germany', 'Nigerian citizen'));
}

console.log('\nIT FIRES ON A HEADER THAT WAS ALREADY CORRECT');
{
  // The fault this file is named for: the rule returned early whenever
  // the city was right, so the note only ever appeared while fixing a
  // wrong one.
  const r = RA.ensureTruthfulLocation(CV, 'Dublin, Ireland', 'Berlin, Germany', EU);
  t('  the correct city does not stop the note', r.changed === true, JSON.stringify(r.now));
  t('  ...and it is not reported as a correction', r.corrected === false,
    JSON.stringify({ was: r.was, now: r.now, corrected: r.corrected }));

  // While a header that named the JOB's city still is one.
  const wrong = CV.replace('Dublin, Ireland  |', 'Berlin, Germany  |');
  const w = RA.ensureTruthfulLocation(wrong, 'Dublin, Ireland', 'Berlin, Germany', EU);
  t('  a wrong city is still corrected', w.changed && /^Dublin, Ireland/.test(w.now), w.now);
  t('  ...and IS reported as a correction', w.corrected === true, JSON.stringify(w.corrected));
}

console.log('\nAND IT IS SAFE TO RUN TWICE');
{
  const once = RA.ensureTruthfulLocation(CV, 'Dublin, Ireland', 'Berlin, Germany', EU);
  const twice = RA.ensureTruthfulLocation(once.text, 'Dublin, Ireland', 'Berlin, Germany', EU);
  t('  a second pass changes nothing', twice.changed === false, JSON.stringify(twice.now));
  t('  ...and does not double the note',
    (once.text.match(/open to relocation/g) || []).length === 1,
    once.text.split('\n')[2]);

  // And a stale note from a previous, foreign posting is removed when the
  // next one is local.
  const stale = RA.ensureTruthfulLocation(once.text, 'Dublin, Ireland', 'Dublin, Ireland', EU);
  t('  a stale note is taken off for a local posting',
    stale.changed && stale.now === 'Dublin, Ireland', stale.now);
}

console.log('\nAND THE PHONE AND EMAIL ARE LEFT ALONE');
{
  const r = RA.ensureTruthfulLocation(CV, 'Dublin, Ireland', 'Berlin, Germany', EU);
  t('  the phone survives', /\+353 87 426 1508/.test(r.text), r.text.split('\n')[2]);
  t('  the email survives', /max@example\.invalid/.test(r.text), r.text.split('\n')[2]);
  t('  and the name is untouched', r.text.split('\n')[0] === 'Maxmilliam Okafor',
    r.text.split('\n')[0]);
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
