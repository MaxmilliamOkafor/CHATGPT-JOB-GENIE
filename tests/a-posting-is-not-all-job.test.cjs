// A POSTING IS NOT ALL JOB.
//
// It is a job wrapped in a company pitch, a list of values, a benefits
// table and a page of legal text, and only one of those says what the
// candidate must be able to do.
//
// Frequency scoring used to hide this. Boilerplate words are rare, so
// they never scored. The taxonomy sweep asks whether a requirement is
// NAMED and deliberately does not care how often, which threw that
// protection away. One real posting produced six requirements that came
// entirely from prose about the employer:
//
//   Hiring            "remove your data from our recruitment database"
//   Policy            "a zero tolerance policy applied to it"
//   Ownership         "the lowest total cost of ownership"
//   SaaS              "its SaaS-first automation fabric"
//   Innovation        "focus on innovation, growth and what's next"
//   Customer Success  "Obsess over Customer Success", a company value
//
// Hiring is the one that shows the cost. It reached the CV, which then
// claimed recruitment experience on an application for a data analyst,
// because a GDPR paragraph happened to contain the word "recruitment".
//
// The test is what the section is ABOUT: a requirements section says
// what YOU will do, a company section says what THEY are. Only the
// former may introduce a requirement here. Nothing is lost by it, since
// the frequency and model extractors still read the whole posting, so a
// theme genuinely central to the role is still caught by repetition.
let PASS = 0, FAIL = 0;
const t = (n, c, x) => { c ? PASS++ : FAIL++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '\n           >> ' + x)); };

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
global.window = global;
require(path.join(DIR, 'keyword-taxonomy.js'));
require(path.join(DIR, 'jd-contact-extractor.js'));
const TX = global.KeywordTaxonomy;
const JD = global.JDContactExtractor;

const POSTING = [
  'Revenue Operations Data Analyst',
  '',
  'ABOUT US',
  'Redwood is the leading orchestration platform for the autonomous',
  'enterprise, driving business transformation at the lowest total cost of',
  'ownership. Through its SaaS-first automation fabric, Redwood helps',
  'organizations unlock human potential to focus on innovation and growth.',
  '',
  'CORE VALUES',
  'One Team. One Redwood',
  'Obsess over Customer Success',
  'Own the Outcome',
  'Be Curious',
  '',
  'YOUR IMPACT',
  'You will analyse sales data, develop insightful reports, and provide',
  'recommendations to improve sales performance and operational efficiency.',
  'Develop and implement forecasting models to predict future sales.',
  'Identify automation opportunities to improve data quality.',
  'Partner with cross-functional teams to support strategic planning.',
  '',
  'YOUR EXPERIENCE',
  'Five years with data analysis tools including Salesforce, SQL, Python, R,',
  'Qlik/Tableau and Excel. SQL is a must-have.',
  'Excellent communication and presentation skills.',
  '',
  'BENEFITS',
  'Private health insurance, a pension, and 25 days paid time off.',
  'We also offer Kubernetes training for anyone who wants it.',
  '',
  'THE LEGAL BIT',
  'Redwood is an equal opportunity employer and prohibits unlawful',
  'discrimination. All such discrimination will have a zero tolerance',
  'policy applied to it.',
  'Redwood will comply with GDPR. Should you wish for us to remove your',
  'personal data from our recruitment database, please email us directly',
  'at Privacy@Redwood.com',
].join('\n');

const found = TX.sweep(POSTING, 80).map((r) => r.label);

console.log('THE COMPANY PITCH IS NOT A LIST OF REQUIREMENTS');
{
  for (const [label, where] of [
    ['Hiring', '"our recruitment database", in the GDPR paragraph'],
    ['Policy', '"a zero tolerance policy", in the EEO text'],
    ['Ownership', '"the lowest total cost of ownership", a pricing phrase'],
    ['SaaS', '"its SaaS-first automation fabric", their product'],
    ['Innovation', 'the About Us paragraph'],
    ['Customer Success', 'a company value, not a requirement'],
  ]) {
    t('  ' + label.padEnd(17) + ' is not a requirement: ' + where,
      !found.includes(label), found.join(', '));
  }
  t('  ...nor is a perk: Kubernetes training is not a Kubernetes requirement',
    !found.includes('Kubernetes'), found.join(', '));
}

console.log('\nAND THE JOB STILL IS');
{
  for (const want of ['Salesforce', 'SQL', 'Python', 'R', 'Qlik', 'Tableau', 'Excel',
    'Forecasting', 'Automation', 'Data Quality', 'Data Analysis', 'Communication',
    'Presentation', 'Strategic Planning', 'Operational Efficiency']) {
    t('  ' + want.padEnd(22) + ' survives', found.includes(want), found.join(', '));
  }
}

console.log('\nTHE SECTIONS ARE JUDGED BY WHAT THEY ARE ABOUT');
{
  const PAD = ('We want someone to own this area end to end, working with '
    + 'partners across the business and taking real responsibility.\n').repeat(4);
  const probe = (h) => TX.requirementText(
    'Head of Data\n\nWHAT YOU WILL DO\n' + PAD + '\n' + h + '\nWe need Kubernetes here.\n'
  ).includes('Kubernetes');
  for (const keep of ['About the role', 'Responsibilities:', 'YOUR EXPERIENCE',
    'Requirements', 'What you will do', 'Why this role exists']) {
    t('  kept: ' + keep, probe(keep), 'a requirements section was discarded');
  }
  for (const drop of ['About us', 'About Extenteam', 'ABOUT US', 'CORE VALUES',
    'Our values', 'Benefits', 'Perks', 'What we offer', 'THE LEGAL BIT',
    'Equal Opportunity', 'How to apply', 'Life at Redwood']) {
    t('  dropped: ' + drop, !probe(drop), 'a company section was read as requirements');
  }
}

console.log('\nAND A VALUES LIST IS ONE SECTION, NOT SEVEN HEADINGS');
{
  // "Obsess over Customer Success" is Title Case, short, and ends without
  // punctuation, so it read as a heading of its own. That split the values
  // block into one-line sections and let every line through.
  const values = ['Role', '', 'CORE VALUES', 'Obsess over Customer Success',
    'Own the Outcome', 'Make Your Own Weather', '', 'REQUIREMENTS',
    'You will need Python and SQL and a good deal of experience with data',
    'modelling, pipelines and the reporting that sits on top of them here.'].join('\n');
  const kept = TX.requirementText(values);
  t('  the whole values block goes', !/Customer Success|Own the Outcome/.test(kept), kept);
  t('  ...and the requirements stay', /Python and SQL/.test(kept), kept);
}

console.log('\nAND A POSTING IT CANNOT PARSE IS READ WHOLE');
{
  // Under-reading a posting costs a real requirement, which is the worse
  // of the two mistakes, so anything ambiguous fails open.
  const noHeadings = 'We need a data engineer with Python, SQL and Airflow '
    + 'experience to build pipelines for our analytics team over the next year.';
  t('  a posting with no headings comes back whole',
    TX.requirementText(noHeadings) === noHeadings, 'text was dropped');
  t('  ...and its requirements are still found',
    ['Python', 'SQL', 'Airflow'].every((k) => TX.sweep(noHeadings, 40)
      .some((r) => r.label === k)), JSON.stringify(TX.sweep(noHeadings, 40)));
  t('  an empty posting is empty', TX.requirementText('') === '', 'invented text');
  t('  ...and a posting that is ALL boilerplate is read whole rather than not at all',
    TX.requirementText('ABOUT US\nWe are a company that does things.').includes('company'),
    'scoping left nothing');
}

console.log('\nAND A WRONG INBOX BEATS NO INBOX');
{
  // "please email us directly at Privacy@Redwood.com" IS a published
  // address, and reporting "No recipient. Add an address the employer
  // published" was false: it sent the reader back to the posting to look
  // for an address already on their screen.
  //
  // It is not the recipient anyone would choose. It is also not nothing,
  // and an application nobody sends is a guaranteed zero, so when the
  // employer published no recruiting address it is offered rather than
  // the run being skipped. Never preferred: a real recruiting address
  // wins wherever one exists.
  const r = JD.extract({ jdText: POSTING, url: 'https://job-boards.greenhouse.io/x/jobs/1',
    title: 'Revenue Operations Data Analyst', company: 'Redwood' });
  t('  it is reported, not silently dropped', r.declined.length === 1
    && /privacy@redwood\.com/i.test(r.declined[0].email), JSON.stringify(r.declined));
  t('  ...the reason names the inbox, not a generic refusal',
    /privacy and data-protection/i.test(r.declined[0].reason || ''),
    JSON.stringify(r.declined));
  t('  ...and it IS offered, because nothing better was published',
    r.fallback && /privacy@redwood\.com/i.test(r.fallback.email), JSON.stringify(r.fallback));

  const only = (text) => {
    const o = JD.extract({ jdText: text, url: 'https://x.invalid/j/1', title: 'T', company: 'Acme' });
    return { email: o.email, fallback: o.fallback && o.fallback.email };
  };

  // A real recruiting address always wins, however it is laid out. The
  // context window is a whole line, and a footer carries two addresses on
  // one, so "privacy" beside careers@ used to throw careers@ away.
  for (const [shape, text] of [
    ['prose', 'Email careers@acme.com to apply. Also privacy@acme.com for data removal.'],
    ['pipes', 'Apply: careers@acme.com | Privacy: privacy@acme.com'],
    ['reversed', 'Privacy: privacy@acme.com | Apply: careers@acme.com'],
    ['separate lines', 'Email careers@acme.com to apply.\nSeparately, privacy@acme.com is for data removal.'],
  ]) {
    const o = only(text);
    t('  a recruiting address on the same line still wins (' + shape + ')',
      o.email === 'careers@acme.com' && !o.fallback, JSON.stringify(o));
  }

  // Ranked: an inbox that reads general post beats one that does not.
  t('  a general enquiries inbox outranks the privacy inbox',
    only('Recruitment: privacy@acme.com and info@acme.com for questions.').fallback
      === 'info@acme.com',
    JSON.stringify(only('Recruitment: privacy@acme.com and info@acme.com for questions.')));

  // And the one thing never offered, which is not a judgement about which
  // inbox is appropriate: noreply@ is configured not to deliver to a
  // person, so sending there skips the application while reporting
  // success, which is the worst of both.
  t('  an unattended mailbox is never offered',
    only('Recruitment questions: noreply@acme.com').fallback === undefined
      || only('Recruitment questions: noreply@acme.com').fallback === null,
    JSON.stringify(only('Recruitment questions: noreply@acme.com')));

  // A posting that really published nothing must not claim otherwise.
  const bare = JD.extract({ jdText: 'We are hiring a data engineer. Apply on this page.',
    url: 'https://example.invalid/j/1', title: 'Data Engineer', company: 'X' });
  t('  a posting with no address reports none declined',
    Array.isArray(bare.declined) && bare.declined.length === 0, JSON.stringify(bare.declined));
  t('  ...and offers no fallback', !bare.fallback, JSON.stringify(bare.fallback));

  // And the panel has to actually use it.
  const src = fs.readFileSync(path.join(DIR, 'popup.js'), 'utf8');
  t('  the panel asks for the reason instead of hard-coding "no recipient"',
    (src.match(/this\.followupNoRecipientMessage\(\)/g) || []).length >= 2,
    'the message is still unconditional');
  t('  ...and fills the To field from the fallback rather than skipping',
    /toEl\.dataset\.fallback = '1'/.test(src)
      && /followupFallbackRecipient\(\)/.test(src),
    'the fallback is computed but never used');
}

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
