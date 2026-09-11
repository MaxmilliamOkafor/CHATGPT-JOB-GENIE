// "POSTGRESQL X" ON A CV THAT SAYS POSTGRES.
//
// The coverage panel read 20 of 33 on an application whose CV plainly
// held most of the thirteen things it listed as missing. Every miss was
// the same fault, and it was not the CV's:
//
//   PostgreSQL    x   the CV says "Postgres"
//   Linux systems x   the CV says "Linux"
//   observability x   the CV says "observability tooling"
//
// The denominator was wrong too. Thirty-three "keywords" counted
// "Linux systems" AND "Linux", "AI" AND "AI building" -- one
// requirement counted two and three times in
// whatever words that posting happened to use. A percentage over a list
// like that measures the job description's vocabulary, not the CV.
//
// A keyword is a REQUIREMENT. It resolves to a group of equivalent
// surface forms; the group is counted once, its canonical name is what
// the chip shows, and the CV satisfies it by containing any form in it.
//
// What must NOT follow from that: a shared prefix is still not a match.
// Java cannot claim JavaScript, React cannot claim Reactive, Scala
// cannot claim Scalable. An equivalence has to be written down or
// produced by a stated rule, never inferred from an overlap.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), Module = require('module');
const DIR = path.join(__dirname, '..');
global.window = global;
for (const f of ['keyword-taxonomy.js', 'dynamic-score.js']) {
  const file = path.join(DIR, f);
  const m = new Module(file, null); m.filename = file;
  m.paths = Module._nodeModulePaths(DIR);
  m._compile(fs.readFileSync(file, 'utf8'), file);
}
const TX = global.KeywordTaxonomy;
const DS = global.DynamicScore;

// The CV from the reported run, in the shape it actually ships.
const CV = [
  'Maxmilliam Okafor', 'Staff Software Engineer', 'Dublin, IE | max@example.invalid', '',
  'TECHNICAL SKILLS',
  'Programming: Python, Java, Node.js, Bash',
  'Cloud & DevOps: AWS, Kubernetes, Docker, Terraform, Jenkins, GitLab',
  'Data: Postgres, Redis',
  'Observability: Datadog, Grafana', '',
  'PROFESSIONAL EXPERIENCE',
  '- Ran incident response and on-call for cloud infrastructure on Linux.',
  '- Owned the CI/CD pipelines and cut cloud spend through cost optimisation.',
].join('\n');

console.log('THE REPORTED MISSES');
for (const [term, why] of [
  ['PostgreSQL', 'the CV says Postgres'],
  ['Linux systems', 'the CV says Linux'],
  ['Cloud cost management', 'the CV says cost optimisation'],
  ['observability', 'the CV has an Observability line'],
  ['CI/CD', 'written the same way'],
  ['Node.js', 'written the same way'],
]) {
  t('  ' + term.padEnd(22) + ' -> matched (' + why + ')', TX.appearsIn(CV, term), 'still missing');
}

console.log('\nAND A SHARED PREFIX IS STILL NOT A MATCH');
for (const [text, term] of [
  ['Built a JavaScript front end', 'Java'],
  ['Reactive streams with Kafka', 'React'],
  ['Managed the scalable platform', 'Scala'],
  ['Worked on Google Ads', 'Go'],
  ['Ran the Postgres upgrade', 'MySQL'],
  ['Deployed with Docker', 'Kubernetes'],
  ['GitLab repository hosting', 'GitLab CI'],
  ['Git version control', 'GitHub Actions'],
]) {
  t('  "' + text + '" does not satisfy ' + term, !TX.appearsIn(text, term), 'a false match');
}

console.log('\nPUNCTUATION IS NOT PART OF THE REQUIREMENT');
for (const [text, term] of [
  ['CI-CD pipelines', 'CI/CD'], ['CICD pipeline', 'CI/CD'],
  ['built with nodejs', 'Node.js'], ['Node JS services', 'Node.js'],
  ['machine-learning models', 'Machine Learning'],
  ['a cross functional team', 'Cross-functional Collaboration'],
]) {
  t('  "' + text + '" satisfies ' + term, TX.appearsIn(text, term), 'separator variance not handled');
}

console.log('\nBUT C++, C# AND .NET SURVIVE IT');
{
  const cv = 'Wrote C++ and C# services, deployed .NET APIs through CI/CD, plus Node.js tooling.';
  for (const term of ['C++', 'C#', '.NET', 'CI/CD', 'Node.js']) {
    t('  ' + term + ' matched', TX.appearsIn(cv, term), 'punctuation was normalised away');
  }
  t('  and plain C does not claim C++', !TX.appearsIn('Only C code here', 'C++'), 'a false match');
}

console.log('\nONE ENTRY PER REQUIREMENT, UNDER ITS CANONICAL NAME');
{
  const asked = ['Linux systems', 'Linux', 'AI', 'AI building', 'GitLab CI', 'GitHub Actions',
    'SRE', 'site reliability engineering', 'PostgreSQL', 'Postgres',
    'Cloud cost management', 'FinOps'];
  const entries = TX.dedupe(asked);
  t('  twelve strings are seven requirements', entries.length === 7,
    entries.length + ': ' + entries.map((e) => e.label).join(', '));
  const labels = entries.map((e) => e.label);
  for (const want of ['Linux', 'AI', 'GitLab CI', 'GitHub Actions', 'SRE', 'PostgreSQL', 'Cloud Cost Management']) {
    t('  ...one of them is "' + want + '"', labels.indexOf(want) !== -1, labels.join(', '));
  }
  t('  and the chip shows the canonical name, not the posting\'s phrasing',
    labels.indexOf('Linux systems') === -1 && labels.indexOf('AI building') === -1,
    labels.join(', '));
}

console.log('\nA QUALIFIER DOES NOT MAKE A NEW REQUIREMENT');
for (const [term, want] of [
  ['Kubernetes experience', 'Kubernetes'],
  ['strong Python', 'Python'],
  ['Linux systems', 'Linux'],
  ['hands-on Terraform', 'Terraform'],
  ['deep knowledge of Docker', 'Docker'],
]) {
  t('  "' + term + '" is ' + want, TX.canonical(term) === want, TX.canonical(term));
}
{
  // ...but a qualifier that changes the subject is left alone. "AWS
  // security" is not satisfied by having mentioned AWS.
  t('  "AWS security" is not just AWS', TX.canonical('AWS security') !== 'AWS',
    TX.canonical('AWS security'));
  t('  ...and is not matched by an AWS-only CV',
    !TX.appearsIn('Deployed to AWS with Terraform', 'AWS security'), 'a false match');
  t('  "Linux administration" is not just Linux',
    TX.canonical('Linux administration') !== 'Linux', TX.canonical('Linux administration'));
}

console.log('\nA PLURAL IS NOT A DIFFERENT REQUIREMENT');
for (const [text, term] of [
  ['Owned payouts and settlement', 'Payout'],
  ['Built a microservice platform', 'Microservices'],
  ['Ran the payment service', 'Payments'],
]) {
  t('  "' + text + '" satisfies ' + term, TX.appearsIn(text, term), 'plural rule missed it');
}
{
  // The floor that stops "AWS" being tested as "AW".
  t('  and a three-letter acronym is not stripped to two',
    !TX.appearsIn('The AW building', 'AWS'), 'AWS matched something that is not AWS');
}

console.log('\nTHE GAUGE COUNTS REQUIREMENTS, NOT STRINGS');
{
  const asked = ['Kubernetes', 'AWS', 'PostgreSQL', 'CI/CD', 'Terraform', 'Docker',
    'Linux systems', 'Linux', 'GitLab CI', 'GitHub Actions', 'Elixir', 'Clojure'];
  const r = DS.calculateDynamicMatch(CV, asked);
  t('  twelve strings measured as eleven requirements', r.totalKeywords === 11,
    r.totalKeywords + ': ' + r.matched.concat(r.missing).join(', '));
  t('  ...seven of them on the CV', r.matchCount === 7, r.matchCount + ' / ' + r.totalKeywords);
  t('  ...so the gauge reads 64%', r.score === 64, r.score + '%');
  t('  and the four absent tools are named',
    r.missing.length === 4 && r.missing.includes('GitLab CI') && r.missing.includes('GitHub Actions') && r.missing.indexOf('Elixir') !== -1 && r.missing.indexOf('Clojure') !== -1,
    JSON.stringify(r.missing));
}

console.log('\nAND THE CHIPS SAY WHICH IS WHICH IN COLOUR, NOT ONLY IN A GLYPH');
{
  const css = fs.readFileSync(path.join(DIR, 'popup-readability.css'), 'utf8');
  const rule = (sel) => (new RegExp('\\' + sel + '\\s*\\{([^}]*)\\}').exec(css) || ['', ''])[1];
  const matched = rule('.keyword-chip.matched');
  const missing = rule('.keyword-chip.missing');
  t('  a matched chip is green', /#6ee7b7|16,\s*185,\s*129/.test(matched), matched);
  t('  a missing chip is red', /#fca5a5|239,\s*68,\s*68/.test(missing), missing);
  t('  ...and they no longer share one background',
    matched.indexOf('background') !== -1 && missing.indexOf('background') !== -1
      && matched !== missing, JSON.stringify([matched, missing]));
  const js = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  the tick and the cross stay, for anyone the colour does not reach',
    /isMatched \? '✓' : '✗'/.test(js), 'colour became the only signal');
}

console.log('\nAND NOTHING HERE IS SOMEBODY ELSE\'S FILE');
{
  const src = fs.readFileSync(path.join(DIR, 'keyword-taxonomy.js'), 'utf8');
  t('  the table is small enough to be hand-written and reviewable',
    TX.GROUPS.length < 400, TX.GROUPS.length + ' groups');
  t('  every group names its canonical form first',
    TX.GROUPS.every((g) => Array.isArray(g) && g.length && typeof g[0] === 'string' && g[0].trim()),
    'a malformed group');
  t('  and no group is a regex object pulled from a vendor config',
    TX.GROUPS.every((g) => g.every((f) => typeof f === 'string')), 'a non-string form');
  t('  the rules are stated in the file, not encoded in data',
    /function stripQualifiers/.test(src) && /function pluralVariants/.test(src),
    'the behaviour lives somewhere unreadable');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);

