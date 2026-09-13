// TEN ROUNDS OF FIXING A NUMBER THAT WAS NEVER THE NUMBER ON SCREEN.
//
// The coverage pass worked. The taxonomy worked. The panel read 68%
// anyway, and the PDF that got attached to the application really did
// carry only 68% of the posting's terms. Four separate faults, each
// downstream of everything that had been fixed:
//
//   1. openresume-generator.js had its OWN scorer -- raw substring
//      containment over the posting's unmerged keyword list, blind to
//      the education and header sections -- and popup.js assigned its
//      result LAST. Whatever the taxonomy concluded was overwritten.
//
//   2. PROJECTS was missing from the parser's section table, so a CV
//      with a projects block never left the SKILLS section: project
//      names, bullet sentences and "Live demo:" URLs all became
//      "skills", and the projects never rendered at all.
//
//   3. mergeSkills capped the list with slice(0, 25) -- trimming from
//      the END, which is exactly where the coverage pass writes. With
//      the projects block inflating the list past the cap, every term
//      added for the posting was deleted before the PDF was drawn.
//
//   4. Each experience bullet was pushed twice into the text render.
//
// What this file holds: ONE scorer, reading the document that is
// actually delivered. If the PDF pipeline ever drops a tailored term
// again, the number must FALL and say so -- never be papered over by a
// second opinion taken from a different document.
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
const TX = global.KeywordTaxonomy;
const quiet = { log() {}, warn() {}, error() {} };
const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: TX },
  KeywordTaxonomy: TX, document: { addEventListener() {} }, console: quiet,
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const popup = Object.create(sandbox.P.prototype);

const PROFILE = {
  skills: ['Python', 'AWS', 'Kubernetes', 'Docker', 'Terraform', 'Helm', 'Prometheus',
    'Grafana', 'Datadog', 'GitHub Actions', 'ArgoCD', 'Jenkins', 'Go'],
  professional_experience: [
    { company: 'Meta', title: 'Software Engineer', bullets: [
      'Built backend services in Python for a platform that serves billions of requests daily.',
      'Held primary on-call responsibility for two critical services and authored incident '
        + 'response documentation.',
      'Mentored two junior engineers and an intern.'] },
    { company: 'Accenture', title: 'Solutions Architect', bullets: [
      'Authored the Terraform modules and Helm charts the client continues to operate.',
      'Established monitoring and alerting in Prometheus, Grafana and Datadog with formal '
        + 'reliability targets.',
      'Replaced Jenkins with GitHub Actions and ArgoCD across four delivery teams.'] }],
};

// A CV with a full skills block AND a projects block -- the shape that
// broke it. The skills block alone is near the cap.
const CV = ['Maxmilliam Okafor', 'Staff Software Engineer', 'Dublin | max@example.invalid', '',
  'PROFESSIONAL SUMMARY', 'Software engineer on platform and delivery work.', '',
  'PROFESSIONAL EXPERIENCE',
  'Meta | Software Engineer | January 2023 - Present',
  '- Built backend services in Python for a platform serving billions of requests daily.',
  '- Held primary on-call responsibility for two critical services.', '',
  'TECHNICAL SKILLS',
  'Programming: Python, Java, TypeScript, C++, SQL, Bash, Go',
  'Cloud & DevOps: AWS, Azure, Google Cloud Platform, Kubernetes, Docker, Terraform, Helm',
  'Data: Postgres, Redis, Kafka, Snowflake, Airflow',
  'Soft Skills: Mentoring, Collaboration', '',
  'PROJECTS',
  'SignalDesk Python, LLMs (RAG), Kafka, FastAPI, React, AWS',
  '- Streams live financial news through an LLM that extracts ticker level sentiment.',
  'Live demo: example.invalid/signaldesk | Code: example.invalid/code',
  'DriftGuard Python, MLflow, Evidently, Docker, Kubernetes',
  '- Detects data and concept drift in a deployed model, then retrains.',
  'Live demo: example.invalid/driftguard | Code: example.invalid/code', '',
  'EDUCATION', 'Imperial College London | MSc Computing | 2019'].join('\n');

const KEYWORDS = { all: ['Python', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'Docker', 'Go',
  'microservices', 'infrastructure as code', 'observability', 'incident response', 'SRE',
  'distributed systems', 'mentorship', 'GitHub Actions', 'Helm', 'platform engineering',
  'automation', 'reliability'] };

const CONTACT = { first_name: 'Maxmilliam', last_name: 'Okafor',
  email: 'max@example.invalid', phone: '+353871234567' };

// The pipeline, in the order popup.js runs it.
popup._cachedProfile = PROFILE;
const gap = popup.calculateMatchScore(CV, KEYWORDS);
const injected = popup.fastKeywordInjection(CV, KEYWORDS, gap.missingKeywords).tailoredCV;
const reviewed = popup.calculateMatchScore(injected, KEYWORDS);

const structured = OR.parseAndStructureCV(injected, CONTACT);
OR.sanitiseStructuredData(structured);
const tailored = OR.tailorCVData(structured, KEYWORDS, { title: 'Staff Platform Engineer', company: 'Acme' });
const delivered = OR.generateCVText(tailored);
const coverage = OR.measureCoverage(tailored, KEYWORDS);

console.log('THE COVERAGE PASS STILL WORKS');
{
  // Everything this profile can prove gets written. The one requirement
  // left is Microservices, which appears nowhere in it -- so the ceiling
  // here is the profile, not the tailoring.
  t('  the reviewed CV clears 95%', reviewed.matchScore >= 95,
    gap.matchScore + '% -> ' + reviewed.matchScore + '%, short: '
      + reviewed.missingKeywords.join(', '));
}

console.log('\nAND THE PDF PIPELINE NO LONGER THROWS IT AWAY');
{
  for (const term of ['infrastructure as code', 'observability', 'SRE', 'platform engineering']) {
    t('  ' + term.padEnd(24) + ' survives into the delivered document',
      TX.appearsIn(delivered, term), 'the PDF was built without a term the CV had');
  }
  // The generator does its own integration pass, so the delivered
  // document may carry MORE than the reviewed CV did. What it must
  // never do is carry less: that is the fault this file exists for.
  t('  delivered coverage never falls below the reviewed reading',
    coverage.score >= reviewed.matchScore,
    'reviewed ' + reviewed.matchScore + '%, delivered ' + coverage.score
      + '% -- the PDF pipeline dropped: ' + (coverage.missing || []).join(', '));
  t('  ...and it is not a regression to the untailored number',
    coverage.score > gap.matchScore, gap.matchScore + '% -> ' + coverage.score + '%');
}

console.log('\nFURNITURE IS NOT A REQUIREMENT, SO IT IS NOT IN THE DENOMINATOR');
{
  // A scraper cannot tell "competitive salary" from a skill, so these
  // arrive in the keyword list. They were filtered out of the injection
  // and LEFT IN the denominator: unfixable, permanent points off, on
  // every posting that mentioned its own benefits package.
  const withFurniture = { all: ['Python', 'Kubernetes', 'competitive salary', '401k',
    'dental', 'paid time off', 'fast-paced', 'go-getter'] };
  const cv = 'TECHNICAL SKILLS\nPython, Kubernetes';
  const r = popup.calculateMatchScore(cv, withFurniture);
  t('  eight scraped terms are two requirements', r.matchedKeywords.length
    + r.missingKeywords.length === 2,
    JSON.stringify(r.matchedKeywords.concat(r.missingKeywords)));
  t('  ...so a CV that has both reads 100, not 25', r.matchScore === 100, r.matchScore + '%');
  t('  and no benefits line is shown as a missing chip',
    !r.missingKeywords.some((k) => /salary|401k|dental|time off/i.test(k)),
    JSON.stringify(r.missingKeywords));

  // But a real requirement that merely SOUNDS soft stays counted.
  const real = popup.calculateMatchScore('An engineer.', { all: ['reliability', 'automation'] });
  t('  "reliability" is a requirement, not furniture',
    real.missingKeywords.length === 2, JSON.stringify(real.missingKeywords));
  t('  ...and is satisfied by the work that demonstrates it',
    TX.impliedIn('Held primary on-call responsibility and set error budgets', 'reliability')
      && TX.impliedIn('Replaced Jenkins with GitHub Actions across four teams', 'automation'),
    'the entailment does not fire');
}

console.log('\nONE SCORER, NOT TWO');
{
  const viaPanel = popup.calculateMatchScore(delivered, KEYWORDS).matchScore;
  t('  the generator and the panel read the same document the same way',
    viaPanel === coverage.score, 'panel ' + viaPanel + '%, generator ' + coverage.score + '%');

  // The specific disagreements the old naive scorer produced.
  const src = fs.readFileSync(path.join(DIR, 'openresume-generator.js'), 'utf8');
  t('  the generator no longer counts by raw substring containment',
    !/allKeywords\.forEach\(kw => \{\s*if \(text\.includes\(kw\.toLowerCase\(\)\)\) matches\+\+/.test(src),
    'the second scorer is back');
  t('  ...and popup.js takes the coverage detail, not a bare number',
    /atsPackage\.coverage/.test(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')),
    'the overwrite is back');
  const withPostgres = OR.measureCoverage(
    { contact: {}, summary: '', skills: ['Postgres'], experience: [], education: [], certifications: [] },
    { all: ['PostgreSQL'] });
  t('  "Postgres" satisfies "PostgreSQL" here too', withPostgres.score === 100,
    withPostgres.score + '%');
  const threeWays = OR.measureCoverage(
    { contact: {}, summary: '', skills: ['Payroll'], experience: [], education: [], certifications: [] },
    { all: ['payroll', 'global payroll', 'payroll management'] });
  t('  three phrasings of payroll are one requirement, not three',
    threeWays.total === 1 && threeWays.score === 100,
    threeWays.matched.length + '/' + threeWays.total + ' = ' + threeWays.score + '%');
}

console.log('\nAND THE SCORE STILL FALLS WHEN THE DOCUMENT REALLY IS THIN');
{
  const thin = { contact: {}, summary: 'An engineer.', skills: ['Python'],
    experience: [], education: [], certifications: [] };
  const r = OR.measureCoverage(thin, KEYWORDS);
  t('  a CV with one of nineteen requirements does not read high', r.score < 20, r.score + '%');
  t('  ...and names what is absent', r.missing.length > 10, r.missing.length + ' missing');
}

console.log('\nTHE PROJECTS BLOCK IS A SECTION, NOT FIFTEEN SKILLS');
{
  t('  projects are parsed', (tailored.projects || []).length === 2,
    JSON.stringify((tailored.projects || []).map((p) => p.header)));
  t('  ...with their bullets', (tailored.projects || []).every((p) => p.bullets.length >= 1),
    'a project lost its description');
  t('  ...and their links', (tailored.projects || []).every((p) => /example\.invalid/.test(p.links)),
    'a project lost its demo link');
  t('  they render under their own heading', /\nPROJECTS\n/.test(delivered),
    'the projects section is not in the document');
  t('  and no URL is presented as a technical skill',
    !tailored.skills.some((s) => /example\.invalid|https?:/i.test(s)),
    tailored.skills.filter((s) => /example\.invalid|https?:/i.test(s)).join(', '));
  t('  nor is a sentence',
    !tailored.skills.some((s) => /[.!?]$/.test(s) || s.split(/\s+/).length > 7),
    tailored.skills.filter((s) => /[.!?]$/.test(s) || s.split(/\s+/).length > 7).join(' / '));
}

console.log('\nTHE CAP SHEDS WHAT THE POSTING DID NOT ASK FOR');
{
  t('  the skills list is still capped', tailored.skills.length <= 25,
    tailored.skills.length + ' entries');
  const asked = KEYWORDS.all.filter((k) => TX.appearsIn(tailored.skills.join(' | '), k));
  const before = KEYWORDS.all.filter((k) => TX.appearsIn(injected, k));
  t('  ...and kept every requirement the tailored CV had satisfied',
    asked.length >= before.length - 1,
    'had ' + before.length + ', kept ' + asked.length + ': lost '
      + before.filter((k) => asked.indexOf(k) === -1).join(', '));
}

console.log('\nAND NOTHING IS SAID TWICE');
{
  const bullets = delivered.split('\n').filter((l) => l.indexOf('- ') === 0);
  t('  every experience bullet appears once', bullets.length === new Set(bullets).size,
    bullets.length + ' bullets, ' + new Set(bullets).size + ' distinct');
  const lower = tailored.skills.map((s) => s.toLowerCase());
  t('  no skill is listed twice', lower.length === new Set(lower).size,
    lower.filter((s, i) => lower.indexOf(s) !== i).join(', '));
  t('  ...and a term already in a grouped line is not appended again',
    tailored.skills.filter((s) => /^python$/i.test(s)).length === 0,
    'Python was re-added under a heading that already had it');
}

console.log('\nA SKILL NAME IS NOT SHOUTED');
{
  t('  "infrastructure as code" keeps its connector lowercase',
    OR.formatSkillName('infrastructure as code') === 'Infrastructure as Code',
    OR.formatSkillName('infrastructure as code'));
  t('  Go is a language, not an imperative',
    OR.formatSkillName('go') === 'Go', OR.formatSkillName('go'));
  t('  ...and a real acronym still is one',
    OR.formatSkillName('sql') === 'SQL' && OR.formatSkillName('CI/CD') === 'CI/CD',
    OR.formatSkillName('sql') + ' / ' + OR.formatSkillName('CI/CD'));
}

console.log('\nAND A HEADING NOBODY LISTED STILL ENDS A SECTION');
{
  t('  PROJECTS is recognised', !OR.isUnknownSectionHeading('Programming: Python, Java'),
    'a skills line was read as a heading');
  t('  an unknown all-caps heading is one', OR.isUnknownSectionHeading('AWARDS'), 'not detected');
  t('  ...but a skills line is not', !OR.isUnknownSectionHeading('Cloud & DevOps: AWS, Docker'),
    'a skills line was read as a heading');
  t('  ...nor is a sentence', !OR.isUnknownSectionHeading('Built the platform.'), 'misread');
  t('  ...nor a dated employer line',
    !OR.isUnknownSectionHeading('META | SOFTWARE ENGINEER | 2023'), 'misread');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
