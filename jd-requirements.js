/**
 * WHAT THE EMPLOYER REQUIRES, SEPARATED FROM EVERYTHING ELSE ON THE PAGE.
 *
 * A job posting is a requirements list wrapped in a company pitch, a
 * values list, a benefits table, a working-conditions note and a page of
 * legal text. Only one of those describes the job. Extraction that reads
 * the page as one flat blob produces chips like these, all taken from a
 * single real IT-support posting:
 *
 *   Benefits Administration   from the employee benefits section
 *   Training, Mentorship      from "training budget", "mentorship programme"
 *   Ownership                 from equity, not accountability
 *   Presentation              from presentation EQUIPMENT in meeting rooms
 *   warmth, flexibility       culture adjectives, not skills
 *   physical office work      a working condition, not a skill
 *
 * Every one of those reached the CV's skills section, because the
 * coverage pass writes what extraction returns. Precision here is not a
 * tidiness concern: it decides what the candidate claims in writing.
 *
 * THREE RULES DO THE WORK.
 *
 *   1. WHERE IT WAS SAID. A statement in the benefits section is not a
 *      requirement, however skill-shaped its words are. "We administer
 *      your benefits" is a promise to the employee.
 *
 *   2. WHAT WAS SAID AROUND IT. "Go" is a language beside Python and a
 *      verb in "go the extra mile". The same surface form resolves from
 *      its own sentence, never from a global allowlist or blocklist.
 *
 *   3. A DUTY IS NOT A LABEL. "Diagnose hardware and software issues" is
 *      a sentence, and no CV contains it. The concepts inside it --
 *      hardware troubleshooting, software troubleshooting -- are what a
 *      CV can carry and an applicant tracking system can search for.
 *
 * Every record carries the span of source text that produced it, so a
 * requirement that cannot be pointed at in the posting does not survive.
 *
 * Reads window.KeywordTaxonomy for the concept table.  window.JDRequirements
 */
(function (global) {
  'use strict';

  const TX = () => (global && global.KeywordTaxonomy)
    || (typeof KeywordTaxonomy !== 'undefined' ? KeywordTaxonomy : null);

  // ── SECTIONS ─────────────────────────────────────────────────────────
  //
  // Nine classes, of which four feed coverage. The rest are kept and
  // reported rather than deleted: a working-conditions line matters when
  // the candidate decides whether to apply, it is just not a skill.
  const SECTION = {
    REQUIRED: 'required',
    PREFERRED: 'preferred',
    RESPONSIBILITY: 'responsibility',
    SOFT: 'soft-skills',
    CONDITIONS: 'working-conditions',
    COMPANY: 'company',
    BENEFITS: 'benefits',
    LEGAL: 'legal',
    APPLICATION: 'application',
    UNKNOWN: 'unknown',
  };
  const COVERED = new Set([SECTION.REQUIRED, SECTION.PREFERRED,
    SECTION.RESPONSIBILITY, SECTION.SOFT, SECTION.UNKNOWN]);

  // Matched against a heading. Order matters: the first hit wins, so the
  // narrow patterns come before the broad ones.
  // ORDER IS THE WHOLE RULE, AND IT USED TO BE THE WRONG WAY ROUND.
  //
  // First hit wins, and BENEFITS sat above REQUIRED. So a combined
  // heading resolved to the half that is NOT the job, and every
  // requirement under it vanished without a trace:
  //
  //   "Skills and Benefits"                -> benefits, nothing read
  //   "Your experience and what we offer"  -> benefits, nothing read
  //   "Compensation and Qualifications"    -> benefits, nothing read
  //   "Who we are looking for"             -> company,  nothing read
  //
  // A leaked keyword is visible on screen. A deleted section is not: the
  // chip list is simply short and nothing looks wrong. So where a
  // heading names both, the half that carries requirements wins now.
  //
  // LEGAL, APPLICATION and CONDITIONS stay above REQUIRED deliberately.
  // "Travel requirements" and "Physical requirements" are facts about
  // the job, and the word "requirements" in them is not an invitation to
  // read them as skills.
  const HEADINGS = [
    [SECTION.LEGAL, /equal opportunit|\beeo\b|legal|privacy|data protection|gdpr|disclosure|accommodation|e-verify|pay transparency/i],
    [SECTION.APPLICATION, /how to apply|application (?:process|instructions)|our process|interview process|what to expect|hiring process|job alert/i],
    [SECTION.CONDITIONS, /working (?:conditions|arrangements|hours)|physical (?:requirements|demands)|travel|location|eligibility|work authoriz|right to work|visa|sponsorship|shift/i],
    [SECTION.SOFT, /soft skills|interpersonal|behavio(?:u)?ral|competenc/i],
    [SECTION.PREFERRED, /nice to have|preferred|bonus|desirable|a plus|ideally|good to have|pluses/i],
    [SECTION.REQUIRED, /non[- ]negotiable|requirement|qualification|what you(?:'| a|'l| wi)?l*l? (?:need|bring|have)|what we(?:'| a)?re looking for|who you are|about you\b|skills|experience|we(?:'| a)?re looking for|must[- ]have|you have|your background|your profile|the ideal candidate|candidate profile|what you bring/i],
    [SECTION.RESPONSIBILITY, /responsibilit|what you(?:'| wi)?ll do|the role|day to day|day-to-day|duties|your impact|what you will be doing|in this role|why this role exists|what you(?:'| wi)?ll own|what success looks like|position summary|job description|scope of|the opportunity|your mission/i],
    [SECTION.BENEFITS, /benefit|perks?|what we offer|compensation|salary|the package|pay and|why (?:join|work)|rewards?|wellbeing|well-being|our offer|why you should apply|what.s in it for you/i],
    [SECTION.COMPANY, /^about\b(?!\s+(?:the\s+)?(?:role|job|position|opportunity|team|work))|who we are\b(?!\s+looking)|our (?:story|values|mission|culture|team|purpose)|core values|company (?:overview|profile)|life at|meet the team/i],
  ];

  // A section is often introduced by prose with no heading at all, and
  // legal text in particular is dropped in bare.
  // EVERY MARKER IS WORD-BOUNDED. Without it "provision laptops" was read
  // as a benefits line, because "provision" contains "vision", and the
  // whole IT onboarding duty was discarded as a perk. A bare substring
  // is never safe against ordinary English.
  const PROSE_MARKERS = [
    [SECTION.LEGAL, /\b(?:equal opportunity employer|unlawful discrimination|without regard to race|protected veteran|reasonable accommodation|e-verify|gdpr|data protection law|recruitment database|zero tolerance policy)\b/i],
    [SECTION.BENEFITS, /\b(?:we offer|our benefits|benefits package|paid time off|pto|health insurance|dental|vision(?:\s+(?:insurance|cover|plan))?|401\s?\(?k\)?|pension|stock options|equity (?:ownership|grant|package)|parental leave|learning (?:budget|stipend)|training budget|wellness stipend|home office stipend|mentorship programme|mentorship program)\b|\byou(?:'| wi)?ll (?:get|receive|enjoy)\b/i],
    [SECTION.CONDITIONS, /\b(?:must be able to lift|ability to lift|onsite \d|in[- ]office|hybrid schedule|days per week in|willing to travel|travel up to|must reside|authorized to work|authorised to work|physical office work)\b/i],
  ];

  // ── AMBIGUOUS SURFACE FORMS ──────────────────────────────────────────
  //
  // Resolved from the statement they appear in, never globally. `need`
  // is a cue that confirms the technical sense; `reject` is a cue that
  // rules it out and always wins. `siblings` means the term is accepted
  // when the same statement names another, unambiguous technical
  // concept -- which is what makes "Python, Go, and Java" work without
  // listing every possible phrasing of a language list.
  const AMBIGUOUS = {
    'Go': { siblings: true, need: /\bgolang\b|\bgo\s*(?:lang|routines?|modules?|programming)\b|\bin go\b/i,
      reject: /\bgo\s+(?:to|through|live|beyond|above|the extra|out of)\b|\bon the go\b|\bgo-to\b|\bgo home\b|\blet\s+go\b/i },
    'R': { siblings: true, need: /\br\s*(?:\/|,|\)|and)|statistical|\br\s+programming\b|\bin r\b/i, reject: null },
    'C': { siblings: true, need: /\bc\s*(?:\/|,|\))|\bc\s+programming\b|\bin c\b/i, reject: null },
    'Rust': { siblings: true, need: /\brust\s*(?:lang|programming|developer|code)?\b/i,
      reject: /\brust(?:ing|ed|proof|y)\b|corrosion|\brust\s+(?:removal|prevention)\b/i },
    'React': { siblings: true, need: /\breact(?:\.js|js)?\b(?!\s+(?:to|quickly|calmly|fast|promptly|appropriately))/i,
      reject: /\breact\s+(?:to|quickly|calmly|fast|promptly|appropriately|well)\b|\breacting\b/i },
    'Spring': { siblings: true, need: /\bspring\s*(?:boot|framework|mvc|cloud|security|data)\b/i,
      reject: /\bspring\s+(?:20\d\d|semester|season|break)\b|\bnext spring\b/i },
    'Spark': { siblings: true, need: /\b(?:apache\s+)?spark\b/i,
      reject: /\bspark(?:s|ed|ing)?\s+(?:joy|conversation|debate|interest|curiosity|ideas)\b/i },
    'Swift': { siblings: true, need: /\bswift\s*(?:ui|lang|programming|developer)?\b/i,
      reject: /\bswift(?:ly)?\s+(?:action|response|resolution|turnaround|decision)\b|\bswift\s+(?:payments?|network|code|messaging|transfers?)\b/i },
    'Azure': { siblings: true, need: /\bazure\b/i, reject: /\bazure\s+(?:blue|sky|waters?)\b/i },
    'Teams': { siblings: true, need: /\b(?:microsoft|ms)\s+teams\b|\bteams\s+(?:rooms?|admin|channels?|meetings?)\b/i,
      reject: /\b(?:cross-functional|engineering|product|our|the|multiple|global|remote|internal)\s+teams\b|\bteams\s+(?:across|of|work|collaborate)\b/i },
    'Windows': { siblings: true, need: /\bwindows\s*(?:1[01]|server|xp|update|defender|autopilot|deployment|os)\b|\bmicrosoft windows\b/i,
      reject: /\b(?:time|maintenance|delivery|release|deployment)\s+windows?\b/i },
    'Access': { siblings: true, need: /\b(?:microsoft|ms)\s+access\b|\baccess\s+database\b/i,
      reject: /\baccess\s+(?:to|control|management|reviews?|rights?|permissions?|requests?|levels?)\b|\bgrant(?:ing)?\s+access\b|\buser access\b/i },
    'Excel': { siblings: true, need: /\b(?:microsoft|ms|advanced)\s+excel\b|\bexcel\s*(?:spreadsheets?|formulas?|macros?|pivot)\b|\bexcel\b\s*[,)]/i,
      reject: /\bexcel\s+(?:at|in|as)\b|\bexcels?\s+(?:at|in)\b/i },
    'Power BI': { siblings: true, need: /\bpower\s*bi\b/i, reject: null },
    'Looker': { siblings: true, need: /\blooker\b/i, reject: /\bgood[- ]?looker\b/i },
    'Snowflake': { siblings: true, need: /\bsnowflake\b/i, reject: /\bsnowflake\s+schema\b/i },
    'Oracle': { siblings: true, need: /\boracle\s*(?:database|db|ebs|cloud|fusion|apps|erp|\d)/i, reject: null },
    'Workday': { siblings: true, need: /\bworkday\s*(?:hcm|financials?|studio|extend|adaptive|reports?)\b|\bin workday\b|\bworkday\b\s*[,)]/i,
      reject: /\b(?:a|the|each|per|every|average|normal|typical|busy|long)\s+work\s?day\b|\bworkday\s+(?:begins|starts|ends)\b/i },
    'ServiceNow': { siblings: true, need: /\bservicenow\b/i, reject: null },
    'Make': { siblings: true, need: /\bmake\.com\b|\bmake\s*\(automation\)|\bgnu make\b|\bmakefile/i,
      reject: /\bmake\s+(?:sure|a|an|the|it|them|us|your|decisions?|recommendations?|improvements?|changes?)\b|\bmaking\b/i },
    'Chef': { siblings: true, need: /\bchef\s*(?:cookbooks?|recipes?|infra|automation|server)\b|\b(?:puppet|ansible|salt|terraform)\b/i,
      reject: /\b(?:head|sous|executive|pastry)\s+chef\b|\bchefs?\s+(?:cook|prepare|kitchen)\b/i },
    'Puppet': { siblings: true, need: /\bpuppet\s*(?:manifests?|modules?|enterprise|agent)\b|\b(?:chef|ansible|salt|terraform)\b/i,
      reject: /\bpuppet(?:s|ry)?\s+(?:show|theatre|theater)\b/i },
    'Salt': { siblings: true, need: /\bsaltstack\b|\bsalt\s*(?:project|states?|minions?|master)\b/i,
      reject: /\bsalt\b(?!\s*(?:stack|project|states?|minions?))/i },
    'Assembly': { siblings: true, need: /\bassembly\s*(?:language|code|programming|x86|arm)\b/i,
      reject: /\bassembly\s+(?:line|plant|process|of components?)\b|\bassembl(?:e|ing|ed)\b/i },
    'Scrum': { siblings: true, need: /\bscrum\s*(?:master|team|events?|ceremonies|framework)?\b|\bagile\b|\bsprints?\b/i, reject: null },
    'Lean': { siblings: true, need: /\blean\s*(?:six sigma|manufacturing|methodology|principles|process)\b/i,
      reject: /\blean\s+(?:on|into|towards?|forward)\b|\blean\s+team\b/i },
    'AI': { siblings: true, need: /\b(?:ai|artificial intelligence)[- ](?:powered|driven|assisted|enabled|based|tools?|features?|products?|models?|systems?|agents?)\b|\b(?:machine learning|llm|genai|generative ai|copilot|chatgpt)\b|\b(?:build|train|deploy|develop)\w*\s+(?:ai|models?)\b|\busing ai\b|\bwith ai\b/i,
      reject: null },
    'Security': { siblings: true, need: /\b(?:cyber|information|infosec|network|application|cloud|endpoint|data)\s*security\b|\bsecurity\s*(?:engineer|analyst|operations|controls?|posture|tooling|incidents?|patch)/i,
      reject: /\bsecurit(?:y|ies)\s+(?:guard|deposit|clearance check|firm|trading)\b|\bfinancial securities\b|\bphysical security\b|\bsocial security\b|\bjob security\b/i },
    'Networking': { siblings: true, need: /\bnetwork(?:ing)?\s*(?:equipment|hardware|switches|routers?|configuration|troubleshooting|protocols?|infrastructure|stack|lan|wan|wifi|wi-fi)\b|\b(?:tcp|dns|dhcp|vpn|vlan|firewall)\b/i,
      reject: /\bnetworking\s+(?:events?|opportunit|with (?:peers|people|professionals)|skills to build relationships)\b/i },
    'Inventory Management': { siblings: true, need: /\b(?:hardware|software|asset|equipment|device|it|laptop|licen[cs]e)\s+inventory\b|\binventory\s+of\s+(?:hardware|software|devices?|equipment|assets?|laptops?)\b/i,
      reject: /\b(?:stock|warehouse|retail|product|merchandise|store)\s+inventory\b/i },
    'Ownership': { siblings: false, need: /\b(?:take|takes|taking|taken|sense of|strong|end[- ]to[- ]end|full|personal)\s+ownership\b|\bowns?\s+(?:the|our|end[- ]to[- ]end|delivery|outcomes?)\b|\baccountab/i,
      reject: /\b(?:equity|stock|share|employee|option)\s*(?:ownership|options?)\b|\bownership\s+(?:stake|interest|of the company|in the company)\b|\besop\b/i },
    'Training': { siblings: false, need: /\b(?:deliver|delivering|provide|providing|conduct|conducting|run|running|lead|leading|create|creating|develop|developing)\s+(?:\w+\s+){0,3}training\b|\btraining\s+(?:end users?|employees?|staff|new hires?|others|the team|sessions? for)\b|\btrain(?:ing)?\s+(?:models?|data)\b/i,
      reject: /\btraining\s*(?:budget|allowance|stipend|fund|programme?s? (?:for you|available)|opportunit|and development (?:budget|opportunit))\b|\b(?:access to|we (?:offer|provide)|paid)\s+training\b/i },
    'Mentorship': { siblings: false, need: /\b(?:mentor|mentoring|mentorship of|coach|coaching)\s+(?:\w+\s+){0,3}(?:engineers?|juniors?|team|colleagues?|others|staff|analysts?|developers?)\b|\bmentor(?:ing|ship)?\s+(?:junior|new|less experienced)\b|\byou will mentor\b/i,
      reject: /\bmentorship\s*(?:programme?|scheme|available|opportunit|from)\b|\b(?:access to|we (?:offer|provide))\s*(?:a\s+)?mentor/i },
    'Presentation': { siblings: false, need: /\bpresent(?:ing|ation)?\s+(?:to|findings|results|recommendations?|proposals?|insights?|data)\b|\bpublic speaking\b|\bpresentation skills\b/i,
      reject: /\bpresentation\s*(?:equipment|hardware|systems?|screens?|displays?|technology|av)\b|\b(?:av|audio[- ]?visual)\s+(?:equipment|systems?)\b/i },
    'Onboarding': { siblings: false, need: null, reject: null,
      // Never bare. The posting always says WHOSE onboarding, and the
      // three meanings are different jobs.
      qualify: [
        [/\b(?:it|device|laptop|equipment|hardware|system|account|technical)\s+onboarding\b|\bonboarding\s+(?:and offboarding\s+)?(?:of\s+)?(?:new hires?|employees?|staff|users?)\b.{0,60}\b(?:laptop|device|account|hardware|equipment|access|system)/i, 'IT Onboarding'],
        [/\b(?:employee|new[- ]hire|staff|people|hr)\s+onboarding\b|\bonboarding\s+new\s+(?:hires?|employees?|starters?)\b/i, 'Employee Onboarding'],
        [/\b(?:customer|client|merchant|vendor|partner|user|account)\s+onboarding\b/i, 'Customer Onboarding'],
      ] },
    'Benefits Administration': { siblings: false,
      need: /\b(?:administer|administering|administration of|manage|managing|process|processing)\s+(?:\w+\s+){0,2}benefits\b|\bbenefits\s+administration\b(?=.{0,80}\b(?:you will|responsible|duties|manage|administer))/i,
      reject: /\b(?:our|your|employee|comprehensive|competitive|company)\s+benefits\b|\bbenefits\s+(?:package|include|offered|programme?)\b/i },
    'QA': { siblings: true, need: /\b(?:quality assurance|qa)\s*(?:engineer|analyst|automation|testing|process|team)\b|\btest(?:ing)?\b/i, reject: null },
    'Architecture': { siblings: true, need: /\b(?:software|system|solution|enterprise|cloud|data|technical|application|microservices?|security)\s+architect/i,
      reject: /\b(?:building|landscape|interior|naval)\s+architecture\b/i },
    // ── PRODUCT NAMES THAT ARE ALSO ORDINARY ENGLISH ──────────────────
    //
    // Every one of these is a real tool AND a word a careers page uses in
    // a sentence. They are accepted only when the statement gives a
    // technical cue or names another unambiguous tool beside them, which
    // is how "Load testing with Locust and Artillery" works while "an
    // artillery of ideas" does not.
    'Lighthouse': { siblings: true, need: /\blighthouse\s*(?:audits?|scores?|ci|reports?|performance)\b|\brun lighthouse\b/i,
      reject: /\blighthouse\s+(?:project|customer|account|client|brand)\b/i },
    'Locust': { siblings: true, need: /\blocust\s*(?:io|files?|load|swarm)?\b(?=.{0,40}\b(?:load|performance|test|users?)\b)|\bload test\w*\b/i, reject: /\blocust[- ]like\b/i },
    'Artillery': { siblings: true, need: /\bartillery\b(?=.{0,40}\b(?:load|performance|test|script)\b)|\bload test\w*\b/i,
      reject: /\bartillery of\b/i },
    'Percy': { siblings: true, need: /\bpercy\b(?=.{0,40}\b(?:visual|snapshot|regression|screenshot)\b)|\bvisual regression\b/i, reject: null },
    'Feast': { siblings: true, need: /\bfeast\b(?=.{0,40}\b(?:feature store|features?|ml|serving)\b)|\bfeature store\b/i,
      reject: /\bfeast\s+(?:on|of|for)\b/i },
    'Lit': { siblings: true, need: /\blit\s*(?:element|html|web components?)\b/i,
      reject: /\blit\s+(?:team|culture|up|fuse)\b|\bwell[- ]lit\b/i },
    'Sanity': { siblings: true, need: /\bsanity\s*(?:\.io|cms|studio|content)\b/i,
      reject: /\b(?:your|our|the|maintain|keep)\s+sanity\b|\bsanity\s+check\b/i },
    'Remix': { siblings: true, need: /\bremix\s*(?:run|js|framework|routes?|loaders?)\b/i,
      reject: /\ba remix of\b|\bremix\s+of\b/i },
    'Kong': { siblings: true, need: /\bkong\s*(?:gateway|api|ingress|enterprise)\b|\bapi gateway\b/i,
      reject: /\bthe kong of\b|\bking kong\b/i },
    'Soda': { siblings: true, need: /\bsoda\s*(?:core|cloud|cl|checks?|scans?)\b|\bdata quality\b/i,
      reject: /\b(?:a|the|free|grab a)\s+soda\b/i },
    'Ray': { siblings: true, need: /\bray\s*(?:serve|tune|train|cluster|core|data)\b|\bdistributed (?:compute|training)\b/i,
      reject: /\bray of\b|\bx[- ]ray\b/i },
    'Pest': { siblings: true, need: /\bpest\s*(?:php|testing|framework)\b|\bphpunit\b/i,
      reject: /\bpest[- ]free\b|\bpest\s+control\b/i },
    'Heap': { siblings: true, need: /\bheap\s*(?:analytics|io)\b|\bproduct analytics\b/i,
      reject: /\bheap\s+of\b|\bheap\s+(?:analysis|dump|memory|size)\b/i },
    'Chroma': { siblings: true, need: /\bchroma\s*(?:db)?\b(?=.{0,40}\b(?:vector|embedding|retrieval|rag)\b)|\bvector (?:database|store|search)\b/i, reject: null },
    'Falco': { siblings: true, need: /\bfalco\b(?=.{0,40}\b(?:runtime|security|kubernetes|container)\b)|\bruntime security\b/i, reject: null },
    'Wiz': { siblings: true, need: /\bwiz\b(?=.{0,40}\b(?:cloud|security|cspm|cnapp)\b)|\bcloud security\b/i,
      reject: /\bwiz(?:ard|ardry)\b/i },
    'Envoy': { siblings: true, need: /\benvoy\s*(?:proxy|filter|sidecar)\b|\bservice mesh\b|\bapi gateway\b/i, reject: null },
    'Segment': { siblings: true, need: /\bsegment\s*(?:\.com|io)\b|\bcustomer data platform\b|\bcdp\b/i,
      reject: /\b(?:customer|market|user|audience|network|business)\s+segments?\b|\bsegment\s+(?:of|the)\b/i },
    'Cargo': { siblings: true, need: /\bcargo\s*(?:build|test|crates?|toml)\b|\brust\b/i,
      reject: /\bcargo\s+(?:ship|freight|handling|plane)\b/i },
    'Poetry': { siblings: true, need: /\bpoetry\s*(?:lock|install|add|env)\b|\bpython\b/i, reject: null },
    'Composer': { siblings: true, need: /\bcomposer\s*(?:install|require|json)\b|\bphp\b/i, reject: null },
    'Bundler': { siblings: true, need: /\bbundler\b(?=.{0,30}\b(?:ruby|gem|gemfile)\b)|\bruby\b/i, reject: null },
    'Unity': { siblings: true, need: /\bunity\s*(?:3d|engine|editor|c#)\b|\bgame (?:development|engine)\b/i,
      reject: /\bunity\s+(?:of|and diversity|in the team)\b|\bteam unity\b/i },
    'Emotion': { siblings: true, need: /\bemotion\s*(?:js|css|styled)\b|\bcss[- ]in[- ]js\b/i,
      reject: /\bemotion(?:al|s)?\b/i },
    'Squid': { siblings: true, need: /\bsquid\s*(?:proxy|cache)\b|\bproxy server\b/i, reject: null },
    'Snort': { siblings: true, need: /\bsnort\b(?=.{0,40}\b(?:ids|ips|intrusion|rules?|network)\b)|\bintrusion detection\b/i, reject: null },
    'Zeek': { siblings: true, need: /\bzeek\b(?=.{0,40}\b(?:network|nsm|logs?|monitoring)\b)|\bnetwork security monitoring\b/i, reject: null },
    'Sentinel': { siblings: true, need: /\b(?:microsoft|azure)\s+sentinel\b|\bsentinel\b(?=.{0,30}\b(?:siem|soc|logs?)\b)/i, reject: null },
    'Prettier': { siblings: true, need: /\bprettier\b(?=.{0,30}\b(?:eslint|format|lint|config)\b)|\beslint\b/i,
      reject: /\bprettier\s+than\b|\bmuch prettier\b/i },
    'Reproducibility': { siblings: true, need: /\breproducib\w+\b(?=.{0,40}\b(?:model|experiment|build|pipeline|research)\b)|\bexperiment tracking\b/i, reject: null },
    'Estimation': { siblings: false, need: /\b(?:effort|story|sprint|project|cost|delivery)\s+estimation\b|\bestimat\w+\s+(?:effort|work|stories|delivery|timelines?)\b/i, reject: null },
    'Provisioning': { siblings: true, need: /\bprovision(?:ing)?\s+(?:\w+\s+){0,2}(?:devices?|laptops?|accounts?|users?|hardware|equipment|infrastructure|servers?|access)\b/i, reject: null },
  };

  // ── A DUTY SENTENCE NAMES A CAPABILITY ───────────────────────────────
  //
  // "Diagnose hardware and software issues" is a sentence, and no CV
  // contains it. The capability it describes is what a CV can carry and
  // what a keyword screen can find. These cues read the EMPLOYER'S
  // wording only; they are deliberately not the candidate-evidence table,
  // because what the employer requires must not be inferred from what the
  // candidate happens to have done.
  const DUTY_CUES = [
    [/\b(?:diagnos|troubleshoot|resolv|fix|repair)\w*\s+(?:\w+\s+){0,3}hardware\b|\bhardware\s+(?:issues?|faults?|problems?|failures?)\b/i, 'Hardware Troubleshooting'],
    [/\b(?:diagnos|troubleshoot|resolv|fix|debug)\w*\s+(?:\w+\s+){0,3}software\b|\bsoftware\s+(?:issues?|faults?|problems?|bugs?)\b|\bapplication (?:issues?|support)\b/i, 'Software Troubleshooting'],
    [/\bprovision(?:ing)?\s+(?:\w+\s+){0,2}(?:laptops?|devices?|hardware|equipment|machines?)\b|\bequipment provisioning\b/i, 'Provisioning'],
    [/\b(?:maintain|track|manage)\w*\s+(?:\w+\s+){0,3}inventory\b|\basset (?:tracking|register)\b/i, 'Inventory Management'],
    [/\b(?:resolve|triage|route|close|action)\w*\s+(?:\w+\s+){0,3}tickets?\b|\bticket (?:queue|triage|volume)\b/i, 'Ticketing'],
    [/\bcreate\s+accounts?\b|\bgrant\s+(?:\w+\s+){0,2}access\b|\buser access administration\b/i, 'Provisioning'],
    [/\b(?:reset|resetting)\s+passwords?\b|\bpassword resets?\b/i, 'Password Reset'],
    [/\bescalat\w+\b.{0,40}\b(?:issues?|tickets?|incidents?)\b|\bincident (?:response|management)\b/i, 'Escalation Management'],
    [/\b(?:document|documenting|write|writing|maintain)\w*\s+(?:\w+\s+){0,3}(?:runbooks?|knowledge base|documentation|sops?)\b/i, 'Documentation'],
  ];

  /** Capabilities a duty sentence names without using their names. */
  function dutyConcepts(statement) {
    const out = [];
    for (const [re, label] of DUTY_CUES) if (re.test(statement)) out.push(label);
    return out;
  }

  // Personality adjectives a posting uses to describe a person rather
  // than a capability. Jobscan scores some soft skills, so this is not
  // "no soft skills": Communication and Attention to Detail are things
  // you do and can point at. Warmth is not.
  const VAGUE = /^(?:warmth|warm|friendly|kind|kindness|positivity|positive|enthusiasm|enthusiastic|passion(?:ate)?|energy|energetic|flexibility|flexible|humility|humble|curiosity|curious|grit|gritty|tenacity|tenacious|hunger|hungry|drive|driven|integrity|authenticity|empathy for|nice|fun|approachable|personable|scrappy|scrappiness|resilience|resilient|adaptable|adaptability|self[- ]starter|go[- ]getter|team player|can[- ]do|proactive|motivated|ambitious|dynamic|hard[- ]working)$/i;

  // A working condition is a fact about the job, not a skill on a CV.
  const CONDITION = /^(?:physical office work|on[- ]?site|onsite|in[- ]?office|hybrid|remote|relocation|travel|shift work|weekend work|on[- ]call rota|lifting|standing|driving licence|driver'?s licence|drivers license|work authorisation|work authorization|visa|sponsorship|right to work|background check|security clearance)/i;

  // ── SEGMENTATION ─────────────────────────────────────────────────────

  function _isHeading(lines, i) {
    const l = String(lines[i] == null ? '' : lines[i]).trim();
    if (!l || l.length > 70) return false;
    if (/[.,;]$/.test(l)) return false;
    if (/^[-*•·◦]|^\d+[.)]/.test(l)) return false;
    if (i > 0 && String(lines[i - 1] == null ? '' : lines[i - 1]).trim()) return false;
    if (/:$/.test(l)) return true;
    const letters = l.replace(/[^A-Za-z]/g, '');
    if (letters.length >= 3 && letters === letters.toUpperCase()) return true;
    return /^[A-Z][^.!?]*$/.test(l) && l.split(/\s+/).length <= 9;
  }

  function classifyHeading(heading) {
    const h = String(heading || '').trim();
    if (!h) return null;
    for (const [cls, re] of HEADINGS) if (re.test(h)) return cls;
    return null;
  }

  function classifyProse(text) {
    for (const [cls, re] of PROSE_MARKERS) if (re.test(text)) return cls;
    return null;
  }

  /**
   * The posting as statements, each carrying its section and the exact
   * offsets it came from. Offsets are into the ORIGINAL string, so a
   * record's evidence can always be pointed at on the page.
   */
  function segment(jdText) {
    const text = String(jdText == null ? '' : jdText);
    if (!text.trim()) return [];
    const lines = text.split('\n');
    const out = [];
    let section = SECTION.UNKNOWN;
    let offset = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lineStart = offset;
      offset += line.length + 1;
      if (!line.trim()) continue;

      if (_isHeading(lines, i)) {
        const cls = classifyHeading(line);
        if (cls) {
          section = cls;
        } else if (!COVERED.has(section)) {
          // AN UNRECOGNISED HEADING ENDS A SECTION THAT IS NOT THE JOB.
          //
          // Inheriting unconditionally meant a posting opening with
          // "About Extenteam" and continuing under headings this table
          // does not know -- "Why this role exists", "Non-negotiables" --
          // stayed classified as company prose to the end, and produced
          // zero requirements from a posting full of them.
          //
          // It still inherits INSIDE a requirements section, where a bare
          // sub-heading is common and forgetting the section would
          // readmit nothing. Unknown is itself covered, so the safe
          // direction is to read the text rather than discard it.
          section = SECTION.UNKNOWN;
        }
        continue;
      }

      // Bullets split on their own; prose splits into sentences, so one
      // paragraph mixing a duty and a benefit is judged per statement.
      const pieces = [];
      const bullet = /^\s*(?:[-*•·◦]|\d+[.)])\s*/.exec(line);
      if (bullet) {
        pieces.push([bullet[0].length, line.slice(bullet[0].length)]);
      } else {
        let at = 0;
        for (const m of line.matchAll(/[^.!?]+[.!?]*/g)) {
          if (m[0].trim()) pieces.push([m.index, m[0]]);
          at = m.index;
        }
        if (!pieces.length) pieces.push([0, line]);
        void at;
      }

      for (const [rel, piece] of pieces) {
        const body = String(piece);
        if (!body.trim()) continue;
        // A statement can override its section: legal and benefits text
        // is routinely dropped into a list with no heading of its own.
        // A DUTY IS NOT RECLASSIFIED BY A NOUN INSIDE IT. "You will
        // administer benefits for 400 staff, including medical and
        // pension" is the job, and the word "pension" was moving it into
        // the benefits section and deleting the one requirement it
        // stated. A sentence that tells the reader what they will DO
        // keeps the section it was written under.
        const promises = /^\s*(?:you(?:'| wi)?ll|we(?:'| wi)?ll|the (?:role|successful)|responsible for|manage|administer|handle|own|run|lead|deliver|support|maintain|provide|process)\b/i.test(body)
          || /\byou will\b/i.test(body);
        const override = promises ? null : classifyProse(body);
        out.push({
          text: body.trim(),
          section: override || section,
          start: lineStart + rel,
          end: lineStart + rel + body.length,
        });
      }
    }
    return out;
  }

  // ── CONCEPT DETECTION, ONE STATEMENT AT A TIME ───────────────────────

  /**
   * Does this statement name an unambiguous technical concept?
   *
   * Takes the concepts ALREADY found in the statement when the caller has
   * them. Re-sweeping here meant every ambiguous hit paid for a second
   * full scan of the statement, on top of the one that found it.
   */
  function _hasSibling(statement, exceptLabel, known) {
    const named = Array.isArray(known) ? known
      : (TX() ? TX().sweep(statement, 8).map((r) => r.label) : []);
    return named.some((label) => label !== exceptLabel && !AMBIGUOUS[label]);
  }

  /**
   * Is this concept genuinely being asked for HERE, and under what name?
   *
   * Returns null when the surface form is present but means something
   * else, which is the whole point: "Access" beside "control" is a
   * permission, "Excel" before "at" is a verb, and "Teams" after
   * "cross-functional" is a group of people.
   */
  function resolve(label, statement, known) {
    const rule = AMBIGUOUS[label];
    if (!rule) return label;
    if (rule.reject && rule.reject.test(statement)) return null;
    if (Array.isArray(rule.qualify)) {
      for (const [re, qualified] of rule.qualify) if (re.test(statement)) return qualified;
      // Bare and unqualified: the posting did not say whose, so there is
      // nothing a CV can honestly be matched against.
      return null;
    }
    if (rule.need && rule.need.test(statement)) return label;
    if (rule.siblings && _hasSibling(statement, label, known)) return label;
    // A rule that asks for context and finds none REJECTS. Falling
    // through to acceptance is what let "a lighthouse project", "feast on
    // interesting problems" and "maintain your sanity" read as Lighthouse,
    // Feast and Sanity -- all three are real products, and all three
    // sentences are ordinary English from a careers page.
    return (rule.need || rule.siblings) ? null : label;
  }

  /**
   * Every statement with the concepts it names, computed once per posting.
   *
   * extract() and filterAgainstPosting() both need exactly this, and both
   * are called on the same posting in the same run. Computing it twice
   * doubled the cost of the one path the popup blocks on.
   */
  let _lastText = null;
  let _lastScan = null;
  function _scan(jdText) {
    const key = String(jdText == null ? '' : jdText);
    if (_lastText === key && _lastScan) return _lastScan;
    const tx = TX();
    const statements = segment(key);
    const scanned = statements.map((st) => {
      const named = tx ? tx.sweep(st.text, 12).map((h) => h.label) : [];
      for (const extra of dutyConcepts(st.text)) if (!named.includes(extra)) named.push(extra);
      return { st, named };
    });
    _lastText = key;
    _lastScan = { statements, scanned };
    return _lastScan;
  }

  // ── THE PASS ─────────────────────────────────────────────────────────

  /**
   * Every requirement the posting states, with the text that states it.
   *
   * Returns { requirements, excluded, conditions, sections }. `excluded`
   * carries a reason per rejected term so extraction failures can be
   * diagnosed without guessing.
   */
  function extract(jdText) {
    const tx = TX();
    const { statements, scanned } = _scan(jdText);
    const requirements = [];
    const excluded = [];
    const conditions = [];
    if (!tx || !statements.length) {
      return { requirements, excluded, conditions, statements, version: VERSION };
    }
    const byKey = new Map();

    for (const { st, named } of scanned) {
      const inCoverage = COVERED.has(st.section);
      // A working condition is a fact about the job, recorded for the
      // person deciding whether to apply and never scored as a skill.
      if (st.section === SECTION.CONDITIONS) {
        conditions.push({ label: st.text, evidence: st.text, start: st.start, end: st.end });
      }
      for (const label of named) {
        const hit = { label };
        const resolved = resolve(hit.label, st.text, named);
        if (!resolved) {
          excluded.push({ term: hit.label, reason: 'means something else here',
            section: st.section, evidence: st.text, start: st.start, end: st.end });
          continue;
        }
        if (!inCoverage) {
          excluded.push({ term: resolved, reason: 'stated in the ' + st.section + ' section',
            section: st.section, evidence: st.text, start: st.start, end: st.end });
          if (st.section === SECTION.CONDITIONS) {
            conditions.push({ label: resolved, evidence: st.text, start: st.start, end: st.end });
          }
          continue;
        }
        if (VAGUE.test(resolved)) {
          excluded.push({ term: resolved, reason: 'a personality adjective, not a capability',
            section: st.section, evidence: st.text, start: st.start, end: st.end });
          continue;
        }
        if (CONDITION.test(resolved)) {
          conditions.push({ label: resolved, evidence: st.text, start: st.start, end: st.end });
          excluded.push({ term: resolved, reason: 'a working condition, not a skill',
            section: st.section, evidence: st.text, start: st.start, end: st.end });
          continue;
        }

        const key = tx.keyOf(resolved);
        const status = st.section === SECTION.PREFERRED ? 'preferred'
          : st.section === SECTION.RESPONSIBILITY ? 'responsibility'
            : st.section === SECTION.SOFT ? 'soft' : 'required';
        const existing = byKey.get(key);
        if (existing) {
          // Required outranks preferred outranks responsibility, and the
          // strongest statement keeps the evidence.
          const rank = { required: 3, soft: 2, responsibility: 1, preferred: 0 };
          existing.mentions += 1;
          if (rank[status] > rank[existing.status]) {
            existing.status = status;
            existing.evidence = st.text;
            existing.start = st.start;
            existing.end = st.end;
            existing.section = st.section;
          }
          continue;
        }
        const record = {
          id: key,
          label: resolved,
          category: (typeof tx.categoryOf === 'function' && tx.categoryOf(resolved)) || null,
          status,
          section: st.section,
          evidence: st.text,
          start: st.start,
          end: st.end,
          mentions: 1,
          coverage: true,
        };
        byKey.set(key, record);
        requirements.push(record);
      }
    }

    // EVERY RECORD MUST BE POINTABLE AT. A requirement whose evidence is
    // not in the posting is an invention, whatever produced it.
    const source = String(jdText == null ? '' : jdText);
    const verified = requirements.filter((r) => {
      const ok = r.evidence && source.indexOf(r.evidence) !== -1;
      if (!ok) excluded.push({ term: r.label, reason: 'no source span in the posting', evidence: r.evidence });
      return ok;
    });

    // Explicit requirement language and repetition, not frequency alone.
    const weight = { required: 3, soft: 2, responsibility: 1, preferred: 0 };
    verified.sort((a, b) => (weight[b.status] - weight[a.status])
      || (b.mentions - a.mentions) || a.label.localeCompare(b.label));

    // ── THE BACKSTOP ───────────────────────────────────────────────────
    //
    // This is not a fix for the classification bugs found so far. It is a
    // fix for the ones not found yet, and it is the most important rule
    // in the file.
    //
    // Section scoping fails in two directions and they are not equally
    // bad. A section wrongly READ leaks a keyword, which is visible on
    // screen and can be reported. A section wrongly SKIPPED deletes
    // requirements silently: the chip list is short and nothing looks
    // wrong. A posting in a language this table cannot read, an ATS
    // layout it cannot parse, a heading nobody anticipated -- all of
    // them fail the second way.
    //
    // So if scoping found nothing and reading the whole posting would
    // have found something, the scoping was wrong about this posting and
    // is abandoned for it. Every future classification failure degrades
    // into the visible direction instead of the silent one.
    //
    // It fires on ONE condition: no statement in the whole posting landed
    // in a section that states requirements. That is classification
    // having swallowed the document, which is the failure worth
    // overriding. A posting that HAS requirements sections and simply
    // states no requirements in them has been read correctly, and the
    // honest answer there is nothing -- firing on that would undo the
    // term-level rules and put "lighthouse project" back on the CV.
    //
    // And even then only the SECTION gate is abandoned. Ambiguous terms
    // still resolve against the text, adjectives and working conditions
    // still go. Those rules were never the thing in doubt.
    // A SUBSTANTIAL posting, because that is what makes zero requirements
    // sections implausible. A two-line travel note or a stub with nothing
    // but an About paragraph really does state no requirements, and
    // reading it whole would put "Python is used on client sites" on a CV
    // from a section about where the job is. Five statements is the line:
    // below it, absence is ordinary; above it, absence means the headings
    // were not understood.
    const anyCovered = statements.some((st) => COVERED.has(st.section));
    if (!verified.length && !anyCovered && statements.length >= 5) {
      const body = String(jdText == null ? '' : jdText);
      const whole = (tx ? tx.sweep(body, 40) : [])
        .map((hit) => ({ hit, resolved: resolve(hit.label, body) }))
        .filter((x) => x.resolved && !VAGUE.test(x.resolved) && !CONDITION.test(x.resolved))
        .map((x) => ({ label: x.resolved, hits: x.hit.hits }));
      if (whole.length) {
        const fallback = whole.map((hit) => ({
          id: tx.keyOf(hit.label),
          label: hit.label,
          category: (typeof tx.categoryOf === 'function' && tx.categoryOf(hit.label)) || null,
          status: 'required',
          section: SECTION.UNKNOWN,
          evidence: '',
          start: -1,
          end: -1,
          mentions: hit.hits,
          coverage: true,
          unscoped: true,
        }));
        excluded.push({ term: '(section scoping)', reason: 'found nothing on this posting, '
          + 'so the whole text was read instead' });
        return { requirements: fallback, excluded, conditions, statements,
          scopingAbandoned: true, version: VERSION };
      }
    }
    return { requirements: verified, excluded, conditions, statements, version: VERSION };
  }

  /**
   * Does this read as a sentence describing a duty rather than a label?
   *
   * A skills line holds "Inventory Management". A responsibilities list
   * holds "Maintain hardware and software inventory". The second is the
   * same requirement written as an instruction, and the giveaway is that
   * it opens with a verb.
   */
  const _DUTY_OPENER = /^(?:resolve|diagnos|maintain|manage|support|handle|provide|deliver|create|build|develop|design|implement|monitor|track|troubleshoot|configure|install|administer|coordinate|perform|conduct|ensure|own|drive|lead|assist|respond|escalate|document|update|review|analyse|analyze|use|using|work|partner|collaborate|provision|triage|route|close)\w*\b/i;
  function _looksLikeDuty(term) {
    const t = String(term || '').trim();
    if (t.split(/\s+/).length < 3) return false;
    return _DUTY_OPENER.test(t);
  }

  /**
   * Keep only the terms the POSTING actually asks for, by the same rules.
   *
   * The model extractor returns labels with no evidence attached, and
   * that is where "Benefits Administration", "warmth" and "physical
   * office work" came from: it read the whole page and reported what it
   * saw. A label survives here only if some statement the posting makes,
   * in a section that states requirements, names it under the reading
   * that this term actually has.
   *
   * It never invents. A term the model missed is added by extract(); a
   * term it returned that no covered statement supports is dropped with
   * a reason.
   */
  function filterAgainstPosting(labels, jdText) {
    const tx = TX();
    const list = Array.isArray(labels) ? labels : [];
    if (!tx || !String(jdText || '').trim()) return { kept: list.slice(), dropped: [] };
    const { statements, scanned } = _scan(jdText);
    const supported = new Map();
    for (const { st, named } of scanned) {
      if (!COVERED.has(st.section)) continue;
      for (const label of named) {
        const resolved = resolve(label, st.text, named);
        if (!resolved) continue;
        if (VAGUE.test(resolved) || CONDITION.test(resolved)) continue;
        if (!supported.has(tx.keyOf(resolved))) supported.set(tx.keyOf(resolved), { resolved, st });
      }
    }
    const kept = [];
    const dropped = [];
    for (const raw of list) {
      const term = String(raw == null ? '' : raw).trim();
      if (!term) continue;
      if (VAGUE.test(term)) {
        dropped.push({ term, reason: 'a personality adjective, not a capability' });
        continue;
      }
      if (CONDITION.test(term)) {
        dropped.push({ term, reason: 'a working condition, not a skill' });
        continue;
      }
      const hit = supported.get(tx.keyOf(term));
      if (hit) {
        // Under the posting's own reading: "Onboarding" becomes "IT
        // Onboarding" where the posting said whose.
        kept.push(hit.resolved);
        continue;
      }
      // A DUTY SENTENCE IS NOT A LABEL.
      //
      // "Diagnose hardware and software issues" is literally in the
      // posting, so the literal test below would keep it, and no CV on
      // earth contains that string. The capabilities it names are
      // already on the list, added from the same statement. Dropping the
      // sentence removes a chip that could never match while losing
      // nothing, because what it meant is still there.
      if (_looksLikeDuty(term)) {
        const names = dutyConcepts(term)
          .concat(tx.sweep(term, 4).map((h) => h.label));
        if (names.some((n) => supported.has(tx.keyOf(n)))) {
          dropped.push({ term, reason: 'a duty sentence; the capability it names is listed as '
            + names.filter((n) => supported.has(tx.keyOf(n)))
              .map((n) => supported.get(tx.keyOf(n)).resolved).join(', ') });
          continue;
        }
      }
      // A term the table does not know cannot be checked this way, and
      // dropping it would lose every emerging tool and niche industry.
      // It survives only when the posting literally contains it in a
      // section that states requirements.
      if (!tx.groupOf(term)) {
        const literal = statements.some((st) => COVERED.has(st.section)
          && tx.appearsIn(st.text, term));
        if (literal) { kept.push(term); continue; }
        dropped.push({ term, reason: 'not stated in any requirements section' });
        continue;
      }
      dropped.push({ term, reason: 'not supported by a requirements statement' });
    }
    return { kept, dropped };
  }

  /** The tiered shape the rest of the extension already speaks. */
  function toKeywords(result) {
    const reqs = (result && result.requirements) || [];
    const high = reqs.filter((r) => r.status === 'required').map((r) => r.label);
    const medium = reqs.filter((r) => r.status === 'soft' || r.status === 'responsibility')
      .map((r) => r.label);
    const low = reqs.filter((r) => r.status === 'preferred').map((r) => r.label);
    return { all: high.concat(medium, low), highPriority: high, mediumPriority: medium, lowPriority: low };
  }

  const VERSION = '1.0.0';

  global.JDRequirements = {
    extract, toKeywords, segment, resolve, classifyHeading, classifyProse,
    filterAgainstPosting, dutyConcepts,
    SECTION, COVERED, AMBIGUOUS, VAGUE, CONDITION, VERSION,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.JDRequirements;
})(typeof window !== 'undefined' ? window : globalThis);
