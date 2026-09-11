// A PLATFORM ENGINEER APPLYING TO A PLATFORM ROLE SCORED SEVENTY.
//
// Not because the CV was thin. Because the gate that decides whether a
// requirement may be written onto it demanded the requirement's OWN
// WORDS, and a profile does not describe work that way:
//
//   the posting asked for     the profile said
//   Infrastructure as Code    "authored the Terraform modules and Helm
//                              charts the client continues to operate"
//   Observability             "monitoring and alerting in Prometheus,
//                              Grafana and Datadog"
//   SRE                       "primary on-call responsibility ... formal
//                              reliability targets"
//   Scalability               "serves billions of requests daily"
//
// Six requirements withheld from a CV that proved every one of them.
// Using Terraform IS doing infrastructure as code; running Prometheus,
// Grafana and Datadog IS observability. A table of those entailments is
// the difference between naming a capability and demonstrating it.
//
// THE LINE THIS FILE HOLDS. The table is consulted ONLY when deciding
// whether a term may be added to the CV. Whether the finished CV
// MATCHES stays a literal test, because an ATS is literal: naming
// Terraform does not make a document contain the words "infrastructure
// as code", and the coverage meter must never pretend otherwise.
//
// And every entry has to be an entailment, not an association. "Improved
// a process" is not continuous improvement in the sense a posting means,
// and a resume that mentions AWS has not thereby done security work.
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
const popup = Object.create(sandbox.P.prototype);

const PROFILE = {
  skills: ['Python', 'AWS', 'Kubernetes', 'Docker', 'Terraform', 'Helm', 'Prometheus',
    'Grafana', 'Datadog', 'GitHub Actions', 'ArgoCD', 'Jenkins', 'PySpark', 'Airflow'],
  professional_experience: [
    { company: 'Meta', title: 'Software Engineer', bullets: [
      'Built backend services in Python for the ads delivery platform, which serves '
        + 'billions of requests daily.',
      'Held primary on-call responsibility for two critical services and authored '
        + 'incident response documentation.',
      'Mentored two junior engineers and an intern.'] },
    { company: 'Accenture', title: 'Solutions Architect', bullets: [
      'Authored the Terraform modules and Helm charts the client continues to operate.',
      'Established monitoring and alerting in Prometheus, Grafana and Datadog with formal '
        + 'reliability targets.',
      'Replaced Jenkins with GitHub Actions and ArgoCD across four delivery teams.'] }],
};

const CV = ['Maxmilliam Okafor', 'Staff Software Engineer', 'Dublin | max@example.invalid', '',
  'PROFESSIONAL SUMMARY', 'Software engineer on platform and delivery work.', '',
  'PROFESSIONAL EXPERIENCE', 'Meta January 2023 - Present', 'Software Engineer',
  '- Built backend services in Python for a platform serving billions of requests daily.', '',
  'TECHNICAL SKILLS',
  'Programming: Python, Go',
  'Cloud & DevOps: AWS, Kubernetes, Docker, Terraform, Helm', '',
  'EDUCATION', 'Imperial College London'].join('\n');

console.log('THE TOOL PROVES THE CAPABILITY');
for (const [requirement, proof] of [
  ['Infrastructure as Code', 'Terraform and Helm'],
  ['Observability', 'Prometheus, Grafana and Datadog'],
  ['SRE', 'on-call and reliability targets'],
  ['Scalability', 'billions of requests daily'],
  ['CI/CD', 'GitHub Actions, ArgoCD, Jenkins'],
  ['Data Engineering', 'Airflow and PySpark'],
  ['Mentorship', 'mentored two junior engineers'],
]) {
  const blob = popup._profileEvidenceBlob.call({ _cachedProfile: PROFILE });
  t('  ' + requirement.padEnd(24) + ' <- ' + proof,
    popup._profileEvidences(requirement, blob), 'the profile proves it and the gate said no');
}

console.log('\nAND AN ASSOCIATION IS NOT AN ENTAILMENT');
{
  const blob = popup._profileEvidenceBlob.call({ _cachedProfile: PROFILE });
  for (const [requirement, why] of [
    ['Zendesk', 'never touched it'],
    ['Linux', 'not named anywhere in the profile'],
    ['Payroll', 'a different profession entirely'],
    ['Salesforce', 'never touched it'],
    ['Rust', 'never touched it'],
  ]) {
    t('  ' + requirement.padEnd(24) + ' stays off (' + why + ')',
      !popup._profileEvidences(requirement, blob), 'an unevidenced term was allowed through');
  }
}

console.log('\nTHE MATCH TEST STAYS LITERAL, BECAUSE AN ATS IS LITERAL');
{
  const terraformOnly = 'Cloud & DevOps: AWS, Kubernetes, Docker, Terraform, Helm';
  t('  naming Terraform does not make a CV "contain" infrastructure as code',
    !TX.appearsIn(terraformOnly, 'Infrastructure as Code'),
    'the coverage meter would report a term the document does not carry');
  t('  ...and naming Prometheus does not make it contain observability',
    !TX.appearsIn('Monitoring in Prometheus and Grafana', 'Observability'),
    'the meter would overstate the document');
  t('  the word itself still matches',
    TX.appearsIn('Additional Skills: Infrastructure as Code', 'Infrastructure as Code'),
    'the literal test broke');
}

console.log('\nEND TO END: THE ROLE HE IS QUALIFIED FOR');
{
  popup._cachedProfile = PROFILE;
  const keywords = { all: ['Python', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'Docker',
    'infrastructure as code', 'observability', 'incident response', 'SRE', 'scalability',
    'mentorship', 'Linux', 'Zendesk'] };
  const before = popup.calculateMatchScore(CV, keywords);
  const out = popup.fastKeywordInjection(CV, keywords, before.missingKeywords);
  const after = popup.calculateMatchScore(out.tailoredCV, keywords);
  t('  coverage rises well past the old ceiling', after.matchScore >= 85,
    before.matchScore + '% -> ' + after.matchScore + '%');
  for (const term of ['infrastructure as code', 'observability', 'SRE']) {
    t('    ...' + term + ' is now on the page',
      out.tailoredCV.toLowerCase().indexOf(term.toLowerCase()) !== -1,
      'evidenced and still withheld');
  }
  t('  and what the profile cannot support is still refused',
    !/Zendesk/i.test(out.tailoredCV), 'a fabricated term reached the CV');
  t('  ...and is named so it can be fixed at the source',
    (out.reviewKeywords || []).some((k) => /Zendesk/i.test(k)),
    JSON.stringify(out.reviewKeywords));
}

console.log('\nAND A POSTING\'S PHRASING IS NOT A NEW REQUIREMENT');
{
  // "feedback" and "team performance" arrived as two more chips on a
  // posting that had already asked for performance management, and the
  // denominator counted all three.
  const asked = ['performance management', 'feedback', 'team performance',
    'payroll', 'global payroll', 'payroll management'];
  const entries = TX.dedupe(asked);
  t('  six strings are two requirements', entries.length === 2,
    entries.length + ': ' + entries.map((e) => e.label).join(', '));
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
