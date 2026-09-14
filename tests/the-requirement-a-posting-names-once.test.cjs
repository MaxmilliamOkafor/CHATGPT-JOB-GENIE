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

  t('  ...and the flow runs it inside extraction',
    /this\.sweepKnownRequirements\(jobDescription, keywords\)/
      .test(fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8')),
    'the pass exists but nothing calls it');
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

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
