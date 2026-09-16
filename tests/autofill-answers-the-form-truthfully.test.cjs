// THREE THINGS A LIVE GREENHOUSE FORM SHOWED AT ONCE.
//
// 1. "Location (City) *" came out EMPTY, flagged "Please enter your
//    location", on a form where every other contact field was filled.
//    The location box is a typeahead whose suggestions arrive over the
//    network; the fill waited one fixed 350ms, read an empty listbox,
//    and then WIPED the value it had just typed on the grounds that
//    filter text is not a committed selection. The applicant was left
//    with a required field the extension had emptied on purpose.
//
// 2. "Do you have the unrestricted right to work for any employer in
//    the United States?" was answered Yes -- from `work_authorized`, a
//    country-less boolean meaning "I can work where I live". On a US
//    posting from an applicant with EU citizenship and no US status
//    that is a false statement on an application, and the kind that
//    withdraws an offer after it is made.
//
// 3. The sponsorship question computed the country-aware answer and
//    then threw it away, reading the same country-less preference
//    instead. Requiring sponsorship is a fact about a country.
//
// The rule underneath all three: answer from what the profile actually
// records, for the country actually being asked about, and never
// delete an answer that was correct.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../autofill-core.js');

const IRISH = {
  city: 'Dublin', country: 'Ireland', work_authorized: true,
  work_authorized_countries: ['IE', 'GB'],
};

test('a country-less flag never answers a question about a country', () => {
  const q = 'Do you have the unrestricted right to work for any employer in the United States?';
  assert.equal(core.yesNoFor(q, IRISH), 'No');
  // And with no country list at all it stays unanswered rather than
  // borrowing the flag.
  assert.equal(core.yesNoFor(q, {work_authorized: true}), '');
});

test('the same flag still answers a question that names no country', () => {
  assert.equal(core.yesNoFor('Are you legally authorised to work?', {work_authorized: true}), 'Yes');
});

test('the country named in the question decides the sponsorship answer', () => {
  assert.equal(core.yesNoFor('Will you require visa sponsorship to work in the United States?', IRISH), 'Yes');
  assert.equal(core.yesNoFor('Will you require visa sponsorship to work in Ireland?', IRISH), 'No');
  // Inverted phrasing is the same question, and must not contradict it.
  assert.equal(core.yesNoFor('Can you work in Ireland without sponsorship?', IRISH), 'Yes');
  assert.equal(core.yesNoFor('Can you work in the United States without sponsorship?', IRISH), 'No');
});

test('a sponsorship question about an unknown country goes unanswered', () => {
  assert.equal(core.yesNoFor('Do you require sponsorship to work in Japan?', {sponsorship_required: false}), '');
  assert.equal(core.yesNoFor('Do you require sponsorship?', {sponsorship_required: false}), 'No');
});

// ── "IRELAND" AND "IRELAND (IE)" ARE THE SAME ANSWER ──────────────────
//
// Exact-only matching is right in general -- a partial overlap is how
// "Java" gets picked for "JavaScript". But dropdowns qualify their
// labels after a separator constantly, and refusing every one of those
// left required fields empty with the right option sitting in the list.
test('a qualified option label still matches its own country', () => {
  assert.equal(core.optionStartsWith('Ireland (IE)', 'Ireland'), true);
  assert.equal(core.optionStartsWith('Dublin, County Dublin, Ireland', 'Dublin'), true);
  assert.equal(core.optionStartsWith("Bachelor's Degree - Honours", "Bachelor's Degree"), true);
});

test('and a longer name is not a qualified version of a shorter one', () => {
  assert.equal(core.optionStartsWith('United States Minor Outlying Islands', 'United States'), false);
  assert.equal(core.optionStartsWith('JavaScript', 'Java'), false);
  assert.equal(core.optionStartsWith('Ireland', 'Ireland'), false);   // exact is the other rule
  assert.equal(core.optionStartsWith('Go', 'Go'), false);
});

test('an ambiguous near-match picks nothing at all', () => {
  const opts = [{textContent: 'Korea, Republic of'}, {textContent: "Korea, Democratic People's Republic of"}];
  assert.equal(core.soleMatch(opts, 'Korea'), null);
  assert.equal(core.soleMatch([{textContent: 'Ireland (IE)'}], 'Ireland').textContent, 'Ireland (IE)');
  // Exact always wins over a qualified label, wherever it sits.
  const mixed = [{textContent: 'Ireland (IE)'}, {textContent: 'Ireland'}];
  assert.equal(core.soleMatch(mixed, 'Ireland').textContent, 'Ireland');
});

// ── THE TYPEAHEAD THAT EMPTIED ITSELF ─────────────────────────────────
function fakeDoc(options) {
  return {
    defaultView: {getComputedStyle() { return {display: 'block', visibility: 'visible', opacity: '1'}; }},
    getElementById() { return null; },
    querySelectorAll() { return options; },
  };
}

function fakeInput(doc, {tagName = 'INPUT'} = {}) {
  const el = {
    tagName, ownerDocument: doc, value: '', textContent: '', events: [],
    getAttribute() { return null; }, click() {}, focus() {},
    dispatchEvent(e) { el.events.push(e.key || e.type); return true; },
    getBoundingClientRect() { return {width: 200, height: 30}; },
  };
  return el;
}

test('a typeahead keeps the city it typed rather than blanking a required field', async () => {
  const original = global.KeyboardEvent, originalEvent = global.Event;
  global.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  global.Event = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  try {
    // The suggestion list never arrives -- the exact case that emptied
    // the box.
    const doc = fakeDoc([]);
    const el = fakeInput(doc);
    const filled = await core.fillCustomDropdown(el, 'Dublin');
    assert.equal(filled, true);
    assert.equal(el.value, 'Dublin');
    assert.ok(el.events.includes('Enter'), el.events.join(','));
    assert.ok(!el.events.includes('Escape'), 'the field was dismissed instead of committed');
  } finally { global.KeyboardEvent = original; global.Event = originalEvent; }
});

test('a non-input combobox still reverts, because typed text means nothing there', async () => {
  const original = global.KeyboardEvent, originalEvent = global.Event;
  global.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  global.Event = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  try {
    const doc = fakeDoc([]);
    const el = fakeInput(doc, {tagName: 'BUTTON'});
    assert.equal(await core.fillCustomDropdown(el, 'Dublin'), false);
    assert.equal(el.value, '');
    assert.ok(el.events.includes('Escape'));
  } finally { global.KeyboardEvent = original; global.Event = originalEvent; }
});

test('a suggestion that arrives late is still selected', async () => {
  const original = global.KeyboardEvent, originalEvent = global.Event;
  global.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  global.Event = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  try {
    const options = [];
    const doc = fakeDoc(options);
    const el = fakeInput(doc);
    let clicked = 0;
    setTimeout(() => options.push({
      textContent: 'Dublin, County Dublin, Ireland', ownerDocument: doc,
      getBoundingClientRect() { return {width: 200, height: 30}; },
      getAttribute(k) { return k === 'aria-selected' ? 'true' : null; },
      click() { clicked++; },
    }), 600);
    assert.equal(await core.fillCustomDropdown(el, 'Dublin'), true);
    assert.equal(clicked, 1, 'the late suggestion was never clicked');
  } finally { global.KeyboardEvent = original; global.Event = originalEvent; }
});
