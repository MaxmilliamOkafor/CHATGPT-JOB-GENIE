/* Local profile autofill for application forms. No AI calls or submission. */
(function () {
  'use strict';
  if (window.JobGenieAutofill) return;
  let enabled = false, active = null, timer = null;
  const core = window.AutofillCore;
  function eligible() {
    const platform = window.ATSPlatforms?.detect(location.hostname, location.href);
    const hasResume = [...document.querySelectorAll('input[type="file"]')].some(el => /resume|cv/i.test(core.labelFor(el) + ' ' + el.id + ' ' + el.name));
    if (document.querySelector('input[type="password"]')) return false;
    const applicationPath = /\/(apply|application|candidate)(?:[/?#-]|$)/i.test(location.pathname);
    return !!(hasResume || (platform && applicationPath)) && !!document.querySelector('input:not([type="hidden"]):not([type="password"]),select,textarea,[role="combobox"]');
  }
  function run() {
    if (active) return active;
    active = (async () => {
      await ready;
      if (!enabled) return { success: false, reason: 'autofill-disabled', filledCount: 0 };
      if (!eligible()) return { success: false, reason: 'no-application-form', filledCount: 0 };
      const profile = await core.loadProfile();
      if (!enabled) return { success: false, reason: 'autofill-disabled', filledCount: 0 };
      const result = await core.fillContainer(document, profile, {shouldContinue: () => enabled});
      const validation = window.ApplicationValidator?.checkRequiredFields();
      const report = { success: enabled, filledCount: result.filled, alreadySet: result.alreadySet, validation };
      window.JobGenieAutofill.lastResult = report;
      return report;
    })().finally(() => { active = null; });
    return active;
  }
  function schedule() {
    if (!enabled || active || timer) return;
    timer = setTimeout(() => { timer = null; run().catch(() => {}); }, 500);
  }
  const observer = new MutationObserver(schedule);
  function setEnabled(value) {
    enabled = value === true;
    observer.disconnect();
    clearTimeout(timer); timer = null;
    if (enabled) { observer.observe(document.documentElement, {childList:true,subtree:true}); schedule(); }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.autofill_enabled) setEnabled(changes.autofill_enabled.newValue);
  });
  const ready = new Promise(resolve => chrome.storage.local.get(['autofill_enabled'], values => { setEnabled(values?.autofill_enabled); resolve(); }));
  window.JobGenieAutofill = {run, lastResult:null};
})();
