/* One application view; advanced preferences stay collapsed. */
document.addEventListener('DOMContentLoaded', () => {
  const main = document.getElementById('mainSection');
  if (!main) return;
  const footer = main.querySelector('.popup-footer');
  for (const selector of ['#aiSettingsPanel', '.workspace-settings', '#historyPanel']) {
    const node = main.querySelector(selector);
    if (node) main.insertBefore(node, footer);
  }
  const answers = document.createElement('section');
  answers.className = 'job-card';
  const heading = document.createElement('h3'); heading.textContent = 'Saved screening answers';
  const question = document.createElement('textarea'); question.placeholder = 'Paste the exact application question'; question.setAttribute('aria-label', 'Exact application question');
  const answer = document.createElement('input'); answer.placeholder = 'Your confirmed answer'; answer.setAttribute('aria-label', 'Your confirmed answer');
  const save = document.createElement('button'); save.type = 'button'; save.className = 'btn btn-primary'; save.textContent = 'Save answer';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const help = document.createElement('p'); help.textContent = 'Use the complete question, including country or employer. Unknown answers remain for review.';
  answers.append(heading, help, question, answer, save, status);
  main.querySelector('.workspace-settings')?.appendChild(answers);
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
});
