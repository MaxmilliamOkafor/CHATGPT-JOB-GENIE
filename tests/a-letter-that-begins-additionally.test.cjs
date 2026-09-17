// A LETTER THAT BEGINS "ADDITIONALLY" LOST ITS FIRST PARAGRAPH.
//
// Read out of the text layer of a real .docx this extension produced and
// a real person was about to send. The entire body:
//
//   Dear Hiring Manager,
//   Additionally, I mentored two junior engineers, facilitating their
//   transition to permanent roles, showing my commitment to fostering
//   talent and knowledge sharing.
//   This experience aligns with Cloudbeds' mission to transform
//   hospitality through technology.
//   My background in developing training materials and my proactive
//   approach to gathering feedback will support your goal of promoting
//   software adoption and strengthening client relationships.
//   I am available for a discussion at your convenience and look
//   forward to the opportunity to contribute to your team.
//
// Eighty-five words. "Additionally" refers back to something, and there
// is nothing behind it: the opening paragraph, the one that says what
// the application is and why, was never written or was cut before the
// document was built.
//
// Every pass in this audit ran over that letter and passed it. Each was
// looking at what was there. None asked whether something was missing,
// which is the failure mode a generated document has and a written one
// does not.
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

const SHIPPED = ['Maxmilliam Okafor',
  'Dublin, Ireland | Email: maxokafordev@gmail.com | +353 087 426 1508',
  'Date: September 16, 2026',
  'Re: Application for Customer Support Coach',
  'Dear Hiring Manager,',
  'Additionally, I mentored two junior engineers, facilitating their transition to '
    + 'permanent roles, showing my commitment to fostering talent and knowledge sharing.',
  'This experience aligns with Cloudbeds’ mission to transform hospitality through technology.',
  'My background in developing training materials and my proactive approach to gathering '
    + 'feedback will support your goal of promoting software adoption and strengthening '
    + 'client relationships.',
  'I am available for a discussion at your convenience and look forward to the '
    + 'opportunity to contribute to your team.',
  'Sincerely,', 'Maxmilliam Okafor'].join('\n');

console.log('THE BODY IS FOUND BETWEEN THE SALUTATION AND THE SIGN-OFF');
{
  const body = RA.coverLetterBody(SHIPPED);
  t('  the header is not part of it',
    !body.some((l) => /maxokafordev@gmail\.com|Re: Application/.test(l)), JSON.stringify(body[0]));
  t('  ...nor is the sign-off',
    !body.some((l) => /^Sincerely/.test(l)), JSON.stringify(body[body.length - 1]));
  t('  and the four real sentences are', body.length === 4, JSON.stringify(body.length));
}

console.log('\nAND THE MISSING OPENING IS CAUGHT');
{
  const h = RA.coverLetterHealth(SHIPPED);
  t('  the connective is seen', h.opensOnConnective, JSON.stringify(h.opening));
  t('  ...and the opening it refers to is reported',
    /^Additionally/.test(h.opening), JSON.stringify(h.opening));
  t('  the body is measured, not the whole file',
    h.bodyWords > 60 && h.bodyWords < 110, h.bodyWords + ' words');
  t('  ...and called short', h.tooShort, h.bodyWords + ' words');
  t('  the whole-document count is still there for the length check',
    h.wordCount > h.bodyWords, JSON.stringify({ body: h.bodyWords, all: h.wordCount }));
}

console.log('\nAND A COMPLETE LETTER IS NOT FLAGGED');
{
  const good = ['Maxmilliam Okafor', 'Dublin, Ireland | maxokafordev@gmail.com',
    'Re: Application for Customer Support Coach', 'Dear Hiring Manager,',
    'Your posting describes turning every support conversation into something the next '
      + 'person can use, which is a documentation and coaching problem more than a tooling '
      + 'one, and it is the part of the work I would want to own here.',
    'At Citigroup I trained 24 analysts across the London and Belfast offices, and the '
      + 'measure that mattered was not the sessions run but that routine data requests came '
      + 'back the same day afterwards rather than the following week.',
    'In a first quarter here I would expect to spend most of my time on whatever your '
      + 'support rota is currently absorbing by hand, because that is usually where the '
      + 'same question is being answered for the fortieth time.',
    'Cloudbeds runs support across live chat, email and phone for properties in 150 '
      + 'countries, so the same question arrives in three formats and gets answered three '
      + 'times. That is the loop I would want tightened before adding anything new.',
    'I would be glad to talk it through.',
    'Sincerely,', 'Maxmilliam Okafor'].join('\n');
  const h = RA.coverLetterHealth(good);
  t('  it does not open on a connective', !h.opensOnConnective, JSON.stringify(h.opening));
  t('  ...and is not short', !h.tooShort, h.bodyWords + ' words');
  // The floor is a structural test, not a style preference: a tight but
  // whole letter must clear it.
  t('  ...and a complete letter of 130 words would clear the floor too',
    RA.coverLetterHealth('Dear Sir,\n' + 'word '.repeat(130) + '\nSincerely,\nName').tooShort === false,
    'the floor is set above a complete short letter');
  t('  ...and is not long either', !h.tooLong, h.wordCount + ' words');
}

console.log('\nAND EVERY CONNECTIVE THAT MEANS THE SAME THING IS CAUGHT');
{
  const wrap = (first) => 'Dear Hiring Manager,\n' + first + '\nSincerely,\nName';
  for (const opener of ['Additionally, I led the migration.', 'Furthermore, I led it.',
    'Moreover, I led it.', 'In addition, I led it.', 'Also, I led it.',
    'Secondly, I led it.', 'Similarly, I led it.', 'Likewise, I led it.',
    'What is more, I led it.', 'As well as that, I led it.']) {
    t('  "' + opener.split(',')[0] + '"' + ' '.repeat(Math.max(0, 16 - opener.split(',')[0].length)),
      RA.coverLetterHealth(wrap(opener)).opensOnConnective, opener);
  }
  // And a letter that genuinely starts there is not one of these.
  for (const opener of ['Your posting describes a support team that...',
    'I trained 24 analysts across two offices.', 'Cloudbeds operates at a scale where...',
    'Alongside the engineering work, I ran the training.']) {
    t('  not flagged: "' + opener.slice(0, 34) + '"',
      !RA.coverLetterHealth(wrap(opener)).opensOnConnective, opener);
  }
}

console.log('\nAND THE AWKWARD SHAPES DO NOT BREAK IT');
{
  for (const [name, input] of [['null', null], ['empty', ''], ['no salutation', 'Just prose.'],
    ['no sign-off', 'Dear Sir,\nSome prose.'], ['salutation only', 'Dear Sir,'],
    ['not a string', 42]]) {
    let threw = false, h = null;
    try { h = RA.coverLetterHealth(input); } catch (e) { threw = true; }
    t('  ' + name.padEnd(16) + ' is handled', !threw && h && typeof h.bodyWords === 'number',
      threw ? 'it threw' : JSON.stringify(h));
  }
  t('  an empty letter is not called short',
    RA.coverLetterHealth('').tooShort === false, 'a missing letter is a different problem');
}

console.log('\nAND THE AUDIT REPORTS BOTH, AS CRITICAL');
{
  const src = fs.readFileSync(path.join(DIR, 'recruiter-audit.js'), 'utf8');
  t('  the lost opening is raised',
    /kind: 'cover-letter-opening-lost', severity: 'critical'/.test(src), 'not reported');
  t('  ...telling the reader to regenerate rather than patch',
    /Regenerate the letter before sending it/.test(src), 'no action given');
  t('  the short body is raised',
    /kind: 'cover-letter-too-short', severity: 'critical'/.test(src), 'not reported');
  t('  ...saying which of the three parts must be missing',
    /an opening, \n?\s*\/\/?\s*'?\+? ?'?a proof point and a close/.test(src)
      || /a proof point and a close/.test(src), 'no diagnosis');
  t('  and both are exported for the panel to read',
    typeof RA.coverLetterHealth === 'function' && typeof RA.coverLetterBody === 'function',
    'not exported');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
