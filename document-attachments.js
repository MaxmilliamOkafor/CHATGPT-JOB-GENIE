/* Explicit, scoped document replacement. No submit or unrelated remove clicks. */
(function (global) {
  'use strict';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function sameFile(actual, expected) {
    return !!actual && actual.name === expected.name && actual.size === expected.size && actual.lastModified === expected.lastModified;
  }
  function fieldScope(input) {
    let fallback = null;
    for (let root = input.parentElement; root && !['FORM', 'BODY', 'HTML'].includes(root.tagName); root = root.parentElement) {
      // Do not climb into a section containing unrelated application answers.
      if (root.querySelector('input:not([type="file"]):not([type="hidden"]), textarea, select, [role="combobox"]')) break;
      const inputs = root.querySelectorAll('input[type="file"]');
      if (inputs.length > 1) break;
      if (inputs.length === 1) {
        if (removalControl(root)) return root;
        if (!fallback && (root.querySelector('label') || /field|upload|attachment|file/i.test(root.className || ''))) fallback = root;
      }
    }
    // THE WALK FAILING IS NOT A REASON TO REFUSE THE UPLOAD.
    //
    // The loop above only ever ACCEPTS a container that carries a
    // removal control, a <label>, or an upload-ish class name. A
    // Greenhouse resume field whose input sits in a bare <div> matches
    // none of those, so this returned null, the caller reported
    // "Cannot safely isolate this upload field", and the applicant's
    // previous CV stayed on the form while a tailored one sat unused
    // in the popup. The scope is only ever used to read status text and
    // find a remove button near this input; the input's own parent
    // serves both, and is never wider than the walk would have gone.
    return fallback || input.parentElement || null;
  }
  function removalControl(scope) {
    if (!scope) return null;
    const candidates = Array.from(scope.querySelectorAll('button, [role="button"], a'));
    const matching = candidates.filter(el => {
      const label = [el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent, el.className].filter(Boolean).join(' ');
      return !el.disabled && (/(remove|delete|clear).*(file|resume|cv|cover|attachment)|(file|resume|cv|cover|attachment).*(remove|delete|clear)/i.test(label) || (/^[×xX✕]\s*$/.test(el.textContent || '') || /^(remove|delete|clear)$/i.test((el.getAttribute('aria-label') || el.textContent || '').trim())));
    });
    return matching.length === 1 ? matching[0] : null;
  }
  function accepts(input, file) {
    const accept = (input.accept || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    return !accept.length || accept.some(value => value === '.' + file.name.split('.').pop().toLowerCase() || value === file.type || value === '*/*' || (value.endsWith('/*') && file.type.startsWith(value.slice(0, -1))));
  }

  // WHICH OF SEVERAL MATCHING INPUTS IS THE ONE ON SCREEN.
  //
  // Refusing to act on more than one match was meant to stop a CV
  // landing in the cover-letter slot. In practice `matches` is already
  // the caller's CV/cover classifier, and the second "match" is nearly
  // always the same widget's hidden legacy input or a duplicate
  // rendered by the ATS -- so the guard fired on ordinary forms and
  // nothing was attached at all.
  //
  // A choice is only made when every candidate is the SAME KIND of
  // field; the field already holding an attachment wins, because that
  // is the one the applicant can see and the one that must be
  // replaced. Genuinely ambiguous cases still refuse.
  function pickTarget(candidates) {
    const usable = candidates.filter(i => !i.disabled);
    const pool = usable.length ? usable : candidates;
    if (pool.length <= 1) return pool[0] || null;
    const holding = pool.filter(i => (i.files && i.files.length) || removalControl(fieldScope(i)));
    if (holding.length === 1) return holding[0];
    const enabled = pool.filter(i => i.getAttribute('data-ats-tailor-disabled') !== '1');
    return (enabled.length ? enabled : pool)[0];
  }

  /** Write the file straight into the input. The last resort, and what the previous build always did. */
  function writeFile(doc, input, file) {
    const transfer = new (doc.defaultView.DataTransfer || global.DataTransfer)();
    transfer.items.add(file);
    input.dataset.jgAttachOk = '1';
    input.files = transfer.files;
    for (const type of ['input', 'change']) input.dispatchEvent(new doc.defaultView.Event(type, { bubbles: true }));
  }

  // WHAT THIS FIELD WILL TAKE, IN THE ORDER WE WOULD RATHER SEND IT.
  //
  // DOCX is always first: it is the format the document was reviewed
  // in, it parses cleanly everywhere, and it is what a recruiter can
  // open and edit. The alternatives are built from the same text and
  // exist for the one case that used to end the run -- a field
  // publishing accept=".pdf".
  function chooseFile(input, file, alternatives) {
    for (const candidate of [file].concat(alternatives || [])) {
      if (candidate && accepts(input, candidate)) return candidate;
    }
    return null;
  }

  async function replace({ doc, file, alternatives, matches, kind, timeout = 2500 }) {
    const find = () => Array.from(doc.querySelectorAll('input[type="file"]')).filter(matches);
    let candidates = find();
    if (!candidates.length && (kind === 'cv' || kind === 'cover')) {
      // Greenhouse can remove its file input while an attachment is displayed.
      // Only act on one explicitly labelled document group.
      const groups = Array.from(doc.querySelectorAll('[role="group"], fieldset')).filter(group => {
        const ids = (group.getAttribute('aria-labelledby') || '').split(/\s+/);
        const label = group.getAttribute('aria-label') || ids.map(id => doc.getElementById(id)?.textContent || '').join(' ') || group.querySelector('legend')?.textContent || '';
        // The DOCX check this used to carry rejected every employer who
        // lists accepted formats as "PDF, DOC, DOCX" in a tooltip, or
        // not at all -- a labelled Resume group with a remove button is
        // already unambiguous, and `accepts` still guards the format
        // once the real input is back.
        return (kind === 'cv' ? /^(resume(?:\s*\/\s*cv)?|cv)\s*\*?$/i : /^cover\s*letter\s*\*?$/i).test(label.trim()) && removalControl(group);
      });
      if (groups.length === 1) {
        removalControl(groups[0]).click();
        const deadline = Date.now() + timeout;
        do { await wait(100); candidates = find(); } while (!candidates.length && Date.now() < deadline);
      }
    }

    if (!candidates.length) return { success: false, skipped: true, message: 'No matching upload field found.' };
    let input = pickTarget(candidates);
    if (!input) return { success: false, skipped: true, message: 'No matching upload field found.' };
    // Check before removing anything. Never destroy a valid attachment
    // for a format the field cannot take -- but a field that refuses
    // DOCX is no longer the end of the run, because the same reviewed
    // text is also being carried as a PDF and as plain text.
    const usable = [file].concat(alternatives || []).filter(f => f && accepts(input, f));
    if (!usable.length) {
      return { success: false, message: 'This upload field accepts only ' + (input.accept || 'formats it does not name')
        + '. Download the document and upload it in one of those.' };
    }
    let scope = fieldScope(input);
    if (!scope) return { success: false, message: 'Cannot safely isolate this upload field.' };
    const previousText = (scope.textContent || '');
    const remove = removalControl(scope);
    if (remove) {
      remove.click();
      const deadline = Date.now() + timeout;
      do {
        await wait(100);
        candidates = find();
        if (candidates.length) {
          const next = pickTarget(candidates);
          if (next) { input = next; scope = fieldScope(input) || scope; }
          if (scope && !removalControl(scope)) break;
        }
      } while (Date.now() < deadline);
      // A LINGERING X IS NOT A FAILED REMOVAL.
      //
      // This used to demand that the removal control disappear, and
      // gave up on the whole attachment when it did not. Several ATS
      // keep a clear/browse control on an EMPTY field, so a removal
      // that plainly worked was reported as "Existing attachment was
      // not removed" and the stale CV stayed on the form. What matters
      // is that the old file is gone -- the input is empty and its
      // name is no longer on screen. The write below overwrites
      // whatever is left in any case.
      const emptied = !(input.files && input.files.length);
      const cleared = (scope.textContent || '') !== previousText;
      if (!emptied && !cleared && removalControl(scope)) {
        return { success: false, message: 'Existing attachment was not removed. Confirm removal on the form, then retry.' };
      }
    }
    if (input.getAttribute('data-ats-tailor-disabled') === '1') {
      input.disabled = false;
      input.removeAttribute('data-ats-tailor-disabled');
    }
    if (input.disabled) return { success: false, message: 'Upload field is disabled.' };

    /** Write one candidate and wait for the form to confirm or refuse it. */
    async function attempt(candidate) {
      writeFile(doc, input, candidate);
      const deadline = Date.now() + timeout;
      let rewritten = false;
      await wait(300);
      do {
        await wait(100);
        const error = scope.querySelector('[role="alert"], .field-error, .error-message');
        if (input.getAttribute('aria-invalid') === 'true' || error?.textContent?.trim()) {
          // A REFUSAL IS ABOUT THIS FILE, NOT ABOUT THE APPLICATION.
          //
          // Employers reject an upload for reasons a different format
          // fixes -- a server-side allow-list the accept attribute does
          // not declare, a converter that chokes on DOCX. Reported as
          // retryable so the caller can offer the same text as a PDF
          // before giving up on the field entirely.
          return { success: false, retryable: true, rejected: true,
            message: error?.textContent?.trim() || 'The employer rejected the file.' };
        }
        const current = find();
        if (current.length) {
          const next = pickTarget(current);
          if (next) {
            // A React ATS re-renders the widget after a write, replacing
            // the input node. The file went into a node that no longer
            // exists, so the write is repeated once against the live one
            // rather than timing out on a field nobody is looking at.
            if (next !== input && !rewritten && !(next.files && next.files.length)
              && !(scope.textContent || '').includes(candidate.name)) {
              input = next;
              scope = fieldScope(input) || scope;
              rewritten = true;
              if (!input.disabled) writeFile(doc, input, candidate);
              continue;
            }
            input = next;
            scope = fieldScope(input) || scope;
          }
        }
        const shown = (scope.textContent || '').includes(candidate.name);
        const selected = Array.from(input.files || []).some(actual => sameFile(actual, candidate));
        const busy = scope.querySelector('[aria-busy="true"], [role="progressbar"]');
        if (!busy && (shown || selected)) {
          return { success: true, filename: candidate.name, confirmation: shown ? 'filename' : 'file-input' };
        }
      } while (Date.now() < deadline);
      return { success: false, retryable: true,
        message: 'Upload did not confirm the new file. Check the employer form.' };
    }

    let last = null;
    for (const candidate of usable) {
      last = await attempt(candidate);
      if (last.success) {
        if (candidate !== file) {
          last.converted = candidate.name.split('.').pop().toLowerCase();
          last.message = 'Attached as ' + last.converted.toUpperCase()
            + ': this field would not take the DOCX.';
        }
        return last;
      }
      if (!last.retryable) break;
    }
    return last || { success: false, message: 'Upload did not confirm the new file. Check the employer form.' };
  }
  global.JobGenieAttachments = { replace, sameFile, fieldScope, accepts, removalControl, pickTarget, chooseFile };
  if (typeof module !== 'undefined') module.exports = global.JobGenieAttachments;
})(typeof window === 'undefined' ? globalThis : window);
