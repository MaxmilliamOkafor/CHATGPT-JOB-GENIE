// A PARAGRAPH IS NEVER DELETED, ONLY THINNED.
//
// The mechanism behind a letter that reached a real employer at 85 words
// of body, opening "Additionally, I mentored two junior engineers" with
// nothing in front of it.
//
// enforceCoverLetterOriginality removes any sentence that restates a CV
// bullet, which is right: a reviewer holds both documents and reading
// the same claim twice is a wasted page. It removed them one at a time,
// and a paragraph whose every sentence crossed the threshold became "",
// which the join then filtered out. Each individual removal was correct.
// The hole was invisible to the loop that made it, and to every pass
// downstream, because they were all looking at what was there.
//
// Two fixes, and neither weakens the removal. When everything in a
// paragraph would go, the least-restating sentence stays: a thin
// paragraph is a writing problem a report can name, a missing one is a
// document that no longer makes sense. And a body left opening on a
// connective loses the connective, because it points back at something
// that is not there.
//
// This lives in tests/ rather than website/tests/ because CI runs
// `node --test tests/*.test.cjs` and nothing else. A test the pipeline
// does not run is a test that stops being true without telling anyone.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const CL = require(path.join(DIR, 'website', 'supabase', 'functions', '_shared', 'coverLetter.ts'));

const BULLETS = [
  'Architected a UK retail client migration from a legacy application to AWS '
    + 'microservices on EKS, delivering all 47 services in 11 months.',
  'Mentored two junior engineers and an intern who converted to a permanent role.',
];

const letter = (...body) => ['Dear Hiring Manager,', '']
  .concat(body.flatMap((p) => [p, ''])).concat(['Sincerely,', 'Maxmilliam Okafor']).join('\n');

console.log('A PARAGRAPH OF PURE RESTATEMENT SURVIVES, THINNED');
{
  const out = CL.enforceCoverLetterOriginality(letter(
    'I led the migration of a UK retail client legacy application to AWS microservices, '
      + 'delivering all 47 services in 11 months.',
    'I am available for a discussion at your convenience.'), BULLETS);
  const paras = out.text.split(/\n{2,}/).filter((p) => p.trim());
  t('  nothing is deleted outright', paras.length === 4, JSON.stringify(paras));
  t('  ...the restating paragraph is still there',
    /47 services/.test(out.text), out.text);
  t('  ...and it is reported as having had nothing original in it',
    out.emptiedParagraphs.length >= 1, JSON.stringify(out.emptiedParagraphs));
  t('  the salutation and sign-off are untouched',
    /^Dear Hiring Manager,/.test(out.text) && /Sincerely,/.test(out.text), out.text);
}

console.log('\nAND A BODY LEFT OPENING ON A CONNECTIVE LOSES IT');
{
  // The exact shape that shipped.
  const out = CL.enforceCoverLetterOriginality(letter(
    'Additionally, I mentored two junior engineers, facilitating their transition to permanent roles.',
    'I am available for a discussion at your convenience.'), []);
  t('  "Additionally" is gone', !/Additionally/.test(out.text), out.text);
  t('  ...and the sentence keeps its meaning',
    /I mentored two junior engineers/.test(out.text), out.text);
  t('  ...capitalised where the connective was',
    /\n\nI mentored/.test(out.text), JSON.stringify(out.text));
}

console.log('\nBUT A CONNECTIVE MID-LETTER IS LEFT ALONE');
{
  // Only the FIRST body paragraph can be an orphan. A letter that says
  // "Additionally" in its third paragraph is referring to its second,
  // which is there, and that is ordinary English.
  const out = CL.enforceCoverLetterOriginality(letter(
    'Your posting describes turning every support conversation into something reusable.',
    'Additionally, I ran the training that followed.',
    'I would be glad to talk it through.'), []);
  t('  it is still there', /Additionally, I ran the training/.test(out.text), out.text);
}

console.log('\nAND THE REMOVAL ITSELF IS NOT WEAKENED');
{
  // A paragraph with one restating sentence and one original keeps the
  // original and drops the restatement, exactly as before.
  // Long enough that the body still clears the floor after removal.
  // Below the floor the removed sentence comes back on purpose, which is
  // a different rule and is asserted above.
  const out = CL.enforceCoverLetterOriginality(letter(
    'I led the migration of a UK retail client legacy application to AWS microservices, '
      + 'delivering all 47 services in 11 months. What I would bring here is the review '
      + 'discipline that made it survive contact with production.',
    'Your posting describes a support function where the same question arrives through '
      + 'three channels and is answered three times, which is a documentation problem '
      + 'wearing a staffing problem as a disguise, and it is the part of the work I would '
      + 'want to own here rather than the part I would tolerate.',
    'In a first quarter I would expect to spend most of my time on whatever the rota is '
      + 'currently absorbing by hand, because that is reliably where the recurring cost '
      + 'sits and it is rarely where anyone is looking for it.',
    'Cloudbeds runs support across live chat, email and phone for properties in a hundred '
      + 'and fifty countries, and at that spread the cost of an answer that only exists in '
      + 'one person\'s head compounds quietly until somebody measures it. Writing the answer '
      + 'down once is cheaper than answering it forty times, and it is the kind of work that '
      + 'never shows up on a roadmap until someone insists on it.',
    'I would be glad to talk it through.'), BULLETS);
  t('  the restatement goes', !/47 services/.test(out.text), out.text);
  t('  ...and is reported', out.removedSentences.length >= 1,
    JSON.stringify(out.removedSentences));
  t('  the original sentence stays',
    /review discipline/.test(out.text), out.text);
  t('  ...and that paragraph is not reported as emptied',
    out.emptiedParagraphs.length === 0, JSON.stringify(out.emptiedParagraphs));
}

console.log('\nAND ORIGINALITY IS NEVER ENFORCED DOWN TO NOTHING');
{
  // The guarantee that was missing, and the one that matters. Two
  // letters went to real employers at 85 and 80 words of body, both
  // opening on a reference to a paragraph that had been removed. Every
  // deletion was individually correct and the result was not a letter.
  const bullets = [
    'Designed and delivered the artificial intelligence and natural language processing '
      + 'systems behind a dementia detection product that identifies cognitive decline '
      + 'early enough for clinicians to intervene.',
    'Acted as technical lead on five pre-sales bids, authoring the architecture sections '
      + 'and presenting proposed solutions to client CTOs, across engagements totalling 3.2m.',
  ];
  const restating = letter(
    'I designed and delivered the artificial intelligence and natural language processing '
      + 'systems behind a dementia detection product that identifies cognitive decline early '
      + 'enough for clinicians to intervene. I acted as technical lead on five pre-sales '
      + 'bids, authoring the architecture sections and presenting proposed solutions to '
      + 'client CTOs, across engagements totalling 3.2m.',
    'I am available for a discussion at your earliest convenience.');
  const words = (text) => text.split(/\n{2,}/)
    .filter((p) => p.trim() && !/^(Dear|Sincerely|Maxmilliam)/.test(p.trim()))
    .join(' ').split(/\s+/).filter(Boolean).length;
  const out = CL.enforceCoverLetterOriginality(restating, bullets);
  t('  the body is not gutted', words(out.text) >= words(restating) - 5,
    words(restating) + ' -> ' + words(out.text) + ' words');
  t('  ...and what came back is reported',
    out.restoredForLength.length >= 1, JSON.stringify(out.restoredForLength.length));
  t('  ...least restating first',
    !/dementia detection/.test(out.restoredForLength[0] || ''),
    JSON.stringify((out.restoredForLength[0] || '').slice(0, 60)));
}

console.log('\nAND A DEMONSTRATIVE OPENING IS REPORTED');
{
  // The second letter out opened "This consultative approach resulted in
  // improved patient outcomes", which points back exactly as hard as
  // "Additionally" and reads exactly as broken. It cannot be stripped
  // the way a connective can, because removing "This" leaves a sentence
  // with no subject, so it is reported for a rewrite instead.
  const out = CL.enforceCoverLetterOriginality(letter(
    'This consultative approach resulted in improved patient outcomes.',
    'I would be glad to talk it through.'), []);
  t('  it is flagged', /^This consultative approach/.test(out.danglingOpening),
    JSON.stringify(out.danglingOpening));
  t('  ...and the sentence is left intact, not mangled',
    /This consultative approach resulted/.test(out.text), out.text);
  const fine = CL.enforceCoverLetterOriginality(letter(
    'Your posting describes a support team answering the same question forty times.',
    'I would be glad to talk it through.'), []);
  t('  a real opening is not flagged', fine.danglingOpening === '',
    JSON.stringify(fine.danglingOpening));
}

console.log('\nAND THE AWKWARD SHAPES DO NOT BREAK IT');
{
  for (const [name, text, bullets] of [
    ['empty letter', '', BULLETS],
    ['null letter', null, BULLETS],
    ['no bullets', letter('A paragraph.'), []],
    ['null bullets', letter('A paragraph.'), null],
    ['salutation only', 'Dear Sir,', BULLETS],
    ['one word', 'Hello', BULLETS],
  ]) {
    let threw = false, out = null;
    try { out = CL.enforceCoverLetterOriginality(text, bullets); } catch (e) { threw = true; }
    t('  ' + name.padEnd(18) + ' is handled',
      !threw && out && typeof out.text === 'string', threw ? 'it threw' : JSON.stringify(out));
  }
}

console.log('\nAND THE WRITING PROMPT ASKS FOR THE OPENING IN THE FIRST PLACE');
{
  // The rescue above is a backstop. The letter should arrive with four
  // paragraphs, and until now the prompt never said what shape a letter
  // takes at all.
  for (const f of ['website/supabase/functions/tailor-application/index.ts',
    'functions/tailor-application/index.ts']) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const where = f.split('/')[0];
    t('  ' + where.padEnd(8) + ' names the four paragraphs',
      /COVER LETTER SHAPE - FOUR PARAGRAPHS/.test(src), 'no structure is specified');
    t('  ' + where.padEnd(8) + ' ...and forbids opening on a connective',
      /NEVER BEGIN A PARAGRAPH WITH "Additionally"/.test(src), 'the observed failure is allowed');
    t('  ' + where.padEnd(8) + ' ...and sets a body floor',
      /at least 150 words between the salutation and the sign-off/.test(src), 'no length floor');
    t('  ' + where.padEnd(8) + ' ...and does not open by announcing the application',
      /Do NOT open by announcing the application/.test(src),
      'the first line would repeat the Re: line directly above it');
  }
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
