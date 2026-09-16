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
  // AT THE END. Two passes downstream read the OPENING of a summary to
  // decide what profession it announces. A leading "Customer Support
  // Coach candidate" was taken for a claim to an unheld job and the
  // paragraph was rebuilt around it -- measured output, on a payroll
  // application: "Meta candidate with a background as a Software
  // Engineer". A closing line leaves the opening saying what it said.
  t('  ...at the end, not the front',
    /Interested in applying this experience to the Customer Support Coach role\.$/.test(summary),
    summary);
  t('  ...and the opening still names the real profession',
    /^Software Engineer working across/.test(summary), summary);
  t('  it claims no title', !/Customer Support Coach (?:with|at |, January)/.test(out.text), summary);
  t('  ...and no number of years', !/applying.*\b(?:\d+|eight|ten|five)\b.*years/i.test(summary), summary);
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

console.log('\nAND THE YEARS CLAUSE IS MADE ONLY WHERE IT IS TRUE');
{
  // "bringing 8 years of relevant experience that meets the position's
  // stated experience requirement" is an assertion about eligibility. A
  // posting stating a number does not license it, because the number is
  // almost always domain-qualified and the domain is the whole of it.
  //
  // Measured on the posting that produced this rule:
  //
  //   1+ years of hands-on, front-of-house hospitality operations
  //   experience at a hotel or resort ... (Airline, event, or food &
  //   beverage-only experience does not meet this requirement.)
  //
  // A software engineer of eight years clears the number and fails the
  // requirement. Triggering on "the posting mentions years" alone sends
  // a CV that claims a bar it does not meet, three lines above a history
  // that says so.
  const has = (title, jd) => {
    const o = RA.ensureTitleInSummary(CV, title, 'Acme', jd);
    return o.added ? o.sentence : '';
  };
  const hospitality = has('Customer Support Coach',
    '1+ years of hands-on, front-of-house hospitality operations experience at a hotel or resort.');
  t('  a hospitality bar gets no years claim from a software history',
    !/years of relevant experience/.test(hospitality), hospitality);
  t('  ...and the role is still named', /Customer Support Coach role\.$/.test(hospitality),
    hospitality);

  const matched = has('Senior Backend Engineer',
    '5+ years of software engineering experience building backend services.');
  t('  a software bar does get one from a software history',
    /bringing \d+ years of relevant experience that meets/.test(matched), matched);
  t('  ...written as a digit, which is what a reader and a parser both scan for',
    /bringing \d+ years/.test(matched) && !/bringing (?:five|eight|nine|ten) years/.test(matched),
    matched);

  t('  an unqualified bar is met by the number alone',
    /bringing \d+ years/.test(has('Operations Lead', 'Minimum 3 years of experience required.')),
    has('Operations Lead', 'Minimum 3 years of experience required.'));
  t('  a bar the history does not clear gets no claim',
    !/years of relevant experience/.test(
      has('Principal Engineer', '12+ years of software engineering experience.')),
    has('Principal Engineer', '12+ years of software engineering experience.'));
  t('  a posting that states no number says nothing about years',
    !/years/.test(has('Customer Support Coach', 'Excellent communication skills.')),
    has('Customer Support Coach', 'Excellent communication skills.'));

  // A number in a posting is not always a number of years of experience.
  t('  "delivering 47 services in 11 months" is not an experience bar',
    !/years of relevant experience/.test(
      has('Customer Support Coach', 'Our team ships in 2 years of platform history.')),
    has('Customer Support Coach', 'Our team ships in 2 years of platform history.'));

  t('  and no job text at all falls back to the plain line',
    /^Interested in applying this experience to the/.test(has('Customer Support Coach', '')),
    has('Customer Support Coach', ''));
}

console.log('\nAND THE AUDIT RUNS IT, IN THE ONE PLACE IT CAN');
{
  const src = fs.readFileSync(path.join(DIR, 'recruiter-audit.js'), 'utf8');
  t('  the module exports it', typeof RA.ensureTitleInSummary === 'function', 'not exported');
  t('  the audit calls it', /const st = ensureTitleInSummary\(outCV, jdTitle, jdCompany, jdText\);/.test(src),
    'the pass exists but nothing runs it');
  // AFTER repairSummary, which rebuilds a summary whose opening claims
  // an unheld title, and BEFORE the clamp, so the paragraph is still
  // cut to the two lines a recruiter reads.
  t('  ...after the summary rebuild',
    src.indexOf('const sr = repairSummary(') < src.indexOf('ensureTitleInSummary(outCV'),
    'the rebuild would read the closing line and rewrite the paragraph');
  t('  ...before the clamp', src.indexOf('ensureTitleInSummary(outCV') < src.indexOf('clampSummary(st.added'),
    'the summary would go out longer than two lines');
  t('  ...and the clamp is given room for it, so it is not what gets cut',
    /maxChars: 220 \+ \(st\.added \? st\.sentence\.length \+ 1 : 0\)/.test(src),
    'the sentence carrying the title would be the first thing trimmed');
  t('  the text comes back whether or not the clamp did anything',
    /if \(st\.added\) \{\s*\n\s*outCV = c\.text;/.test(src),
    'the closing line would be dropped on every summary short enough not to need clamping');
  t('  ...and it is reported, saying what it does and does not claim',
    /Summary: named the target role at the end/.test(src), 'invisible in the report');
}

// WHAT THIS DOES NOT DO. It puts the posting's exact title in the
// summary, which is where a title-match heuristic reads one. It does
// not improve a Jobscan score, satisfy any particular applicant
// tracking system, or make a recruiter more likely to reply, and
// nothing here should be read as measuring any of those. What is
// measured below is that the sentence is added where intended, claims
// no title and no years, and leaves the rest of the page alone.

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
