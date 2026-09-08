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
    return fallback;
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
  async function replace({ doc, file, matches, timeout = 2500 }) {
    const find = () => Array.from(doc.querySelectorAll('input[type="file"]')).filter(matches);
    let candidates = find();
    if (candidates.length !== 1) return { success: false, skipped: !candidates.length, message: candidates.length ? 'Multiple matching upload fields. Select the intended field manually.' : 'No matching upload field found.' };
    let input = candidates[0];
    // Check before removing anything. Never destroy a valid attachment for an unsupported format.
    if (!accepts(input, file)) return { success: false, message: 'This upload field does not accept DOCX. Download and use a format allowed by the employer.' };
    let scope = fieldScope(input);
    if (!scope) return { success: false, message: 'Cannot safely isolate this upload field.' };
    const remove = removalControl(scope);
    if (remove) {
      remove.click();
      const deadline = Date.now() + timeout;
      do {
        await wait(100);
        candidates = find();
        if (candidates.length === 1) {
          input = candidates[0];
          scope = fieldScope(input);
          if (scope && !removalControl(scope)) break;
        }
      } while (Date.now() < deadline);
      if (!scope || removalControl(scope)) return { success: false, message: 'Existing attachment was not removed. Confirm removal on the form, then retry.' };
    }
    if (input.getAttribute('data-ats-tailor-disabled') === '1') {
      input.disabled = false;
      input.removeAttribute('data-ats-tailor-disabled');
    }
    if (input.disabled) return { success: false, message: 'Upload field is disabled.' };
    const transfer = new (doc.defaultView.DataTransfer || global.DataTransfer)();
    transfer.items.add(file);
    input.dataset.jgAttachOk = '1';
    input.files = transfer.files;
    for (const type of ['input', 'change']) input.dispatchEvent(new doc.defaultView.Event(type, { bubbles: true }));
    const deadline = Date.now() + timeout;
    await wait(300);
    do {
      await wait(100);
      const error = scope.querySelector('[role="alert"], .field-error, .error-message');
      if (input.getAttribute('aria-invalid') === 'true' || error?.textContent?.trim()) return { success: false, message: error?.textContent?.trim() || 'The employer rejected the file.' };
      const current = find();
      if (current.length === 1) { input = current[0]; scope = fieldScope(input) || scope; }
      const shown = (scope.textContent || '').includes(file.name);
      const selected = Array.from(input.files || []).some(actual => sameFile(actual, file));
      const busy = scope.querySelector('[aria-busy="true"], [role="progressbar"]');
      if (!busy && (shown || selected)) return { success: true, filename: file.name, confirmation: shown ? 'filename' : 'file-input' };
    } while (Date.now() < deadline);
    return { success: false, message: 'Upload did not confirm the new file. Check the employer form.' };
  }
  global.JobGenieAttachments = { replace, sameFile, fieldScope, accepts, removalControl };
  if (typeof module !== 'undefined') module.exports = global.JobGenieAttachments;
})(typeof window === 'undefined' ? globalThis : window);
