const {test} = require('node:test');
const assert = require('node:assert/strict');
const ats = require('../ats-platforms.js');
for (const platform of ats.list()) {
  test(`${platform.label}: registered hosts resolve and fallback selectors exist`, () => {
    for (const host of platform.host) {
      const url = new URL(`https://${host}`);
      assert.equal(ats.detect(url.hostname, url.href), platform.id);
      if (!host.includes('/')) assert.equal(ats.detect(`not-${host}.invalid`, `https://not-${host}.invalid`), '');
    }
    for (const field of ['title', 'company', 'location', 'description']) assert.ok(ats.selectorsFor(platform.id, field).length);
  });
}
const doc = data => ({querySelectorAll: () => data.map(textContent => ({textContent}))});
test('JSON-LD recovers after malformed script and reads nested graph', () => {
  const result = ats.fromJobPostingLd(doc(['{bad', JSON.stringify({'@graph': [{'@type':['Thing','JobPosting'], title:'Engineer', description:'<p>Build services</p><p>Test systems</p>', hiringOrganization:{name:'Example'}, identifier:{value:'123'}}]})]));
  assert.equal(result.title, 'Engineer'); assert.equal(result.description, 'Build services Test systems'); assert.equal(result.jobId, '123');
});
test('JSON-LD never merges separate postings', () => {
  const result = ats.fromJobPostingLd(doc([JSON.stringify([{'@type':'JobPosting',title:'Wrong title'}, {'@type':'JobPosting',title:'Correct title',description:'Correct description'}])]));
  assert.equal(result.title, 'Correct title');
});
test('unknown ATS is explicitly unknown', () => assert.equal(ats.autofillCapability('unknown').mode, 'unknown'));
