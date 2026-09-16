// THE SKILLS LINE A HUMAN WOULD NOT WRITE.
//
// Three faults, all read off one .docx this extension produced for a
// real application to a Customer Support Coach role.
//
//   Additional Skills: Troubleshooting, Hospitality Operations,
//                      Emotional Intelligence, Learning Agility, Internet
//   Soft Skills: Empathy
//
// "Internet" is equipment. The posting did ask for it, in the sense that
// remote roles say "reliable internet connection required", and nothing
// downstream could tell that apart from a tool the candidate knows, so
// it was listed beside Kubernetes.
//
// "Soft Skills: Empathy" is one word under a heading of its own, on a
// page where every line above it carries four to ten. On a coaching
// posting, where the whole question is judgement about people, that line
// argues against the candidate better than its absence would.
//
// And the scanner's "job title not found" was true in the only sense it
// meant: the title was on the page, as line two, but not in the summary
// and not in the employment history, which is where a title is read from.
//
// None of this is an evidence gate. Nothing the posting asked for is
// dropped for want of proof. Equipment is not a capability, a label over
// one word is not a group, and a target role can be named without
// claiming it was held.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
global.window = global;
const realConsole = console;
global.console = Object.assign({}, realConsole, { log() {}, warn() {} });
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'recruiter-audit.js'));
global.console = realConsole;
const RA = global.RecruiterAudit;

console.log('EQUIPMENT IS NOT A CAPABILITY');
{
  // Read out of popup.js rather than executed: requirementsOnly is a
  // static on a class that needs a DOM to construct.
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  const junk = (/_JUNK_KEYWORDS\(\)[\s\S]*?\n      \]\);/m.exec(src) || [''])[0];
  t('  the junk list was found', junk.length > 500, String(junk.length));
  for (const term of ['internet', 'wifi', 'laptop', 'webcam', 'headset',
    'quiet workspace', 'reliable transportation']) {
    t('  ' + term.padEnd(24) + ' is not a skill',
      junk.indexOf("'" + term + "'") !== -1, 'it would be listed beside Kubernetes');
  }
  // And the line stays drawn where it was: these are equipment, not
  // capabilities the candidate happens to lack.
  for (const term of ['python', 'kubernetes', 'empathy', 'mentoring', 'training']) {
    t('  ' + term.padEnd(24) + ' is still a requirement',
      junk.indexOf("'" + term + "'") === -1, 'a real requirement was swept up');
  }
}

console.log('\nA LABEL OVER ONE WORD IS NOT A GROUP');
{
  const cv = ['Maxmilliam Okafor', 'Customer Support Coach', '',
    'TECHNICAL SKILLS',
    'Programming: Python, Java, TypeScript, C++, SQL',
    'Cloud & DevOps: AWS, Azure, Google Cloud Platform, Kubernetes, Docker, Terraform',
    'Core Competencies: Troubleshooting, Hospitality Operations, Emotional Intelligence, Learning Agility',
    'Soft Skills: Empathy', '',
    'PROFESSIONAL EXPERIENCE',
    'Meta | Software Engineer | January 2023 - Present',
    '• Mentored two junior engineers.'].join('\n');
  const out = RA.sanitiseSkillsSection(cv, { all: ['Empathy', 'Troubleshooting'] });
  t('  the one-word line is gone',
    !/^Soft Skills:/m.test(out.text), out.text);
  t('  ...and the word itself is not',
    /Empathy/.test(out.text), 'a requirement was dropped, which is not what this fixes');
  t('  ...it joined the line its peers are on',
    /Core Competencies:.*Empathy/.test(out.text),
    (out.text.match(/^Core Competencies:.*$/m) || [''])[0]);
  t('  and the technical lines are untouched',
    /^Programming: Python, Java, TypeScript, C\+\+, SQL$/m.test(out.text)
      && /^Cloud & DevOps: AWS/m.test(out.text), out.text);
}

console.log('\nBUT AN ORDINARY SHORT LINE IS LEFT ALONE');
{
  // "Programming: Python" is a normal line on a normal CV. Only a
  // BEHAVIOURAL singleton is merged, and only into a line of its kind.
  const cv = ['Name', '', 'TECHNICAL SKILLS',
    'Programming: Python',
    'Cloud & DevOps: AWS, Docker', '',
    'PROFESSIONAL EXPERIENCE', 'Meta | Engineer | 2023 - Present'].join('\n');
  const out = RA.sanitiseSkillsSection(cv, {});
  t('  a one-item technical line survives', /^Programming: Python$/m.test(out.text), out.text);
  t('  ...and does not collect its neighbours',
    !/Programming: Python, AWS/.test(out.text), out.text);
}

console.log('\nAND A SOFT SINGLETON WITH NOWHERE TO GO STAYS PUT');
{
  const cv = ['Name', '', 'TECHNICAL SKILLS',
    'Programming: Python, SQL',
    'Soft Skills: Empathy', '',
    'PROFESSIONAL EXPERIENCE', 'Meta | Engineer | 2023 - Present'].join('\n');
  const out = RA.sanitiseSkillsSection(cv, { all: ['Empathy'] });
  t('  the requirement is still on the page', /Empathy/.test(out.text), out.text);
  t('  ...and was not filed under Programming',
    !/Programming:.*Empathy/.test(out.text), out.text);
}

console.log('\n"NATIVE" IS A STATEMENT ABOUT WHERE SOMEONE IS FROM');
{
  const cv = ['Name', '', 'TECHNICAL SKILLS',
    'Languages & Citizenship: English (native), French (native), Spanish (advanced)',
    'Programming: Python, SQL', '',
    'PROFESSIONAL EXPERIENCE', 'Meta | Engineer | 2023 - Present'].join('\n');
  const out = RA.ensureCitizenshipLine(cv, {
    languages: [{ language: 'English', proficiency: 'Native' },
      { language: 'French', proficiency: 'native speaker' },
      { language: 'Spanish', proficiency: 'Advanced' }],
    citizenship: 'EU Citizen', profileLocation: 'Dublin, Ireland',
  });
  t('  no language is declared native', !/\(native/i.test(out.text),
    (out.text.match(/^Languages.*$/m) || [''])[0]);
  t('  ...they are declared fluent instead', /English \(fluent\)/.test(out.text),
    (out.text.match(/^Languages.*$/m) || [''])[0]);
  t('  ...and a level that is not "native" is untouched',
    /Spanish \(advanced\)/.test(out.text), (out.text.match(/^Languages.*$/m) || [''])[0]);
  t('  the right to work is still stated, because it costs an employer money',
    /EU Citizen/.test(out.text), 'dropping it would cost him interviews, not bias');
}

// ── THE TITLE THE SCANNER LOOKS FOR ──────────────────────────────────
const CV = ['Maxmilliam Okafor', 'Customer Support Coach',
  'Dublin, IE | +353 087 426 1508 | maxokafordev@gmail.com', '',
  'PROFESSIONAL SUMMARY',
  'Software Engineer working across communication, problem-solving and training. '
    + 'Cut the overnight run from six hours to under one.', '',
  'PROFESSIONAL EXPERIENCE',
  'Meta January 2023 - Present',
  'Software Engineer',
  '• Mentored two junior engineers and an intern who converted to a permanent role.',
  'Citigroup August 2017 - March 2021',
  'Data Analyst',
  '• Trained 24 analysts across the London and Belfast offices in SQL and Power BI.'].join('\n');

console.log('\nA HEADLINE IS NOT READ AS A JOB TITLE');
{
  const out = RA.ensureTitleInSummary(CV, 'Customer Support Coach', 'Acme');
  t('  the summary now names the target role', out.added, 'nothing was added');
  const summary = out.text.split('\n')[out.text.split('\n').indexOf('PROFESSIONAL SUMMARY') + 1];
  t('  ...as the first thing in it',
    /^Customer Support Coach candidate/.test(summary), summary);
  t('  ...naming the background it comes from',
    /background as a Software Engineer\./.test(summary), summary);
  t('  ...without claiming the role was held',
    !/Customer Support Coach (?:with \d|at |, January)/.test(out.text), summary);
  t('  and the summary that was there is kept',
    /Cut the overnight run from six hours to under one\./.test(summary), summary);
  t('  the employment history is untouched',
    out.text.indexOf('Meta January 2023 - Present\nSoftware Engineer') !== -1, 'history rewritten');
}

console.log('\nAND A TITLE ACTUALLY HELD IS NOT CALLED A CANDIDACY');
{
  // The scanner reads held titles out of the employment block, so this
  // one already passes. Writing "candidate" over a genuine match sells
  // it short, which is worse than the red X it would clear.
  const out = RA.ensureTitleInSummary(CV, 'Software Engineer', 'Acme');
  t('  nothing is added', !out.added, out.sentence || '');
  t('  ...and the summary is byte-identical', out.text === CV, 'the summary was rewritten');
}

console.log('\nAND THE AWKWARD SHAPES DO NOT BREAK IT');
{
  for (const [name, cv, title] of [
    ['no summary section', 'Name\n\nPROFESSIONAL EXPERIENCE\nMeta\nEngineer', 'Coach'],
    ['no experience section', 'Name\n\nPROFESSIONAL SUMMARY\nAn engineer.', 'Coach'],
    ['no title', CV, ''],
    ['null title', CV, null],
    ['empty CV', '', 'Coach'],
    ['null CV', null, 'Coach'],
    ['title is the company', CV, 'Acme'],
  ]) {
    let threw = false, out = null;
    try { out = RA.ensureTitleInSummary(cv, title, 'Acme'); } catch (e) { threw = true; }
    t('  ' + name.padEnd(22) + ' returns the text unchanged',
      !threw && out && out.added === false, threw ? 'threw' : JSON.stringify(out && out.added));
  }
  // Already said is already said.
  const already = CV.replace('Software Engineer working across',
    'Customer Support Coach candidate. Software Engineer working across');
  t('  a summary that already names the title is left alone',
    RA.ensureTitleInSummary(already, 'Customer Support Coach', 'Acme').added === false,
    'it would be named twice');
}

console.log('\nAND IT IS DELIBERATELY NOT WIRED INTO THE AUDIT');
{
  // Wiring it in costs three things the audit currently does, all of
  // them decisions already made in this project:
  //
  //   repairSummary reads the added sentence as a claim to an unheld
  //   title and rebuilds the paragraph around it. Measured: a payroll
  //   application came back "Meta candidate with a background as a
  //   Software Engineer".
  //
  //   summaryNamesAnotherProfession never fires again, because every
  //   summary now leads with the target role, so the warning that says
  //   "you led with Software Engineer on a Reinsurance application and
  //   you hold Data Analyst" is unreachable.
  //
  //   A summary that was already specific and quantified gets a
  //   sentence bolted to its front whether it needed one or not.
  //
  // What it buys is one scanner heuristic. So the function exists,
  // works, and is the owner's switch to throw rather than a default.
  const src = fs.readFileSync(path.join(DIR, 'recruiter-audit.js'), 'utf8');
  t('  the module exports it', typeof RA.ensureTitleInSummary === 'function', 'not exported');
  t('  ...and the audit does not call it',
    !/^\s*(?:const \w+ = )?ensureTitleInSummary\(/m.test(
      src.replace(/function ensureTitleInSummary[\s\S]*?\n  \}/, '')),
    'it was wired in without the three costs above being accepted');
  t('  ...with the reason recorded where the wiring would go',
    /NOT WIRED IN\./.test(src), 'the next reader re-derives the whole problem');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
