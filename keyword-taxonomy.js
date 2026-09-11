// "POSTGRESQL X" ON A CV THAT SAYS POSTGRES.
//
// The coverage panel read 20 of 33 on an application where the CV
// plainly held most of the thirteen things missing from it. Every one
// of the misses was the same fault, and it was not the CV's:
//
//   PostgreSQL x   the CV says "Postgres"
//   GitLab CI  x   the CV says "GitLab"
//   Linux systems x the CV says "Linux"
//   observability x the CV says "observability tooling"
//
// A literal, whole-phrase substring test says no to all four, so the
// gauge understated the document and the missing-keyword list sent the
// user off to add things that were already on the page.
//
// The denominator was wrong too. Thirty-three "keywords" included
// "Linux systems" AND "Linux", "GitLab CI" AND "GitHub Actions", "AI"
// AND "AI building" -- the same requirement counted two and three
// times, in whatever words that particular posting happened to use. A
// percentage over a list like that measures the job description's
// vocabulary, not the CV.
//
// ── WHAT A KEYWORD ACTUALLY IS ────────────────────────────────────────
//
// A requirement, not a string. "Postgres", "PostgreSQL" and
// "PostgresSQL" are one requirement written three ways, and a CV
// satisfies it by containing ANY of them. So a keyword resolves to a
// GROUP of equivalent surface forms; the group is what gets counted,
// the group's canonical name is what the chip shows, and the CV is
// searched for every form in it.
//
// Two things generate those forms.
//
//   THE TABLE below, for equivalences no rule can derive: Postgres and
//   PostgreSQL, K8s and Kubernetes, GCP and Google Cloud. These are
//   facts about how the industry writes its own tool names.
//
//   THE RULES in variantsOf, for the ones that are mechanical:
//   separators (CI/CD, CI-CD, CICD), inflections (payout/payouts),
//   and generic qualifiers ("Linux systems", "Kubernetes experience",
//   "strong Python") that add a word to a requirement without changing
//   which requirement it is.
//
// Nothing here loosens the rule that a partial overlap is not a match.
// "Java" still cannot claim "JavaScript" and "React" cannot claim
// "Reactive": an equivalence has to be in the table or produced by a
// rule, never inferred from a shared prefix.
(function (global) {
  'use strict';

  // ── NORMALISATION ────────────────────────────────────────────────────
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[‘’'`´]/g, '')
      .replace(/[^a-z0-9+#./ -]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** All separators removed, so "node.js", "node js" and "nodejs" agree. */
  function tight(s) {
    return norm(s).replace(/[ ./-]/g, '');
  }

  // ── THE TABLE ────────────────────────────────────────────────────────
  //
  // One line per requirement. The FIRST entry is the canonical name and
  // is what a chip displays; the rest are other ways the same thing is
  // written. Kept deliberately short: anything a rule can derive is not
  // listed, so this stays a table of genuine industry synonyms rather
  // than a dictionary of every inflection.
  const GROUPS = [
    // --- languages ----------------------------------------------------
    ['JavaScript', 'JS', 'ECMAScript'],
    ['TypeScript', 'TS'],
    ['Python'], ['Java'], ['Go', 'Golang'], ['Rust'], ['Ruby'],
    ['C#', 'C Sharp', 'CSharp', '.NET C#'], ['C++', 'CPP', 'C Plus Plus'], ['C'],
    ['PHP'], ['Swift'], ['Kotlin'], ['Scala'], ['Elixir'], ['Clojure'],
    ['Perl'], ['R'], ['MATLAB'], ['Objective-C'], ['Dart'], ['Haskell'],
    ['Shell Scripting', 'Shell Script', 'Bash', 'Unix Shell', 'Shell'],
    ['PowerShell', 'Windows PowerShell'],
    ['SQL'], ['PL/SQL'], ['T-SQL', 'Transact-SQL'], ['HTML'], ['CSS'], ['SASS', 'SCSS'],
    ['GraphQL'], ['YAML'], ['JSON'], ['XML'],

    // --- databases and stores ----------------------------------------
    ['PostgreSQL', 'Postgres', 'PostgresSQL', 'Postgre'],
    ['MySQL'], ['MariaDB'], ['SQL Server', 'MSSQL', 'Microsoft SQL Server'],
    ['Oracle Database', 'Oracle DB'], ['MongoDB', 'Mongo'],
    ['Redis'], ['Cassandra'], ['DynamoDB'], ['Elasticsearch', 'ElasticSearch', 'ELK'],
    ['Snowflake'], ['BigQuery', 'Google BigQuery'], ['Redshift', 'Amazon Redshift'],
    ['Databricks'], ['ClickHouse'], ['Neo4j'], ['SQLite'],

    // --- cloud --------------------------------------------------------
    ['AWS', 'Amazon Web Services'],
    ['Azure', 'Microsoft Azure'],
    ['GCP', 'Google Cloud', 'Google Cloud Platform'],
    ['Cloud Infrastructure', 'Cloud Infra', 'Cloud Platforms', 'Public Cloud'],
    ['Serverless', 'Lambda', 'AWS Lambda'],
    ['S3', 'Amazon S3'], ['EC2', 'Amazon EC2'], ['EKS'], ['ECS'], ['RDS'],

    // --- devops / platform --------------------------------------------
    ['Kubernetes', 'K8s'],
    ['Docker'], ['Containerisation', 'Containerization', 'Containers'],
    ['Terraform'], ['Pulumi'], ['Ansible'], ['Chef'], ['Puppet'], ['Helm'],
    ['Infrastructure as Code', 'IaC'],
    ['CI/CD', 'CI', 'CD', 'CICD', 'Continuous Integration',
      'Continuous Delivery', 'Continuous Deployment',
      'Continuous Integration and Deployment'],
    ['Git'], ['GitHub'], ['GitLab'], ['Bitbucket'],
    ['GitHub Actions'], ['GitLab CI', 'GitLab CI/CD'],
    ['Version Control', 'Source Control'],
    ['Jenkins'], ['CircleCI'], ['ArgoCD', 'Argo CD'], ['Spinnaker'],
    ['Linux', 'Linux/Unix', 'Unix', 'Linux Kernel'],
    ['Nginx'], ['Apache'], ['Kafka', 'Apache Kafka'], ['RabbitMQ'],
    ['Airflow', 'Apache Airflow'], ['dbt'], ['Spark', 'Apache Spark'],
    ['Temporal'],

    // --- observability and reliability --------------------------------
    ['Observability', 'Observability Tooling', 'Observability Tools', 'Telemetry'],
    ['Monitoring', 'Alerting'],
    ['OpenTelemetry', 'OTel', 'Open Telemetry'],
    ['Datadog', 'DataDog'], ['Grafana'], ['Prometheus'], ['Honeycomb'],
    ['New Relic', 'NewRelic'], ['Splunk'], ['PagerDuty'], ['Sentry'],
    ['SRE', 'Site Reliability Engineering', 'Site Reliability'],
    ['Incident Response', 'Incident Management', 'On-call', 'Oncall'],
    ['SLO', 'SLA', 'Service Level Objectives', 'Error Budgets'],
    ['DevOps'], ['Platform Engineering'],
    ['Cloud Cost Management', 'FinOps', 'Cloud Cost Optimisation',
      'Cloud Cost Optimization', 'Cost Optimisation', 'Cost Optimization'],

    // --- data / AI ----------------------------------------------------
    ['AI', 'Artificial Intelligence', 'AI Building', 'AI-enabled', 'AI Enabled'],
    ['Machine Learning', 'ML'],
    ['Deep Learning'], ['NLP', 'Natural Language Processing'],
    ['LLM', 'Large Language Models', 'GenAI', 'Generative AI'],
    ['Data Engineering'], ['Data Pipelines', 'Data Pipeline'],
    ['ETL', 'Extract Transform Load'], ['ELT', 'Extract Load Transform'],
    ['Data Analysis', 'Data Analytics', 'Analytics'],
    ['Data Science'], ['Data Modelling', 'Data Modeling'],
    ['Data Warehousing', 'Data Warehouse'],
    ['Power BI', 'PowerBI'], ['Tableau'], ['Looker'], ['Qlik', 'QlikView'],
    ['pandas'], ['NumPy'], ['scikit-learn', 'sklearn'],
    ['TensorFlow'], ['PyTorch'],

    // --- frontend / backend -------------------------------------------
    ['React', 'React.js', 'ReactJS'],
    ['Angular', 'AngularJS'], ['Vue', 'Vue.js', 'VueJS'], ['Svelte'],
    ['Next.js', 'NextJS'], ['Node.js', 'Node', 'NodeJS'],
    ['Express', 'Express.js'], ['Django'], ['Flask'], ['FastAPI'],
    ['Spring', 'Spring Boot'], ['Rails', 'Ruby on Rails'],
    ['.NET', 'dotnet', '.NET Core', 'ASP.NET'],
    ['REST', 'REST API', 'RESTful', 'RESTful API'],
    ['API Design', 'API Development', 'API Architecture'],
    ['Microservices', 'Microservice Architecture'],
    ['Frontend', 'Front End', 'Front-end'],
    ['Backend', 'Back End', 'Back-end'],
    ['Full Stack', 'Fullstack'],
    ['Software Engineering', 'Software Development', 'Software Engineer'],
    ['Architecture', 'System Design', 'Systems Design', 'Solution Architecture'],
    ['Scalability', 'High Availability', 'Distributed Systems'],
    ['Performance Optimisation', 'Performance Optimization', 'Performance Tuning'],
    ['Testing', 'Automated Testing', 'Test Automation', 'Unit Testing'],
    ['QA', 'Quality Assurance'],
    ['Security', 'Application Security', 'AppSec', 'InfoSec'],

    // --- business, product, finance ------------------------------------
    ['Project Management'], ['Programme Management', 'Program Management'],
    ['Product Management'], ['Stakeholder Management', 'Stakeholder Engagement'],
    ['Requirements Gathering', 'Requirements Analysis'],
    ['Business Analysis', 'Business Analytics'],
    ['Process Improvement', 'Process Optimisation', 'Process Optimization'],
    ['Agile', 'Scrum', 'Kanban', 'Agile Methodologies'],
    ['Jira', 'Atlassian Jira'], ['Confluence'], ['Asana'], ['Notion'],
    ['Salesforce', 'SFDC'], ['HubSpot'], ['Workday'], ['SAP'], ['NetSuite'],
    ['Oracle EBS', 'Oracle E-Business Suite', 'E-Business Suite', 'EBS'],
    ['Excel', 'Microsoft Excel', 'MS Excel'],
    ['Financial Reporting'], ['Forecasting', 'Financial Forecasting'],
    ['Budgeting'], ['Reconciliation'], ['Invoicing', 'Billing'],
    ['Payouts', 'Disbursements'], ['Payments', 'Payment Services',
      'Payment Processing', 'Payment Service Providers', 'PSP'],
    ['Tax Calculation', 'Tax Compliance'],
    ['Financial Technology', 'FinTech'],
    ['Risk Management', 'Credit Risk'],
    ['Regulatory Reporting', 'Compliance', 'Regulatory Compliance'],
    ['AML', 'Anti Money Laundering', 'Anti-Money Laundering'],
    ['KYC', 'Know Your Customer'],
    ['GTM', 'Go To Market', 'Go-to-Market'],
    ['Revenue Operations', 'RevOps'], ['Sales Operations', 'SalesOps'],
    ['Technical Evaluation', 'Vendor Evaluation', 'Technical Assessment'],
    ['Innovation'],

    // --- payroll, HR and operations -----------------------------------
    //
    // The table was tech-heavy, so an operations posting produced three
    // chips for one requirement -- "payroll", "global payroll" and
    // "payroll management" -- and counted them as three, which is what
    // held a 50% reading down.
    ['Payroll', 'Global Payroll', 'Payroll Operations', 'Payroll Management',
      'Payroll Delivery', 'Payroll Processing', 'Payroll Administration'],
    ['Multi-country', 'Multi Country', 'Multinational', 'Cross-border', 'International'],
    ['HRIS', 'HR Information System', 'Core HR'],
    ['Benefits Administration', 'Benefits'], ['Compensation', 'Comp & Ben', 'Total Rewards'],
    ['Time and Attendance', 'Timekeeping'],
    ['Statutory Reporting', 'Regulatory Reporting', 'Statutory Filings'],
    ['Compliance', 'Regulatory Compliance', 'Statutory Compliance'],
    ['Audit', 'Internal Audit', 'Audit Readiness', 'Controls'],
    ['Reconciliation', 'Account Reconciliation', 'Payroll Reconciliation'],
    ['Vendor Management', 'Supplier Management', 'Third Party Management'],
    ['SLA Management', 'Service Levels', 'Service Level Agreements'],
    ['KPI', 'KPIs', 'Key Performance Indicators', 'Metrics', 'Performance Metrics'],
    ['Continuous Improvement', 'Process Improvement', 'Process Optimisation', 'Process Optimization'],
    ['Operational Excellence'], ['Lean'], ['Six Sigma'],
    ['Escalation Management', 'Issue Resolution', 'Operational Resolution',
      'Query Resolution', 'Case Management'],
    // "feedback" and "team performance" arrived as separate chips on one
    // posting and counted as two more requirements, when both are the
    // same area of work as the performance review cycle that was
    // already listed. A posting's phrasing is not a new requirement.
    ['Performance Management', 'Performance Reviews', 'Performance Feedback',
      'Performance Actions', 'Appraisals', 'Feedback', 'Team Performance',
      'Performance Improvement', 'Performance Conversations'],
    ['Policy', 'Policy Application', 'Policy Compliance', 'Policy Development',
      'Policy Implementation', 'Policies and Procedures'],
    ['Remote-first', 'Remote First', 'Remote-first Teams', 'Distributed Teams',
      'Remote Teams', 'Fully Remote'],
    ['Languages', 'Additional Languages', 'Multilingual', 'Language Skills'],
    ['Zendesk'], ['ServiceNow'], ['Deel'], ['Remote.com'], ['ADP'], ['Ceridian'],
    ['Payroll Software', 'Payroll Systems', 'Payroll Platform'],
    ['Onboarding'], ['Offboarding'], ['Employee Relations'],
    ['People Leadership', 'People Management', 'Line Management',
      'Team Leadership', 'Managing a Team'],
    ['Stakeholder Communication', 'Stakeholder Updates'],
    ['SOP', 'Standard Operating Procedures', 'Process Documentation'],
    ['Data Accuracy', 'Accuracy', 'Quality Control'],

    // --- people -------------------------------------------------------
    ['Leadership', 'Team Leadership', 'Technical Leadership'],
    ['Mentorship', 'Mentoring', 'Coaching'],
    ['Collaboration', 'Cross-functional Collaboration', 'Cross Functional',
      'Cross-functional', 'Teamwork', 'Team Dynamics'],
    ['Communication', 'Written Communication', 'Verbal Communication'],
    ['Problem Solving', 'Problem-solving', 'Analytical Thinking'],
    ['Conflict Resolution'],
    ['Attention to Detail'], ['Time Management'], ['Adaptability'],
    ['Presentation', 'Public Speaking'],
    ['Negotiation'], ['Training', 'Enablement'],
    ['Documentation', 'Technical Writing'],
  ];

  const BY_FORM = new Map();
  GROUPS.forEach((group, i) => {
    for (const form of group) {
      const key = tight(form);
      if (key && !BY_FORM.has(key)) BY_FORM.set(key, i);
    }
  });

  // ── RULES ────────────────────────────────────────────────────────────
  //
  // Words that qualify a requirement without changing which requirement
  // it is. "Linux systems" and "Linux" are the same line on a CV;
  // "Linux administration" is not, so administration is not here. The
  // list is deliberately closed and dull.
  const TRAILING_NOISE = new Set(['systems', 'system', 'tools', 'tooling', 'stack',
    'stacks', 'platform', 'platforms', 'technologies', 'technology', 'tech',
    'experience', 'expertise', 'skills', 'skill', 'knowledge', 'environment',
    'environments', 'ecosystem', 'fundamentals', 'concepts', 'principles',
    'practices', 'background', 'proficiency', 'capabilities', 'suite']);

  const LEADING_NOISE = new Set(['strong', 'excellent', 'good', 'solid', 'deep',
    'proven', 'demonstrated', 'advanced', 'basic', 'extensive', 'working',
    'hands on', 'hands-on', 'practical', 'relevant', 'modern', 'core',
    'experience with', 'experience in', 'knowledge of', 'proficiency in',
    'familiarity with', 'understanding of', 'expertise in']);

  /** Strip the qualifiers off a term without changing what it names. */
  function stripQualifiers(term) {
    let words = norm(term).split(' ').filter(Boolean);
    let changed = true;
    while (changed && words.length > 1) {
      changed = false;
      // Leading: single words, then the two-word phrases above.
      const two = words.slice(0, 2).join(' ');
      if (words.length > 2 && LEADING_NOISE.has(two)) { words = words.slice(2); changed = true; continue; }
      if (LEADING_NOISE.has(words[0])) { words = words.slice(1); changed = true; continue; }
      if (TRAILING_NOISE.has(words[words.length - 1])) { words = words.slice(0, -1); changed = true; }
    }
    return words.join(' ');
  }

  /**
   * The group this term belongs to, or null.
   *
   * Two attempts and no more: the term as written, then the term with
   * its qualifiers stripped -- which is what lets "Linux systems" and
   * "Kubernetes experience" find their group.
   *
   * An earlier version also walked back through leading sub-phrases, so
   * any term beginning with a known name inherited that name's group.
   * It made "AWS security" into AWS and "Linux administration" into
   * Linux -- marking a requirement satisfied by a CV that had only
   * mentioned the platform, which is the exact false positive this file
   * exists to avoid. A qualifier that changes the subject is a
   * different requirement, and the only words allowed to fall away are
   * the closed, dull list above.
   */
  function groupIndexOf(term) {
    const exact = BY_FORM.get(tight(term));
    if (exact !== undefined) return exact;
    const stripped = BY_FORM.get(tight(stripQualifiers(term)));
    return stripped === undefined ? null : stripped;
  }

  function groupOf(term) {
    const i = groupIndexOf(term);
    return i === null ? null : GROUPS[i];
  }

  /** Title-ish label for a term with no group: the writer's own words, tidied. */
  function tidyLabel(term) {
    const bare = stripQualifiers(term) || norm(term);
    const original = String(term == null ? '' : term).trim();
    // Keep the original casing when it survives the stripping intact --
    // acronyms and product names are cased by the person who wrote them.
    if (tight(original) === tight(bare)) return original;
    const words = original.split(/\s+/);
    const kept = words.filter((w) => tight(bare).indexOf(tight(w)) !== -1);
    return (kept.join(' ') || bare).trim();
  }

  /**
   * The name to PRINT for this term.
   *
   * A chip reading "Linux systems" beside another reading "Linux" is
   * the same requirement listed twice, and a coverage percentage over
   * that list measures the posting's vocabulary rather than the CV.
   */
  function canonical(term) {
    const group = groupOf(term);
    return group ? group[0] : tidyLabel(term);
  }

  /** A stable identity for a requirement, for de-duplication. */
  function keyOf(term) {
    const i = groupIndexOf(term);
    return i === null ? 'raw:' + tight(stripQualifiers(term) || term) : 'g:' + i;
  }

  // ── MATCHING ─────────────────────────────────────────────────────────
  //
  // One regex per surface form, with every separator inside it made
  // optional so "node.js", "node js", "node-js" and "nodejs" are one
  // pattern. Boundaries still reject a hit inside a longer word, which
  // is what keeps Java out of JavaScript.
  const _cache = new Map();
  function formPattern(form) {
    if (_cache.has(form)) return _cache.get(form);
    const n = norm(form);
    const parts = n.split(/[ ./-]+/).filter(Boolean)
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const body = parts.join('[\\s./-]{0,2}');
    // + and # are part of the token in C++ and C#, so they must not be
    // treated as a boundary either side.
    const re = new RegExp('(?<![\\p{L}\\p{N}_+#])' + body + '(?![\\p{L}\\p{N}_+#])', 'iu');
    _cache.set(form, re);
    return re;
  }

  // A PLURAL IS NOT A DIFFERENT REQUIREMENT.
  //
  // "Payouts" and "payout", "microservices" and "microservice". Done by
  // rule rather than by listing both in the table, and only on the last
  // word, so it cannot reach inside a name. The floor of three
  // characters on the singular is what stops "AWS" being tested as
  // "AW".
  function pluralVariants(form) {
    const words = String(form || '').trim().split(/\s+/);
    if (!words.length) return [];
    const last = words[words.length - 1];
    const swap = (w) => words.slice(0, -1).concat(w).join(' ');
    if (/[^s]s$/i.test(last) && last.length >= 4) return [swap(last.slice(0, -1))];
    if (/[^s]$/i.test(last) && last.length >= 3 && !/[+#.]/.test(last)) return [swap(last + 's')];
    return [];
  }

  /** Every surface form worth testing for this term. */
  function variantsOf(term) {
    const group = groupOf(term);
    const base = group ? group.slice() : (() => {
      const out = [String(term == null ? '' : term).trim()];
      const bare = stripQualifiers(term);
      if (bare && tight(bare) !== tight(out[0])) out.push(bare);
      return out.filter(Boolean);
    })();
    const seen = new Set(base.map(tight));
    const out = base.slice();
    for (const form of base) {
      for (const variant of pluralVariants(form)) {
        const key = tight(variant);
        if (key && !seen.has(key)) { seen.add(key); out.push(variant); }
      }
    }
    return out;
  }

  /** Does this document satisfy this requirement? */
  function appearsIn(text, term) {
    const haystack = String(text == null ? '' : text).normalize('NFKC');
    if (!haystack) return false;
    for (const form of variantsOf(term)) {
      const pattern = formPattern(form);
      const occurrences = new RegExp(pattern.source, 'giu');
      for (const match of haystack.matchAll(occurrences)) {
        const before = haystack.slice(0, match.index);
        const clause = before.slice(Math.max(before.lastIndexOf('\n'), before.lastIndexOf('.'), before.lastIndexOf(';'), before.lastIndexOf('!'), before.lastIndexOf('?')) + 1);
        // Scope negative experience statements, not unrelated results such as
        // "without downtime using Docker" or "not only Python".
        const scope = clause.split(/\b(?:but|however|although)\b/i).pop();
        const negativeExperience = /\b(?:no|without|zero|lacking)\s+(?:(?:prior|direct|professional|hands-on)\s+)?(?:experience|knowledge|exposure|proficiency|familiarity)\b[^.!?;]{0,100}$/i;
        const negativeUse = /\b(?:not|never)\s+(?:(?:directly|previously|personally|yet)\s+)*(?:worked|used|implemented|built|learned|worked with)\b[^.!?;]{0,100}$/i;
        const directNegation = /\b(?:no|neither|nor|without)\s*$/i;
        if (!negativeExperience.test(scope) && !negativeUse.test(scope) && !directNegation.test(scope)) return true;
      }
    }
    return false;
  }

  /**
   * One entry per requirement, in the order first seen, each carrying
   * the canonical label and every form that was asked for.
   */
  function dedupe(terms) {
    const seen = new Map();
    for (const raw of (Array.isArray(terms) ? terms : [])) {
      if (typeof raw !== 'string') continue;
      const term = raw.trim();
      if (!term) continue;
      const key = keyOf(term);
      if (seen.has(key)) { seen.get(key).asked.push(term); continue; }
      seen.set(key, { key: key, label: canonical(term), asked: [term] });
    }
    return Array.from(seen.values());
  }

  /** Coverage over REQUIREMENTS rather than over strings. */
  function measure(text, terms) {
    const entries = dedupe(terms);
    const matched = [], missing = [];
    for (const entry of entries) {
      (appearsIn(text, entry.asked[0]) ? matched : missing).push(entry.label);
    }
    const total = entries.length;
    return {
      matched: matched,
      missing: missing,
      total: total,
      percent: total ? Math.round(matched.length / total * 100) : 0,
    };
  }


  // ── WHAT PROVES A CAPABILITY, AS OPPOSED TO NAMING IT ────────────────
  //
  // A posting asks for "Infrastructure as Code". The profile says
  // "authored the Terraform modules and Helm charts the client
  // continues to operate". Those are the same competence, and a gate
  // that looks for the WORDS "infrastructure" and "code" rejects it --
  // so the term was withheld from a CV that had every right to it, and
  // a platform engineer applying to a platform role scored 70%.
  //
  // The same gap, over and over, on exactly the requirements that
  // matter most:
  //
  //   Infrastructure as Code   proved by Terraform, Helm, Pulumi
  //   Observability            proved by Prometheus, Grafana, Datadog
  //   SRE                      proved by on-call, incident response,
  //                            error budgets, reliability targets
  //   Scalability              proved by "serves billions of requests"
  //
  // This table is the difference between naming a capability and
  // demonstrating it. It is used ONLY to decide whether a term may be
  // written onto the CV -- never to decide whether the finished CV
  // matches, which stays a literal test because an ATS is literal.
  //
  // Every entry has to be an entailment, not an association. Using
  // Terraform IS doing infrastructure as code. Having "improved a
  // process" is NOT continuous improvement in the sense a posting
  // means, so no such entry exists.
  const IMPLIED_BY = {
    'Infrastructure as Code': ['Terraform', 'Pulumi', 'CloudFormation', 'Helm', 'Ansible', 'Puppet', 'Chef'],
    'Observability': ['Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Splunk', 'OpenTelemetry',
      'Honeycomb', 'Sentry', 'monitoring and alerting', 'alerting'],
    'Monitoring': ['Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Splunk', 'PagerDuty'],
    'SRE': ['on-call', 'oncall', 'incident response', 'error budget', 'reliability target',
      'postmortem', 'post-mortem', 'SLO', 'production incident'],
    'Incident Response': ['on-call', 'oncall', 'postmortem', 'post-mortem', 'production incident',
      'paged', 'PagerDuty'],
    'Scalability': ['billions of requests', 'millions of requests', 'high availability',
      'horizontally', 'load balanc', 'throughput', 'distributed'],
    'CI/CD': ['Jenkins', 'GitHub Actions', 'GitLab CI', 'ArgoCD', 'CircleCI', 'build pipeline',
      'deployment pipeline', 'release pipeline'],
    'Platform Engineering': ['Kubernetes', 'Terraform', 'internal tooling', 'developer platform',
      'deployment tooling'],
    'Microservices': ['microservice', 'EKS', 'ECS', 'service mesh'],
    'Data Engineering': ['Airflow', 'Spark', 'PySpark', 'dbt', 'Kafka', 'ETL', 'data pipeline',
      'data feed', 'Presto'],
    'Machine Learning': ['PyTorch', 'TensorFlow', 'scikit-learn', 'XGBoost', 'ranking model',
      'model training', 'MLflow'],
    'Cloud Infrastructure': ['AWS', 'Azure', 'GCP', 'Google Cloud', 'EC2', 'EKS', 'S3', 'Lambda'],
    'Testing': ['pytest', 'unit test', 'test coverage', 'integration test', 'automated test'],
    'Linux': ['Bash', 'shell script', 'Unix', 'systemd', 'cron'],
    'Docker': ['container', 'Kubernetes', 'EKS'],
    'Data Analysis': ['Power BI', 'Tableau', 'SQL', 'Looker', 'dashboards'],
    'Data Warehousing': ['Snowflake', 'Redshift', 'BigQuery', 'data warehouse'],
    'Mentorship': ['mentored', 'coached', 'onboarded', 'trained', 'apprentice'],
    'Leadership': ['led the', 'chaired', 'headed', 'ran the team', 'line managed'],
    'Stakeholder Management': ['stakeholder', 'business partner', 'client CTO', 'steering'],
    'Regulatory Reporting': ['regulatory', 'IFRS', 'statutory', 'regulator'],
    'Compliance': ['ISO 27001', 'HIPAA', 'GDPR', 'SOC 2', 'audit'],
    'Performance Management': ['performance review', 'appraisal', 'feedback', 'one to one', '1:1'],
    'Multi-country': ['offices in', 'across three markets', 'cross-border', 'EMEA', 'APAC',
      'multiple countries', 'international'],
    'KPI': ['reliability target', 'performance metric', 'service level', 'SLA', 'SLO',
      'error budget', 'month-end reporting'],
    'Escalation Management': ['incident response', 'triage', 'escalated', 'root cause',
      'recurring failure', 'backlog'],
    'Continuous Improvement': ['cutting the', 'cut the month-end', 'reduced the cycle',
      'streamlined', 'removed the manual'],
  };
  const _IMPLIED_LOOKUP = new Map();
  for (const label of Object.keys(IMPLIED_BY)) _IMPLIED_LOOKUP.set(tight(label), IMPLIED_BY[label]);

  /**
   * Does this body of text DEMONSTRATE the requirement, as opposed to
   * naming it? Used by the evidence gate only.
   */
  function impliedIn(text, term) {
    const group = groupOf(term);
    const label = group ? group[0] : String(term || '');
    const proofs = _IMPLIED_LOOKUP.get(tight(label));
    if (!proofs) return false;
    const haystack = String(text == null ? '' : text).normalize('NFKC').toLowerCase();
    if (!haystack) return false;
    for (const proof of proofs) {
      // A plain lower-cased contains: these are phrases, not keywords,
      // and a boundary test would reject "load balanc" matching
      // "load balancing", which is the point of writing it that way.
      if (haystack.indexOf(norm(proof)) !== -1) return true;
    }
    return false;
  }

  global.KeywordTaxonomy = {
    norm, tight, canonical, keyOf, groupOf, variantsOf, appearsIn, dedupe,
    measure, stripQualifiers, GROUPS, impliedIn, IMPLIED_BY,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.KeywordTaxonomy;
})(typeof window !== 'undefined' ? window : globalThis);

