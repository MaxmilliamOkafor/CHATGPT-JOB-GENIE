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
  //
  // TWO SIDES OF ONE COMPARISON, AND THEY HAVE TO AGREE.
  //
  // norm() cleans the TERM being searched for. fold() cleans the DOCUMENT
  // being searched. They were not doing the same thing, so a document
  // could plainly contain a requirement and still not match it:
  //
  //   posting says            term normalises to     result
  //   Bachelor's degree       "bachelors degree"      no match
  //   2016-2024               "2016-2024"             no match on 2016<en>2024
  //   full-stack              "full-stack"            no match on full<nb>stack
  //
  // The apostrophe case is the worst of them and needs no exotic
  // characters at all: norm strips the apostrophe out of the term, the
  // document keeps it, and the pattern hunts "masters" through a page
  // that says "Master's". "Bachelor's degree" and "Master's degree" are
  // in most postings, so those chips could never go green.
  //
  // Typography does the rest. Posting text pasted from a web page is full
  // of curly apostrophes and en-dashes, and a word processor rewrites
  // ASCII into them as you type.
  //
  // FOLDED AT COMPARISON TIME ONLY. What gets written to the CV keeps its
  // real punctuation, because that is what the applicant tracking system
  // parses and what a person reads.
  const _APOSTROPHE = /[‘’‚‛ʼʹ`´']/g;
  const _DASH = /[‐‑‒–—―−]/g;
  const _SPACE = /[     ]/g;

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .toLowerCase()
      .replace(_APOSTROPHE, '')
      .replace(/[^a-z0-9+#./ -]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * A document put into the same shape the search terms are in.
   *
   * Every rule here mirrors one in norm(): apostrophes removed because
   * norm removes them, dash variants folded to the ASCII hyphen that
   * formPattern's separator class accepts, exotic spaces folded to a
   * plain one. Nothing else is touched, so the text a caller matches
   * against is still the text it was given.
   */
  function fold(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .replace(_APOSTROPHE, '')
      .replace(_DASH, '-')
      .replace(_SPACE, ' ');
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
    // Orchestrators a data posting names alongside Airflow. Separate
    // requirements, because they are separate products: knowing Airflow
    // is not knowing Dagster, and a CV must not claim otherwise.
    ['Dagster'], ['Prefect'], ['Luigi'], ['Mage'], ['Flyte'],
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
    ['Data Engineering'],
    ['Data Pipelines', 'Data Pipeline', 'Pipelines', 'Pipeline', 'Ingestion Pipelines'],
    ['ETL', 'Extract Transform Load'], ['ELT', 'Extract Load Transform'],
    ['Data Analysis', 'Data Analytics', 'Analytics'],
    ['Data Science'], ['Data Modelling', 'Data Modeling'],
    ['Data Warehousing', 'Data Warehouse'],
    // "pipelines" on a data posting means data pipelines. It had no
    // group at all, so it stood as its own unmatchable requirement.
    ['Data Quality', 'Data Accuracy', 'Data Integrity', 'Data Validation'],
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
    // Both arrived on postings as bare words with no group at all, so
    // nothing could be shown to satisfy them and they sat in the
    // denominator as permanent misses.
    // High availability stays with Scalability, and automated testing
    // with Testing: those are where a reader of either group would look
    // for them, and a form belongs to one group only.
    ['Reliability', 'Availability', 'Uptime', 'Resilience'],
    ['Automation', 'Process Automation', 'Workflow Automation', 'Scripting'],
    ['Security', 'Application Security', 'AppSec', 'InfoSec'],

    // --- business, product, finance ------------------------------------
    ['Project Management'], ['Programme Management', 'Program Management'],
    ['Product Management'], ['Stakeholder Management', 'Stakeholder Engagement'],
    ['Requirements Gathering', 'Requirements Analysis'],
    ['Business Analysis', 'Business Analytics'],
    ['Agile', 'Scrum', 'Kanban', 'Agile Methodologies'],
    ['Jira', 'Atlassian Jira'], ['Confluence'], ['Asana'], ['Notion'],
    ['Salesforce', 'SFDC'], ['HubSpot'], ['Workday'], ['SAP'], ['NetSuite'],
    ['Oracle EBS', 'Oracle E-Business Suite', 'E-Business Suite', 'EBS'],
    ['Excel', 'Microsoft Excel', 'MS Excel'],
    ['Financial Reporting'], ['Forecasting', 'Financial Forecasting'],
    ['Budgeting'], ['Invoicing', 'Billing'],
    ['Payouts', 'Disbursements'], ['Payments', 'Payment Services',
      'Payment Processing', 'Payment Service Providers', 'PSP'],
    ['Tax Calculation', 'Tax Compliance'],
    ['Financial Technology', 'FinTech'],
    ['Risk Management', 'Credit Risk'],
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
    // Producing the filings and meeting the rules are different work. A
    // CV that reports to a regulator has not thereby shown a compliance
    // programme, so these stay two requirements.
    ['Regulatory Reporting', 'Statutory Reporting', 'Statutory Filings'],
    ['Compliance', 'Regulatory Compliance', 'Statutory Compliance'],
    ['Audit', 'Internal Audit', 'Audit Readiness', 'Controls'],
    ['Reconciliation', 'Account Reconciliation', 'Payroll Reconciliation'],
    ['Vendor Management', 'Supplier Management', 'Third Party Management'],
    ['SLA Management', 'Service Levels', 'Service Level Agreements'],
    ['KPI', 'KPIs', 'Key Performance Indicators', 'Metrics', 'Performance Metrics'],
    ['Continuous Improvement', 'Process Improvement', 'Process Optimisation', 'Process Optimization'],
    ['Operational Excellence'], ['Lean'], ['Six Sigma'],
    // Postings ask for these constantly and none had a group, so each
    // sat in the denominator with nothing in the world able to satisfy
    // it. The adjective and the abstract noun resolve to one entry
    // through the rules above, so "scrappy" and "scrappiness" are one
    // requirement rather than two.
    ['Operational Efficiency', 'Efficiency'],
    ['Ownership', 'Accountability', 'End-to-end Ownership', 'Take Ownership'],
    ['Scrappy', 'Resourceful', 'Resourcefulness', 'Scrappiness'],
    ['Decision Making', 'Decision-Making', 'Judgement', 'Judgment'],
    ['Customer Success', 'Client Success'],
    ['Internal Tools', 'Internal Users', 'Internal Platform', 'Internal Tooling',
      'Building for Internal Users', 'Internal Products'],
    ['Vendor Integration', 'Third-party Integration', 'Partner Integration',
      'Third Party Integration', 'External Integrations'],
    // Jobscan counted "Restructuring" twice in a posting and found none
    // on the CV: the bare noun had no group, so only the two-word form
    // could ever match.
    ['Team Restructuring', 'Restructuring', 'Reorganisation', 'Reorganization',
      'Team Reorg', 'Reorg'],
    ['Prioritisation', 'Prioritization', 'Prioritising', 'Prioritizing',
      'Prioritise', 'Prioritize', 'Backlog Prioritisation', 'Roadmap Prioritisation'],
    // Getting software in front of users. Jobscan scores a posting's
    // "shipping AI products" as a hard skill, so the bare gerund needs a
    // home rather than being dropped as a verb.
    ['Delivery', 'Shipping', 'Ship', 'Shipped', 'Delivering', 'Execution'],
    ['Roadmap', 'Product Roadmap', 'Roadmapping', 'Technology Roadmap'],
    ['Discovery', 'Product Discovery', 'User Research'],
    ['Pod Structure', 'Squad Model', 'Team Topology'],
    ['Tradeoffs', 'Trade-offs', 'Technical Tradeoffs'],
    ['Bias for Action', 'Sense of Urgency'],
    // WHAT AN EXTERNAL ATS SCAN LOOKED FOR AND THIS TABLE COULD NOT NAME.
    // The sweep below can only find a requirement the table already
    // knows, so anything missing here is invisible to it no matter how
    // plainly the posting asks. These are the ordinary hard and soft
    // skills a screen expects across postings, not one employer's words.
    ['SaaS', 'Software as a Service', 'B2B SaaS'],
    ['Product Strategy', 'Technology Strategy'],
    ['Strategic Planning', 'Strategy', 'Strategic Thinking'],
    ['Customer Support', 'Customer Service', 'Guest Communication'],
    ['Account Management', 'Client Management', 'Relationship Management'],
    ['Retention', 'Customer Retention', 'Churn', 'Churn Reduction'],
    ['Upselling', 'Upsell', 'Cross-selling'],
    ['Revenue Management', 'Revenue Growth'],
    ['P&L', 'Profit and Loss', 'P&L Ownership'],
    ['Unit Economics', 'Margin Analysis'],
    ['Change Management', 'Organisational Change', 'Organizational Change'],
    ['Hiring', 'Recruiting', 'Recruitment', 'Talent Acquisition'],
    ['OKRs', 'OKR', 'Objectives and Key Results'],
    ['A/B Testing', 'Split Testing', 'Experimentation'],
    ['User Experience', 'UX'],
    ['Code Review', 'Peer Review', 'Pull Request Review'],
    ['Technical Debt', 'Tech Debt'],
    ['Postmortem', 'Incident Review', 'Root Cause Analysis'],
    ['Production Code', 'Hands-on Coding'],
    ['Critical Thinking'],
    ['Storytelling', 'Narrative'],
    ['Delegation', 'Delegating'],
    ['Empathy', 'Empathetic'],
    ['Property Management', 'Property Managers'],
    ['Short-Term Rental', 'STR', 'Vacation Rental', 'Holiday Rental'],
    ['Escalation Management', 'Issue Resolution', 'Operational Resolution',
      'Query Resolution', 'Case Management'],
    // "feedback" and "team performance" arrived as separate chips on one
    // posting and counted as two more requirements, when both are the
    // same area of work as the performance review cycle that was
    // already listed. A posting's phrasing is not a new requirement.
    ['Performance Management', 'Performance Reviews', 'Performance Feedback',
      'Performance Actions', 'Appraisals', 'Feedback', 'Team Performance',
      'Performance Improvement', 'Performance Conversations',
      'Performance Framework'],
    ['Policy', 'Policy Application', 'Policy Compliance', 'Policy Development',
      'Policy Implementation', 'Policies and Procedures'],
    ['Remote-first', 'Remote First', 'Remote-first Teams', 'Distributed Teams',
      'Remote Teams', 'Fully Remote'],
    ['Languages', 'Additional Languages', 'Multilingual', 'Language Skills'],
    // ── IT OPERATIONS AND END-USER COMPUTING ──────────────────────────
    //
    // The table had none of this. An IT-support posting naming help desk
    // ticketing, macOS troubleshooting, device provisioning and asset
    // inventory produced almost no requirements, so the extractor fell
    // back on whatever prose it could find and the panel filled up with
    // culture words. A whole profession was invisible.
    ['Help Desk', 'Helpdesk', 'Service Desk', 'IT Support', 'Technical Support',
      'Desktop Support', 'End User Support', 'IT Helpdesk'],
    ['Ticketing', 'Ticketing System', 'Help Desk Ticketing', 'Ticket Management',
      'Ticket Triage', 'Ticket Resolution'],
    ['macOS', 'Mac OS', 'OSX', 'Mac OS X', 'Apple macOS'],
    ['Windows', 'Microsoft Windows', 'Windows 10', 'Windows 11', 'Windows Desktop'],
    ['Google Workspace', 'G Suite', 'Google Apps'],
    ['Microsoft 365', 'Office 365', 'M365', 'O365'],
    // NOT a bare 'AD': it matched "ad-hoc data analysis" and put Active
    // Directory on a data analyst's CV. Two letters that are also an
    // English prefix are not a safe alias, unlike AI, ML, QA and UX.
    ['Active Directory', 'Azure AD', 'Entra ID', 'Microsoft Entra'],
    ['Okta'], ['JumpCloud'], ['OneLogin'], ['Duo'], ['LastPass'], ['1Password'],
    ['Single Sign-On', 'SSO', 'SAML', 'OIDC', 'OAuth'],
    ['Multi-factor Authentication', 'MFA', '2FA', 'Two-factor Authentication'],
    ['Jamf', 'Jamf Pro'], ['Intune', 'Microsoft Intune'], ['Kandji'], ['Mosyle'],
    ['Workspace ONE', 'AirWatch'], ['Autopilot', 'Windows Autopilot'],
    ['Device Management', 'MDM', 'Mobile Device Management', 'Endpoint Management',
      'Unified Endpoint Management', 'UEM'],
    ['Provisioning', 'Device Provisioning', 'Equipment Provisioning',
      'Account Provisioning', 'User Provisioning'],
    ['Deprovisioning', 'Offboarding Access', 'Access Revocation'],
    ['Inventory Management', 'Asset Management', 'IT Asset Management', 'ITAM',
      'Hardware Inventory', 'Software Inventory', 'Asset Tracking'],
    ['Equipment Lifecycle', 'Device Lifecycle', 'Hardware Lifecycle', 'Refresh Cycle'],
    ['Hardware Troubleshooting', 'Hardware Diagnostics', 'Hardware Repair'],
    ['Software Troubleshooting', 'Application Support', 'Software Diagnostics'],
    ['Audiovisual', 'AV Support', 'Audio Visual', 'AV Equipment', 'Conference Room Technology'],
    ['Zoom'], ['Zoom Rooms'], ['Microsoft Teams Rooms'], ['Slack'],
    ['Group Policy', 'GPO'], ['BitLocker'], ['FileVault'],
    ['Software Packaging', 'Application Deployment', 'Software Deployment'],
    ['Licence Management', 'License Management', 'Software Licensing'],
    ['CMDB', 'Configuration Management Database'],
    ['ITIL', 'Service Management', 'IT Service Management', 'ITSM'],
    ['Request Fulfilment', 'Request Fulfillment', 'Service Requests'],
    ['Major Incident Management', 'Incident Triage'],
    ['Password Reset', 'Password Resets', 'Account Recovery'],
    ['IT Procurement', 'Hardware Procurement', 'Vendor Procurement'],
    ['Remote Desktop', 'RDP', 'Remote Support', 'Remote Troubleshooting'],
    ['VPN'], ['DNS'], ['DHCP'], ['TCP/IP'], ['VLAN'], ['Firewall'],
    ['Printer Support', 'Print Management'],
    ['Zapier'], ['Workato'], ['Boomi'], ['n8n'], ['MuleSoft'], ['Make'],
    ['Zendesk'], ['ServiceNow'], ['Deel'], ['Remote.com'], ['ADP'], ['Ceridian'],
    ['Payroll Software', 'Payroll Systems', 'Payroll Platform'],
    ['Onboarding'], ['Offboarding'], ['Employee Relations'],
    ['People Leadership', 'People Management', 'Line Management',
      'Team Leadership', 'Managing a Team'],
    ['Stakeholder Communication', 'Stakeholder Updates'],
    ['SOP', 'Standard Operating Procedures', 'Process Documentation'],
    // "Accuracy" in an operations posting is care over the output, not
    // the data-engineering discipline. Data Accuracy belongs to Data
    // Quality above; this one keeps the general sense.
    ['Accuracy', 'Quality Control'],

    // --- people -------------------------------------------------------
    // "Team leadership" sits with People Leadership above: a posting that
    // asks for it means direct reports. Leadership on its own does not.
    ['Leadership', 'Technical Leadership'],
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

    // ══ THE VOCABULARY A MODERN POSTING ACTUALLY USES ══════════════════
    //
    // The table knew about four hundred things. A posting naming vLLM,
    // pgvector, Semgrep, OpenTelemetry, Testcontainers or Workday Studio
    // produced nothing for any of them, and a requirement the table
    // cannot name is invisible to the sweep however plainly it is asked
    // for. Five hundred and seventy concepts, grouped so that genuine
    // aliases share an entry and distinct technologies never do: Git,
    // GitHub and GitHub Actions stay three things, as do ETL and ELT,
    // React and React Native, Ray and Ray Serve.
    //
    // A NAME THAT IS ALSO AN ORDINARY WORD carries no bare alias here and
    // is resolved from its sentence in jd-requirements.js instead --
    // Lighthouse, Locust, Artillery, Percy, Pest, Soda, Feast, Lit,
    // Remix, Sanity, Chroma, Wiz, Falco, Ray, Kong, Envoy, Druid. The
    // lesson was a bare "AD" matching "ad-hoc data analysis".
    // Developer tooling and software delivery.
    ['npm'], ['pnpm'], ['Yarn'], ['pip'], ['Poetry'], ['uv'], ['Maven'],
    ['Gradle'], ['NuGet'], ['Cargo'], ['Bundler'], ['Composer'], ['CMake'],
    ['Bazel'], ['MSBuild'], ['ESLint'], ['Prettier'], ['Ruff'], ['mypy'],
    ['Nx'], ['Turborepo'], ['Artifactory'], ['Nexus Repository'],
    ['TypeScript Type Checking'], ['Dependency Management'],
    ['Package Management'], ['Semantic Versioning', 'SemVer'],
    ['Monorepos', 'Monorepo'], ['Software Supply Chain Security'],
    ['SBOM', 'Software Bill of Materials'], ['Dependency Scanning'],
    ['Artifact Signing'], ['Reproducible Builds'],
    ['Feature Flags', 'Feature Toggles'], ['LaunchDarkly'],
    ['Trunk-based Development'], ['GitFlow'],
    ['Canary Deployment', 'Canary Release'], ['Blue-green Deployment'],
    ['Rolling Deployment'], ['Rollback Strategies'],
    // Distributed systems and application architecture.
    ['Idempotency'], ['Eventual Consistency'], ['Strong Consistency'],
    ['Consensus Algorithms'], ['Distributed Transactions'],
    ['Saga Pattern'], ['Transactional Outbox'], ['Circuit Breakers'],
    ['Retry Policies'], ['Exponential Backoff'], ['Backpressure'],
    ['Dead-letter Queues', 'DLQ'], ['Connection Pooling'],
    ['Service Discovery'], ['Service Mesh'], ['Istio'], ['Linkerd'],
    ['Envoy'], ['ActiveMQ'], ['NATS'], ['Apache Pulsar', 'Pulsar'],
    ['Amazon SQS', 'SQS'], ['Amazon SNS', 'SNS'], ['Azure Service Bus'],
    ['Azure Event Hubs'], ['Durable Workflows'],
    ['Workflow Orchestration'], ['API Gateways', 'API Gateway'], ['Kong'],
    ['Apigee'],
    // Advanced data engineering.
    ['Apache NiFi', 'NiFi'], ['Debezium'], ['Kafka Connect'],
    ['Kafka Streams'], ['Schema Registry'], ['Apache Avro', 'Avro'],
    ['Protocol Buffers', 'Protobuf'], ['JSON Schema'],
    ['Apache Druid', 'Druid'], ['Trino'], ['Amazon Athena', 'Athena'],
    ['Amazon EMR', 'EMR'], ['Azure Databricks'], ['Microsoft Fabric'],
    ['OneLake'], ['Snowpark'], ['Snowpipe'], ['Amazon Kinesis', 'Kinesis'],
    ['Google Dataproc', 'Dataproc'], ['Data Contracts'],
    ['Data Observability'], ['Data Reconciliation'], ['Data Profiling'],
    ['Data Cleansing'], ['Data Deduplication'],
    ['Slowly Changing Dimensions', 'SCD'],
    ['Dimensional Modeling', 'Dimensional Modelling'], ['Star Schema'],
    ['Snowflake Schema'], ['Fact Tables'], ['Dimension Tables'],
    ['Data Vault'], ['Semantic Layers', 'Semantic Layer'],
    ['Metric Definitions'], ['Great Expectations'], ['Soda'],
    ['Monte Carlo'], ['Collibra'], ['Alation'],
    ['Microsoft Purview', 'Purview'], ['OpenLineage'],
    // AI applications, retrieval and advanced machine learning.
    ['OpenAI API'], ['Azure OpenAI'], ['Amazon Bedrock', 'Bedrock'],
    ['Google Vertex AI', 'Vertex AI'], ['Anthropic API'], ['LangChain'],
    ['LlamaIndex'], ['Semantic Kernel'], ['DSPy'], ['LangGraph'],
    ['Haystack'], ['vLLM'], ['Ollama'], ['TensorRT'], ['ONNX'],
    ['ONNX Runtime'], ['Triton Inference Server', 'Triton'],
    ['TorchServe'], ['BentoML'], ['Ray Serve'], ['KServe'], ['Ray'],
    ['Pinecone'], ['Weaviate'], ['Milvus'], ['Qdrant'], ['FAISS'],
    ['pgvector'], ['Chroma'], ['Hybrid Search'], ['Reranking'],
    ['Chunking Strategies'], ['Retrieval Evaluation'],
    ['Grounded Generation'], ['Structured Outputs'], ['Function Calling'],
    ['Model Context Protocol', 'MCP'],
    ['Prompt Injection Defense', 'Prompt Injection Defence'],
    ['AI Guardrails', 'Guardrails'], ['Hallucination Evaluation'],
    ['Human-in-the-loop Review', 'Human-in-the-loop'],
    ['Agent Evaluation'], ['Evaluation Datasets'],
    ['Synthetic Data Generation'], ['Transfer Learning'],
    ['Self-supervised Learning'], ['Contrastive Learning'],
    ['Multimodal Learning'], ['Representation Learning'],
    ['Learning to Rank'],
    ['Bayesian Optimization', 'Bayesian Optimisation'],
    ['Bayesian Inference'],
    ['Probabilistic Modeling', 'Probabilistic Modelling'],
    ['Survival Analysis'],
    ['Optimization Algorithms', 'Optimisation Algorithms'],
    ['Operations Research'], ['Linear Programming'],
    ['Integer Programming'], ['Constraint Programming'],
    ['Graph Neural Networks', 'GNN'], ['Time Series Forecasting'],
    ['Demand Forecasting'], ['Model Calibration'], ['Class Imbalance'],
    ['Feature Stores', 'Feature Store'], ['Feast'], ['Tecton'],
    ['Experiment Tracking'], ['Model Registries', 'Model Registry'],
    ['Reproducibility'], ['Online Inference'], ['Batch Inference'],
    ['Shadow Deployment'], ['Champion-Challenger Evaluation'], ['SHAP'],
    ['LIME'], ['Federated Learning'], ['Differential Privacy'],
    // Cloud and platform engineering, reliability and performance.
    ['AWS IAM'], ['AWS Organizations'], ['AWS Control Tower'],
    ['AWS CloudTrail', 'CloudTrail'], ['AWS Config'],
    ['AWS Systems Manager'], ['AWS Secrets Manager'], ['AWS KMS', 'KMS'],
    ['AWS WAF', 'WAF'], ['Amazon CloudFront', 'CloudFront'],
    ['Amazon Route 53', 'Route 53'], ['AWS Transit Gateway'],
    ['AWS Direct Connect'], ['Azure Bicep', 'Bicep'],
    ['Azure Resource Manager', 'ARM Templates'], ['Azure Policy'],
    ['Azure Key Vault'], ['Azure Front Door'],
    ['Azure Application Gateway'], ['Azure ExpressRoute'],
    ['Google Cloud IAM'], ['Google Secret Manager'],
    ['Google Cloud Armor'], ['Google Cloud Build'],
    ['Google Artifact Registry'], ['Cloud Landing Zones', 'Landing Zones'],
    ['Infrastructure Modules'], ['Policy as Code'],
    ['Open Policy Agent', 'OPA'], ['Gatekeeper'], ['Kyverno'],
    ['Crossplane'], ['Backstage'],
    ['Internal Developer Platforms', 'Internal Developer Platform', 'IDP'],
    ['Developer Experience', 'DevEx'], ['Self-service Infrastructure'],
    ['Kubernetes Operators'], ['Custom Resource Definitions', 'CRD'],
    ['Kustomize'], ['Cilium'], ['Calico'],
    ['Container Registry Management'], ['Reliability Engineering'],
    ['Production Engineering'], ['Availability Engineering'],
    ['Performance Profiling'], ['CPU Profiling'], ['Memory Profiling'],
    ['Heap Analysis'], ['Garbage Collection Tuning'], ['Latency Analysis'],
    ['Throughput Optimization', 'Throughput Optimisation'],
    ['Resource Utilization', 'Resource Utilisation'],
    ['Chaos Engineering'], ['Fault Injection'], ['Load Shedding'],
    ['Graceful Degradation'], ['Disaster Recovery Testing'],
    ['Recovery Time Objective', 'RTO'],
    ['Recovery Point Objective', 'RPO'], ['Runbooks', 'Runbook'],
    ['Operational Readiness Reviews'], ['Incident Command'],
    ['Alert Tuning'], ['Alert Fatigue Reduction'],
    ['Synthetic Monitoring'], ['Real User Monitoring', 'RUM'],
    ['Continuous Profiling'],
    // Security engineering, privacy and technology governance.
    ['Microsoft Sentinel', 'Sentinel'], ['Microsoft Defender', 'Defender'],
    ['CrowdStrike'], ['SentinelOne'], ['Elastic Security'], ['Wazuh'],
    ['Suricata'], ['Snort'], ['Zeek'], ['Wireshark'], ['Nmap'],
    ['Burp Suite'], ['Metasploit'], ['Nessus'], ['Qualys'], ['Rapid7'],
    ['Tenable'], ['Snyk'], ['Semgrep'], ['Checkmarx'], ['Veracode'],
    ['SonarQube'], ['Trivy'], ['Grype'], ['Falco'], ['Wiz'],
    ['Prisma Cloud'], ['CNAPP'], ['CSPM'], ['CWPP'], ['CIEM'],
    ['DLP', 'Data Loss Prevention'], ['CASB'], ['SASE'],
    ['ZTNA', 'Zero Trust Network Access'], ['Email Security'],
    ['Phishing Analysis'], ['Malware Analysis'],
    ['Digital Forensics', 'DFIR'], ['Threat Intelligence'],
    ['MITRE ATT&CK'], ['Detection Engineering'], ['Detection-as-Code'],
    ['YARA'], ['Sigma Rules'], ['Security Incident Triage'],
    ['Identity Governance'], ['Access Reviews'],
    ['Joiner-Mover-Leaver', 'JML'], ['Certificate Management'],
    ['Secrets Rotation'], ['Privacy Engineering'], ['Privacy by Design'],
    ['Data Minimization', 'Data Minimisation'], ['Retention Policies'],
    ['Data Classification'], ['Data Residency'], ['Data Sovereignty'],
    ['Pseudonymization', 'Pseudonymisation'],
    ['Anonymization', 'Anonymisation'], ['Consent Management'], ['DPIA'],
    ['Third-party Risk Management', 'TPRM'], ['Control Testing'],
    ['Audit Evidence Collection'], ['Compliance Automation'],
    ['Governance Risk and Compliance', 'GRC'], ['ISO 27701'],
    ['ISO 22301'], ['ISO 42001'], ['NIST CSF'], ['NIST AI RMF'],
    ['CIS Controls'], ['CIS Benchmarks'], ['FedRAMP'],
    ['SOX IT Controls', 'SOX'], ['GDPR'], ['HIPAA'], ['ISO 27001'],
    ['SOC 2'],
    // Networking, infrastructure and end-user computing.
    ['IPv4'], ['IPv6'], ['NAT'], ['CIDR'], ['Subnetting'], ['IPsec'],
    ['WireGuard'], ['OpenVPN'], ['MPLS'], ['VXLAN'], ['EVPN'],
    ['Network Segmentation'], ['Network Access Control', 'NAC'],
    ['RADIUS'], ['TACACS+'], ['802.1X'], ['QoS'], ['Packet Analysis'],
    ['Network Automation'], ['NetBox'], ['Netmiko'], ['NAPALM'],
    ['Ansible Networking'], ['Cisco IOS'], ['Cisco NX-OS'], ['Junos'],
    ['F5 BIG-IP'], ['HAProxy'], ['Squid'], ['Proxmox'], ['KVM'], ['QEMU'],
    ['Ceph'], ['ZFS'], ['NFS'], ['SMB'], ['iSCSI'], ['Fibre Channel'],
    ['Microsoft Exchange Online', 'Exchange Online'],
    ['SharePoint Online', 'SharePoint'], ['OneDrive'],
    ['Windows Autopatch'], ['Windows Deployment'], ['WSUS'],
    ['Remote Desktop Services'],
    ['Citrix Virtual Apps and Desktops', 'Citrix'],
    ['Azure Virtual Desktop', 'AVD'], ['Apple Business Manager'],
    ['Apple School Manager'], ['Google Admin Console'],
    ['Endpoint Compliance'], ['Device Encryption'],
    ['Configuration Items'], ['Service Catalogues', 'Service Catalogs'],
    ['Service Level Management'], ['User Access Administration'],
    ['Meeting-room Support'],
    // Testing and quality.
    ['WebdriverIO'], ['Robot Framework'], ['NUnit'], ['MSTest'], ['RSpec'],
    ['Capybara'], ['PHPUnit'], ['Pest'], ['Testcontainers'], ['Pact'],
    ['WireMock'], ['Mock Service Worker', 'MSW'], ['Supertest'],
    ['REST Assured'], ['Newman'], ['Locust'], ['Artillery'],
    ['Lighthouse'], ['axe-core'], ['Pa11y'], ['BrowserStack'],
    ['Sauce Labs'], ['Percy'], ['Applitools'],
    ['Visual Regression Testing'], ['Snapshot Testing'],
    ['Property-based Testing'], ['Mutation Testing'], ['Fuzz Testing'],
    ['Exploratory Testing'], ['Compatibility Testing'],
    ['Localization Testing'], ['Test Data Management'],
    ['Test Environment Management'], ['Test Coverage Analysis'],
    ['Flaky Test Reduction'], ['Shift-left Testing'],
    // Frontend, accessibility and content platforms.
    ['Remix'], ['React Router'], ['TanStack Query'], ['TanStack Table'],
    ['SolidJS'], ['Lit'], ['Alpine.js'], ['HTMX'], ['Storybook'],
    ['Radix UI'], ['Material UI', 'MUI'], ['Chakra UI'], ['Ant Design'],
    ['Emotion'], ['Styled Components'], ['CSS Modules'], ['CSS Grid'],
    ['Flexbox'], ['Core Web Vitals'],
    ['Web Performance Optimization', 'Web Performance Optimisation'],
    ['Keyboard Navigation'], ['Screen Reader Testing'],
    ['Focus Management'],
    ['Internationalization', 'Internationalisation', 'i18n'],
    ['Localization', 'Localisation', 'l10n'], ['Contentful'], ['Sanity'],
    ['Strapi'], ['WordPress'], ['Drupal'], ['Webflow'], ['Headless CMS'],
    ['Content Modeling', 'Content Modelling'], ['Content Migration'],
    ['React Native'], ['Accessibility', 'WCAG', 'a11y'],
    // Product analytics and experimentation.
    ['Amplitude'], ['Mixpanel'], ['Heap'], ['Pendo'], ['Segment'],
    ['Google Analytics 4', 'GA4'], ['Adobe Analytics'], ['RudderStack'],
    ['Optimizely'], ['Product Instrumentation'], ['Event Tracking'],
    ['Tracking Plans'], ['Experiment Analysis'], ['Statistical Power'],
    ['Sample Size Estimation'], ['Sequential Testing'],
    ['Retention Analysis'], ['Activation Metrics'], ['Churn Analysis'],
    ['Customer Lifetime Value', 'CLV', 'LTV'], ['North Star Metrics'],
    ['Opportunity Assessment'], ['Jobs to Be Done', 'JTBD'],
    ['Product-market Fit Research'],
    // Business systems.
    ['Salesforce Flow'], ['Lightning Web Components', 'LWC'], ['SOQL'],
    ['Salesforce CPQ', 'CPQ'], ['Revenue Cloud'], ['Marketing Cloud'],
    ['Marketo'], ['Eloqua'], ['SAP Fiori'], ['SAP BTP'],
    ['SAP SuccessFactors', 'SuccessFactors'], ['SAP Integration Suite'],
    ['Workday HCM'], ['Workday Financial Management'], ['Workday Studio'],
    ['Workday Extend'], ['Oracle Fusion Cloud'],
    ['Oracle Integration Cloud'], ['Microsoft Dataverse', 'Dataverse'],
    ['Power BI Administration'],
    ['Power Platform', 'Power Automate', 'Power Apps'],
    ['Power Platform Governance'],
    // Specialised technology.
    ['Unity'], ['Unreal Engine'], ['Godot'], ['OpenGL'], ['Vulkan'],
    ['DirectX'], ['WebGL'], ['WebGPU'], ['Three.js'],
    ['Computer Graphics'], ['Shader Programming'], ['GIS'], ['ArcGIS'],
    ['QGIS'], ['PostGIS'], ['Geospatial Analysis'], ['Remote Sensing'],
    ['Digital Twins'], ['CAD'], ['AutoCAD'], ['SolidWorks'],
    ['MATLAB Simulink', 'Simulink'], ['LabVIEW'],
    ['PLC Programming', 'PLC'], ['SCADA'], ['HMI'], ['Modbus'], ['OPC UA'],
    ['Industrial Automation'], ['Mechatronics'], ['Signal Processing'],
    ['DSP'],
    // Interpersonal and delivery capabilities.
    ['Executive Communication'], ['Audience-aware Communication'],
    ['Requirements Clarification'], ['Workshop Facilitation'],
    ['Meeting Facilitation'], ['Technical Demonstration'],
    ['Consultative Discovery'], ['Consensus Building'],
    ['Stakeholder Alignment'], ['Cross-cultural Collaboration'],
    ['Remote Collaboration'], ['Conflict Mediation'],
    ['Constructive Feedback'], ['Change Leadership'],
    ['Commercial Awareness'], ['Business Acumen'], ['Customer Advocacy'],
    ['Service Recovery'], ['Structured Problem Solving'],
    ['Judgement Under Uncertainty'], ['Trade-off Analysis'],
    ['Risk Communication'], ['Estimation'], ['Dependency Coordination'],
    ['Operational Discipline'], ['Documentation Discipline'],
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
  // A COMPOUND MODIFIER IS THE SAME REQUIREMENT AS ITS HEAD NOUN.
  //
  // One posting produced "AI" and "AI-driven" as two chips and the
  // denominator counted both, so a CV that plainly said AI could reach
  // at most half of that pair. "AI-driven" is not a second thing to
  // know; it is the same thing written as an adjective.
  //
  // Applied ONLY after the exact and qualifier-stripped lookups have
  // failed, so a compound that genuinely names its own requirement --
  // "Remote-first" is a way of working, not a kind of remote -- keeps
  // the group it is listed under.
  // "native" is deliberately absent: cloud-native names an architecture
  // rather than a degree of cloud, and folding it would claim a CV that
  // merely mentions AWS had built for it.
  const COMPOUND_TAIL = /[-\s](driven|led|focused|focussed|centric|centred|centered|based|enabled|powered|oriented|minded|savvy|heavy)$/i;

  // And an abstract noun is the same requirement as its adjective.
  // "Scrappy" and "scrappiness" arrived as two chips on one posting.
  const ABSTRACT_TAIL = /(?:iness|ness)$/i;

  function _deCompound(term) {
    const t = norm(term);
    const m = COMPOUND_TAIL.exec(t);
    return m ? t.slice(0, m.index).trim() : '';
  }

  function _deAbstract(term) {
    const t = norm(term);
    if (!ABSTRACT_TAIL.test(t) || t.length < 6) return '';
    // scrappiness -> scrappy, resourcefulness -> resourceful
    return /iness$/i.test(t) ? t.replace(/iness$/i, 'y') : t.replace(/ness$/i, '');
  }

  function groupIndexOf(term) {
    const exact = BY_FORM.get(tight(term));
    if (exact !== undefined) return exact;
    const stripped = BY_FORM.get(tight(stripQualifiers(term)));
    if (stripped !== undefined) return stripped;
    for (const reduce of [_deCompound, _deAbstract]) {
      const head = reduce(term);
      if (!head) continue;
      const hit = BY_FORM.get(tight(head));
      if (hit !== undefined) return hit;
      const q = BY_FORM.get(tight(stripQualifiers(head)));
      if (q !== undefined) return q;
    }
    return null;
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

  // ── THE FIRST-WORD INDEX ─────────────────────────────────────────────
  //
  // Which groups are even worth testing against a given piece of text.
  // Keyed on the first word of every surface form, because a form can
  // only match if its first word is present. "node.js" indexes under
  // "node", "c++" under "c", ".NET" under "net".
  const _BY_FIRST_TOKEN = new Map();
  function _firstToken(form) {
    const m = norm(form).match(/[a-z0-9]+/);
    return m ? m[0] : '';
  }
  function _tokensOf(text) {
    const out = new Set();
    for (const m of String(text).toLowerCase().matchAll(/[a-z0-9]+/g)) out.add(m[0]);
    return out;
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
    // Folded, so a document that says Master's or 2016<en-dash>2024 is
    // searched in the same shape the term was normalised into.
    const haystack = fold(text);
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
        // "No experience with Kafka" and "No previous Kafka experience"
        // are the same sentence with the noun on the other side, and only
        // the first was being caught.
        const negativeExperience = /\b(?:no|without|zero|lacking)\s+(?:(?:prior|previous|direct|professional|hands-on|formal)\s+)?(?:experience|knowledge|exposure|proficiency|familiarity)\b[^.!?;]{0,100}$/i;
        const negativeBefore = /\b(?:no|without|zero|lacking)\s+(?:(?:prior|previous|direct|professional|hands-on|formal)\s+)?[\w\s.+#/-]{0,40}$/i;
        const negativeUse = /\b(?:not|never)\s+(?:(?:directly|previously|personally|yet)\s+)*(?:worked|used|implemented|built|learned|worked with)\b[^.!?;]{0,100}$/i;
        const directNegation = /\b(?:no|neither|nor|without)\s*$/i;
        const after = haystack.slice(match.index + match[0].length, match.index + match[0].length + 60);
        const negatedNoun = negativeBefore.test(scope)
          && /^\s*(?:experience|knowledge|exposure|proficiency|familiarity|background)\b/i.test(after);
        if (!negativeExperience.test(scope) && !negativeUse.test(scope)
          && !directNegation.test(scope) && !negatedNoun) return true;
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
    'Stakeholder Management': ['stakeholder', 'business partner', 'client CTO', 'steering',
      'chaired', 'review board', 'for a regulated', 'presented to', 'senior leadership',
      'executive', 'business users'],
    // Work done WITH other teams is collaboration; a posting asking for
    // it is not asking for the word. "Across four teams" on its own is
    // a count, not evidence, so it is not here.
    'Collaboration': ['cross-team', 'cross team', 'cross-functional', 'with product',
      'with design', 'partnered', 'paired', 'design documents', 'working group'],
    'REST APIs': ['FastAPI', 'Flask', 'Express', 'Django REST', 'API endpoint', 'GraphQL',
      'gRPC', 'OpenAPI', 'Swagger'],
    'MLOps': ['MLflow', 'Evidently', 'model deployment', 'model registry', 'model monitoring',
      'feature store', 'Kubeflow', 'SageMaker', 'model drift', 'concept drift', 'retrains'],
    'Feature Engineering': ['XGBoost', 'scikit-learn', 'ranking model', 'model training',
      'PyTorch', 'TensorFlow', 'SHAP'],
    'Statistics': ['XGBoost', 'regression', 'A/B test', 'significance', 'forecasting',
      'PyTorch', 'scikit-learn', 'credit risk', 'ranking model'],
    'Data Modelling': ['Snowflake', 'Redshift', 'BigQuery', 'data warehouse', 'star schema',
      'dimensional', 'ETL', 'dbt', 'reporting suite'],
    'Data Quality': ['data drift', 'concept drift', 'reconciliation', 'validation',
      'data accuracy', 'test coverage', 'Evidently', 'Great Expectations'],
    'Business Analysis': ['reporting pack', 'business requirement', 'reporting suite',
      'Power BI', 'Tableau', 'stakeholder', 'data request'],
    'System Design': ['architected', 'architecture', 'design document', 'designed the',
      'migration from a legacy', 'distributed'],
    // Making a thing faster. "Cut the cycle time" is process work and
    // belongs to Continuous Improvement, so it is not here.
    'Performance Optimisation': ['latency', 'throughput', 'faster', 'optimis', 'optimiz',
      'cached', 'query plan', 'profiling'],
    'Security': ['access control', 'encryption', 'security architecture', 'authentication',
      'authorisation', 'IAM', 'least privilege', 'threat model'],
    // Reviewing a DESIGN DOCUMENT is not reviewing code, and chairing an
    // architecture board is not either. Only the practice itself counts,
    // which means this usually stays a genuine gap in the profile --
    // where it can be fixed truthfully.
    'Code Review': ['pull request', 'merge request', 'reviewed the code', 'peer review'],
    'Agile': ['sprint', 'scrum', 'kanban', 'stand-up', 'standup', 'retro', 'iteration'],
    'Regulatory Reporting': ['regulatory', 'IFRS', 'statutory', 'regulator'],
    'Compliance': ['ISO 27001', 'HIPAA', 'GDPR', 'SOC 2', 'audit'],
    'Performance Management': ['performance review', 'appraisal', 'feedback', 'one to one', '1:1'],
    'Multi-country': ['offices in', 'across three markets', 'cross-border', 'EMEA', 'APAC',
      'multiple countries', 'international'],
    'KPI': ['reliability target', 'performance metric', 'service level', 'SLA', 'SLO',
      'error budget', 'month-end reporting'],
    'Escalation Management': ['incident response', 'triage', 'escalated', 'root cause',
      'recurring failure', 'backlog'],
    // Tools whose users sit inside the company. "Rewrote the internal
    // campaign diagnostics tool used by sales engineers" is building for
    // internal users, whatever words the posting chose for it.
    // Wiring somebody else's service into yours. The tools differ every
    // time; the work is the same.
    'Vendor Integration': ['integrated', 'integration with', 'third-party API',
      'third party api', 'API integration', 'connected the', 'Kafka', 'webhook',
      'AWS Transcribe', 'FLUX Kontext'],
    // Deciding what gets built next, and what does not. A roadmap owner
    // does this by definition.
    'Prioritisation': ['roadmap', 'backlog', 'prioritis', 'prioritiz', 'trade-off',
      'tradeoff', 'what to build', 'sequenced', 'triage', 'deciding what'],
    'Roadmap': ['roadmap', 'quarterly plan', 'product plan', 'what we build next'],
    'Internal Tools': ['internal tool', 'internal campaign', 'internal platform',
      'internal dashboard', 'internal users', 'internal-facing', 'developer platform',
      'used by sales engineers', 'used by the team', 'deployment tooling'],
    // Owning a thing end to end is what a posting means by ownership.
    'Ownership': ['owned the', 'owned and', 'built and owned', 'end-to-end responsibility',
      'primary on-call responsibility', 'sole owner', 'accountable for', 'took the'],
    'Decision Making': ['recommendation', 'adopted into policy', 'trade-off', 'tradeoff',
      'prioritis', 'prioritiz', 'chose', 'selected the', 'decided'],
    'Operational Efficiency': ['automated the', 'cut the', 'reduced the cycle', 'streamlined',
      'removed the manual', 'shortened the', 'right-sizing', 'cutting annual'],
    'Reliability': ['on-call', 'oncall', 'error budget', 'reliability target', 'SLO',
      'uptime', 'incident response', 'failover', 'redundancy', 'disaster recovery'],
    'Automation': ['automated the', 'automating the', 'CI/CD', 'GitHub Actions', 'Jenkins',
      'GitLab CI', 'ArgoCD', 'Terraform', 'Ansible', 'Airflow', 'cron', 'scripted',
      'Bash', 'PowerShell', 'pipeline'],
    // Taking work that was being done by hand and making it stop being
    // done by hand is the thing a posting means. "Improved a process" on
    // its own is not, which is why no bare "improved" appears here.
    'Continuous Improvement': ['cutting the', 'cut the', 'reduced the cycle',
      'streamlined', 'removed the manual', 'replaced the manual', 'eliminated the manual',
      'automated the', 'automating the', 'shortened the'],
    // THE REQUIREMENTS ADDED TO THE TABLE STILL HAD NO WAY TO BE PROVEN.
    //
    // A group with no entailment can only be credited when the profile
    // says the word, so eight of ten requirements a posting named were
    // blocked at the gate by profiles that plainly demonstrated them.
    // Each cue below is the WORK, not a looser way of saying the name.
    'Production Code': ['in production', 'to production', 'production service',
      'production system', 'production rollback', 'backend service', 'wrote the service',
      'shipped the'],
    'Code Review': ['code review', 'reviewed the pull request', 'pull request review',
      'reviewing merge requests'],
    'Technical Debt': ['legacy', 'refactor', 'rewrote the', 'consolidating',
      'duplicated services', 'paid down'],
    'Postmortem': ['incident response', 'recurring failure', 'root cause',
      'led the review', 'leading the review', 'blameless'],
    'Customer Support': ['support ticket', 'support queue', 'help desk', 'customer quer',
      'guest quer', 'raised by', 'end users'],
    'A/B Testing': ['live test', 'holdout', 'control group', 'variant', 'experiment',
      'statistically significant'],
    'User Experience': ['dashboard in', 'front end', 'frontend', 'user journey',
      'usability', 'user-facing', 'redesigned the'],
    'Retention': ['renewal', 'repeat customer', 'lapsed', 'win-back', 'stickiness'],
    'Revenue Management': ['revenue increase', 'revenue growth', 'pricing',
      'grew revenue', 'top line'],
    'Unit Economics': ['cost per', 'margin', 'infrastructure costs', 'right-sizing',
      'reserved instances', 'cost model'],
    'P&L': ['budget of', 'cost centre', 'cost center', 'annual spend', 'bottom line'],
    'Account Management': ['client relationship', 'account review', 'client cto',
      'presenting proposed', 'pre-sales', 'stakeholder across'],
    'Hiring': ['interview panel', 'interviewed candidates', 'hiring loop', 'job spec',
      'grew the team from', 'brought on'],
    'Change Management': ['rollout across', 'adoption of', 'migration from a legacy',
      'transition to', 'comms plan'],
    'OKRs': ['quarterly goal', 'quarterly target', 'key result', 'north star'],
    'Strategic Planning': ['three-year', 'long-term plan', 'strategy for',
      'where we invest', 'multi-year'],
    'Product Strategy': ['what we build', 'why we build', 'product direction',
      'positioning', 'product bet'],
    'SaaS': ['multi-tenant', 'subscription product', 'self-serve', 'per-seat',
      'standalone product'],
    'Pod Structure': ['squad', 'cross-functional team', 'team topology',
      'organised the team', 'organized the team'],
    'Tradeoffs': ['trade-off', 'tradeoff', 'weighed', 'chose between', 'design document',
      'architecture decision', 'at the cost of'],
    'Critical Thinking': ['root cause', 'diagnosed', 'ruled out', 'evaluated the options',
      'first principles'],
    'Delegation': ['handed over', 'delegated', 'assigned ownership', 'devolved'],
    'Storytelling': ['presented to', 'pitched', 'briefed the board', 'narrative for'],
    'Empathy': ['user research', 'listened to', 'in their shoes', 'user interview'],
    'Upselling': ['expansion revenue', 'cross-sell', 'upgrade path'],
    'Property Management': ['property manager', 'lettings', 'tenancy', 'unit turnover'],
    'Short-Term Rental': ['airbnb', 'vrbo', 'booking.com', 'guesty', 'hostaway',
      'breezeway', 'ota compliance', 'reservation alteration'],
    // THE FIFTY-THREE CAPABILITIES THAT COULD ONLY BE CREDITED BY NAME.
    //
    // A tool needs no entailment: there is no proving Kubernetes without
    // saying Kubernetes. A CAPABILITY is the opposite -- a CV describes
    // the work and almost never labels it -- so every one of these was
    // gated behind the candidate happening to use the posting's own word
    // for something the CV already demonstrated twice over.
    'Communication': ['presented to', 'briefed', 'wrote the', 'authored',
      'stakeholders across', 'liaised', 'explained'],
    'Problem Solving': ['root cause', 'diagnosed', 'resolved a recurring', 'debugged',
      'unblocked', 'worked out why'],
    'Attention to Detail': ['reconcil', 'audit trail', 'zero defect', 'error rate',
      'checked every', 'caught the'],
    'Time Management': ['on the dates committed', 'ahead of schedule', 'deadline',
      'competing priorities', 'within the window'],
    'Adaptability': ['pivoted', 'stepped into', 'picked up', 'changed direction',
      'at short notice'],
    'Presentation': ['presented to', 'presenting proposed', 'pitched', 'demo to',
      'briefed the board', 'client cto'],
    'Negotiation': ['negotiated', 'agreed terms', 'contract with', 'secured agreement',
      'commercial terms'],
    'Training': ['trained', 'ran the workshop', 'onboarded the team', 'wrote the guide',
      'upskilled'],
    'Documentation': ['documented', 'authored', 'wrote the runbook', 'design document',
      'wrote the guide', 'knowledge base'],
    'Project Management': ['delivered all', 'in 11 months', 'on schedule', 'workstream',
      'milestone', 'ran the project', 'end to end delivery'],
    'Programme Management': ['workstream', 'multiple projects', 'programme of',
      'across teams', 'portfolio of'],
    'Product Management': ['acceptance criteria', 'requirements and', 'user stor',
      'product roadmap', 'what we build', 'backlog'],
    'Requirements Gathering': ['acceptance criteria', 'gathered requirements',
      'user stor', 'scoped the', 'discovery session'],
    'Delivery': ['shipped', 'released', 'went live', 'delivered all',
      'on the dates committed', 'into production'],
    'Discovery': ['user research', 'interviewed users', 'validated the', 'prototype',
      'problem definition'],
    'Customer Success': ['renewal', 'customer outcome', 'adoption of', 'onboarded the client',
      'quarterly business review'],
    'People Leadership': ['mentored', 'line managed', 'led a team of', 'grew the team',
      'direct reports', 'led engineers'],
    'Stakeholder Communication': ['stakeholders across', 'briefed', 'steering',
      'reported to the', 'client cto', 'cross-team'],
    'Onboarding': ['first day', 'new starter', 'new joiner', 'induction',
      'onboarded the'],
    'Offboarding': ['leaver', 'exit process', 'final pay', 'revoked access'],
    'Employee Relations': ['grievance', 'disciplinary', 'employee case', 'people issue'],
    'Risk Management': ['risk register', 'mitigat', 'contingency', 'exposure',
      'control gap', 'pre-audit'],
    'Vendor Management': ['vendor', 'third party', 'supplier', 'contract with',
      'managed the provider'],
    'SLA Management': ['sla', 'service level', 'turnaround time', 'response time target',
      'within the agreed'],
    'Operational Excellence': ['cut the', 'shortened the', 'error rate', 'throughput',
      'removed the manual', 'standardised the'],
    'QA': ['test coverage', 'pytest', 'unit test', 'regression', 'automated test',
      'blocked unsafe'],
    'Technical Evaluation': ['evaluated the options', 'proof of concept', 'benchmarked',
      'vendor selection', 'chose between'],
    'Innovation': ['first of its kind', 'prototype', 'new approach', 'patent',
      'proof of concept'],
    'Policy': ['policy', 'adopted into policy', 'standard operating', 'guidelines for'],
    'Conflict Resolution': ['mediated', 'resolved the disagreement', 'aligned two teams',
      'escalation between'],
    'Accuracy': ['error rate', 'zero defect', 'reconcil', 'audit trail', 'right first time'],
    'Remote-first': ['distributed team', 'across time zones', 'fully remote',
      'asynchronous'],
    'Team Restructuring': ['reorganised the team', 'reorganized the team', 'restructured',
      'split the team', 'new team structure'],
    'Scrappy': ['with no budget', 'shoestring', 'bootstrapped', 'first hire',
      'wore many hats'],
    'Bias for Action': ['shipped within', 'same week', 'did not wait', 'moved first'],
    'Lean': ['waste', 'value stream', 'kaizen', 'cycle time'],
    'Six Sigma': ['dmaic', 'defect rate', 'process capability', 'control chart'],
    'SOP': ['standard operating', 'runbook', 'documented the process', 'wrote the guide'],
    'Payroll': ['pay run', 'payslip', 'gross to net', 'pay cycle', 'payroll calendar'],
    'Invoicing': ['invoice', 'billing run', 'accounts receivable', 'credit note'],
    'Payouts': ['payout', 'disbursement', 'settlement', 'paid out to'],
    'Payments': ['payment', 'card transaction', 'direct debit', 'bank transfer', 'sepa'],
    'Tax Calculation': ['paye', 'withholding', 'tax code', 'vat', 'statutory deduction'],
    // Not a bare "ledger": it fired inside the project name "LedgerLens".
    // The trailing side of a cue is deliberately open, so a cue that is
    // also the start of a product name proves that product, not the work.
    'Financial Technology': ['fintech', 'payment rail', 'general ledger',
      'double-entry', 'open banking'],
    'AML': ['anti-money laundering', 'suspicious activity', 'sanctions screening',
      'transaction monitoring'],
    'KYC': ['identity verification', 'customer due diligence', 'onboarding checks',
      'document verification'],
    'Benefits Administration': ['pension', 'health cover', 'benefit scheme',
      'salary sacrifice'],
    'Compensation': ['salary band', 'pay review', 'bonus cycle', 'equity grant',
      'total reward'],
    'Time and Attendance': ['timesheet', 'clock-in', 'shift pattern', 'absence',
      'overtime'],
    'GTM': ['go to market', 'launch plan', 'positioning', 'pricing and packaging'],
    'Revenue Operations': ['pipeline hygiene', 'quota', 'forecast accuracy',
      'crm process'],
    'Sales Operations': ['quota', 'territory', 'commission plan', 'deal desk'],
    'Languages': ['fluent in', 'native speaker', 'bilingual', 'working proficiency'],
    // The interpersonal capabilities added with the vocabulary. Same rule
    // as the other fifty-three: a CV describes the work and almost never
    // labels it, so each needs a way to be proven by what was done.
    'Executive Communication': ['briefed the board', 'to the c-suite', 'to executives',
      'exec update', 'steering committee', 'board paper'],
    'Audience-aware Communication': ['non-technical', 'technical and business',
      'tailored the message', 'for a mixed audience'],
    'Requirements Clarification': ['clarified requirements', 'scoped the', 'acceptance criteria',
      'discovery session', 'gathered requirements'],
    'Workshop Facilitation': ['facilitated', 'ran the workshop', 'led the session',
      'design sprint'],
    'Meeting Facilitation': ['chaired', 'facilitated the meeting', 'ran the standup',
      'ran the retro'],
    'Technical Demonstration': ['demo to', 'demonstrated the', 'proof of concept for',
      'walked through the'],
    'Consultative Discovery': ['discovery call', 'understand the client', 'pre-sales',
      'client workshop'],
    'Consensus Building': ['aligned', 'brought together', 'agreement across',
      'buy-in from'],
    'Stakeholder Alignment': ['aligned stakeholders', 'stakeholders across', 'buy-in from',
      'steering'],
    'Cross-cultural Collaboration': ['across time zones', 'multi-country', 'global team',
      'offshore team'],
    'Remote Collaboration': ['distributed team', 'across time zones', 'asynchronous',
      'fully remote'],
    'Conflict Mediation': ['mediated', 'resolved the disagreement', 'aligned two teams'],
    'Constructive Feedback': ['feedback to', 'one to one', '1:1', 'performance conversation'],
    'Change Leadership': ['rollout across', 'adoption of', 'led the transition',
      'took the team through'],
    'Commercial Awareness': ['revenue impact', 'cost of', 'margin', 'commercial terms',
      'business case'],
    'Business Acumen': ['business case', 'revenue impact', 'p&l', 'unit economics',
      'commercial'],
    'Customer Advocacy': ['voice of the customer', 'on behalf of customers',
      'customer feedback into'],
    'Service Recovery': ['win-back', 'recovered the account', 'after the outage',
      'apolog'],
    'Structured Problem Solving': ['root cause', 'first principles', 'hypothesis',
      'broke the problem'],
    'Judgement Under Uncertainty': ['with incomplete', 'limited data', 'ambiguous',
      'had to decide'],
    'Trade-off Analysis': ['trade-off', 'tradeoff', 'weighed', 'chose between',
      'at the cost of'],
    'Risk Communication': ['flagged the risk', 'risk register', 'escalated the risk',
      'raised concerns'],
    'Estimation': ['estimated', 'sized the', 'story points', 'forecast the effort'],
    'Dependency Coordination': ['dependencies', 'blocked by', 'coordinated across teams',
      'critical path'],
    'Operational Discipline': ['runbook', 'standard operating', 'checklist',
      'right first time'],
    'Documentation Discipline': ['documented', 'wrote the runbook', 'knowledge base',
      'design document'],
    // The same gap outside the two capability categories. Forecasting is
    // the one that showed it: a posting asked for it, a CV describing
    // demand planning and sales projections could not be credited, and
    // the chip stayed red because the CV never used that exact word.
    // Product NAMES are deliberately absent here -- there is no proving
    // Salesforce without saying Salesforce, and a CV that cannot say it
    // must not be handed the word.
    'Forecasting': ['demand plan', 'projected', 'projection', 'predict future',
      'predictive model', 'run rate', 'pipeline coverage', 'headcount plan'],
    'Financial Reporting': ['month-end', 'year-end close', 'management accounts',
      'p&l report', 'statutory account', 'variance analysis'],
    'Audit': ['audit trail', 'pre-audit', 'iso 27001', 'soc 2', 'evidence pack',
      'control testing'],
    'Reconciliation': ['reconcil', 'matched against', 'balanced the', 'break report'],
    'Data Science': ['hypothesis', 'statistical', 'regression', 'clustering',
      'feature engineering', 'model accuracy'],
    'Deep Learning': ['neural network', 'transformer', 'convolutional', 'fine-tun',
      'pytorch', 'tensorflow'],
    'Data Pipelines': ['ingestion', 'batch job', 'streaming job', 'orchestrat',
      'airflow', 'dbt', 'etl', 'elt'],
    'Software Engineering': ['production code', 'code review', 'unit test',
      'refactor', 'pull request', 'design document'],
    'API Design': ['endpoint', 'openapi', 'swagger', 'versioned the api',
      'rate limit', 'contract between services'],
    'REST': ['endpoint', 'http api', 'json api', 'openapi'],
    'Frontend': ['react', 'typescript', 'user interface', 'browser', 'css'],
    'Backend': ['service written in', 'backend service', 'database schema',
      'server-side', 'throughput'],
    'Full Stack': ['front to back', 'end-to-end feature', 'both the ui and'],
    'DevOps': ['ci/cd', 'deployment pipeline', 'release process', 'infrastructure as code'],
    'Version Control': ['git', 'branch', 'pull request', 'merge request'],
    'Containerisation': ['docker', 'container image', 'kubernetes', 'pod'],
    'Serverless': ['lambda', 'cloud function', 'event-driven function'],
    'Cloud Cost Management': ['right-sizing', 'reserved instance', 'infrastructure costs',
      'cloud spend', 'cost per'],
    'Shell Scripting': ['bash script', 'shell script', 'cron job'],
  };
  // KEYED BY THE GROUP, NOT BY THE SPELLING THE TABLE HAPPENED TO USE.
  //
  // impliedIn resolves its term through the group before looking the cues
  // up, so a cue list written under "System Design" -- a member of the
  // group whose canonical name is "Architecture" -- was never reachable.
  // All six of its cues were dead, silently, and nothing said so. Two
  // keys that land on the same group have their cues merged rather than
  // one quietly replacing the other.
  const _IMPLIED_LOOKUP = new Map();
  for (const label of Object.keys(IMPLIED_BY)) {
    const group = groupOf(label);
    for (const key of new Set([tight(label), tight(group ? group[0] : label)])) {
      _IMPLIED_LOOKUP.set(key, (_IMPLIED_LOOKUP.get(key) || []).concat(IMPLIED_BY[label]));
    }
  }

  /**
   * Does this body of text DEMONSTRATE the requirement, as opposed to
   * naming it? Used by the evidence gate only.
   */
  const _proofCache = new Map();
  function _proofPattern(proof) {
    if (_proofCache.has(proof)) return _proofCache.get(proof);
    const n = norm(proof);
    const body = n.split(/[ ./-]+/).filter(Boolean)
      // ':' and '&' are separators the haystack keeps but norm() strips,
      // which is why the cue "1:1" could never match the text "1:1" and
      // "p&l report" could never match "p&l reporting".
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s.:&/-]{0,2}');
    const re = new RegExp('(?<![\\p{L}\\p{N}_+#])' + body, 'iu');
    _proofCache.set(proof, re);
    return re;
  }

  function impliedIn(text, term) {
    const group = groupOf(term);
    const label = group ? group[0] : String(term || '');
    const proofs = _IMPLIED_LOOKUP.get(tight(label));
    if (!proofs) return false;
    const haystack = fold(text).toLowerCase();
    if (!haystack) return false;
    for (const proof of proofs) {
      // THE CUE MUST START A WORD, BUT NEED NOT FINISH ONE.
      //
      // The open end is deliberate: "load balanc" is written that way so
      // it also matches "load balancing", which is the point. The open
      // FRONT was not deliberate. It made "IAM" fire inside "Miami" and
      // "SLA" inside "translator", so a CV naming the city it was written
      // in was credited with evidence of security work. A leading
      // boundary rejects both and costs the trailing match nothing.
      if (_proofPattern(proof).test(haystack)) return true;
    }
    return false;
  }

  // ── WHICH LINE OF THE SKILLS BLOCK A TERM BELONGS ON ─────────────────
  //
  // Tailored terms were appended to a line of their own, "Additional
  // Skills:", which reads as exactly what it is: a list bolted onto the
  // end. A person writing the same CV would put Kubernetes with the
  // other infrastructure and Kafka with the other data tools.
  //
  // The category is only ever used to CHOOSE A LINE. It never decides
  // whether a term may be written at all -- that stays with the
  // evidence gate -- and it never affects the coverage measurement.
  const CATEGORIES = {
    'Programming': ['Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Rust',
      'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl', 'Bash', 'PowerShell',
      'SQL', 'HTML', 'CSS', '.NET', 'Node.js', 'React', 'Angular', 'Vue', 'Next.js',
      'Django', 'Flask', 'Spring', 'Express', 'FastAPI', 'GraphQL', 'REST APIs',
      'Frontend', 'Backend', 'Full Stack', 'Object Oriented Programming', 'Design Patterns'],
    'Cloud & DevOps': ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Terraform', 'Helm',
      'Ansible', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'ArgoCD', 'CI/CD', 'Linux',
      'Infrastructure as Code', 'Cloud Infrastructure', 'Platform Engineering', 'SRE',
      'Observability', 'Monitoring', 'Prometheus', 'Grafana', 'Datadog', 'Microservices',
      'Networking', 'Serverless', 'Automation', 'Reliability', 'Scalability',
      'Cloud Cost Management', 'Git', 'GitHub', 'GitLab', 'Multi-tenant'],
    'Data Engineering': ['Apache Spark', 'Airflow', 'Kafka', 'Snowflake', 'ETL', 'ELT',
      'dbt', 'Data Engineering', 'Data Pipelines', 'Data Warehousing', 'Data Modelling',
      'Data Quality', 'Hadoop', 'Databricks', 'Redshift', 'BigQuery', 'PostgreSQL',
      'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra', 'NoSQL'],
    'Machine Learning': ['Machine Learning', 'Deep Learning', 'AI', 'PyTorch', 'TensorFlow',
      'scikit-learn', 'XGBoost', 'NLP', 'Computer Vision', 'MLOps', 'Feature Engineering',
      'Statistics', 'LLM', 'RAG', 'Model Deployment'],
    'Analytics & Reporting': ['Power BI', 'Tableau', 'Looker', 'Excel', 'Data Analysis',
      'Data Visualisation', 'Business Analysis', 'Financial Reporting', 'Forecasting',
      'KPI', 'Regulatory Reporting', 'Dashboards', 'OKRs', 'A/B Testing',
      'Unit Economics'],
    'Tools & Platforms': ['Jira', 'Confluence', 'Salesforce', 'Workday', 'SAP', 'NetSuite',
      'Zendesk', 'ServiceNow', 'ADP', 'Ceridian', 'Deel', 'HRIS', 'Payroll Software',
      'Oracle EBS', 'Asana', 'Notion'],
    'Soft Skills': ['Communication', 'Collaboration', 'Problem Solving', 'Adaptability',
      'Time Management', 'Attention to Detail', 'Critical Thinking', 'Negotiation',
      'Presentation', 'Written Communication', 'Self-organised', 'Storytelling',
      'Delegation', 'Empathy', 'Ownership', 'Prioritisation', 'Decision Making'],
    'Domain Expertise': ['Leadership', 'People Leadership', 'Mentorship', 'Coaching',
      'Stakeholder Management', 'Project Management', 'Programme Management',
      'Product Management', 'Agile', 'Performance Management', 'Escalation Management',
      'Continuous Improvement', 'Operational Excellence', 'Compliance', 'Payroll',
      'Vendor Management', 'SLA Management', 'Multi-country', 'Risk Management',
      'Change Management', 'Hiring', 'Policy', 'Remote-first', 'System Design',
      'Code Review', 'Testing', 'Security', 'Documentation', 'Training',
      'SaaS', 'Product Strategy', 'Strategic Planning', 'Roadmap', 'Discovery',
      'Delivery', 'Customer Support', 'Customer Success', 'Account Management',
      'Retention', 'Upselling', 'Revenue Management', 'P&L', 'Technical Debt',
      'Postmortem', 'Production Code', 'User Experience', 'Pod Structure',
      'Property Management', 'Short-Term Rental', 'Data Quality',
      'Operational Efficiency', 'Internal Tools', 'Vendor Integration'],
  };
  // A REQUIREMENT WITH NO CATEGORY HAS NO SKILLS LINE TO LAND ON, so it
  // goes wherever there is room rather than beside its peers. Ninety-six
  // of the table's groups were in that position, which is why a tool
  // could turn up under the wrong heading. Listed here rather than above
  // only to keep each category readable at the point it is defined.
  Object.assign(CATEGORIES, {
    'Programming': CATEGORIES['Programming'].concat(['C', 'Elixir', 'Clojure',
      'Objective-C', 'Dart', 'Haskell', 'PL/SQL', 'T-SQL', 'SASS', 'YAML', 'JSON',
      'XML', 'Svelte', 'Rails', 'REST', 'API Design', 'Software Engineering']),
    'Cloud & DevOps': CATEGORIES['Cloud & DevOps'].concat(['S3', 'EC2', 'EKS', 'ECS',
      'RDS', 'Containerisation', 'Pulumi', 'Chef', 'Puppet', 'Bitbucket',
      'Version Control', 'CircleCI', 'Spinnaker', 'Nginx', 'Apache', 'RabbitMQ',
      'OpenTelemetry', 'Honeycomb', 'New Relic', 'Splunk', 'PagerDuty', 'Sentry',
      'Incident Response', 'SLO', 'DevOps', 'Performance Optimisation']),
    'Data Engineering': CATEGORIES['Data Engineering'].concat(['MariaDB', 'SQL Server',
      'Oracle Database', 'DynamoDB', 'ClickHouse', 'Neo4j', 'SQLite', 'Dagster',
      'Prefect', 'Luigi', 'Mage', 'Flyte', 'Temporal']),
    'Machine Learning': CATEGORIES['Machine Learning'].concat(['Data Science',
      'pandas', 'NumPy']),
    'Analytics & Reporting': CATEGORIES['Analytics & Reporting'].concat(['Qlik',
      'Audit', 'Reconciliation', 'Budgeting']),
    'Tools & Platforms': CATEGORIES['Tools & Platforms'].concat(['HubSpot', 'Remote.com',
      'Zapier', 'Workato', 'Boomi', 'n8n', 'MuleSoft', 'Make',
      // IT operations and end-user computing: products.
      'Google Workspace', 'Microsoft 365', 'Okta', 'JumpCloud', 'OneLogin', 'Duo',
      'LastPass', '1Password', 'Jamf', 'Intune', 'Kandji', 'Mosyle', 'Workspace ONE',
      'Autopilot', 'Zoom', 'Zoom Rooms', 'Microsoft Teams Rooms', 'Slack',
      'Active Directory', 'CMDB']),
    // The practices, which belong with the other infrastructure work.
    'IT Operations': ['Help Desk', 'Ticketing', 'macOS', 'Windows', 'Single Sign-On',
      'Multi-factor Authentication', 'Device Management', 'Provisioning', 'Deprovisioning',
      'Inventory Management', 'Equipment Lifecycle', 'Hardware Troubleshooting',
      'Software Troubleshooting', 'Audiovisual', 'Group Policy', 'BitLocker', 'FileVault',
      'Software Packaging', 'Licence Management', 'ITIL', 'Request Fulfilment',
      'Major Incident Management', 'Password Reset', 'IT Procurement', 'Remote Desktop',
      'VPN', 'DNS', 'DHCP', 'TCP/IP', 'VLAN', 'Firewall', 'Printer Support'],
    'Soft Skills': CATEGORIES['Soft Skills'].concat(['Scrappy', 'Bias for Action',
      'Stakeholder Communication', 'Accuracy', 'Conflict Resolution', 'Languages',
      'Tradeoffs']),
    'Domain Expertise': CATEGORIES['Domain Expertise'].concat(['Invoicing', 'Payouts',
      'Payments', 'Tax Calculation', 'Financial Technology', 'AML', 'KYC', 'GTM',
      'Revenue Operations', 'Sales Operations', 'Technical Evaluation', 'Innovation',
      'Benefits Administration', 'Compensation', 'Time and Attendance', 'Lean',
      'Six Sigma', 'Team Restructuring', 'Onboarding', 'Offboarding',
      'Employee Relations', 'SOP', 'Requirements Gathering', 'QA']),
  });
  // Every concept added above gets the skills line its peers are on.
  Object.assign(CATEGORIES, {
    'Developer Tooling': (CATEGORIES['Developer Tooling'] || []).concat(['npm', 'pnpm', 'Yarn', 'pip', 'Poetry', 'uv', 'Maven', 'Gradle', 'NuGet', 'Cargo', 'Bundler', 'Composer', 'CMake', 'Bazel', 'MSBuild', 'ESLint', 'Prettier', 'Ruff', 'mypy', 'Nx', 'Turborepo', 'Artifactory', 'Nexus Repository', 'TypeScript Type Checking', 'Dependency Management', 'Package Management', 'Semantic Versioning', 'Monorepos', 'Software Supply Chain Security', 'SBOM', 'Dependency Scanning', 'Artifact Signing', 'Reproducible Builds', 'Feature Flags', 'LaunchDarkly', 'Trunk-based Development', 'GitFlow', 'Canary Deployment', 'Blue-green Deployment', 'Rolling Deployment', 'Rollback Strategies']),
    'Distributed Systems': (CATEGORIES['Distributed Systems'] || []).concat(['Idempotency', 'Eventual Consistency', 'Strong Consistency', 'Consensus Algorithms', 'Distributed Transactions', 'Saga Pattern', 'Transactional Outbox', 'Circuit Breakers', 'Retry Policies', 'Exponential Backoff', 'Backpressure', 'Dead-letter Queues', 'Connection Pooling', 'Service Discovery', 'Service Mesh', 'Istio', 'Linkerd', 'Envoy', 'ActiveMQ', 'NATS', 'Apache Pulsar', 'Amazon SQS', 'Amazon SNS', 'Azure Service Bus', 'Azure Event Hubs', 'Durable Workflows', 'Workflow Orchestration', 'API Gateways', 'Kong', 'Apigee']),
    'Data Engineering': (CATEGORIES['Data Engineering'] || []).concat(['Apache NiFi', 'Debezium', 'Kafka Connect', 'Kafka Streams', 'Schema Registry', 'Apache Avro', 'Protocol Buffers', 'JSON Schema', 'Apache Druid', 'Trino', 'Amazon Athena', 'Amazon EMR', 'Azure Databricks', 'Microsoft Fabric', 'OneLake', 'Snowpark', 'Snowpipe', 'Amazon Kinesis', 'Google Dataproc', 'Data Contracts', 'Data Observability', 'Data Reconciliation', 'Data Profiling', 'Data Cleansing', 'Data Deduplication', 'Slowly Changing Dimensions', 'Dimensional Modeling', 'Star Schema', 'Snowflake Schema', 'Fact Tables', 'Dimension Tables', 'Data Vault', 'Semantic Layers', 'Metric Definitions', 'Great Expectations', 'Soda', 'Monte Carlo', 'Collibra', 'Alation', 'Microsoft Purview', 'OpenLineage']),
    'Machine Learning': (CATEGORIES['Machine Learning'] || []).concat(['OpenAI API', 'Azure OpenAI', 'Amazon Bedrock', 'Google Vertex AI', 'Anthropic API', 'LangChain', 'LlamaIndex', 'Semantic Kernel', 'DSPy', 'LangGraph', 'Haystack', 'vLLM', 'Ollama', 'TensorRT', 'ONNX', 'ONNX Runtime', 'Triton Inference Server', 'TorchServe', 'BentoML', 'Ray Serve', 'KServe', 'Ray', 'Pinecone', 'Weaviate', 'Milvus', 'Qdrant', 'FAISS', 'pgvector', 'Chroma', 'Hybrid Search', 'Reranking', 'Chunking Strategies', 'Retrieval Evaluation', 'Grounded Generation', 'Structured Outputs', 'Function Calling', 'Model Context Protocol', 'Prompt Injection Defense', 'AI Guardrails', 'Hallucination Evaluation', 'Human-in-the-loop Review', 'Agent Evaluation', 'Evaluation Datasets', 'Synthetic Data Generation', 'Transfer Learning', 'Self-supervised Learning', 'Contrastive Learning', 'Multimodal Learning', 'Representation Learning', 'Learning to Rank', 'Bayesian Optimization', 'Bayesian Inference', 'Probabilistic Modeling', 'Survival Analysis', 'Optimization Algorithms', 'Operations Research', 'Linear Programming', 'Integer Programming', 'Constraint Programming', 'Graph Neural Networks', 'Time Series Forecasting', 'Demand Forecasting', 'Model Calibration', 'Class Imbalance', 'Feature Stores', 'Feast', 'Tecton', 'Experiment Tracking', 'Model Registries', 'Reproducibility', 'Online Inference', 'Batch Inference', 'Shadow Deployment', 'Champion-Challenger Evaluation', 'SHAP', 'LIME', 'Federated Learning', 'Differential Privacy']),
    'Cloud & DevOps': (CATEGORIES['Cloud & DevOps'] || []).concat(['AWS IAM', 'AWS Organizations', 'AWS Control Tower', 'AWS CloudTrail', 'AWS Config', 'AWS Systems Manager', 'AWS Secrets Manager', 'AWS KMS', 'AWS WAF', 'Amazon CloudFront', 'Amazon Route 53', 'AWS Transit Gateway', 'AWS Direct Connect', 'Azure Bicep', 'Azure Resource Manager', 'Azure Policy', 'Azure Key Vault', 'Azure Front Door', 'Azure Application Gateway', 'Azure ExpressRoute', 'Google Cloud IAM', 'Google Secret Manager', 'Google Cloud Armor', 'Google Cloud Build', 'Google Artifact Registry', 'Cloud Landing Zones', 'Infrastructure Modules', 'Policy as Code', 'Open Policy Agent', 'Gatekeeper', 'Kyverno', 'Crossplane', 'Backstage', 'Internal Developer Platforms', 'Developer Experience', 'Self-service Infrastructure', 'Kubernetes Operators', 'Custom Resource Definitions', 'Kustomize', 'Cilium', 'Calico', 'Container Registry Management', 'Reliability Engineering', 'Production Engineering', 'Availability Engineering', 'Performance Profiling', 'CPU Profiling', 'Memory Profiling', 'Heap Analysis', 'Garbage Collection Tuning', 'Latency Analysis', 'Throughput Optimization', 'Resource Utilization', 'Chaos Engineering', 'Fault Injection', 'Load Shedding', 'Graceful Degradation', 'Disaster Recovery Testing', 'Recovery Time Objective', 'Recovery Point Objective', 'Runbooks', 'Operational Readiness Reviews', 'Incident Command', 'Alert Tuning', 'Alert Fatigue Reduction', 'Synthetic Monitoring', 'Real User Monitoring', 'Continuous Profiling']),
    'Security': (CATEGORIES['Security'] || []).concat(['Microsoft Sentinel', 'Microsoft Defender', 'CrowdStrike', 'SentinelOne', 'Elastic Security', 'Wazuh', 'Suricata', 'Snort', 'Zeek', 'Wireshark', 'Nmap', 'Burp Suite', 'Metasploit', 'Nessus', 'Qualys', 'Rapid7', 'Tenable', 'Snyk', 'Semgrep', 'Checkmarx', 'Veracode', 'SonarQube', 'Trivy', 'Grype', 'Falco', 'Wiz', 'Prisma Cloud', 'CNAPP', 'CSPM', 'CWPP', 'CIEM', 'DLP', 'CASB', 'SASE', 'ZTNA', 'Email Security', 'Phishing Analysis', 'Malware Analysis', 'Digital Forensics', 'Threat Intelligence', 'MITRE ATT&CK', 'Detection Engineering', 'Detection-as-Code', 'YARA', 'Sigma Rules', 'Security Incident Triage', 'Identity Governance', 'Access Reviews', 'Joiner-Mover-Leaver', 'Certificate Management', 'Secrets Rotation', 'Privacy Engineering', 'Privacy by Design', 'Data Minimization', 'Retention Policies', 'Data Classification', 'Data Residency', 'Data Sovereignty', 'Pseudonymization', 'Anonymization', 'Consent Management', 'DPIA', 'Third-party Risk Management', 'Control Testing', 'Audit Evidence Collection', 'Compliance Automation', 'Governance Risk and Compliance', 'ISO 27701', 'ISO 22301', 'ISO 42001', 'NIST CSF', 'NIST AI RMF', 'CIS Controls', 'CIS Benchmarks', 'FedRAMP', 'SOX IT Controls', 'GDPR', 'HIPAA', 'ISO 27001', 'SOC 2']),
    'IT Operations': (CATEGORIES['IT Operations'] || []).concat(['IPv4', 'IPv6', 'NAT', 'CIDR', 'Subnetting', 'IPsec', 'WireGuard', 'OpenVPN', 'MPLS', 'VXLAN', 'EVPN', 'Network Segmentation', 'Network Access Control', 'RADIUS', 'TACACS+', '802.1X', 'QoS', 'Packet Analysis', 'Network Automation', 'NetBox', 'Netmiko', 'NAPALM', 'Ansible Networking', 'Cisco IOS', 'Cisco NX-OS', 'Junos', 'F5 BIG-IP', 'HAProxy', 'Squid', 'Proxmox', 'KVM', 'QEMU', 'Ceph', 'ZFS', 'NFS', 'SMB', 'iSCSI', 'Fibre Channel', 'Microsoft Exchange Online', 'SharePoint Online', 'OneDrive', 'Windows Autopatch', 'Windows Deployment', 'WSUS', 'Remote Desktop Services', 'Citrix Virtual Apps and Desktops', 'Azure Virtual Desktop', 'Apple Business Manager', 'Apple School Manager', 'Google Admin Console', 'Endpoint Compliance', 'Device Encryption', 'Configuration Items', 'Service Catalogues', 'Service Level Management', 'User Access Administration', 'Meeting-room Support']),
    'Testing': (CATEGORIES['Testing'] || []).concat(['WebdriverIO', 'Robot Framework', 'NUnit', 'MSTest', 'RSpec', 'Capybara', 'PHPUnit', 'Pest', 'Testcontainers', 'Pact', 'WireMock', 'Mock Service Worker', 'Supertest', 'REST Assured', 'Newman', 'Locust', 'Artillery', 'Lighthouse', 'axe-core', 'Pa11y', 'BrowserStack', 'Sauce Labs', 'Percy', 'Applitools', 'Visual Regression Testing', 'Snapshot Testing', 'Property-based Testing', 'Mutation Testing', 'Fuzz Testing', 'Exploratory Testing', 'Compatibility Testing', 'Localization Testing', 'Test Data Management', 'Test Environment Management', 'Test Coverage Analysis', 'Flaky Test Reduction', 'Shift-left Testing']),
    'Frontend': (CATEGORIES['Frontend'] || []).concat(['Remix', 'React Router', 'TanStack Query', 'TanStack Table', 'SolidJS', 'Lit', 'Alpine.js', 'HTMX', 'Storybook', 'Radix UI', 'Material UI', 'Chakra UI', 'Ant Design', 'Emotion', 'Styled Components', 'CSS Modules', 'CSS Grid', 'Flexbox', 'Core Web Vitals', 'Web Performance Optimization', 'Keyboard Navigation', 'Screen Reader Testing', 'Focus Management', 'Internationalization', 'Localization', 'Contentful', 'Sanity', 'Strapi', 'WordPress', 'Drupal', 'Webflow', 'Headless CMS', 'Content Modeling', 'Content Migration', 'React Native', 'Accessibility']),
    'Analytics & Reporting': (CATEGORIES['Analytics & Reporting'] || []).concat(['Amplitude', 'Mixpanel', 'Heap', 'Pendo', 'Segment', 'Google Analytics 4', 'Adobe Analytics', 'RudderStack', 'Optimizely', 'Product Instrumentation', 'Event Tracking', 'Tracking Plans', 'Experiment Analysis', 'Statistical Power', 'Sample Size Estimation', 'Sequential Testing', 'Retention Analysis', 'Activation Metrics', 'Churn Analysis', 'Customer Lifetime Value', 'North Star Metrics', 'Opportunity Assessment', 'Jobs to Be Done', 'Product-market Fit Research']),
    'Tools & Platforms': (CATEGORIES['Tools & Platforms'] || []).concat(['Salesforce Flow', 'Lightning Web Components', 'SOQL', 'Salesforce CPQ', 'Revenue Cloud', 'Marketing Cloud', 'Marketo', 'Eloqua', 'SAP Fiori', 'SAP BTP', 'SAP SuccessFactors', 'SAP Integration Suite', 'Workday HCM', 'Workday Financial Management', 'Workday Studio', 'Workday Extend', 'Oracle Fusion Cloud', 'Oracle Integration Cloud', 'Microsoft Dataverse', 'Power BI Administration', 'Power Platform', 'Power Platform Governance']),
    'Specialised Technology': (CATEGORIES['Specialised Technology'] || []).concat(['Unity', 'Unreal Engine', 'Godot', 'OpenGL', 'Vulkan', 'DirectX', 'WebGL', 'WebGPU', 'Three.js', 'Computer Graphics', 'Shader Programming', 'GIS', 'ArcGIS', 'QGIS', 'PostGIS', 'Geospatial Analysis', 'Remote Sensing', 'Digital Twins', 'CAD', 'AutoCAD', 'SolidWorks', 'MATLAB Simulink', 'LabVIEW', 'PLC Programming', 'SCADA', 'HMI', 'Modbus', 'OPC UA', 'Industrial Automation', 'Mechatronics', 'Signal Processing', 'DSP']),
    'Soft Skills': (CATEGORIES['Soft Skills'] || []).concat(['Executive Communication', 'Audience-aware Communication', 'Requirements Clarification', 'Workshop Facilitation', 'Meeting Facilitation', 'Technical Demonstration', 'Consultative Discovery', 'Consensus Building', 'Stakeholder Alignment', 'Cross-cultural Collaboration', 'Remote Collaboration', 'Conflict Mediation', 'Constructive Feedback', 'Change Leadership', 'Commercial Awareness', 'Business Acumen', 'Customer Advocacy', 'Service Recovery', 'Structured Problem Solving', 'Judgement Under Uncertainty', 'Trade-off Analysis', 'Risk Communication', 'Estimation', 'Dependency Coordination', 'Operational Discipline', 'Documentation Discipline']),
  });

  const _CATEGORY_OF = new Map();
  for (const category of Object.keys(CATEGORIES)) {
    for (const label of CATEGORIES[category]) {
      // Through the group, so any surface form of a listed requirement
      // resolves to the same category its canonical name does.
      const group = groupOf(label);
      const key = tight(group ? group[0] : label);
      if (key && !_CATEGORY_OF.has(key)) _CATEGORY_OF.set(key, category);
    }
  }

  /** The skills-block category this term belongs to, or null. */
  function categoryOf(term) {
    const group = groupOf(term);
    const label = group ? group[0] : String(term == null ? '' : term);
    return _CATEGORY_OF.get(tight(label)) || null;
  }

  // ── WHICH PART OF A POSTING STATES A REQUIREMENT ─────────────────────
  //
  // A posting is not all job. It is a job wrapped in a company pitch, a
  // list of values, a benefits table and a page of legal text, and only
  // one of those says what the candidate must be able to do.
  //
  // Frequency scoring used to hide this: boilerplate words are rare, so
  // they never scored. The sweep asks whether a requirement is NAMED, and
  // deliberately does not care how often, which threw that protection
  // away. One real posting produced these, every one from prose about the
  // employer rather than about the job:
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
  // former can introduce a requirement here. Nothing is lost by it --
  // the frequency and model extractors still read the whole posting, so
  // a genuinely central theme is still picked up by being repeated.
  const _NOT_THE_JOB = new RegExp([
    // "About <anything>" is the company pitch -- "About us", "About
    // Extenteam" -- EXCEPT when it is about the job itself.
    '^about\\b(?!\\s+(?:the\\s+)?(?:role|job|position|opportunity|team|work))',
    'who we are', 'our (?:story|values|mission|culture|team)',
    'core values', 'company (?:overview|profile)', 'why (?:join|work|us)', 'life at',
    'benefits', 'perks', 'what we offer', 'compensation( and benefits)?', 'the package',
    'equal opportunit', '\\beeo\\b', 'the legal bit', 'legal', 'privacy', 'data protection',
    'diversity', 'inclusion', 'job alert', 'how to apply', 'our process',
  ].join('|'), 'i');

  // Legal and GDPR text is routinely dropped in with no heading at all,
  // so the paragraph has to be recognised by what it says.
  const _BOILERPLATE_PROSE = new RegExp([
    'equal opportunity employer', 'unlawful discrimination', 'zero tolerance policy',
    'gdpr', 'data protection law', 'recruitment database', 'reasonable accommodation',
    'affirmative action', 'protected veteran', 'e-verify',
  ].join('|'), 'i');

  /**
   * Does this line look like a section heading rather than prose?
   *
   * A HEADING STARTS A BLOCK. Without that requirement every line of a
   * values list -- "Obsess over Customer Success", "Own the Outcome" --
   * reads as its own heading, which split the values section into seven
   * one-line sections and let all seven through as requirements.
   */
  function _isHeading(lines, i) {
    const l = String(lines[i] == null ? '' : lines[i]).trim();
    if (!l || l.length > 70) return false;
    if (/[.,;]$/.test(l)) return false;
    // A bullet is content, however short and however capitalised.
    if (/^[-*•·◦]|^\d+[.)]/.test(l)) return false;
    if (i > 0 && String(lines[i - 1] == null ? '' : lines[i - 1]).trim()) return false;
    if (/:$/.test(l)) return true;
    const letters = l.replace(/[^A-Za-z]/g, '');
    if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
    // Title Case with no sentence punctuation, e.g. "Why this role exists".
    return /^[A-Z][^.!?]*$/.test(l) && l.split(/\s+/).length <= 8;
  }

  /**
   * The parts of a posting that state requirements, with the company
   * pitch, the values list, the benefits and the legal text removed.
   *
   * FAILS OPEN. A posting with no headings, or one where every section
   * looks like boilerplate, comes back whole: under-reading a posting
   * costs a real requirement, which is the worse of the two mistakes.
   */
  function requirementText(text) {
    const body = String(text == null ? '' : text);
    if (!body.trim()) return '';
    const lines = body.split('\n');

    // Split into [heading, ...lines] blocks. Text before the first
    // heading is the title and intro, which is part of the job.
    const blocks = [{ heading: '', lines: [] }];
    for (let i = 0; i < lines.length; i += 1) {
      if (_isHeading(lines, i)) blocks.push({ heading: lines[i].trim(), lines: [lines[i]] });
      else blocks[blocks.length - 1].lines.push(lines[i]);
    }

    const kept = blocks
      .filter((b) => !b.heading || !_NOT_THE_JOB.test(b.heading))
      .map((b) => b.lines
        // And a boilerplate paragraph that arrived without a heading.
        .filter((l) => !_BOILERPLATE_PROSE.test(l))
        .join('\n'))
      .join('\n');

    // If scoping left almost nothing, the headings were not what they
    // looked like. Read the whole posting rather than nearly none of it.
    return kept.trim().length >= Math.min(200, body.trim().length * 0.2) ? kept : body;
  }

  /**
   * Every requirement in the table that the text actually mentions,
   * ranked by how often the text mentions it.
   *
   * THE EXTRACTOR MISSES WHAT THE POSTING SAYS ONCE. It scores terms by
   * frequency, so a requirement named a single time -- "a team that
   * ships well", "two roadmaps with one team", "OTA compliance" -- never
   * rises far enough to be returned. An external ATS scan found three
   * such skills on one posting that this extension had not extracted at
   * all, and a requirement never extracted can never be matched, written
   * or counted.
   *
   * Frequency is the wrong question. The table already knows what a
   * requirement IS, so the right question is simply whether the posting
   * names one. This sweep is deterministic, has no threshold to tune,
   * and cannot miss a requirement the table knows.
   */
  function sweep(text, limit) {
    // Scoped, because this pass adds requirements on its own authority
    // and a company pitch is not a requirement.
    const body = fold(requirementText(String(text == null ? '' : text)));
    if (!body.trim()) return [];
    const found = [];
    // ONLY THE GROUPS WHOSE FIRST WORD IS ACTUALLY ON THE PAGE.
    //
    // This used to test all nine hundred groups against the text, every
    // form of every one, on every call. At four hundred groups that was
    // tolerable; at nine hundred it reached 265ms for a single short
    // string, and the passes above call sweep once per statement and once
    // per chip. A real posting froze the popup's main thread for tens of
    // seconds, which is what "Measuring..." forever actually was.
    //
    // A group can only match if the first word of one of its forms
    // appears in the text, so the text's own words decide which handful
    // of groups are worth testing. Every match the full scan would have
    // found is still found: the prefilter only skips groups that could
    // not have matched.
    const present = _tokensOf(body);
    const candidates = new Set();
    for (const token of present) {
      const bucket = _BY_FIRST_TOKEN.get(token);
      if (bucket) for (const i of bucket) candidates.add(i);
    }
    for (const index of candidates) {
      const group = GROUPS[index];
      // MEMBERSHIP IS DECIDED BY THE SAME TEST EVERYTHING ELSE USES, so a
      // posting that says "roadmaps" or "ships" names Roadmap and
      // Delivery, and one that says "no experience with Kafka" names
      // neither. Counting the table's own spelling instead scored those
      // first two zero and dropped them.
      if (!group.some((member) => appearsIn(body, member))) continue;
      // Distinct STRETCHES of text, not distinct match positions. "product
      // roadmap" and "roadmap" start eight characters apart but are the
      // same two words being read twice, and counting both made one
      // mention look like emphasis.
      const spans = [];
      for (const form of variantsOf(group[0])) {
        for (const m of body.matchAll(new RegExp(formPattern(form).source, 'giu'))) {
          spans.push([m.index, m.index + m[0].length]);
        }
      }
      spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
      let hits = 0, reached = -1;
      for (const [start, end] of spans) {
        if (start >= reached) hits += 1;
        if (end > reached) reached = end;
      }
      found.push({ label: group[0], hits: hits || 1 });
    }
    found.sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label));
    const cap = Math.max(1, Number(limit) || 40);
    return found.slice(0, cap);
  }

  // Populated once, after variantsOf exists, so plurals are indexed too.
  for (let i = 0; i < GROUPS.length; i += 1) {
    for (const form of variantsOf(GROUPS[i][0])) {
      const token = _firstToken(form);
      if (!token) continue;
      if (!_BY_FIRST_TOKEN.has(token)) _BY_FIRST_TOKEN.set(token, []);
      const bucket = _BY_FIRST_TOKEN.get(token);
      if (bucket[bucket.length - 1] !== i) bucket.push(i);
    }
  }

  global.KeywordTaxonomy = {
    norm, tight, fold, canonical, keyOf, groupOf, variantsOf, appearsIn, dedupe,
    measure, stripQualifiers, GROUPS, impliedIn, IMPLIED_BY,
    categoryOf, CATEGORIES, sweep, requirementText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.KeywordTaxonomy;
})(typeof window !== 'undefined' ? window : globalThis);

