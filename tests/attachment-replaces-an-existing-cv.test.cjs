// THE COVER LETTER WENT ON. THE CV DID NOT.
//
// Reported from a live Greenhouse application: the tailored cover
// letter attached, and the Resume/CV field kept the PDF that had been
// uploaded weeks earlier. The difference between the two fields was not
// the document -- it was that one of them ALREADY HELD A FILE, and
// every guard on the replacement path fired on that and on nothing
// else:
//
//   fieldScope() only ever accepted a container carrying a removal
//   control, a <label>, or an upload-ish class name, and returned null
//   for anything else -- reported as "Cannot safely isolate this upload
//   field", which is a refusal, not a diagnosis.
//
//   after clicking the employer's X, the code demanded that the X
//   DISAPPEAR. Several ATS keep a clear/browse control on the empty
//   field, so a removal that plainly worked was reported as "Existing
//   attachment was not removed".
//
//   more than one matching input -- a hidden legacy input beside the
//   visible one is ordinary -- refused outright rather than choosing.
//
// Each of them leaves the applicant's stale CV on the form and says so
// in a message that reads like the site's fault. The previous build
// simply wrote the file into the input, which is why it "worked
// perfectly": these tests keep the safe path AND stop it refusing.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const attachments = require('../document-attachments.js');

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const newFile = () => ({name: 'Tailored_CV.docx', size: 9001, lastModified: 42, type: DOCX});

// A container the scope walk cannot accept: it holds an unrelated text
// input, which stops the climb, and carries no label, class or X.
function bareField({existing = null} = {}) {
  const file = newFile();
  let written = 0;
  const scope = {
    tagName: 'DIV', className: '', textContent: existing ? existing + ' ' : '',
    parentElement: {tagName: 'FORM'},
    querySelector(sel) {
      if (sel.startsWith('input:not')) return {};        // an unrelated answer field
      return null;                                        // no label, no error, not busy
    },
    querySelectorAll() { return []; },                    // no removal control anywhere
  };
  const input = {
    accept: '', files: existing ? [{name: existing, size: 1, lastModified: 1}] : [],
    dataset: {}, parentElement: scope, disabled: false,
    getAttribute() { return null; }, removeAttribute() {},
    dispatchEvent() { written++; scope.textContent = file.name; },
  };
  const doc = {
    getElementById: () => null,
    querySelectorAll: sel => (sel === 'input[type="file"]' ? [input] : []),
    defaultView: {
      Event: class { constructor(type) { this.type = type; } },
      DataTransfer: class { constructor() { this.files = []; this.items = {add: f => this.files.push(f)}; } },
    },
  };
  return {file, doc, input, written: () => written};
}

test('a field the scope walk cannot label is still replaced, not refused', async () => {
  const f = bareField({existing: 'Maxmilliam_Okafor_CV.pdf'});
  const r = await attachments.replace({doc: f.doc, file: f.file, kind: 'cv', matches: () => true, timeout: 400});
  assert.equal(r.success, true, r.message);
  assert.equal(f.input.files[0], f.file);
  assert.ok(f.written() > 0);
});

test('the scope falls back to the input\'s own parent rather than nothing', () => {
  const f = bareField();
  assert.equal(attachments.fieldScope(f.input), f.input.parentElement);
});

// Greenhouse-shaped: the X removes the file but the control stays on
// screen for the empty state.
function lingeringClear() {
  const file = newFile();
  let removed = 0;
  const scope = {
    tagName: 'DIV', className: 'upload', textContent: 'Old_CV.pdf',
    parentElement: {tagName: 'FORM'},
    querySelector(sel) { return sel === 'label' ? {} : null; },
    querySelectorAll(sel) {
      if (sel === 'input[type="file"]') return [input];
      return [button];                                    // the X never goes away
    },
  };
  const button = {
    textContent: '', className: '', disabled: false,
    getAttribute: name => (name === 'aria-label' ? 'Remove file' : null),
    click() { removed++; input.files = []; scope.textContent = ''; },
  };
  const input = {
    accept: '.pdf,.doc,.docx', files: [{name: 'Old_CV.pdf', size: 5, lastModified: 5}],
    dataset: {}, parentElement: scope, disabled: false,
    getAttribute() { return null; }, removeAttribute() {},
    dispatchEvent() { scope.textContent = file.name; },
  };
  const doc = {
    querySelectorAll: () => [input],
    defaultView: {
      Event: class { constructor(type) { this.type = type; } },
      DataTransfer: class { constructor() { this.files = []; this.items = {add: f => this.files.push(f)}; } },
    },
  };
  return {file, doc, input, removed: () => removed};
}

test('a clear control that survives the removal does not abort the replacement', async () => {
  const f = lingeringClear();
  const r = await attachments.replace({doc: f.doc, file: f.file, kind: 'cv', matches: () => true, timeout: 400});
  assert.equal(r.removed, undefined);
  assert.equal(f.removed(), 1);
  assert.equal(r.success, true, r.message);
  assert.equal(f.input.files[0], f.file);
});

test('of two matching inputs the one holding the attachment is the one replaced', () => {
  const empty = {files: [], disabled: false, parentElement: null, getAttribute: () => null};
  const holding = {files: [{name: 'Old_CV.pdf'}], disabled: false, parentElement: null, getAttribute: () => null};
  assert.equal(attachments.pickTarget([empty, holding]), holding);
  assert.equal(attachments.pickTarget([holding]), holding);
  assert.equal(attachments.pickTarget([]), null);
});

test('a disabled duplicate never wins over the live field', () => {
  const dead = {files: [], disabled: true, parentElement: null, getAttribute: () => null};
  const live = {files: [], disabled: false, parentElement: null, getAttribute: () => null};
  assert.equal(attachments.pickTarget([dead, live]), live);
});

test('an employer that rejects the format still keeps its existing file', async () => {
  const f = bareField({existing: 'Maxmilliam_Okafor_CV.pdf'});
  f.input.accept = '.pdf';
  const r = await attachments.replace({doc: f.doc, file: f.file, kind: 'cv', matches: () => true, timeout: 200});
  assert.equal(r.success, false);
  assert.match(r.message, /does not accept DOCX/);
  assert.equal(f.written(), 0);
  assert.equal(f.input.files[0].name, 'Maxmilliam_Okafor_CV.pdf');
});

test('an employer that rejects the upload is not reported as attached', async () => {
  const f = bareField();
  f.input.getAttribute = name => (name === 'aria-invalid' ? 'true' : null);
  const r = await attachments.replace({doc: f.doc, file: f.file, kind: 'cv', matches: () => true, timeout: 300});
  assert.equal(r.success, false);
  assert.match(r.message, /rejected/);
});

test('no matching field is still skipped, never silently claimed', async () => {
  const f = bareField();
  const r = await attachments.replace({doc: f.doc, file: f.file, kind: 'cv', matches: () => false, timeout: 200});
  assert.equal(r.success, false);
  assert.equal(r.skipped, true);
});

// The step that reveals the field before anything is replaced. A
// single-pass replacement cannot find an input the employer has not
// rendered yet, and dropping this call is what left the CV field
// untouched while the cover letter -- already visible -- went on.
test('the attach path reveals hidden upload fields before replacing', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../content.js'), 'utf8');
  const body = source.slice(source.indexOf('  async function attachPreparedDocuments()'),
    source.indexOf('  function loadFilesAndStart()'));
  assert.match(body, /revealUploadFields\(\)/);
  assert.match(source, /async function revealUploadFields\(\)/);
  // And it opens widgets only -- it must never click a remove control.
  const reveal = source.slice(source.indexOf('  function clickResumeAttach()'),
    source.indexOf('  // ============ LOAD FILES AND START'));
  assert.match(reveal, /\^\(attach\|upload\|attach file\|upload file\|choose file\|browse\)\$/);
  assert.ok(!/remove|delete/i.test(reveal.replace(/\/\/.*$/gm, '')));
});
