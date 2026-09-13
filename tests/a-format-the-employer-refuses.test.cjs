// THE PDF FALLBACK IS A REAL PDF, NOT A RENAMED FILE.
//
// A field publishing accept=".pdf" used to end the run outright. The
// same reviewed text now travels behind the DOCX as a PDF, so the
// employer's own field decides the format -- but only if what we build
// is a document a parser can actually read. A PDF whose text is an
// image, or whose cross-reference table points at the wrong bytes, is
// worse than no attachment: it looks attached and scores zero.
//
// So the structure is pinned here. Real text operators, one per line,
// in Helvetica -- one of the fourteen fonts every reader carries
// without embedding -- and an xref whose every offset lands on the
// object it claims.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const pdf = require('../text-pdf.js');

const CV = [
  'Maxmilliam Okafor', 'Staff Software Engineer', 'Dublin, IE | max@example.invalid', '',
  'PROFESSIONAL SUMMARY',
  'Staff engineer with eight years on payment platforms across three markets.', '',
  'TECHNICAL SKILLS', 'Programming: Python, TypeScript, Go',
].join('\n');

function bytes(source) { return Buffer.from(source, 'binary'); }

test('the document is a structurally valid PDF', () => {
  const out = bytes(pdf.build(CV));
  assert.ok(out.slice(0, 8).toString() === '%PDF-1.4', out.slice(0, 8).toString());
  assert.ok(out.includes('%%EOF'));
  const start = Number(/startxref\s+(\d+)/.exec(out.toString('latin1'))[1]);
  assert.equal(out.slice(start, start + 4).toString(), 'xref');
});

test('every cross-reference offset lands on the object it names', () => {
  const out = bytes(pdf.build(CV));
  const text = out.toString('latin1');
  const start = Number(/startxref\s+(\d+)/.exec(text)[1]);
  const rows = [...text.slice(start).matchAll(/(\d{10}) (\d{5}) ([nf])/g)];
  assert.ok(rows.length >= 6, 'too few xref entries: ' + rows.length);
  rows.forEach((row, i) => {
    if (row[3] === 'f') return;
    assert.ok(text.startsWith(i + ' 0 obj', Number(row[1])),
      'entry ' + i + ' points at ' + JSON.stringify(text.substr(Number(row[1]), 12)));
  });
});

test('every line of the CV is extractable text, not a picture of it', () => {
  const text = pdf.build(CV);
  const shown = [...text.matchAll(/\((.*?)\) Tj/g)].map(m => m[1]);
  for (const line of ['Maxmilliam Okafor', 'Staff Software Engineer', 'PROFESSIONAL SUMMARY',
    'TECHNICAL SKILLS', 'Programming: Python, TypeScript, Go']) {
    assert.ok(shown.includes(line), 'missing from the PDF text: ' + line);
  }
  assert.match(text, /\/BaseFont \/Helvetica/);
  assert.match(text, /\/Encoding \/WinAnsiEncoding/);
});

test('a long line wraps instead of running off the page', () => {
  const long = 'Programming: ' + Array.from({length: 40}, (_, i) => 'Skill' + i).join(', ');
  const lines = pdf.wrap(long);
  assert.ok(lines.length > 1, 'a 40-item skills line was not wrapped');
  for (const line of lines) assert.ok(pdf.widthOf(line) <= 595.28 - 112, line);
  // and nothing is lost in the wrapping
  assert.equal(lines.join(' ').replace(/\s+/g, ' '), long.replace(/\s+/g, ' '));
});

test('parentheses and backslashes cannot break the content stream', () => {
  const text = pdf.build('Built (fast) C:\\builds\\out and shipped it');
  assert.match(text, /\\\(fast\\\)/);
  assert.match(text, /C:\\\\builds\\\\out/);
});

test('smart punctuation is folded, never emitted as a box', () => {
  assert.equal(pdf.toWinAnsi('“Owned” the roadmap — end‑to‑end … 100%'),
    '"Owned" the roadmap - end-to-end ... 100%');
  assert.equal(pdf.toWinAnsi('Maxmilliam Okafor'), 'Maxmilliam Okafor');
  // A letter with an accent keeps the letter rather than becoming a ?.
  assert.equal(pdf.toWinAnsi('Zoë Ştefan'), 'Zoë Stefan');
});

test('an empty document is nothing, not a blank page passed off as a CV', () => {
  assert.equal(pdf.build(''), '');
  assert.equal(pdf.build('   \n  '), '');
});

test('a long CV runs onto a second page rather than being cut', () => {
  const many = Array.from({length: 140}, (_, i) => 'Line ' + i).join('\n');
  const out = pdf.build(many);
  assert.match(out, /\/Count 3/);
  assert.ok(out.includes('(Line 139) Tj'), 'the last line was dropped');
});
