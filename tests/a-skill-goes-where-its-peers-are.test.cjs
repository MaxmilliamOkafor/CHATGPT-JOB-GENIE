// "ADDITIONAL SKILLS: KUBERNETES, KAFKA, SRE."
//
// Everything the coverage pass added landed on one line bolted to the
// end of the skills block, under a label that announces it. A person
// writing the same CV puts Kubernetes with the other infrastructure and
// Kafka with the other data tools; nobody opens a new line called
// "Additional Skills" to hold both.
//
// So each term goes to the existing group line its PEERS are already
// on. The line's label is never parsed: a CV can call its infrastructure
// line "Cloud & DevOps", "Infrastructure", "Platform" or "Tooling", and
// reading the label means guessing at all four. What identifies a line
// is what is already written on it.
//
// TWO THINGS THIS MUST NOT DO. It must not move or reword anything
// already on the page, and it must not put a term under a heading it
// does not belong to just because the right line was full -- "platform
// engineering" listed under Data Engineering is worse than listing it
// separately, and a reader notices.
//
// The category decides a LINE and nothing else. It never decides
// whether a term may be written at all, which stays with the evidence
// gate, and it never touches the coverage measurement.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'dynamic-score.js'));
const TX = global.KeywordTaxonomy;
const sandbox = {
  window: { addEventListener() {}, DynamicScore: global.DynamicScore, KeywordTaxonomy: TX },
  KeywordTaxonomy: TX, document: { addEventListener() {} },
  console: { log() {}, warn() {}, error() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const ATSTailor = sandbox.P;
const popup = Object.create(ATSTailor.prototype);

const PROFILE = {
  skills: ['Python', 'AWS', 'Kubernetes', 'Docker', 'Terraform', 'Helm', 'Prometheus',
    'Grafana', 'Datadog', 'Kafka', 'Airflow', 'FastAPI', 'MLflow', 'GitHub Actions'],
  professional_experience: [{ company: 'Meta', title: 'Software Engineer', bullets: [
    'Authored the Terraform modules and Helm charts the client operates.',
    'Established monitoring and alerting in Prometheus, Grafana and Datadog with formal '
      + 'reliability targets.',
    'Held primary on-call responsibility and authored incident response documentation.',
    'Built the ingestion pipeline in Airflow and Kafka.',
    'Shipped the service behind FastAPI and tracked models in MLflow.'] }],
};

const CV = ['Maxmilliam Okafor', 'Staff Engineer', 'Dublin | max@example.invalid', '',
  'PROFESSIONAL EXPERIENCE', 'Meta January 2023 - Present', 'Software Engineer',
  '- Built the ingestion pipeline.', '',
  'TECHNICAL SKILLS',
  'Programming: Python, Java, TypeScript',
  'Cloud & DevOps: AWS, Docker, Terraform',
  'Data Engineering: Apache Spark, Airflow, Kafka',
  'Soft Skills: Communication, Collaboration', '',
  'EDUCATION', 'Imperial College London'].join('\n');

popup._cachedProfile = PROFILE;
const KEYWORDS = { all: ['Python', 'AWS', 'observability', 'SRE', 'infrastructure as code',
  'REST APIs', 'MLOps', 'Kubernetes'] };
const gap = popup.calculateMatchScore(CV, KEYWORDS);
const out = popup.fastKeywordInjection(CV, KEYWORDS, gap.missingKeywords);
const lineWith = (text, term) => (text.split('\n')
  .find((l) => l.toLowerCase().indexOf(term.toLowerCase()) !== -1) || '');

console.log('EACH TERM LANDS WITH ITS PEERS');
for (const [term, label] of [
  ['observability', 'Cloud & DevOps'],
  ['SRE', 'Cloud & DevOps'],
  ['infrastructure as code', 'Cloud & DevOps'],
  ['Kubernetes', 'Cloud & DevOps'],
  ['REST APIs', 'Programming'],
]) {
  const line = lineWith(out.tailoredCV, term);
  t('  ' + term.padEnd(24) + ' joins ' + label, line.indexOf(label) === 0, line || 'not placed');
}

console.log('\nAND NOTHING ALREADY ON THE PAGE MOVES OR CHANGES');
{
  const before = CV.split('\n');
  const after = out.tailoredCV.split('\n');
  for (const label of ['Programming', 'Cloud & DevOps', 'Data Engineering', 'Soft Skills']) {
    const b = before.find((l) => l.indexOf(label + ':') === 0);
    const a = after.find((l) => l.indexOf(label + ':') === 0);
    t('  the ' + label + ' line still starts as it did',
      !!a && a.indexOf(b) === 0, JSON.stringify([b, a]));
  }
  t('  and no existing term was dropped',
    ['Python', 'Java', 'TypeScript', 'Apache Spark', 'Airflow', 'Kafka', 'Communication']
      .every((s) => out.tailoredCV.indexOf(s) !== -1), 'something was lost');
  t('  the other sections are untouched',
    out.tailoredCV.indexOf('PROFESSIONAL EXPERIENCE') !== -1
      && out.tailoredCV.indexOf('Imperial College London') !== -1, 'a section was damaged');
}

console.log('\nTHE LABEL IS NEVER READ, ONLY WHAT IS ON THE LINE');
{
  // The same CV with the headings renamed to things no table lists.
  const renamed = CV
    .replace('Cloud & DevOps:', 'Kit I reach for:')
    .replace('Programming:', 'Languages:');
  const r = popup.fastKeywordInjection(renamed,
    popup.calculateMatchScore(renamed, KEYWORDS) && KEYWORDS,
    popup.calculateMatchScore(renamed, KEYWORDS).missingKeywords);
  t('  observability still finds the infrastructure line',
    lineWith(r.tailoredCV, 'observability').indexOf('Kit I reach for:') === 0,
    lineWith(r.tailoredCV, 'observability'));
  t('  ...and REST APIs still finds the languages line',
    lineWith(r.tailoredCV, 'REST APIs').indexOf('Languages:') === 0,
    lineWith(r.tailoredCV, 'REST APIs'));
}

console.log('\nA FULL LINE SENDS THE TERM SIDEWAYS, NOT TO THE WRONG GROUP');
{
  const packed = CV.replace('Cloud & DevOps: AWS, Docker, Terraform',
    'Cloud & DevOps: AWS, Docker, Terraform, Helm, Ansible, Puppet, Chef, Nomad, Consul, Vault');
  const before2 = popup.calculateMatchScore(packed, KEYWORDS);
  const r = popup.fastKeywordInjection(packed, KEYWORDS, before2.missingKeywords);
  const line = lineWith(r.tailoredCV, 'observability');
  t('  observability does not gatecrash Data Engineering',
    line.indexOf('Data Engineering') !== 0, line);
  t('  ...it goes to a line of its own instead',
    /^Additional Skills:/.test(line) || line === '', line);
  t('  and the full line is not made longer',
    (r.tailoredCV.split('\n').find((l) => l.indexOf('Cloud & DevOps:') === 0) || '')
      .split(',').length === 10, 'the cap was breached');
}

console.log('\nAND ONE LABEL IS USED ONCE');
{
  // He already keeps an "Additional Skills" line of his own; a second
  // one under the same label is a formatting fault a reader sees.
  const withOwn = CV.replace('Soft Skills: Communication, Collaboration',
    'Soft Skills: Communication, Collaboration\nAdditional Skills: Operational Resolution');
  const before3 = popup.calculateMatchScore(withOwn, KEYWORDS);
  const r = popup.fastKeywordInjection(withOwn, KEYWORDS, before3.missingKeywords);
  const labels = r.tailoredCV.split('\n').filter((l) => /^Additional Skills:/i.test(l));
  t('  there is at most one Additional Skills line', labels.length <= 1,
    labels.length + ': ' + JSON.stringify(labels));
  t('  ...and what he wrote there is still there',
    r.tailoredCV.indexOf('Operational Resolution') !== -1, 'his own entry was replaced');
}

console.log('\nTHE CATEGORY DECIDES A LINE AND NOTHING ELSE');
{
  t('  a term with no category is not forced onto a line',
    TX.categoryOf('Zorblatt') === null, TX.categoryOf('Zorblatt'));
  t('  ...and coverage is unchanged by any of this',
    popup.calculateMatchScore(out.tailoredCV, KEYWORDS).matchScore
      === popup.calculateMatchScore(out.tailoredCV, KEYWORDS).matchScore,
    'measurement moved');
  t('  an unevidenced term is still refused, wherever it would have sat',
    !/Zendesk/i.test(popup.fastKeywordInjection(CV, { all: ['Zendesk'] }, ['Zendesk']).tailoredCV),
    'the gate was bypassed by the placement');
  const surface = TX.categoryOf('K8s') || TX.categoryOf('Kubernetes');
  t('  a surface form categorises like its canonical name',
    TX.categoryOf('Postgres') === TX.categoryOf('PostgreSQL') && !!surface,
    TX.categoryOf('Postgres') + ' / ' + TX.categoryOf('PostgreSQL'));
}

console.log('\nAND "7+ YEARS" IS NOT A SKILL TO TICK AND SAVE');
{
  // It arrived as a chip and was offered in the gap list as something
  // to claim. It is a screening criterion: the dates in the experience
  // section answer it, and "Python, Kubernetes, 7+ years" is nonsense
  // on a CV. Counting it made it a permanent miss as well.
  for (const k of ['7+ years', '5 years experience', '3-5 years', 'minimum 8 years',
    "Bachelor's degree", '10+ years of relevant experience']) {
    t('  ' + k.padEnd(34) + ' is a criterion', ATSTailor.isCriterion(k), 'offered as a skill');
  }
  for (const k of ['Python', 'design patterns', 'multi-tenant', 'self-organised',
    'stakeholder management']) {
    t('  ' + k.padEnd(34) + ' is a skill', !ATSTailor.isCriterion(k), 'wrongly filtered');
  }
  t('  ...so it leaves the denominator',
    JSON.stringify(ATSTailor.requirementsOnly(['Python', '7+ years', 'AWS', '401k']))
      === JSON.stringify(['Python', 'AWS']),
    JSON.stringify(ATSTailor.requirementsOnly(['Python', '7+ years', 'AWS', '401k'])));
  const r = popup.calculateMatchScore('TECHNICAL SKILLS\nPython, AWS',
    { all: ['Python', 'AWS', '7+ years', "Bachelor's degree"] });
  t('  ...and a CV with both skills reads 100, not 50', r.matchScore === 100,
    r.matchScore + '%, missing ' + JSON.stringify(r.missingKeywords));
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
