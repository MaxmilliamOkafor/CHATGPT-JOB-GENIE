// THE REQUIREMENT A POSTING NAMES ONCE.
//
// Extraction scores terms by frequency, which answers "what does this
// posting dwell on". That is not the same question as "what does this
// posting require". A requirement stated a single time --
//
//   "a team that ships well"        the delivery requirement
//   "two roadmaps with one team"    the roadmap requirement
//   "judge a technical tradeoff"    the tradeoff requirement
//
// -- never rises far enough to be returned. An external applicant
// tracking scan of one posting listed three skills this extension had
// not extracted AT ALL, and a requirement that is never extracted can
// never be matched, never written into the CV, and never counted on the
// gauge. It is the one failure the rest of the pipeline cannot recover
// from.
//
// So the taxonomy is asked the other question: of the requirements it
// knows, which does this posting name? Frequency still decides the
// order. It no longer decides membership.
//
// WHAT THIS MUST NOT BECOME. It only ADDS, and only requirements already
// in the table, so it cannot lift a phrase out of the posting's prose
// and call it a skill. It does not restate a requirement already
// extracted -- the posting's own wording is what a literal screen
// searches for, so "Postgres" stays "Postgres".
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
const TX = global.KeywordTaxonomy;
const sandbox = {
  window: { addEventListener() {}, KeywordTaxonomy: TX },
  KeywordTaxonomy: TX, document: { addEventListener() {} },
  console: { log() {}, warn() {}, error() {} },
};
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')
  + '\nthis.P = ATSTailor;', sandbox);
const popup = Object.create(sandbox.P.prototype);

const POSTING = [
  'Head of Technology & Product',
  '',
  'We have a working product, real revenue, and a team that ships well when',
  'the problem is clearly defined. Today we are running two roadmaps with one',
  'team. We are building a standalone SaaS product while also supporting a',
  'live Shared Services operation. Deciding what wins, and when, needs someone',
  'whose job that is.',
  '',
  'You have written production code and led engineers. You can judge a',
  'technical tradeoff without needing a translator. We are headquartered in',
  'Miami and hire across Europe.',
].join('\n');

console.log('THE POSTING NAMES THEM, AND SAYS EACH ONE ONCE');
{
  const labels = TX.sweep(POSTING, 60).map((r) => r.label);
  for (const want of ['Roadmap', 'Delivery', 'SaaS', 'Tradeoffs', 'Production Code']) {
    t('  ' + want.padEnd(16) + ' is found', labels.includes(want), labels.join(', '));
  }
  t('  ...and "ships" reached Delivery without the word "delivery"',
    !/\bdelivery\b/i.test(POSTING) && labels.includes('Delivery'), 'premise is wrong');
  t('  ...and "roadmaps" reached Roadmap through its plural',
    !/\broadmap\b/i.test(POSTING) && labels.includes('Roadmap'), 'premise is wrong');
}

console.log('\nA REQUIREMENT IT DOES NOT NAME IS NOT INVENTED');
{
  const labels = TX.sweep(POSTING, 60).map((r) => r.label);
  for (const no of ['Kubernetes', 'Payroll', 'Salesforce', 'PyTorch']) {
    t('  ' + no.padEnd(16) + ' is not', !labels.includes(no), labels.join(', '));
  }
  t('  a blank posting yields nothing', TX.sweep('', 20).length === 0, 'wrote into nothing');
}

console.log('\nAND A REQUIREMENT IT DENIES IS NOT COUNTED AS ASKED FOR');
{
  // The same negation scoping the rest of the matcher uses, so a sweep
  // cannot be talked into a requirement by the sentence that rules it out.
  const denied = 'We have no experience with Kafka and do not use it.';
  t('  "no experience with Kafka" does not name Kafka',
    !TX.sweep(denied, 20).some((r) => r.label === 'Kafka'),
    JSON.stringify(TX.sweep(denied, 20)));
}

console.log('\nTHE LOUDER REQUIREMENT IS STILL RANKED FIRST');
{
  const twice = 'We need Python. Python is the whole job. Some Kafka too.';
  const ranked = TX.sweep(twice, 20);
  const py = ranked.findIndex((r) => r.label === 'Python');
  const kf = ranked.findIndex((r) => r.label === 'Kafka');
  t('  named twice outranks named once', py >= 0 && kf >= 0 && py < kf,
    JSON.stringify(ranked));
  t('  ...and "roadmap" and "product roadmap" on the same words is one mention',
    TX.sweep('We own the product roadmap.', 20)
      .find((r) => r.label === 'Roadmap').hits === 1,
    JSON.stringify(TX.sweep('We own the product roadmap.', 20)));
}

console.log('\nIT ADDS TO THE EXTRACTOR, IT DOES NOT REPLACE IT');
{
  const before = {
    all: ['Postgres', 'SaaS', 'revenue'],
    highPriority: ['Postgres'], mediumPriority: ['SaaS'], lowPriority: ['revenue'],
  };
  const after = popup.sweepKnownRequirements(POSTING, before);

  t('  everything the extractor found is still there',
    before.all.every((k) => after.all.includes(k)), JSON.stringify(after.all));
  t('  ...in the posting\'s own wording, not the table\'s',
    after.all.includes('Postgres') && !after.all.includes('PostgreSQL'),
    JSON.stringify(after.all));
  t('  a requirement already extracted is not added twice',
    after.all.filter((k) => TX.keyOf(k) === TX.keyOf('SaaS')).length === 1,
    JSON.stringify(after.all));
  t('  and what it missed is now there',
    ['Roadmap', 'Delivery'].every((k) => after.all.includes(k)),
    JSON.stringify(after.all));
  t('  every added requirement landed in a tier',
    after.all.length === after.highPriority.length + after.mediumPriority.length
      + after.lowPriority.length,
    JSON.stringify({ all: after.all.length, h: after.highPriority.length,
      m: after.mediumPriority.length, l: after.lowPriority.length }));

  t('  anything the caller carried through survives',
    popup.sweepKnownRequirements(POSTING,
      Object.assign({ structured: { hard: ['x'] } }, before)).structured.hard[0] === 'x',
    'the AI path\'s structured breakdown was dropped');
}

console.log('\nAND IT RUNS ON WHICHEVER PATH PRODUCED THE KEYWORDS');
{
  // The AI endpoint is the PRIMARY path -- local extraction is only its
  // fallback -- so a sweep wired into extractKeywordsOptimized alone ran
  // on almost no real tailoring run. A model reading a posting misses a
  // requirement stated once for the same reason a frequency score does:
  // it summarises what the posting is about.
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  const calls = (src.match(/this\.sweepKnownRequirements\(/g) || []).length;
  t('  local extraction runs it',
    /this\.sweepKnownRequirements\(jobDescription, keywords\)/.test(src),
    'the pass exists but local extraction does not call it');
  t('  the AI tailoring path runs it too',
    /this\.sweepKnownRequirements\(this\.currentJob\.description, keywords\)/.test(src),
    'the primary path returns the model\'s list unswept');
  t('  ...but leaves an empty AI result empty, so the fallback still fires',
    /keywords\.all\.length\s*\?[\s\S]{0,240}:\s*keywords;/.test(src),
    'sweeping nothing into requirements would hide the failure');
  t('  ...and so does the AI keywords button',
    calls >= 3, 'only ' + calls + ' of the three keyword paths sweep');
}

console.log('\nEVERY REQUIREMENT IT CAN ADD HAS A SKILLS LINE TO LAND ON');
{
  // A term with no category is placed wherever there is room rather than
  // beside its peers, which is how a database tool turns up under soft
  // skills. Ninety-six groups were in that position.
  const homeless = TX.GROUPS.filter((g) => !TX.categoryOf(g[0])).map((g) => g[0]);
  t('  no group in the table is without one', homeless.length === 0,
    homeless.join(', '));
}

console.log('\nAND THE EVIDENCE GATE NO LONGER FIRES FROM INSIDE A WORD');
{
  // impliedIn matched its cues as bare substrings. The open END is
  // deliberate, so "load balanc" also matches "load balancing". The open
  // FRONT was not: "IAM" fired inside "Miami" and "SLA" inside
  // "translator", so a CV naming the city it was written in was credited
  // with evidence of security work it had never done.
  t('  "Miami" is not evidence of security work',
    !TX.impliedIn('We are headquartered in Miami.', 'Security'), 'still fires');
  t('  "translator" is not evidence of service levels',
    !TX.impliedIn('without needing a translator', 'KPI'), 'still fires');
  t('  ...while IAM still is', TX.impliedIn('Managed IAM roles.', 'Security'), 'lost');
  t('  ...and an SLA still is', TX.impliedIn('Held the SLA at 99.9%.', 'KPI'), 'lost');
  t('  ...and the open end is intact',
    TX.impliedIn('Ran load balancing across regions.', 'Scalability'), 'lost');
}

console.log('\nAND NO CUE IN THE TABLE IS UNREACHABLE');
{
  // The cues are looked up through the GROUP, so a list written under a
  // non-canonical member -- "System Design", in the group whose canonical
  // name is "Architecture" -- was keyed under a name the lookup never
  // asks for. All six of its cues were dead, and nothing said so.
  const dead = [];
  for (const label of Object.keys(TX.IMPLIED_BY)) {
    for (const cue of TX.IMPLIED_BY[label]) {
      if (!TX.impliedIn('We did ' + cue + 'ing work here.', label)) dead.push(label + ' <- ' + cue);
    }
  }
  t('  every cue fires for the requirement it was written under',
    dead.length === 0, dead.join('\n           >> '));
  t('  ...including one written under a non-canonical name',
    TX.impliedIn('Architected the ingestion layer.', 'Architecture')
      && TX.impliedIn('Architected the ingestion layer.', 'System Design'),
    'the group and the member disagree');
}

console.log('\nAND EVERY CAPABILITY CAN BE PROVEN BY THE WORK, NOT ONLY BY THE WORD');
{
  // A TOOL needs no entailment -- there is no proving Kubernetes without
  // saying Kubernetes. A CAPABILITY is the opposite: a CV describes the
  // work and almost never labels it. Fifty-three of them had no cue at
  // all, so each was gated behind the candidate happening to use the
  // posting's own word for something the CV already demonstrated.
  const keyed = new Set(Object.keys(TX.IMPLIED_BY).map((k) => {
    const g = TX.groupOf(k);
    return TX.tight(g ? g[0] : k);
  }));
  const unprovable = TX.GROUPS
    .filter((g) => /Soft Skills|Domain Expertise/.test(TX.categoryOf(g[0]) || ''))
    .filter((g) => !keyed.has(TX.tight(g[0]))).map((g) => g[0]);
  t('  no capability is creditable only by name', unprovable.length === 0,
    unprovable.join(', '));
}

console.log('\nAND NO CUE IS PROVEN BY A NAME THAT MERELY STARTS WITH IT');
{
  // The trailing side of a cue is open on purpose, so "load balanc" also
  // matches "load balancing". The cost is that a cue which is also the
  // start of a product name proves the product: a project called
  // "LedgerLens" was evidence of ledger work.
  t('  a project named LedgerLens is not fintech experience',
    !TX.impliedIn('Built LedgerLens with Python and XGBoost.', 'Financial Technology'),
    'still fires');
  t('  ...while a general ledger still is',
    TX.impliedIn('Reconciled the general ledger monthly.', 'Financial Technology'),
    'lost');

  // And no cue may be a single character, which is what a truncated
  // entry looks like. Two is the floor rather than three because "S3"
  // and "1:1" are whole identifiers, not the start of a longer word.
  const tooShort = [];
  for (const label of Object.keys(TX.IMPLIED_BY)) {
    for (const cue of TX.IMPLIED_BY[label]) {
      if (TX.norm(cue).replace(/[^a-z0-9]/g, '').length < 2) tooShort.push(label + ' <- ' + cue);
    }
  }
  t('  and no cue is a single character', tooShort.length === 0, tooShort.join(', '));
}

console.log('\nAND A PROFILE THAT NEVER DID THE WORK IS STILL NOT CREDITED');
{
  const unrelated = [
    'Ran the payroll for 400 staff across three countries in Workday.',
    'Reconciled the general ledger and filed the monthly VAT return.',
  ].join('\n');
  for (const no of ['Kubernetes', 'PyTorch', 'Short-Term Rental', 'Property Management',
    'Six Sigma', 'Sales Operations', 'A/B Testing']) {
    t('  ' + no.padEnd(20) + ' is not proven by unrelated work',
      !TX.impliedIn(unrelated, no) && !TX.appearsIn(unrelated, no), 'credited anyway');
  }
  // Payroll is NAMED here, which appearsIn covers; the entailments are
  // for the work a CV describes without ever labelling it.
  t('  ...while the work it DID describe is credited',
    TX.appearsIn(unrelated, 'Payroll') && TX.impliedIn(unrelated, 'Tax Calculation')
      && TX.impliedIn(unrelated, 'Accuracy'), 'the cues do not reach real work');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
