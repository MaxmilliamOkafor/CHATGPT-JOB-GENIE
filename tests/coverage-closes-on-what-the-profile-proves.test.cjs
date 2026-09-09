// TWENTY-SIX PER CENT, WITH A PROFILE THAT EVIDENCED MOST OF IT.
//
// A live Greenhouse application reported 6 of 23 keywords matched. The
// posting asked for software engineering, mentorship, collaboration,
// invoicing, payouts, tax calculation, observability, API design --
// every one of them recorded, in the candidate's own words, in the
// saved profile the extension had already loaded.
//
// Two causes, both in this repository:
//
//   fastKeywordInjection had been reduced to a stub that returned the
//   CV untouched and relabelled every missing term a "review item". A
//   term the candidate genuinely owns is not a review item, it is a
//   term the tailoring dropped.
//
//   recoverOmittedProfileSkills, the one pass left, walks past any
//   line containing a colon -- which is every line of a GROUPED skills
//   section, the format these CVs actually use. On a real document it
//   added nothing at all.
//
// The line this file holds is not "add the posting's words". It is
// "add the posting's words for things the SAVED PROFILE proves". A
// keyword left off costs a match; a keyword invented costs the
// application and the interview it leads to.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

require('../dynamic-score.js');
const sandbox = {
  window: {addEventListener() {}, DynamicScore: global.DynamicScore},
  document: {addEventListener() {}}, console: {log() {}, warn() {}, error() {}},
};
vm.runInNewContext(fs.readFileSync(require.resolve('../popup.js'), 'utf8')
  + '\nthis.PopupClass = ATSTailor;', sandbox);
const make = (profile) => {
  const popup = Object.create(sandbox.PopupClass.prototype);
  popup._cachedProfile = profile || null;
  return popup;
};

const PROFILE = {
  skills: ['Python', 'TypeScript', 'Go', 'PostgreSQL', 'Kubernetes', 'Kafka', 'AWS'],
  professional_experience: [
    {title: 'Staff Software Engineer', company: 'Stripe', bullets: [
      'Designed payment APIs handling invoicing and payouts across three regions.',
      'Led the technical evaluation of payment service providers.',
      'Mentored four engineers and ran the team collaboration rituals.',
      'Built observability tooling covering latency and error budgets.']},
    {title: 'Software Engineer', company: 'Revolut', bullets: [
      'Worked on tax calculation for cross-border transfers.']}],
  relevant_projects: [{name: 'LedgerLens', technologies: ['Python', 'AI']}],
};

const CV = [
  'Maxmilliam Okafor', 'Staff Software Engineer', 'Dublin, IE | max@example.invalid', '',
  'PROFESSIONAL SUMMARY', 'Staff engineer with eight years on payment platforms.', '',
  'PROFESSIONAL EXPERIENCE', 'Stripe', 'Staff Software Engineer', 'January 2022 - Present',
  '- Designed payment APIs across three regions.', '',
  'TECHNICAL SKILLS', 'Programming: Python, TypeScript, Go', 'Cloud & DevOps: AWS, Docker', '',
  'EDUCATION', 'Trinity College Dublin'].join('\n');

test('the reported gap closes on terms the saved profile evidences', () => {
  const popup = make(PROFILE);
  const keywords = {all: ['software engineering', 'mentorship', 'collaboration', 'invoicing',
    'payouts', 'tax calculation', 'observability', 'API design', 'Kafka', 'Rust']};
  const before = popup.calculateMatchScore(CV, keywords);
  const out = popup.fastKeywordInjection(CV, keywords, before.missingKeywords);
  const after = popup.calculateMatchScore(out.tailoredCV, keywords);
  assert.ok(after.matchScore >= 90, `coverage only reached ${after.matchScore}%`);
  for (const term of ['software engineering', 'mentorship', 'collaboration', 'invoicing',
    'payouts', 'tax calculation', 'observability', 'API design', 'Kafka']) {
    assert.ok(after.matchedKeywords.includes(term), `${term} is evidenced and still missing`);
  }
});

test('a term the profile cannot support is left off and named', () => {
  const popup = make(PROFILE);
  const keywords = {all: ['Rust', 'Salesforce', 'Kubernetes']};
  const out = popup.fastKeywordInjection(CV, keywords, ['Rust', 'Salesforce', 'Kubernetes']);
  assert.ok(!/Rust|Salesforce/.test(out.tailoredCV), 'an unevidenced term reached the CV');
  assert.ok(out.tailoredCV.includes('Kubernetes'), 'a saved skill was withheld');
  assert.deepEqual(Array.from(out.reviewKeywords), ['Rust', 'Salesforce']);
  assert.deepEqual(Array.from(popup._unevidencedKeywords), ['Rust', 'Salesforce']);
});

test('with no saved profile nothing whatsoever is added', () => {
  const popup = make(null);
  const out = popup.fastKeywordInjection(CV, {all: ['Kubernetes']}, ['Kubernetes']);
  assert.equal(out.tailoredCV, CV);
  assert.deepEqual(Array.from(out.injectedKeywords), []);
});

test('the existing group lines survive byte for byte', () => {
  const popup = make(PROFILE);
  const out = popup.fastKeywordInjection(CV, {all: ['invoicing', 'payouts']}, ['invoicing', 'payouts']);
  assert.ok(out.tailoredCV.includes('Programming: Python, TypeScript, Go'));
  assert.ok(out.tailoredCV.includes('Cloud & DevOps: AWS, Docker'));
  assert.match(out.tailoredCV, /Additional Skills: .*invoicing/);
  // and only the skills section changed
  assert.ok(out.tailoredCV.includes('- Designed payment APIs across three regions.'));
  assert.ok(out.tailoredCV.endsWith('EDUCATION\nTrinity College Dublin'));
});

test('nothing is ever appended to an experience bullet', () => {
  const popup = make(PROFILE);
  const out = popup.fastKeywordInjection(CV, {all: ['invoicing', 'payouts', 'observability']},
    ['invoicing', 'payouts', 'observability']);
  const bullet = out.tailoredCV.split('\n').find(l => l.startsWith('- Designed'));
  assert.equal(bullet, '- Designed payment APIs across three regions.');
});

test('a CV with no skills section gains no invented one', () => {
  const popup = make(PROFILE);
  const plain = 'Maxmilliam Okafor\n\nPROFESSIONAL EXPERIENCE\nStripe\n- Shipped payments.';
  const out = popup.fastKeywordInjection(plain, {all: ['invoicing']}, ['invoicing']);
  assert.equal(out.tailoredCV, plain);
});

// ── THE EVIDENCE GATE ITSELF ──────────────────────────────────────────
//
// Word shapes, not loose overlap. "Software Engineer" evidences
// "software engineering"; "JavaScript" evidences nothing about Java.
test('word shapes line up across inflections', () => {
  const popup = make(null);
  const same = (a, b) => assert.equal(popup._keywordRoot(a), popup._keywordRoot(b), `${a} vs ${b}`);
  same('engineering', 'engineer');
  same('collaboration', 'collaborate');
  same('observability', 'observable');
  same('management', 'manager');
  same('services', 'service');
  same('mentorship', 'mentored');
  same('leadership', 'led');
  same('payouts', 'payout');
});

test('a shared prefix is not a shared claim', () => {
  const popup = make(null);
  const differ = (a, b) => assert.notEqual(popup._keywordRoot(a), popup._keywordRoot(b), `${a} vs ${b}`);
  differ('java', 'javascript');
  differ('react', 'reactive');
  differ('scala', 'scalable');
  differ('go', 'google');
});

test('a keyword needs every one of its content words evidenced', () => {
  const popup = make(null);
  const blob = 'designed technical reviews and evaluated vendors for the payments platform';
  assert.equal(popup._profileEvidences('technical evaluation', blob), true);
  assert.equal(popup._profileEvidences('vendor management', blob), false);
  assert.equal(popup._profileEvidences('', blob), false);
  assert.equal(popup._profileEvidences('technical evaluation', ''), false);
});

test('two-letter acronyms are keywords, not noise', () => {
  const popup = make(PROFILE);
  const out = popup.fastKeywordInjection(CV, {all: ['AI']}, ['AI']);
  assert.ok(out.tailoredCV.includes('AI'), 'AI is in the saved projects and was thrown away as too short');
  const noise = popup.fastKeywordInjection(CV, {all: ['of']}, ['of']);
  assert.equal(noise.tailoredCV, CV);
});

test('when the lines fill up, high priority goes in first', () => {
  const popup = make(PROFILE);
  const filler = Array.from({length: 22}, (_, i) => 'payouts ' + i);
  // Every filler term is unevidenced, so only the real ones can land;
  // ranking still has to put the high-priority term ahead of the rest.
  const keywords = {
    all: ['collaboration', 'invoicing', 'payouts', 'observability', ...filler],
    highPriority: ['observability'], mediumPriority: ['invoicing'],
  };
  const out = popup.fastKeywordInjection(CV, keywords, keywords.all);
  assert.equal(out.injectedKeywords[0], 'observability');
  assert.equal(out.injectedKeywords[1], 'invoicing');
});

test('the coverage pass runs on the real pipeline, not just in here', () => {
  const source = fs.readFileSync(require.resolve('../popup.js'), 'utf8');
  assert.match(source, /const closed = this\.fastKeywordInjection\(/);
  assert.match(source, /const injected = this\.fastKeywordInjection\(cvText, keywords, before\.missingKeywords\)/);
});
