/* Keep task navigation separate from application data and visibility states. */
document.addEventListener('DOMContentLoaded', () => {
  const main = document.getElementById('mainSection');
  const nav = main?.querySelector('.workspace-nav');
  if (!nav) return;
  const panels = {};
  for (const name of ['apply', 'documents', 'followup', 'settings']) {
    const panel = document.createElement('div');
    panel.id = `workspace-${name}`;
    panel.className = 'workspace-view';
    panel.setAttribute('aria-label', name);
    panel.hidden = name !== 'apply';
    main.appendChild(panel);
    panels[name] = panel;
    nav.querySelector(`[data-view="${name}"]`).setAttribute('aria-controls', panel.id);
  }
  // Move follow-up before its settings parent to make it independently reachable.
  const followup = document.getElementById('followupPanel');
  if (followup) { panels.followup.appendChild(followup); followup.open = true; }
  for (const child of Array.from(main.children)) {
    if (child === nav || child.classList.contains('workspace-view') || child.classList.contains('user-bar')) continue;
    const view = child.matches('#documentsCard, #historyPanel, #parseCVDebugPanel, #diffPanel') ? 'documents'
      : child.matches('#aiSettingsPanel, .workspace-settings, .bulk-panel, .popup-footer, #debugReportPanel') ? 'settings' : 'apply';
    panels[view].appendChild(child);
  }
  const empty = document.createElement('p');
  empty.className = 'documents-empty';
  empty.textContent = 'Tailor a CV from Apply to review and download your documents here.';
  panels.documents.prepend(empty);
  const docs = document.getElementById('documentsCard');
  const sync = () => { empty.hidden = docs && !docs.classList.contains('hidden'); };
  if (docs) new MutationObserver(sync).observe(docs, { attributes: true, attributeFilter: ['class'] });
  sync();
  const answers = document.createElement('section');
  answers.className = 'job-card';
  const heading = document.createElement('h3'); heading.textContent = 'Saved screening answers';
  const question = document.createElement('textarea'); question.placeholder = 'Paste the exact application question'; question.setAttribute('aria-label', 'Exact application question');
  const answer = document.createElement('input'); answer.placeholder = 'Your confirmed answer'; answer.setAttribute('aria-label', 'Your confirmed answer');
  const save = document.createElement('button'); save.type = 'button'; save.className = 'btn btn-primary'; save.textContent = 'Save answer';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const help = document.createElement('p'); help.textContent = 'Use the complete question, including country or employer. Unknown answers remain for review.';
  answers.append(heading, help, question, answer, save, status);
  panels.settings.prepend(answers);
  save.addEventListener('click', async () => {
    const q = question.value.trim(), a = answer.value.trim();
    if (!q || !a) { status.textContent = 'Enter both the complete question and your answer.'; return; }
    save.disabled = true;
    try {
      const saved = await chrome.storage.local.get(['ua_profile']);
      const profile = saved.ua_profile || {};
      const applicationAnswers = { ...(profile.application_answers || {}), [q]: a };
      await chrome.storage.local.set({ ua_profile: { ...profile, application_answers: applicationAnswers } });
      status.textContent = 'Answer saved. Run autofill again on the application.';
    } catch (error) { status.textContent = 'Could not save. Please try again.'; }
    finally { save.disabled = false; }
  });
  for (const button of nav.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== button.dataset.view;
      for (const item of nav.querySelectorAll('button')) item.setAttribute('aria-pressed', String(item === button));
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
});
