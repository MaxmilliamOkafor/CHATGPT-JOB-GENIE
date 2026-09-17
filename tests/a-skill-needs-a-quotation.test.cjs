// A SKILL NEEDS A QUOTATION, AND MATCHING THAT ONLY READS LETTERS.
//
// Every other keyword path in this extension is generous on purpose. The
// taxonomy knows PostgreSQL is Postgres and ML is Machine Learning,
// because the question it answers is "does this CV cover the posting?"
// and a CV that says Postgres does cover a posting that says PostgreSQL.
//
// This answers a different question: what does the posting actually SAY?
// Generosity is a defect there. SQL inside MySQL is not SQL. C inside
// C++ is not C. "managed teams" does not contain "management". So this
// module shares nothing with the taxonomy, and these tests exist partly
// to hold that line.
//
// The nine checks carried over from the supplied reference
// implementation are marked [ref]; the rest are for the port and for the
// places the port had to decide something the original did not.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'skill-evidence.js'));
const SE = global.SkillEvidence;

const record = (term, evidence, changes) => Object.assign({
  term, category: 'hard_skill', evidence,
  requirement: 'required', review_required: false, review_reason: '',
}, changes || {});

console.log('A SUBSTRING IS NOT A MENTION  [ref]');
{
  t('  SQL is not found inside MySQL or SQLAlchemy',
    SE.occurrences('MySQL SQL SQLAlchemy', 'SQL').length === 1,
    String(SE.occurrences('MySQL SQL SQLAlchemy', 'SQL').length));
  t('  C is not found inside C++ or C#',
    SE.occurrences('C++ C# C', 'C').length === 1,
    JSON.stringify(SE.occurrences('C++ C# C', 'C')));
  t('  ...and C++ is still found',
    SE.occurrences('C++ C# C', 'C++').length === 1,
    JSON.stringify(SE.occurrences('C++ C# C', 'C++')));
  t('  Java is not JavaScript',
    SE.occurrences('JavaScript and TypeScript', 'Java').length === 0,
    'a posting asking for JavaScript would be reported as asking for Java');
  t('  R is not found inside a word',
    SE.occurrences('React and Ruby', 'R').length === 0, 'every capital R would be the language');
}

console.log('\nOFFSETS INDEX THE SOURCE, AND WHITESPACE IS FLEXIBLE  [ref]');
{
  const source = 'Use POWER\nBI now';
  const hit = SE.occurrences(source, 'Power BI')[0];
  t('  a phrase broken across a line is one occurrence', !!hit, JSON.stringify(hit));
  t('  ...and the offsets point at it in the original',
    hit && source.slice(hit.start, hit.end) === 'POWER\nBI',
    hit && JSON.stringify(source.slice(hit.start, hit.end)));
  t('  ...with an exclusive end', hit && hit.end === hit.start + 'POWER\nBI'.length,
    JSON.stringify(hit));
}

console.log('\nNOTHING IS STEMMED, EXPANDED OR RESOLVED  [ref]');
{
  t('  "managed teams" does not contain "management"',
    SE.occurrences('managed teams', 'management').length === 0, 'it stemmed');
  // The taxonomy WOULD resolve each of these, correctly, for the
  // question it answers. Here it would be a report of something the
  // posting never said.
  for (const [text, term] of [['Postgres', 'PostgreSQL'], ['ML', 'Machine Learning'],
    ['Kubernetes', 'K8s'], ['dashboards', 'Tableau']]) {
    t('  "' + text + '" does not satisfy "' + term + '"',
      SE.occurrences(text, term).length === 0, 'a synonym was resolved');
  }
}

console.log('\nA QUOTATION THAT IS NOT IN THE SOURCE IS REJECTED  [ref]');
{
  const out = SE.validate({ skills: [record('SQL', 'SQL required')] }, 'Python required');
  t('  nothing is accepted', out.accepted.length === 0, JSON.stringify(out.accepted));
  t('  ...and the record is returned rather than dropped',
    out.rejected.length === 1, JSON.stringify(out.rejected));
  t('  ...with the reason',
    /exact source quotation/.test(out.rejected[0].reason), out.rejected[0].reason);
  t('  ...and the record itself, so it can be read',
    out.rejected[0].record.term === 'SQL', JSON.stringify(out.rejected[0].record));
}

console.log('\nAND SO IS A TERM THAT ONLY EXISTS INSIDE A LARGER WORD  [ref]');
{
  const out = SE.validate({ skills: [record('SQL', 'MySQL required')] }, 'MySQL required');
  t('  nothing is accepted', out.accepted.length === 0, JSON.stringify(out.accepted));
  t('  ...with its own reason, not the quotation one',
    out.rejected.length === 1 && /inside a larger token/.test(out.rejected[0].reason),
    JSON.stringify(out.rejected));
}

console.log('\nTWO RECORDS THAT DISAGREE ARE ONE RECORD AND A QUESTION  [ref]');
{
  const first = record('SQL', 'SQL required');
  const second = Object.assign({}, first, { category: 'soft_skill' });
  const out = SE.validate({ skills: [first, second] }, 'SQL required');
  t('  they merge to one', out.accepted.length === 1, JSON.stringify(out.accepted));
  t('  ...flagged for review', out.accepted[0].review_required, JSON.stringify(out.accepted[0]));
  t('  ...saying why', /Conflicting duplicate/.test(out.accepted[0].review_reason),
    out.accepted[0].review_reason);
}
{
  // Same wording, same classification, said twice: one record, no
  // question. Merging is on the wording, so an independently occurring
  // variant survives as its own record.
  const jd = 'SQL required. Advanced SQL required.';
  const out = SE.validate({ skills: [record('SQL', 'SQL required'),
    record('Advanced SQL', 'Advanced SQL required')] }, jd);
  t('  a genuine variant is kept separately', out.accepted.length === 2,
    JSON.stringify(out.accepted.map((x) => x.term)));
  t('  ...and neither is flagged',
    out.accepted.every((x) => !x.review_required), JSON.stringify(out.accepted));
}

console.log('\nA RESUME COUNT IS LITERAL PRESENCE AND NOTHING ELSE  [ref]');
{
  // The whole point of the label. "No SQL experience" contains SQL.
  const report = SE.buildReport({ skills: [record('SQL', 'SQL required')] },
    'SQL required', 'No SQL experience');
  t('  the phrase is reported as present', report.hard_skills[0].literal_present,
    JSON.stringify(report.hard_skills[0]));
  t('  ...and counted', report.hard_skills[0].resume_literal_count === 1,
    String(report.hard_skills[0].resume_literal_count));
  t('  ...and the report says what that does and does not mean',
    report.notes.some((n) => /not evidence of proficiency/.test(n)), JSON.stringify(report.notes));
  t('  no score of any kind is produced',
    !('score' in report) && !('match' in report)
      && report.notes.some((n) => /No ATS ranking, Jobscan score/.test(n)),
    JSON.stringify(Object.keys(report)));
}

console.log('\nAN EMPTY EXTRACTION IS AN EMPTY REPORT, NOT AN ERROR  [ref]');
{
  const report = SE.buildReport({ skills: [] }, 'Apply today.');
  t('  no hard skills', report.hard_skills.length === 0, JSON.stringify(report.hard_skills));
  t('  no soft skills', report.soft_skills.length === 0, JSON.stringify(report.soft_skills));
  t('  and nothing to review', report.needs_review === false, JSON.stringify(report));
}

console.log('\nA HALF-FINISHED CALL IS NOT A HALF-FINISHED REPORT  [ref]');
{
  for (const [name, response, expect] of [
    ['an incomplete response', { status: 'incomplete' }, /did not complete/],
    ['a refusal', { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }, /declined/],
    ['no text at all', { status: 'completed', output: [] }, /no text/],
  ]) {
    let message = '';
    try { SE.parseResponse(response); } catch (e) { message = e.message; }
    t('  ' + name.padEnd(22) + ' throws, with a reason a person can act on',
      expect.test(message), message || 'it returned instead of throwing');
  }
  const ok = SE.parseResponse({ status: 'completed', output: [{ content: [
    { type: 'output_text', text: '{"skills":' }, { type: 'output_text', text: '[]}' }] }] });
  t('  and a response split across parts is joined',
    ok && Array.isArray(ok.skills), JSON.stringify(ok));
}

// ── BEYOND THE REFERENCE ─────────────────────────────────────────────
console.log('\nEVERY MALFORMED SHAPE IS NAMED, NOT GUESSED AT');
{
  const jd = 'SQL required';
  for (const [name, rec, expect] of [
    ['a missing field', { term: 'SQL', category: 'hard_skill' }, /Incorrect record fields/],
    ['an extra field', record('SQL', jd, { confidence: '0.9' }), /Incorrect record fields/],
    ['a number for a string', record('SQL', jd, { review_reason: 7 }), /Expected string fields/],
    ['a string for the boolean', record('SQL', jd, { review_required: 'true' }), /must be boolean/],
    ['an invented category', record('SQL', jd, { category: 'meta_skill' }), /Invalid category/],
    ['an invented requirement', record('SQL', jd, { requirement: 'essential' }), /Invalid category or requirement/],
    ['an empty term', record('', jd), /Empty term or evidence/],
    ['a whitespace term', record('   ', jd), /Empty term or evidence/],
    ['null', null, /Incorrect record fields/],
    ['an array', [], /Incorrect record fields/],
  ]) {
    const out = SE.validate({ skills: [rec] }, jd);
    t('  ' + name.padEnd(26) + ' is rejected by name',
      out.accepted.length === 0 && out.rejected.length === 1
        && expect.test(out.rejected[0].reason),
      out.rejected.length ? out.rejected[0].reason : 'it was ACCEPTED');
  }
}

console.log('\nAND A REPLY THAT IS NOT A REPLY IS REFUSED OUTRIGHT');
{
  for (const [name, data] of [['null', null], ['an array', []], ['a string', 'skills'],
    ['no skills key', { results: [] }], ['skills not an array', { skills: {} }]]) {
    let threw = false;
    try { SE.validate(data, 'SQL required'); } catch (e) { threw = true; }
    t('  ' + name.padEnd(20) + ' throws rather than reporting nothing found',
      threw, 'an empty report would look like a posting with no skills in it');
  }
}

console.log('\nTHE REPORT READS IN THE ORDER THE POSTING DOES');
{
  const jd = 'Responsibilities: build dashboards in Tableau.\n'
    + 'Requirements: Python and SQL. Communication is essential.';
  const out = SE.validate({ skills: [
    record('SQL', 'Python and SQL'),
    record('Tableau', 'build dashboards in Tableau'),
    record('Communication', 'Communication is essential', { category: 'soft_skill' }),
  ] }, jd);
  t('  three records survive', out.accepted.length === 3,
    JSON.stringify(out.accepted.map((x) => x.term)));
  t('  ...ordered by first appearance',
    out.accepted.map((x) => x.term).join(',') === 'Tableau,SQL,Communication',
    out.accepted.map((x) => x.term).join(','));
  const report = SE.buildReport({ skills: [
    record('SQL', 'Python and SQL'),
    record('Communication', 'Communication is essential', { category: 'soft_skill' }),
  ] }, jd);
  t('  hard and soft are separate lists',
    report.hard_skills.length === 1 && report.soft_skills.length === 1,
    JSON.stringify({ h: report.hard_skills.length, s: report.soft_skills.length }));
}

console.log('\nREQUIREMENT STATUS IS CARRIED, NOT INVENTED');
{
  const jd = 'Required: SQL. Nice to have: Go. We also use Kafka.';
  const report = SE.buildReport({ skills: [
    record('SQL', 'Required: SQL'),
    record('Go', 'Nice to have: Go', { requirement: 'preferred' }),
    record('Kafka', 'We also use Kafka', { requirement: 'unspecified' }),
  ] }, jd);
  const by = {};
  for (const s of report.hard_skills) by[s.term] = s.requirement;
  t('  required stays required', by.SQL === 'required', JSON.stringify(by));
  t('  preferred stays preferred', by.Go === 'preferred', JSON.stringify(by));
  t('  unspecified stays unspecified', by.Kafka === 'unspecified', JSON.stringify(by));
  t('  and "Go" was not found inside "Required"',
    report.hard_skills.find((s) => s.term === 'Go').jd_literal_count === 1,
    JSON.stringify(report.hard_skills.find((s) => s.term === 'Go').jd_literal_occurrences));
}

console.log('\nA RESUME IS OPTIONAL AND NEVER ASSUMED PRESENT');
{
  const report = SE.buildReport({ skills: [record('SQL', 'SQL required')] }, 'SQL required');
  t('  with no resume there is no presence claim',
    !('literal_present' in report.hard_skills[0]),
    JSON.stringify(report.hard_skills[0]));
  const empty = SE.buildReport({ skills: [record('SQL', 'SQL required')] }, 'SQL required', '');
  t('  an empty resume reports absent, not unknown',
    empty.hard_skills[0].literal_present === false, JSON.stringify(empty.hard_skills[0]));
}

console.log('\nAND NOTHING HERE READS THE TAXONOMY');
{
  const src = fs.readFileSync(path.join(DIR, 'skill-evidence.js'), 'utf8');
  t('  the module never touches KeywordTaxonomy',
    src.indexOf('KeywordTaxonomy') === -1,
    'the extraction rules and the matching rules would stop being separate');
  t('  ...and does not require any other module',
    !/\brequire\(/.test(src.replace(/module\.exports/g, '')), 'it gained a dependency');
  // The pair that proves the separation is real rather than stated.
  t('  so PostgreSQL and Postgres are two different strings here',
    SE.occurrences('We use Postgres', 'PostgreSQL').length === 0
      && SE.occurrences('We use PostgreSQL', 'PostgreSQL').length === 1,
    'it resolved a synonym');
}

console.log('\nAND THE EXTENSION LOADS IT');
{
  const html = fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8');
  const manifest = fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8');
  t('  popup.html loads it', /<script src="skill-evidence\.js">/.test(html), 'never runs in the popup');
  t('  the manifest registers it', /skill-evidence\.js/.test(manifest), 'not registered');
}

console.log('\nAND THE CREDENTIAL IS NOWHERE NEAR THE BROWSER');
{
  const src = fs.readFileSync(path.join(DIR, 'skill-evidence.js'), 'utf8');
  t('  the module makes no network call',
    !/fetch\(|XMLHttpRequest|api\.openai\.com/.test(src),
    'the extraction call would run in the page, where the key would have to be');
  const fnDir = path.join(DIR, 'website', 'supabase', 'functions', 'extract-skills-evidence');
  t('  the extraction runs in an edge function instead',
    fs.existsSync(path.join(fnDir, 'index.ts')), 'no server-side extraction');
  const fn = fs.existsSync(path.join(fnDir, 'index.ts'))
    ? fs.readFileSync(path.join(fnDir, 'index.ts'), 'utf8') : '';
  t('  ...which reads the key from the environment',
    /Deno\.env\.get\(["']OPENAI_API_KEY["']\)/.test(fn), 'the key is not from the environment');
  t('  ...and never returns it, or the request headers, on failure',
    !/headers.*Authorization[\s\S]{0,80}(?:return|JSON\.stringify\(\{ error)/.test(fn)
      && !/error:.*apiKey|error:.*token/.test(fn), 'a failure could leak the credential');
  // Asserted by behaviour, not by my variable names: the deployed
  // function was written separately and calls the model a different way.
  t('  ...and sends the posting as data, under the authorised specification',
    /EXTRACTION_SPEC|EXTRACTION_PROMPT/.test(fn)
      && /role: "user", content: JSON\.stringify\(\{ *(?:untrusted_)?job_/.test(fn),
    'the posting would be concatenated into the instructions');
  t('  ...and returns the reply without deciding anything about it',
    !/score|verdict|percentage/i.test(fn.replace(/^\s*[*/].*$/gm, '')),
    'the server would be scoring, which the extension cannot check');
}

console.log('\nAND WHICHEVER ENVELOPE ARRIVES IS READ');
{
  // This was written against the Responses API. The function that got
  // deployed calls chat/completions and returns the model's JSON with no
  // envelope at all, so the extension unwrapped an undefined and reported
  // "the extraction did not complete" on every single call. Each side was
  // correct and together they did nothing. A working API key would not
  // have fixed it, and the symptom would have looked like a bad posting.
  const payload = { skills: [record('SQL', 'SQL required')] };
  const text = JSON.stringify(payload);

  t('  a bare result is taken as it is',
    SE.parseResponse(payload).skills.length === 1, 'the deployed shape is unreadable');
  t('  a chat/completions envelope is unwrapped',
    SE.parseResponse({ choices: [{ message: { content: text } }] }).skills.length === 1,
    'the deployed call style is unreadable');
  t('  a responses envelope still is',
    SE.parseResponse({ status: 'completed',
      output: [{ content: [{ type: 'output_text', text }] }] }).skills.length === 1,
    'the original shape broke');

  // And a refusal is still a refusal, in either envelope.
  for (const [name, res] of [
    ['a content filter', { choices: [{ finish_reason: 'content_filter', message: {} }] }],
    ['an explicit refusal', { choices: [{ message: { refusal: 'I cannot help with that.' } }] }],
  ]) {
    let message = '';
    try { SE.parseResponse(res); } catch (e) { message = e.message; }
    t('  ' + name.padEnd(20) + ' is reported as one', /declined/.test(message),
      message || 'it returned instead of throwing');
  }
  let empty = '';
  try { SE.parseResponse({ choices: [{ message: { content: '' } }] }); } catch (e) { empty = e.message; }
  t('  an empty completion is not an empty report', /no text/.test(empty), empty);
}

console.log('\nAND THE EXTENSION CALLS IT, AGAINST ONE STRING');
{
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  const fn = (/  async extractSkillsWithEvidence\([\s\S]*?\n  \}/m.exec(src) || [''])[0];
  t('  the popup has an entry point', fn.length > 400, String(fn.length));
  t('  ...that calls the edge function, not the model',
    /functions\/v1\/extract-skills-evidence/.test(fn) && !/api\.openai\.com/.test(fn),
    'the key would have to be in the page');
  t('  ...sending the posting sanitised, because a posting is data',
    /ATSTailor\.sanitiseJobText\(jd\)\.text/.test(fn), 'raw scrape sent to a model');

  // THE STRING SENT AND THE STRING CHECKED AGAINST MUST BE THE SAME.
  // Sanitising removes lines, so a quotation from what the model was
  // given need not appear in the raw scrape, and validating against the
  // raw scrape would reject genuine records as fabrications.
  t('  ...and validating against that same string',
    /buildReport\(data, safe,/.test(fn), 'a genuine quotation could be rejected as invented');
  t('  the resume is compared locally and never sent',
    /buildReport\(data, safe, resumeText/.test(fn)
      && !/resumeText[\s\S]{0,200}JSON\.stringify\(\{ jobDescription/.test(fn),
    'the CV would go to a third party to be string-searched');
  t('  a missing credential is not reported as a bad posting',
    /message \|\|/.test(fn), 'the server\'s reason is discarded');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
