// THE CERTIFICATIONS SECTION "APPEARED AND DISAPPEARED AT RANDOM".
//
// It was not random. The tailoring fetched the profile with a
// hand-written column list:
//
//   select=first_name,last_name,email,phone,linkedin,github,portfolio,
//   cover_letter,professional_experience,relevant_projects,education,
//   skills,certifications,achievements,ats_strategy,city,country,...
//
// and the code reading that result asked for eight columns that were
// not in it: certifications_hidden, show_certifications, citizenship,
// citizenship_status, languages, spoken_languages, right_to_work,
// work_authorized_countries. Every one came back undefined. So:
//
//   the certifications switch on the website did nothing at all;
//   the citizenship line fell through to a hard-coded default;
//   the work-authorisation answer had no country list to check;
//   and the candidate's spoken languages were a fallback constant.
//
// Which of those bit depended on which fetch had run last, so the same
// button produced different documents -- and it was reported, exactly
// as it looked, as randomness.
//
// A profile row is small and it is the user's own. Selecting all of it
// costs nothing and removes the entire class of silent mismatch between
// the column list and the code underneath it. This file exists so the
// next person to "optimise" that fetch back into a list has to see what
// the list has to contain.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), Module = require('module');
const DIR = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');

// The columns the code reads off a fetched profile row, anywhere.
const READ = ['certifications_hidden', 'show_certifications', 'citizenship',
  'citizenship_status', 'languages', 'spoken_languages', 'right_to_work',
  'first_name', 'last_name', 'city', 'country', 'skills', 'certifications',
  'professional_experience', 'relevant_projects', 'education'];

console.log('EVERY PROFILE FETCH RETURNS EVERY COLUMN THE CODE READS');
{
  // The three fetches that feed tailoring, the audit and ats_profile.
  const fetches = [...src.matchAll(/rest\/v1\/profiles\?user_id=eq\.\$\{this\.session\.user\.id\}&select=([a-z_,*]+)`/g)]
    .map((m) => m[1]);
  t('  the profile is fetched at all', fetches.length >= 3, JSON.stringify(fetches));

  // A narrow list is allowed only where nothing downstream reads a
  // profile field off it -- the AI-provider flags and the CV file
  // metadata. Anything wider than that has to be the whole row.
  const narrow = fetches.filter((f) => f !== '*');
  for (const list of narrow) {
    const cols = list.split(',');
    t('  narrow select is a small, single-purpose one: ' + list.slice(0, 48),
      cols.length <= 4, cols.length + ' columns and not select=*');
    for (const col of READ) {
      t('    ...and does not pretend to serve ' + col, cols.indexOf(col) === -1,
        'a partial list is feeding a reader that needs more than it names');
    }
  }
  t('  the tailoring fetch takes the whole row',
    fetches.filter((f) => f === '*').length >= 3,
    JSON.stringify(fetches));
}

console.log('\nAND THE SWITCHES THAT DEPEND ON IT ARE STILL READ');
for (const key of ['certifications_hidden', 'show_certifications', 'citizenship']) {
  t('  ' + key + ' is read from the profile', src.indexOf('profile.' + key) !== -1,
    'nothing consumes it, so the website control is decorative');
}

console.log('\nAND A STATED CITIZENSHIP REACHES THE ANSWER ON THE FORM');
{
  global.window = global;
  const file = path.join(DIR, 'autofill-core.js');
  const m = new Module(file, null); m.filename = file;
  m.paths = Module._nodeModulePaths(DIR);
  m._compile(fs.readFileSync(file, 'utf8'), file);
  const A = global.AutofillCore;

  // The shape the website actually stores: an ISO list plus the
  // citizenship string, on the same row the fetch above now returns.
  const row = { first_name: 'Maxmilliam', city: 'Dublin', country: 'Ireland',
    citizenship: 'EU Citizen', work_authorized_countries: ['IE'] };
  t('  authorised where the citizenship says so',
    A.yesNoFor('Are you legally authorised to work in Germany?', row) === 'Yes',
    A.yesNoFor('Are you legally authorised to work in Germany?', row));
  t('  ...and not where it does not',
    A.yesNoFor('Do you have the unrestricted right to work for any employer in the United States?', row) === 'No',
    A.yesNoFor('Do you have the unrestricted right to work for any employer in the United States?', row));
  t('  ...and the same row answers the sponsorship question consistently',
    A.yesNoFor('Will you require sponsorship to work in the United States?', row) === 'Yes'
      && A.yesNoFor('Will you require sponsorship to work in Ireland?', row) === 'No',
    JSON.stringify([A.yesNoFor('Will you require sponsorship to work in the United States?', row),
      A.yesNoFor('Will you require sponsorship to work in Ireland?', row)]));

  // Strip the citizenship, keep the address: the answer goes away
  // rather than being guessed from where the applicant lives.
  const noClaim = { first_name: 'Maxmilliam', city: 'Dublin', country: 'Ireland' };
  t('  and an address alone still answers nothing',
    A.yesNoFor('Are you legally authorised to work in Ireland?', noClaim) === '',
    A.yesNoFor('Are you legally authorised to work in Ireland?', noClaim));
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
