// WHAT THE EMPLOYER REQUIRES, SEPARATED FROM EVERYTHING ELSE.
//
// A posting is a requirements list wrapped in a company pitch, a values
// list, a benefits table, a working-conditions note and a page of legal
// text. Read as one flat blob it produces chips like these, every one
// taken from a single real IT-support posting:
//
//   Benefits Administration   the employee benefits section
//   Training, Mentorship      "training budget", "mentorship programme"
//   Ownership                 equity, not accountability
//   Presentation              presentation EQUIPMENT in a meeting room
//   warmth, flexibility       culture adjectives
//   physical office work      a working condition
//
// Since the coverage pass writes whatever extraction returns, all six
// were landing in the skills section of a real CV. Precision here is not
// tidiness: it decides what the candidate claims in writing.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'jd-requirements.js'));
const TX = global.KeywordTaxonomy;
const JDR = global.JDRequirements;

const WEBFLOW = fs.readFileSync(path.join(__dirname, 'fixtures', 'webflow-it-support.txt'), 'utf8');
const result = JDR.extract(WEBFLOW);
const labels = result.requirements.map((r) => r.label);
const reasonFor = (term) => (result.excluded.find((e) =>
  String(e.term).toLowerCase() === term.toLowerCase()) || {}).reason || '';

console.log('THE BENEFITS SECTION IS NOT A LIST OF REQUIREMENTS');
{
  t('  Benefits Administration is not a requirement here',
    !labels.includes('Benefits Administration'), labels.join(', '));
  t('  ...a training budget is not a Training requirement',
    !labels.includes('Training'), labels.join(', '));
  t('  ...a mentorship programme is not a Mentorship requirement',
    !labels.includes('Mentorship'), labels.join(', '));
  t('  ...and each says why', ['Benefits Administration', 'Training', 'Mentorship']
    .every((k) => reasonFor(k)), JSON.stringify(result.excluded.slice(0, 6)));
}

console.log('\nNOR IS THE CULTURE PARAGRAPH');
{
  for (const adj of ['warmth', 'flexibility', 'curiosity']) {
    t('  "' + adj + '" is not a skill', !labels.some((l) => l.toLowerCase() === adj),
      labels.join(', '));
  }
  // Communication and Attention to Detail ARE things you do and can point
  // at, and the posting asks for them in its requirements section.
  t('  ...while Communication still is', labels.includes('Communication'), labels.join(', '));
  t('  ...and so is Attention to Detail', labels.includes('Attention to Detail'), labels.join(', '));
}

console.log('\nA WORKING CONDITION IS RECORDED, NOT SCORED');
{
  t('  "physical office work" is not a skill chip',
    !labels.some((l) => /physical office/i.test(l)), labels.join(', '));
  t('  ...but it is kept for the person deciding whether to apply',
    result.conditions.some((c) => /physical office work/i.test(c.label)),
    JSON.stringify(result.conditions));
  t('  ...as is the lifting requirement',
    result.conditions.some((c) => /lift up to 50lbs/i.test(c.label)),
    JSON.stringify(result.conditions));
}

console.log('\nTHE SAME WORD MEANS DIFFERENT THINGS IN DIFFERENT PLACES');
{
  // Ownership appears three times in this posting: a company value, an
  // equity benefit, and a real duty. Only the duty is a requirement.
  t('  Ownership survives, from "take ownership of recurring problems"',
    labels.includes('Ownership'), labels.join(', '));
  const own = result.requirements.find((r) => r.label === 'Ownership');
  t('  ...and its evidence is the duty, not the equity line',
    own && /recurring problems/i.test(own.evidence), own && own.evidence);

  // Onboarding is never bare: the posting always says whose.
  t('  Onboarding is qualified as IT Onboarding', labels.includes('IT Onboarding'),
    labels.join(', '));
  t('  ...and the bare word is not a requirement', !labels.includes('Onboarding'),
    labels.join(', '));

  // Presentation equipment is hardware, not public speaking.
  t('  Presentation is not claimed from meeting-room equipment',
    !labels.includes('Presentation'), labels.join(', '));
  t('  ...while the equipment itself is Audiovisual', labels.includes('Audiovisual'),
    labels.join(', '));

  // AI-powered support tools is using AI, not building it.
  t('  AI is the supported capability', labels.includes('AI'), labels.join(', '));
  t('  ...and no model-development requirement is inferred',
    !labels.some((l) => /machine learning|pytorch|tensorflow|model deployment/i.test(l)),
    labels.join(', '));
}

console.log('\nTHE REAL REQUIREMENTS ARE ALL THERE');
{
  for (const want of ['Help Desk', 'Ticketing', 'macOS', 'Windows', 'Google Workspace',
    'Jamf', 'Device Management', 'Inventory Management', 'Provisioning',
    'Hardware Troubleshooting', 'Software Troubleshooting', 'Okta', 'Slack',
    'ServiceNow', 'Python']) {
    t('  ' + want.padEnd(24) + ' is extracted', labels.includes(want), labels.join(', '));
  }
}

console.log('\nAND THEY CARRY THE STATUS THE POSTING GAVE THEM');
{
  const status = (l) => (result.requirements.find((r) => r.label === l) || {}).status;
  t('  what the posting requires is "required"', status('Jamf') === 'required', status('Jamf'));
  t('  what it lists as a duty is "responsibility"',
    status('Ticketing') === 'responsibility', status('Ticketing'));
  t('  what it calls nice to have is "preferred"',
    status('Python') === 'preferred' && status('Okta') === 'preferred',
    status('Python') + '/' + status('Okta'));
}

console.log('\nEVERY REQUIREMENT CAN BE POINTED AT IN THE POSTING');
{
  const bad = result.requirements.filter((r) => !r.evidence || WEBFLOW.indexOf(r.evidence) === -1);
  t('  no requirement was invented', bad.length === 0, JSON.stringify(bad.map((r) => r.label)));
  const spans = result.requirements.filter((r) =>
    WEBFLOW.slice(r.start, r.end).trim() !== r.evidence.trim());
  t('  ...and every offset lands on its own evidence', spans.length === 0,
    JSON.stringify(spans.slice(0, 3).map((r) => [r.label, WEBFLOW.slice(r.start, r.end)])));
}

console.log('\nA DUTY SENTENCE IS REPLACED BY THE CAPABILITY IT NAMES');
{
  // "Diagnose hardware and software issues" is literally in the posting,
  // so a literal check keeps it, and no CV contains that string.
  const { kept, dropped } = JDR.filterAgainstPosting([
    'Resolve employee tickets', 'Diagnose hardware and software issues',
    'Maintain hardware and software inventory'], WEBFLOW);
  t('  all three sentences go', kept.length === 0, JSON.stringify(kept));
  t('  ...each naming what replaced it',
    dropped.every((d) => /duty sentence/.test(d.reason)), JSON.stringify(dropped));
}

console.log('\nAMBIGUOUS TERMS RESOLVE FROM THEIR OWN SENTENCE');
{
  const cases = [
    ['Go', 'Experience with Python, Go, and Java in production.', 'Go'],
    ['Go', 'You go the extra mile for your colleagues.', null],
    ['React', 'Build interfaces in React and TypeScript.', 'React'],
    ['React', 'You react quickly when priorities change.', null],
    ['Excel', 'Advanced Excel including pivot tables and macros.', 'Excel'],
    ['Excel', 'You will excel in this role if you are curious.', null],
    ['Access', 'Build reporting in Microsoft Access and SQL Server.', 'Access'],
    ['Access', 'Grant access to systems and manage access reviews.', null],
    ['Teams', 'Administer Microsoft Teams and SharePoint Online.', 'Teams'],
    ['Teams', 'You will work with cross-functional teams daily.', null],
    ['Windows', 'Support Windows 11 and macOS laptops.', 'Windows'],
    ['Windows', 'Deploy during agreed maintenance windows.', null],
    ['Spring', 'Java and Spring Boot microservices.', 'Spring'],
    ['Spring', 'The programme launches in spring 2026.', null],
    ['Rust', 'Systems programming in Rust and C++.', 'Rust'],
    ['Rust', 'Inspect equipment for rust and corrosion.', null],
    ['Swift', 'Build iOS apps in Swift and SwiftUI.', 'Swift'],
    ['Swift', 'We value swift resolution of customer issues.', null],
    ['Swift', 'Process SWIFT payments and reconcile transfers.', null],
    ['Make', 'Automate workflows with Zapier and Make.', 'Make'],
    ['Make', 'Make sure every ticket is closed the same day.', null],
    ['Chef', 'Configuration management with Chef and Ansible.', 'Chef'],
    ['Chef', 'Our head chef prepares lunch daily.', null],
    ['Assembly', 'Low-level work in C and Assembly language.', 'Assembly'],
    ['Assembly', 'Work on the assembly line in our plant.', null],
    ['Security', 'Own our cloud security posture and endpoint security.', 'Security'],
    ['Security', 'A security guard is on site at all times.', null],
    ['Networking', 'Configure networking equipment, switches and firewalls.', 'Networking'],
    ['Networking', 'Networking opportunities with industry peers.', null],
    ['Inventory Management', 'Maintain hardware inventory across the estate.', 'Inventory Management'],
    ['Workday', 'Configure Workday HCM and build Workday reports.', 'Workday'],
    ['Workday', 'A typical workday starts at nine.', null],
  ];
  for (const [term, sentence, want] of cases) {
    const got = JDR.resolve(term, sentence);
    const ok = want === null ? got === null : got === want;
    t('  ' + (want === null ? 'rejects' : 'keeps  ') + ' ' + term.padEnd(11)
      + JSON.stringify(sentence.slice(0, 44)), ok, 'got ' + JSON.stringify(got));
  }
}

console.log('\nA PRODUCT NAME THAT IS ALSO AN ORDINARY WORD NEEDS ITS CONTEXT');
{
  // The vocabulary is nine hundred concepts, and a good many of them are
  // words a careers page already uses in a sentence. Every pair below is
  // the same name twice: once as English, once as the tool.
  const req = (line) => JDR.extract('Requirements\n- ' + line + '\n')
    .requirements.map((r) => r.label);
  const PROSE = [
    'We are looking for a lighthouse project to showcase our work.',
    'You will feast on interesting problems with a lit team culture.',
    'Maintain your sanity in a fast-paced environment, we make it fun.',
    'A remix of design and engineering, with real ownership and pace.',
    'You will be the kong of your domain and a wizard with customers.',
    'Bring energy, artillery of ideas, and a locust-like appetite for scale.',
    'Percy in accounts will onboard you; grab a soda from the kitchen.',
    'We move at pace and ray of sunshine attitudes are welcome here.',
    'Free lunch, a pest-free office and a heap of learning opportunities.',
    'We serve customer segments across EMEA with unity and emotion.',
  ];
  for (const line of PROSE) {
    const got = req(line);
    t('  nothing from: ' + JSON.stringify(line.slice(0, 46)), got.length === 0, got.join(', '));
  }
  const TECH = [
    ['Run Lighthouse audits and axe-core checks in CI.', 'Lighthouse'],
    ['Load testing with Locust and Artillery.', 'Locust'],
    ['Load testing with Locust and Artillery.', 'Artillery'],
    ['Visual regression testing with Percy and Applitools.', 'Percy'],
    ['Feature store built on Feast and Tecton.', 'Feast'],
    ['Vector search with Chroma and pgvector.', 'Chroma'],
    ['Runtime security with Falco and Wiz.', 'Falco'],
    ['API gateway using Kong and Envoy.', 'Kong'],
    ['Data quality checks with Soda and Great Expectations.', 'Soda'],
    ['Build UIs with Lit and Storybook.', 'Lit'],
    ['Content modelling in Sanity and Contentful.', 'Sanity'],
    ['Remix Run routes and loaders with React Router.', 'Remix'],
    ['Product analytics in Heap and Amplitude.', 'Heap'],
    ['Customer data platform work in Segment and RudderStack.', 'Segment'],
  ];
  for (const [line, want] of TECH) {
    t('  ' + want.padEnd(11) + ' is found when it is the tool', req(line).includes(want),
      req(line).join(', '));
  }
}

console.log('\nAND THE VOCABULARY REACHES THE WORK IT WAS ADDED FOR');
{
  // A requirement the table cannot name is invisible however plainly it
  // is asked for. These are the shapes a modern posting actually uses.
  const cases = [
    ['Serve models with vLLM and Triton Inference Server.', 'vLLM'],
    ['Retrieval over pgvector with LangChain and reranking.', 'pgvector'],
    ['SAST with Semgrep and Snyk in the pipeline.', 'Semgrep'],
    ['Integration tests using Testcontainers and Pact.', 'Testcontainers'],
    ['Build Workday Studio integrations and Workday Extend apps.', 'Workday Studio'],
    ['Instrument with OpenTelemetry and ship to Honeycomb.', 'OpenTelemetry'],
    ['Policy as Code with Open Policy Agent and Kyverno.', 'Open Policy Agent'],
    ['Change data capture with Debezium and Kafka Connect.', 'Debezium'],
    ['Dimensional modelling with star schema and slowly changing dimensions.', 'Star Schema'],
    ['Trunk-based development with feature flags in LaunchDarkly.', 'Feature Flags'],
    ['Chaos engineering and fault injection against our RTO.', 'Chaos Engineering'],
    ['Detection-as-code with Sigma rules and MITRE ATT&CK mapping.', 'Detection-as-Code'],
    ['Geospatial analysis in PostGIS and QGIS.', 'PostGIS'],
    ['PLC programming and SCADA integration over Modbus.', 'SCADA'],
  ];
  for (const [line, want] of cases) {
    const got = JDR.extract('Requirements\n- ' + line + '\n').requirements.map((r) => r.label);
    t('  ' + want.padEnd(22) + ' is extracted', got.includes(want), got.join(', '));
  }
}

console.log('\nAND DISTINCT TECHNOLOGIES ARE NEVER MERGED');
{
  for (const [a, b] of [['Git', 'GitHub'], ['Git', 'GitHub Actions'], ['ETL', 'ELT'],
    ['Docker', 'Kubernetes'], ['Java', 'JavaScript'], ['React', 'React Native']]) {
    const ka = TX.keyOf(a), kb = TX.keyOf(b);
    t('  ' + a + ' is not ' + b, ka !== kb, ka + ' === ' + kb);
  }
  for (const [a, b] of [['Postgres', 'PostgreSQL'], ['K8s', 'Kubernetes'], ['ML', 'Machine Learning']]) {
    t('  ' + a + ' IS ' + b, TX.keyOf(a) === TX.keyOf(b), TX.keyOf(a) + ' vs ' + TX.keyOf(b));
  }
  // Technical punctuation survives.
  for (const p of ['C++', 'C#', '.NET', 'CI/CD', 'Node.js']) {
    t('  ' + p.padEnd(8) + ' survives as itself', !!TX.groupOf(p), 'lost from the table');
  }
}

console.log('\nAN UNKNOWN TERM IS KEPT WHEN THE POSTING STATES IT');
{
  // The table must not become an allowlist that misses emerging tools.
  const jd = 'Requirements\n- Experience with Zorblatt Cloud and Python.\n';
  const { kept, dropped } = JDR.filterAgainstPosting(['Zorblatt Cloud', 'Databricks'], jd);
  t('  an unfamiliar tool the posting names is kept', kept.includes('Zorblatt Cloud'),
    JSON.stringify(kept));
  t('  ...and one it never mentions is not', !kept.includes('Databricks'),
    JSON.stringify(kept));
  t('  ...with a reason given', dropped.some((d) => /Databricks/.test(d.term)),
    JSON.stringify(dropped));
}

console.log('\nOTHER ROLE FAMILIES, SAME RULES');
{
  const FIN = ['Financial Analyst', '', 'About us', 'We are a warm, curious team.', '',
    'Responsibilities', '- Own month-end close and prepare management accounts.',
    '- Build forecasting models in Excel and Power BI.', '',
    'Requirements', '- Qualified accountant with strong reconciliation experience.', '',
    'Benefits', '- Training budget and mentorship programme.',
    '- Benefits administration handled for you.'].join('\n');
  const fin = JDR.extract(FIN).requirements.map((r) => r.label);
  t('  finance: Excel and Power BI are extracted',
    fin.includes('Excel') && fin.includes('Power BI'), fin.join(', '));
  t('  finance: Financial Reporting from month-end close',
    fin.includes('Financial Reporting') || fin.includes('Reconciliation'), fin.join(', '));
  t('  finance: the benefits section contributes nothing',
    !fin.includes('Training') && !fin.includes('Mentorship')
      && !fin.includes('Benefits Administration'), fin.join(', '));
  t('  finance: and the culture line contributes nothing',
    !fin.some((l) => /warm|curious/i.test(l)), fin.join(', '));

  const HR = ['People Partner', '', 'What you will do',
    '- Run employee onboarding for every new starter.',
    '- Handle employee relations cases and performance reviews.', '',
    'Benefits', '- Mentorship programme and a generous training budget.'].join('\n');
  const hr = JDR.extract(HR).requirements.map((r) => r.label);
  t('  HR: onboarding is qualified as Employee Onboarding',
    hr.includes('Employee Onboarding'), hr.join(', '));
  t('  HR: employee relations is extracted', hr.includes('Employee Relations'), hr.join(', '));
  t('  HR: and its benefits section still contributes nothing',
    !hr.includes('Training') && !hr.includes('Mentorship'), hr.join(', '));

  // The same word, a genuine duty this time.
  const BEN = ['Benefits Specialist', '', 'Responsibilities',
    '- You will administer benefits for 400 staff, including medical and pension.'].join('\n');
  const ben = JDR.extract(BEN).requirements.map((r) => r.label);
  t('  benefits specialist: Benefits Administration IS a requirement here',
    ben.includes('Benefits Administration'), ben.join(', '));
}

console.log('\nAND THE AWKWARD SHAPES DO NOT BREAK IT');
{
  t('  an empty posting yields nothing', JDR.extract('').requirements.length === 0, 'invented');
  t('  ...and does not throw on null', JDR.extract(null).requirements.length === 0, 'threw');
  const noHeadings = 'We need someone with Python, SQL and Airflow to build pipelines.';
  t('  a posting with no headings is still read',
    JDR.extract(noHeadings).requirements.some((r) => r.label === 'Python'),
    JSON.stringify(JDR.extract(noHeadings).requirements.map((r) => r.label)));
  const misspelt = 'Requirments\n- Kubernetes and Terraform experience.\n';
  t('  a misspelt heading does not lose the section',
    JDR.extract(misspelt).requirements.some((r) => r.label === 'Kubernetes'),
    JSON.stringify(JDR.extract(misspelt).requirements.map((r) => r.label)));
  const negated = 'Requirements\n- No previous Kubernetes experience is required.\n';
  t('  a negative statement is not a requirement',
    !JDR.extract(negated).requirements.some((r) => r.label === 'Kubernetes'),
    JSON.stringify(JDR.extract(negated).requirements.map((r) => r.label)));
}

console.log('\nA COMBINED HEADING KEEPS THE HALF THAT IS THE JOB');
{
  // First hit wins, and BENEFITS used to sit above REQUIRED. So a heading
  // naming both resolved to the half that is NOT the job and every
  // requirement under it vanished. A leaked keyword is visible on screen;
  // a deleted section is not, which makes this the worse direction.
  const req = (jd) => JDR.extract(jd).requirements.map((r) => r.label);
  for (const [heading, want] of [
    ['Skills and Benefits', 'Python'],
    ['Your experience and what we offer', 'Python'],
    ['Compensation and Qualifications', 'Python'],
    ['Who we are looking for', 'Python'],
    ['Your profile', 'Python'],
    ['The ideal candidate', 'Python'],
    ['What success looks like', 'Python'],
    ['Position Summary', 'Python'],
  ]) {
    const jd = 'Role\n\n' + heading + '\n- Strong Python and SQL experience.\n';
    t('  "' + heading + '" is read', req(jd).includes(want), req(jd).join(', '));
  }
  // And the ones that really are not the job stay out.
  for (const heading of ['Benefits', 'Perks', 'What we offer', 'Our offer',
    'Why you should apply', 'About us', 'Our values', 'Life at Acme',
    'Equal Opportunity', 'How to apply']) {
    const jd = 'Role\n\nRequirements\n- Airflow experience.\n\n' + heading
      + '\n- Strong Python and SQL experience.\n';
    t('  "' + heading + '" is not', !req(jd).includes('Python'), req(jd).join(', '));
  }
  // "Travel requirements" contains the word and is still a fact about the
  // job, not a skill.
  const travel = 'Role\n\nTravel requirements\n- Python is used on client sites.\n';
  t('  "Travel requirements" is a condition, not a skill list',
    !req(travel).includes('Python'), req(travel).join(', '));
}

console.log('\nAND WHEN SCOPING FINDS NOTHING, IT IS ABANDONED FOR THAT POSTING');
{
  // The rule that covers the classification bugs not found yet. Scoping
  // fails in two directions: a section wrongly READ leaks a keyword,
  // which is visible; a section wrongly SKIPPED deletes requirements
  // silently. A posting in an unreadable language, an unparsed ATS
  // layout, a heading nobody anticipated -- all fail the second way.
  for (const [name, jd] of [
    ['a Spanish posting', 'Ingeniero\n\nRequisitos\n- Experiencia con Python, SQL y Airflow.\n'],
    ['a German posting', 'Entwickler\n\nIhr Profil\n- Erfahrung mit Java, Kubernetes und Docker.\n'],
  ]) {
    const got = JDR.extract(jd).requirements.map((r) => r.label);
    t('  ' + name + ' still yields its tools', got.length > 0, got.join(', '));
  }

  // A SUBSTANTIAL posting whose every heading was misread. An
  // unrecognised heading already fails open to "unknown", which IS
  // covered, so the only way to swallow a posting is for its headings to
  // match the non-covered patterns. That makes this rare, which is the
  // point: it is insurance against the classification bug not yet found,
  // not a path the common case takes.
  const swallowed = ['Engineer', '', 'Benefits',
    '- Experience with Kubernetes and Terraform.',
    '- Strong Python and SQL.',
    '- Docker in production.',
    '- Airflow and Snowflake.',
    '- Comfortable on the command line.'].join('\n');
  const out = JDR.extract(swallowed);
  t('  a substantial posting whose headings were all misread falls back',
    out.scopingAbandoned === true, JSON.stringify(out.requirements.map((r) => r.label)));
  t('  ...and recovers its requirements',
    ['Kubernetes', 'Terraform', 'Python'].every((k) =>
      out.requirements.some((r) => r.label === k)),
    out.requirements.map((r) => r.label).join(', '));
  t('  ...and says so, so the leak can be recognised for what it is',
    out.excluded.some((e) => /section scoping/.test(e.term)), JSON.stringify(out.excluded));
  t('  ...and the records are marked unscoped',
    out.requirements.every((r) => r.unscoped === true), 'a fallback record looks scoped');

  // An unrecognised heading needs no backstop: unknown is covered, so a
  // posting in a language this table cannot read is still read.
  for (const [name, jd] of [
    ['Spanish', 'Ingeniero\n\nBeneficios y requisitos\n- Experiencia con Kubernetes y Python.\n'],
    ['German', 'Entwickler\n\nIhr Profil\n- Erfahrung mit Java, Kubernetes und Docker.\n'],
  ]) {
    const got = JDR.extract(jd);
    t('  a ' + name + ' posting is read without needing the fallback',
      got.requirements.length > 0 && !got.scopingAbandoned,
      got.requirements.map((r) => r.label).join(', '));
  }

  // But a short posting that genuinely states no requirements gets the
  // honest answer, which is nothing.
  const boilerplate = 'About us\nWe are a warm team.\n\nBenefits\nWe offer equity ownership.\n';
  t('  a stub that really has no requirements returns none',
    JDR.extract(boilerplate).requirements.length === 0,
    JSON.stringify(JDR.extract(boilerplate).requirements.map((r) => r.label)));

  // It must NOT fire when scoping worked, or it would undo the whole file.
  const good = JDR.extract(WEBFLOW);
  t('  it does not fire on a posting scoping handled', !good.scopingAbandoned,
    'scoping was abandoned on a posting it read correctly');
  t('  ...and an empty posting still yields nothing at all',
    JDR.extract('').requirements.length === 0 && !JDR.extract('').scopingAbandoned, 'invented');
}

console.log('\nAND THE MODULE IS ACTUALLY LOADED BY THE EXTENSION');
{
  // BOTH LOADERS, BECAUSE THEY ARE DIFFERENT PLACES.
  //
  // The manifest covers content scripts. The popup loads its own scripts
  // with <script> tags, and popup.js is where every one of these passes
  // actually runs. Checking only the manifest is why the module shipped
  // registered and never loaded: window.JDRequirements was undefined in
  // the popup, the guards fell through, and none of this filtering ran in
  // the browser at all while the tests passed.
  const manifest = fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8');
  t('  jd-requirements.js is in the manifest', /jd-requirements\.js/.test(manifest),
    'it would never run in a content script');
  const html = fs.readFileSync(path.join(DIR, 'popup.html'), 'utf8');
  t('  ...and popup.html loads it', /<script src="jd-requirements\.js">/.test(html),
    'it would never run in the popup, which is where popup.js lives');
  t('  ...after the taxonomy it reads',
    html.indexOf('keyword-taxonomy.js') < html.indexOf('jd-requirements.js'),
    'the module would load before the table it depends on');
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  ...and extraction calls it',
    /JDR\.filterAgainstPosting\(base\.all, jobDescription\)/.test(src),
    'the model output is still unfiltered');
  t('  ...for the requirement sweep too', /JDR\.extract\(jobDescription\)/.test(src),
    'the sweep is still section-blind');
}

console.log('\nAND IT IS FAST ENOUGH TO RUN ON THE POPUP\'S MAIN THREAD');
{
  // The table went from four hundred groups to nine hundred, and sweep
  // tested every group against every call. At 265ms for one short string,
  // with one call per statement and one per chip, a real posting froze
  // the popup for tens of seconds: "Measuring..." that never finished.
  //
  // The first-word index fixed it, and these numbers are what stop it
  // coming back. They are deliberately loose -- ten times slower than
  // measured still passes -- because this is a freeze guard, not a
  // benchmark.
  const warm = 'Requirements\n- Python, SQL and Airflow experience.\n';
  JDR.extract(warm);                                    // pay the regex compilation once
  TX.sweep('warm up the pattern cache', 4);

  let at = Date.now();
  for (let i = 0; i < 200; i += 1) TX.sweep('forecasting models ' + i, 4);
  const perSweep = (Date.now() - at) / 200;
  t('  a short sweep stays under 5ms', perSweep < 5, perSweep.toFixed(2) + 'ms each');

  at = Date.now();
  JDR.extract(WEBFLOW + '\n');
  const once = Date.now() - at;
  t('  a whole posting stays under 400ms', once < 400, once + 'ms');

  at = Date.now();
  for (let i = 0; i < 5; i += 1) JDR.extract(WEBFLOW + '\n' + i);
  const each = (Date.now() - at) / 5;
  t('  ...and under 150ms once warm', each < 150, each.toFixed(0) + 'ms each');
}

console.log('\n"MAKE" IS A VERB BEFORE IT IS A BUILD TOOL');
{
  // Read off a real scan. A Customer Support Coach posting said
  // "Troubleshoot and make outbound calls for escalated issues", and GNU
  // Make went onto the CV. The rule existed, with a reject list that did
  // not happen to contain "outbound" -- but the list was never going to
  // work, because "make" is one of the commonest verbs in English and
  // enumerating what may follow it is hopeless.
  //
  // The real fault was siblings:true. Escalation Management is a genuine
  // requirement in that same sentence, and an unambiguous one, so Make
  // rode in beside it. Every posting naming any tool near the word
  // "make" was claiming the build tool.
  const support = JDR.extract(['Requirements:', '',
    '* Troubleshoot and make outbound calls for escalated issues.',
    '* Make sure customers are happy and make an impact on retention.'].join('\n'));
  t('  a support posting does not ask for GNU Make',
    !support.requirements.some((r) => r.label === 'Make'),
    JSON.stringify(support.requirements.map((r) => r.label)));
  t('  ...and the real requirement beside it survives',
    support.requirements.some((r) => r.label === 'Escalation Management'),
    JSON.stringify(support.requirements.map((r) => r.label)));

  const build = JDR.extract(['Requirements:', '',
    '* Experience with Makefiles and GNU Make for our C++ build system.',
    '* Strong C++ and Python.'].join('\n'));
  t('  a posting that means the build tool still asks for it',
    build.requirements.some((r) => r.label === 'Make'),
    JSON.stringify(build.requirements.map((r) => r.label)));

  // The cue has to be the only way in, so no sibling can carry it.
  t('  it cannot ride in beside another tool',
    JDR.resolve('Make', 'Build dashboards in Python and make them available to the team',
      ['Python', 'Make']) === null,
    'siblings would admit it beside any unambiguous tool');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
