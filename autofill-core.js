/**
 * Job Genie - Autofill Core (shared field intelligence)
 *
 * WHY THIS EXISTS
 * ---------------
 * Label matching and fill primitives were duplicated across the vendor
 * engine and the per-site fillers, so every bug had to be fixed three
 * times (and in practice wasn't). This is the single source of truth:
 * label resolution, profile answer mapping, and React-safe fill
 * primitives. Per-site modules (Indeed, LinkedIn Easy Apply) supply only
 * what is genuinely site-specific.
 *
 * Everything here is honest-by-default: it fills facts from the user's
 * profile and safe standard answers. It never invents credentials, never
 * overwrites something the user already typed, and never submits a form.
 *
 * Pure DOM + logic, no network.  window.AutofillCore
 */
(function (global) {
  'use strict';

  if (global.AutofillCore && global.AutofillCore.__jg) return;

  // ===================================================================
  // LABEL RESOLUTION
  // Order matters: explicit associations first, then ARIA, then the
  // enclosing question group (how modern ATS forms actually mark up a
  // question), then weak fallbacks.
  // ===================================================================
  const GROUP_SELECTOR = [
    'fieldset', '[role="group"]', '[role="radiogroup"]',
    '[class*="form-element" i]', '[class*="form-group" i]',
    '[class*="question" i]', '[class*="field" i]', '[data-qa]', 'li',
  ].join(',');

  const LABEL_IN_GROUP = [
    'legend', 'label', 'h1', 'h2', 'h3', 'h4',
    '[class*="label" i]', '[class*="Label" i]', '[class*="title" i]',
  ].join(',');

  function _clean(s) {
    return String(s || '').replace(/\s+/g, ' ').replace(/\*+$/, '').trim();
  }

  function escapeSelector(v) {
    try {
      if (global.CSS && CSS.escape) return CSS.escape(v);
    } catch (e) {}
    return String(v).replace(/["\\]/g, '\\$&');
  }

  function labelFor(el) {
    try {
      if (!el) return '';
      // 1. <label for="id">
      if (el.id) {
        const l = el.ownerDocument.querySelector('label[for="' + escapeSelector(el.id) + '"]');
        if (l && _clean(l.textContent)) return _clean(l.textContent).slice(0, 160);
      }
      // 2. wrapping <label>
      const wrap = el.closest('label');
      if (wrap && _clean(wrap.textContent)) return _clean(wrap.textContent).slice(0, 160);
      // 3. ARIA
      const aria = el.getAttribute('aria-label');
      if (_clean(aria)) return _clean(aria).slice(0, 160);
      const lb = el.getAttribute('aria-labelledby');
      if (lb) {
        const parts = lb.split(/\s+/)
          .map((id) => el.ownerDocument.getElementById(id))
          .filter(Boolean)
          .map((n) => _clean(n.textContent))
          .filter(Boolean);
        if (parts.length) return parts.join(' ').slice(0, 160);
      }
      // 4. Question group heading (fieldset legend / form-element label)
      const grp = el.closest(GROUP_SELECTOR);
      if (grp) {
        const q = grp.querySelector(LABEL_IN_GROUP);
        if (q && _clean(q.textContent)) return _clean(q.textContent).slice(0, 160);
      }
      // 5. Weak fallbacks
      const prev = el.previousElementSibling;
      if (prev && _clean(prev.textContent)) return _clean(prev.textContent).slice(0, 160);
      return _clean(el.getAttribute('placeholder') || el.name || el.id || '');
    } catch (e) {
      return '';
    }
  }

  // For a RADIO, the element's own <label> is the OPTION text ("Yes"),
  // not the question. The answer can only be derived from the group's
  // question ("Are you legally authorized to work..."), which lives on the
  // enclosing fieldset legend / radiogroup label. Option <label>s are
  // explicitly excluded here, which is why this can't just call labelFor.
  const QUESTION_IN_GROUP = 'legend, h1, h2, h3, h4, [class*="label" i], [class*="title" i], p, span';

  function questionFor(el) {
    try {
      const grp = el.closest('fieldset, [role="radiogroup"], [role="group"], [class*="form-element" i], [class*="question" i], [class*="form-group" i]');
      if (grp) {
        const aria = grp.getAttribute('aria-label');
        if (_clean(aria)) return _clean(aria).slice(0, 160);
        const lb = grp.getAttribute('aria-labelledby');
        if (lb) {
          const parts = lb.split(/\s+/)
            .map((id) => el.ownerDocument.getElementById(id))
            .filter(Boolean).map((n) => _clean(n.textContent)).filter(Boolean);
          if (parts.length) return parts.join(' ').slice(0, 160);
        }
        for (const cand of grp.querySelectorAll(QUESTION_IN_GROUP)) {
          // Skip anything that labels an individual option.
          if (cand.tagName === 'LABEL') continue;
          if (cand.querySelector('input, select, textarea')) continue;
          const t = _clean(cand.textContent);
          if (t && t.length > 3) return t.slice(0, 160);
        }
      }
    } catch (e) {}
    return labelFor(el);
  }

  // ===================================================================
  // PROFILE ANSWER MAPPING
  // Ordering is load-bearing: narrow/compound questions must be tested
  // BEFORE the broad field rules, or a sentence like "...authorized to
  // work at the stated location, what sponsorship..." gets hijacked by
  // the /location/ or /state/ rule. Each guard below encodes a real
  // mis-fill observed on a live ATS form.
  // ===================================================================
  // AN EMPTY OBJECT IS NOT THE SAME AS AN EMPTY ANSWER.
  //
  // Reducing this to Object.freeze({}) was meant to stop the autofill
  // inventing personal facts, and that part was right. But a dozen
  // rules downstream read `P.something || DEFAULTS.something`, so each
  // of them began returning `undefined` rather than '' -- a different
  // type from the one the contract promises, reaching callers that
  // expect a string.
  //
  // So every key exists, and every key that would be a CLAIM about the
  // candidate is empty: availability, relocation, remote pattern,
  // country, phone code, how they heard, work authorisation,
  // sponsorship. None of those can be known unless the profile says so.
  //
  // The four EEO questions are the exception, and not because a value
  // is guessed for them. Declining is itself one of the answers every
  // one of those forms offers, it asserts nothing whatsoever about the
  // candidate, and the questions are frequently required -- so leaving
  // them blank protects no one, it just blocks the submission. The
  // old defaults here made real claims ("I am not a protected
  // veteran", "I do not have a disability"); these do not.
  const DEFAULTS = Object.freeze({
    authorized: '', sponsorship: '', relocation: '', remote: '',
    country: '', phoneCode: '', availability: '', howHeard: '',
    gender: 'Prefer not to say', ethnicity: 'Prefer not to say',
    veteran: 'Prefer not to say', disability: 'Prefer not to say',
  });

  // Every way a form writes "I would rather not say". Treated as one
  // answer, so "Prefer not to say" finds an option reading "I don't
  // wish to answer" or "Decline to self-identify".
  const _DECLINE_RE = /^(i )?(prefer not|would rather not|do ?n(?:o|')t wish|do not wish|decline|choose not|wish not|rather not)\b|^(not disclosed|undisclosed|no answer|n\/a)$/i;
  function _isDecline(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    return !!s && _DECLINE_RE.test(s);
  }

  const ISO2_NAMES = {
    IE: 'Ireland', US: 'United States', GB: 'United Kingdom', UK: 'United Kingdom',
    CA: 'Canada', AU: 'Australia', DE: 'Germany', FR: 'France', NL: 'Netherlands',
    ES: 'Spain', IT: 'Italy', PT: 'Portugal', CH: 'Switzerland', BE: 'Belgium',
    AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
    PL: 'Poland', NZ: 'New Zealand', IN: 'India', SG: 'Singapore',
    // The rest of the EEA. Every code in _EEA needs a name here: the
    // name is how a question is matched ("...authorised to work in
    // Croatia?") AND how a country NAME from the profile resolves back
    // to its code. A code in _EEA with no name here is authorisation
    // the candidate holds and cannot prove on a form.
    BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus', CZ: 'Czechia',
    EE: 'Estonia', GR: 'Greece', HU: 'Hungary', IS: 'Iceland',
    LV: 'Latvia', LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg',
    MT: 'Malta', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  };
  // Spellings a form may use that are not the canonical name above.
  const _NAME_ALIASES = {
    'CZECH REPUBLIC': 'CZ', 'USA': 'US', 'U.S.': 'US', 'U.S.A.': 'US',
    'UNITED STATES OF AMERICA': 'US', 'AMERICA': 'US', 'GREAT BRITAIN': 'GB',
    'ENGLAND': 'GB', 'SCOTLAND': 'GB', 'WALES': 'GB', 'BRITAIN': 'GB',
    'HOLLAND': 'NL', 'THE NETHERLANDS': 'NL', 'EIRE': 'IE',
    'REPUBLIC OF IRELAND': 'IE', 'DEUTSCHLAND': 'DE',
  };

  // ===================================================================
  // WORK AUTHORISATION IS A COUNTRY-BY-COUNTRY FACT
  // -------------------------------------------------------------------
  // DEFAULTS.authorized was 'Yes' and DEFAULTS.sponsorship was 'No', and
  // both were returned for every posting on earth. For an applicant in
  // Ireland that is true of Ireland, the EEA and the UK -- the Common
  // Travel Area -- and false of the United States, Brazil, Canada and
  // everywhere else.
  //
  // It fails in the direction that LOOKS like success. A blanket "Yes,
  // authorised" and "No, no sponsorship needed" clears the knockout
  // filter, so the application progresses to a human, and the first
  // screening call establishes that the form said something untrue.
  // That does not read as a form-filling bug. It ends the conversation,
  // and at that employer it ends the next one too.
  //
  // The question almost always names the country -- "Are you legally
  // authorised to work in the United States?" -- so no extra plumbing
  // is needed to know which country is being asked about. When it names
  // one, answer for THAT country. When it does not, the posting is
  // usually local and the old default is right.
  //
  // Nothing here guesses in the applicant's favour. A country the
  // profile does not claim is answered honestly, which may cost the
  // application, which is the correct outcome for a job the applicant
  // cannot lawfully take without sponsorship.
  const _EEA = ['IE', 'DE', 'FR', 'NL', 'ES', 'IT', 'PT', 'BE', 'AT', 'SE', 'NO',
    'DK', 'FI', 'PL', 'GR', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV',
    'EE', 'LU', 'MT', 'CY', 'IS', 'LI'];

  // Which countries this applicant can work in with no sponsorship.
  // An explicit profile list always wins; otherwise it is derived from
  // where they live, using only relationships that are matters of law.
  // "IE", "ie", "Ireland" and "IRELAND" are the same claim. The profile
  // app sends ISO codes today and added a parallel country-NAMES array;
  // whichever arrives, the answer must be the ISO code the matcher
  // below compares against. An unrecognised name upper-cased to
  // "IRELAND" would never match "IE", and the miss answers a work
  // authorisation question "No" -- a knockout answer, in the one place
  // that is worse than saying nothing.
  function _toIso(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    const upper = v.toUpperCase();
    if (ISO2_NAMES[upper]) return upper;
    if (_NAME_ALIASES[upper]) return _NAME_ALIASES[upper];
    const hit = Object.keys(ISO2_NAMES).find((k) => ISO2_NAMES[k].toUpperCase() === upper);
    return hit || upper;
  }

  function authorisedCountries(p) {
    const P = p || {};
    const explicit = P.work_authorized_countries || P.workAuthorizedCountries
      || P.authorised_countries || P.authorized_countries
      || P.work_authorized_country_names || P.workAuthorizedCountryNames;
    // BOTH ARE THE USER'S OWN STATEMENT, SO BOTH COUNT.
    //
    // The country list used to win outright and stop here. The website
    // seeds that list with ['IE'], so a profile that also said "EU
    // Citizen" answered No to Germany -- a default silently overriding
    // a stated citizenship. They are unioned instead: a picked country
    // adds a US work permit the citizenship cannot imply, and a stated
    // citizenship adds the EEA the picker was never going to enumerate.
    // Neither invents anything; both were typed in by the applicant.
    const out = new Set((Array.isArray(explicit) ? explicit : []).map(_toIso).filter(Boolean));

    // CITIZENSHIP IS AN EXPLICIT ANSWER. RESIDENCE IS NOT.
    //
    // This returned an empty list for everything but a hand-written
    // country array, which is correct about residence and wrong about
    // citizenship. Living somewhere proves nothing -- a person on a
    // study visa lives in Ireland -- but HOLDING a citizenship is a
    // legal fact the applicant has stated in their own profile, and the
    // right to work that comes with it is a matter of law, not a guess:
    // an EU/EEA citizenship carries the whole EEA, and Ireland and the
    // United Kingdom carry each other under the Common Travel Area.
    //
    // Without this, every work-authorisation question on every form
    // went unanswered -- including "are you authorised to work in
    // Ireland", from an Irish citizen, where the answer is not in
    // doubt. An unanswered required question is a rejection too.
    for (const iso of _citizenshipCodes(P)) {
      out.add(iso);
      if (_EEA.indexOf(iso) !== -1) for (const c of _EEA) out.add(c);
      if (iso === 'IE' || iso === 'GB' || iso === 'UK') { out.add('IE'); out.add('GB'); out.add('UK'); }
    }
    return Array.from(out);
  }

  // Nationality as people write it: "Irish", "EU Citizen", "Ireland",
  // "IE", "Irish/British". Read ONLY from fields that state citizenship
  // or right to work -- never from country, city or location.
  const _NATIONALITY_ADJECTIVES = {
    IRISH: 'IE', BRITISH: 'GB', ENGLISH: 'GB', SCOTTISH: 'GB', WELSH: 'GB',
    AMERICAN: 'US', CANADIAN: 'CA', AUSTRALIAN: 'AU', GERMAN: 'DE', FRENCH: 'FR',
    DUTCH: 'NL', SPANISH: 'ES', ITALIAN: 'IT', PORTUGUESE: 'PT', BELGIAN: 'BE',
    AUSTRIAN: 'AT', SWEDISH: 'SE', NORWEGIAN: 'NO', DANISH: 'DK', FINNISH: 'FI',
    POLISH: 'PL', GREEK: 'GR', CZECH: 'CZ', HUNGARIAN: 'HU', ROMANIAN: 'RO',
    BULGARIAN: 'BG', CROATIAN: 'HR', SLOVAK: 'SK', SLOVENIAN: 'SI',
    LITHUANIAN: 'LT', LATVIAN: 'LV', ESTONIAN: 'EE', LUXEMBOURGISH: 'LU',
    MALTESE: 'MT', CYPRIOT: 'CY', ICELANDIC: 'IS', SWISS: 'CH',
    INDIAN: 'IN', SINGAPOREAN: 'SG', 'NEW ZEALANDER': 'NZ',
  };

  function _citizenshipCodes(p) {
    const P = p || {};
    const raw = [];
    const push = (v) => {
      if (!v) return;
      if (Array.isArray(v)) { v.forEach(push); return; }
      if (typeof v === 'string') raw.push(v);
    };
    push(P.citizenship); push(P.citizenships); push(P.nationality); push(P.nationalities);
    push(P.citizenship_status); push(P.citizenshipStatus);
    push(P.right_to_work); push(P.rightToWork);
    push(P.work_authorization); push(P.workAuthorization);
    const out = [];
    for (const entry of raw) {
      // "Irish and British", "EU Citizen / Irish", "Irish, British"
      for (const piece of String(entry).split(/[,/;]|\band\b|\bor\b/i)) {
        const token = piece.replace(/\b(citizen(ship)?|national(ity)?|passport|holder|status|dual)\b/gi, ' ')
          .replace(/\s+/g, ' ').trim();
        if (!token) continue;
        const upper = token.toUpperCase();
        if (/^(EU|EEA|EUROPEAN UNION|EUROPEAN ECONOMIC AREA|EUROPEAN)$/.test(upper)) {
          for (const c of _EEA) out.push(c);
          continue;
        }
        const adjective = _NATIONALITY_ADJECTIVES[upper];
        if (adjective) { out.push(adjective); continue; }
        const iso = _toIso(token);
        if (ISO2_NAMES[iso]) out.push(iso);
      }
    }
    return out;
  }


  // Sub-national names that identify a country on a work-authorisation
  // question. Written out rather than fetched: it is a short, stable
  // list of facts, and a form asking about "Ontario" cannot wait for a
  // network call.
  const _REGION_COUNTRY = (() => {
    const map = {};
    const add = (iso, names) => { for (const n of names) map[n.toLowerCase()] = iso; };
    add('US', ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
      'connecticut', 'delaware', 'district of columbia', 'florida', 'hawaii', 'idaho',
      'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine',
      'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
      'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico',
      'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
      'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee',
      'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
      'wisconsin', 'wyoming', 'puerto rico']);
    add('CA', ['alberta', 'british columbia', 'manitoba', 'new brunswick',
      'newfoundland', 'newfoundland and labrador', 'nova scotia', 'northwest territories',
      'nunavut', 'ontario', 'prince edward island', 'quebec', 'saskatchewan', 'yukon']);
    add('GB', ['england', 'scotland', 'wales', 'northern ireland', 'great britain']);
    add('AU', ['new south wales', 'victoria', 'queensland', 'western australia',
      'south australia', 'tasmania', 'northern territory']);
    return map;
  })();

  // The country a question is asking about, if it names one.
  function countryInQuestion(question) {
    // Punctuation stripped to spaces first. Matching on " australia "
    // against "...to work in Australia?" fails on the question mark,
    // and a country that is not detected falls through to the local
    // default -- which is the exact wrong answer this function exists
    // to prevent.
    const l = ' ' + String(question || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    for (const iso of Object.keys(ISO2_NAMES)) {
      const name = ISO2_NAMES[iso].toLowerCase();
      if (l.indexOf(' ' + name + ' ') !== -1) return iso;
    }
    // A STATE, A PROVINCE OR A HOME NATION NAMES ITS COUNTRY.
    //
    // "Are you authorized to work in California?" is a question about
    // the United States, and "the right to work in England" is one
    // about the United Kingdom. Neither matched, so both went
    // unanswered -- on a required field, from an applicant whose answer
    // was not in doubt either way. American forms name the state far
    // more often than the country.
    //
    // Georgia is deliberately absent: it is a country as well as a
    // state, and guessing wrong on a work-authorisation question is the
    // one place a guess costs the application.
    for (const region of Object.keys(_REGION_COUNTRY)) {
      if (l.indexOf(' ' + region + ' ') !== -1) return _REGION_COUNTRY[region];
    }
    for (const [re, iso] of [[/\b(the )?u\.?s\.?a?\b/, 'US'], [/\bunited states\b/, 'US'],
      [/\bu\.?k\.?\b/, 'GB'], [/\bbrazil|brasil\b/, 'BR'], [/\bcanada\b/, 'CA'],
      [/\bmexico\b/, 'MX'], [/\bjapan\b/, 'JP'], [/\bchina\b/, 'CN'],
      [/\buae|emirates\b/, 'AE'], [/\bsouth africa\b/, 'ZA'],
      [/\beuropean union|\bthe eu\b|\beea\b/, 'EU']]) {
      if (re.test(l)) return iso;
    }
    return '';
  }

  // '' when the question names no country, so the caller keeps its own
  // default and nothing changes for an ordinary local application.
  function authorisedForQuestion(question, p) {
    const iso = countryInQuestion(question);
    if (!iso) return '';
    const allowed = authorisedCountries(p);
    if (!allowed.length) return '';          // nothing known: do not guess
    if (iso === 'EU') return allowed.some((c) => _EEA.indexOf(c) !== -1) ? 'Yes' : 'No';
    return allowed.indexOf(iso) !== -1 ? 'Yes' : 'No';
  }

  // ===================================================================
  // YEARS OF EXPERIENCE
  // -------------------------------------------------------------------
  // Every "years of X" question used to get the same constant back: the
  // profile's `years` if set, otherwise a hard-coded '5'. That is the
  // single most direct auto-reject lever on an application form, and it
  // was wrong in three separate ways.
  //
  //   1. A threshold question is a YES/NO question. "Do you have 5+
  //      years of experience?" is a dropdown with two options, and
  //      writing "5" into it either fails validation or leaves the
  //      answer unset -- which scores as "requirement not met".
  //   2. The constant was answered for EVERY skill. "Years of
  //      Kubernetes?" and "Years of people management?" both got 5,
  //      regardless of whether the candidate had touched either. That is
  //      a false statement on an application, and it is grounds for
  //      withdrawing an offer later.
  //   3. '5' was invented when the profile said nothing, so a candidate
  //      with nine years was filtered out of senior roles, and one with
  //      two years was filtered out for overclaiming.
  //
  // The employment history is right there, so use it.
  // ===================================================================
  function _totalYears(p) {
    const explicit = p.years ?? p.years_experience ?? p.yearsExperience;
    if (explicit != null && String(explicit).trim() !== '') {
      const n = parseInt(String(explicit), 10);
      if (!isNaN(n) && n > 0) return n;
    }
    const exp = p.professional_experience || p.professionalExperience || p.workExperience;
    if (!Array.isArray(exp) || !exp.length) return null;

    // Merge overlapping roles rather than summing them. A contract held
    // alongside a full-time job is not two separate careers, and summing
    // them is how "9 years" becomes "14 years".
    const now = new Date();
    const spans = [];
    for (const job of exp) {
      const text = [job.dates, job.startDate, job.start_date, job.endDate, job.end_date]
        .filter(Boolean).join(' ');
      if (!text) continue;
      const ongoing = /present|current|now|ongoing/i.test(text);
      const years = String(text).match(/\b(19|20)\d{2}\b/g);
      if (!years || !years.length) continue;
      const start = parseInt(years[0], 10);
      const end = ongoing ? now.getFullYear() : parseInt(years[years.length - 1], 10);
      if (isNaN(start) || isNaN(end) || end < start) continue;
      spans.push([start, end]);
    }
    if (!spans.length) return null;
    spans.sort((a, b) => a[0] - b[0]);
    let total = 0, cursor = -Infinity;
    for (const [s, e] of spans) {
      const from = Math.max(s, cursor);
      if (e > from) { total += e - from; cursor = e; }
      else if (e > cursor) cursor = e;
    }
    return total > 0 ? total : null;
  }

  // "Do you have 5+ years..." / "at least 3 years" / "minimum of 7 years"
  // -- a threshold, not a quantity. Returns the required number, or null
  // when the question is asking "how many".
  function _yearsThreshold(l) {
    const m = l.match(/(\d{1,2})\s*\+?\s*(?:or more\s+)?years?/);
    if (!m) return null;
    const asksHowMany = /how many|number of|total years|years of experience do you have\b/.test(l)
      && !/\bdo you have\b[^?]*\b\d/.test(l);
    if (asksHowMany) return null;
    // Threshold phrasing: "do you have", "at least", "minimum", "+".
    if (/\bdo you have\b|\bat least\b|\bminimum\b|\bor more\b|\d\s*\+/.test(l)) {
      return parseInt(m[1], 10);
    }
    return null;
  }

  function _country(p) {
    let c = String(p.country || '').trim();
    if (c.includes(',')) c = c.split(',').pop().trim();     // "Dublin, Dublin, IE" -> "IE"
    if (/^[A-Za-z]{2}$/.test(c)) c = ISO2_NAMES[c.toUpperCase()] || c;
    return c || DEFAULTS.country;
  }


  // ===================================================================
  // THE PROFILE THE WEBSITE STORES IS NOT THE PROFILE THE RULES READ
  // -------------------------------------------------------------------
  // An audit of eighty label rules against the profile table found
  // fifty-three keys being read that the row never carries -- and, worse
  // than the harmless aliases among them, a dozen where the CANONICAL
  // key was the one missing:
  //
  //   the rules read      the profile stores
  //   postal_code, zip    zip_code
  //   degree              highest_education
  //   ethnicity, race     race_ethnicity
  //   drivers_license     driving_license
  //   sponsorship_required visa_required
  //   years               total_experience
  //   school, major,      inside education[]
  //     graduation_year
  //   current_company,    inside professional_experience[]
  //     current_title
  //
  // Every one of those fields came out BLANK on a real form while the
  // data sat in the profile. Postal code, degree, field of study and
  // current employer are required on most applications.
  //
  // Fixed in one place rather than by sprinkling "|| P.other_name"
  // through eighty rules: the row is adapted once into the flat shape
  // the rules expect, and the adapter is the single list of what maps
  // to what. Nothing is invented -- every derived value is copied or
  // read out of a structure the user filled in themselves.
  // ===================================================================
  const _adapted = new WeakMap();

  function _firstOf(list, keys) {
    for (const item of (Array.isArray(list) ? list : [])) {
      if (!item || typeof item !== 'object') continue;
      for (const key of keys) {
        const v = item[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
    return '';
  }

  /** True when a role in the history has no end date. */
  function _stillEmployed(list) {
    for (const job of (Array.isArray(list) ? list : [])) {
      if (!job || typeof job !== 'object') continue;
      if (job.current === true || job.is_current === true) return true;
      const text = [job.dates, job.end_date, job.endDate, job.period]
        .filter((v) => typeof v === 'string').join(' ');
      if (/\b(present|current|now|ongoing|to date)\b/i.test(text)) return true;
    }
    return false;
  }

  function normaliseProfile(p) {
    if (!p || typeof p !== 'object') return p || {};
    if (_adapted.has(p)) return _adapted.get(p);
    const out = Object.assign({}, p);
    const take = (target, ...sources) => {
      if (out[target] !== undefined && out[target] !== null && out[target] !== '') return;
      for (const src of sources) {
        if (src !== undefined && src !== null && src !== '') { out[target] = src; return; }
      }
    };
    take('postal_code', p.zip_code, p.zipCode, p.zip, p.eircode);
    take('zip', p.zip_code, p.zipCode, p.postal_code);
    take('degree', p.highest_education, p.highestEducation,
      _firstOf(p.education, ['degree', 'qualification', 'level']));
    take('ethnicity', p.race_ethnicity, p.raceEthnicity, p.race);
    take('drivers_license', p.driving_license, p.drivingLicense, p.drivers_licence);
    take('sponsorship_required', p.visa_required, p.visaRequired);
    take('years', p.total_experience, p.totalExperience, p.years_experience);
    take('school', _firstOf(p.education, ['school', 'institution', 'university', 'college', 'name']));
    take('university', out.school);
    take('major', p.field_of_study, p.fieldOfStudy,
      _firstOf(p.education, ['field_of_study', 'fieldOfStudy', 'major', 'subject', 'discipline']));
    take('graduation_year', _firstOf(p.education, ['graduation_year', 'graduationYear', 'end_year', 'year', 'dates']));
    const exp = p.professional_experience || p.professionalExperience;
    take('current_company', _firstOf(exp, ['company', 'employer', 'organisation', 'organization']));
    take('current_title', _firstOf(exp, ['title', 'role', 'position', 'job_title']));
    if (out.currently_employed === undefined && _stillEmployed(exp)) out.currently_employed = true;
    _adapted.set(p, out);
    return out;
  }

  function answerFor(label, p, opts) {
    const o = { ...(opts || {}) };
    const raw = String(label || '');
    const l = raw.toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!l) return '';
    const P = normaliseProfile(p);
    const saved = P.application_answers?.[raw];
    if (saved !== undefined && saved !== null) return String(saved);
    if (/^(are|do|did|have|has|will|would|can|could|is)\b/.test(l) && !/years/.test(l)) return yesNoFor(raw, P);

    // --- compound / trap questions FIRST -----------------------------
    // Referral-name asks for a person we don't have; the /state/ rule
    // below would otherwise write the user's region into it.
    if (/referral.*name|referr(er|ing).*name|employee.?s? .*name|name of .*(referr|employee)/.test(l)) return '';
    // "What sponsorship would you require" needs a sentence, not Yes/No.
    if (/what .*sponsor|which .*sponsor|sponsor(ship)? .*(would|do) .*(require|need)/.test(l)) {
      return P.sponsorship_details || '';
    }

    // --- open-ended motivation questions ------------------------------
    // Employers add their own questions to Easy Apply, and some form of
    // "why do you want this job" is the commonest of them. Nothing here
    // answered it: it names no field of the profile, so it fell through
    // to the '' at the end. These questions are nearly always REQUIRED,
    // so runAutoFlow stopped with 'needs-you' on a question that asserts
    // no credential and has no factual answer to get wrong -- while the
    // cover letter the user wrote for exactly this purpose sat unread in
    // the same profile.
    //
    // This has to run UP HERE, with the other traps, for the same reason
    // the referral-name rule does. "What attracts you to our company?"
    // contains the word company, and "What interests you about this
    // role?" contains the word role, so the field-name rules below claim
    // both and answer them with the user's CURRENT employer and job
    // title -- which are empty for most profiles, so the question came
    // back blank and the flow stopped anyway, having matched a rule.
    //
    // Motivation ONLY, and the boundary is the point. "Describe your
    // experience with Kubernetes" is a CLAIM about what the user has
    // done. It stays unanswered unless the profile evidences it, because
    // pasting a cover letter that never mentions Kubernetes does not
    // answer the question, it just fills the box. Stopping there is the
    // correct outcome and this must not take it away.
    if (_isMotivationQuestion(l)) return o.coverLetter || P.cover_letter || P.summary || '';

    // A SCREENING QUESTION PHRASED AS "WHY" IS STILL A SCREENING QUESTION.
    //
    // The yes/no router above only fires on questions that OPEN with an
    // auxiliary verb -- are, do, will, can. "Why do you require
    // sponsorship?" and "Why do you want to relocate?" open with "why",
    // so they fell past it, were correctly refused the cover letter by
    // the rule above, and then reached the end of the function with
    // nothing: the profile knew the answer and the box stayed empty.
    // Sponsorship, work authorisation and relocation are the three
    // polarity-critical fields on any form; an unanswered one is read
    // as a knockout.
    if (/sponsor|authoriz|authoris|right to work|eligible to work|relocat|willing to move/.test(l)) {
      const screened = yesNoFor(raw, P);
      if (screened) return screened;
    }

    // --- identity ----------------------------------------------------
    if (/first.?name|given.?name|forename/.test(l)) return P.first_name || P.firstName || '';
    if (/last.?name|family.?name|surname/.test(l)) return P.last_name || P.lastName || '';
    if (/middle.?name/.test(l)) return P.middle_name || '';
    if (/preferred.?name|nick.?name/.test(l)) return P.preferred_name || P.first_name || P.firstName || '';
    if (/full.?name|your name|legal.?name|^name$/.test(l) && !/company|user|referr|employee/.test(l)) {
      return ((P.first_name || P.firstName || '') + ' ' + (P.last_name || P.lastName || '')).trim();
    }
    if (/\bemail\b/.test(l)) return P.email || '';
    // A PHONE NUMBER IS NOT A PHONE TYPE.
    //
    // "Phone Type" is a dropdown offering Mobile, Home and Work, and it
    // was matching the /phone/ rule below -- so a live Workday form got
    // "+353 874 261 508" written into it, which is visibly wrong on a
    // submitted application. Checked before the number rule, and only
    // answered when the profile says which kind of number it is.
    if (/phone.?type|type of phone|number type/.test(l)) return P.phone_type || 'Mobile';
    if (/country.?code|phone.?code|dial.?code|calling.?code/.test(l)) {
      // Derived from the number itself when the profile has no separate
      // field for it. A required country-code select left empty blocks
      // the form, and the code is sitting in front of the number.
      const stored = P.phoneCountryCode || P.phone_country_code || DEFAULTS.phoneCode;
      if (stored) return stored;
      const m = String(P.phone || '').match(/^\s*\+(\d{1,3})/);
      return m ? '+' + m[1] : '';
    }
    if (/phone|mobile|cell|telephone/.test(l)) {
      // National when the form carries the country code separately, or
      // it arrives twice and the field is rejected. See fillContainer.
      return o.hasCountryCodeField ? _nationalPhone(P.phone, P.phoneCountryCode) : (P.phone || '');
    }

    // --- location ----------------------------------------------------
    if (/^city$|\bcity\b|current.?city/.test(l)) return P.city || '';
    // "state" as a NOUN only -- never "please state the...", "stated location".
    // "Country/Region" is a country field, not a region field, and it is
    // one of the commonest labels on LinkedIn Easy Apply. Matching
    // /region/ first sent it to the state rule, which returned the user's
    // state -- empty for most profiles -- so a required field was left
    // blank and the flow stalled on it.
    if (/\b(state|province|region|county)\b/.test(l)
        && !/country|nationality|citizenship/.test(l)
        && !/please state|stated\b|state[sd] (the|your|why|how|what|any)/.test(l)) {
      return P.state || '';
    }
    if (/zip|postal|eircode|post.?code/.test(l)) return P.postal_code || P.zip || '';
    if (/nationality|citizenship/.test(l)) return P.nationality || P.citizenship || '';
    if (/country/.test(l) && !/code|phone|dial/.test(l)) return _country(P);
    if (/address|street/.test(l) && !/email/.test(l)) return P.address || '';
    // Location FIELDS only -- not eligibility questions mentioning "location".
    if (/location|where .*(you|do you) (live|based|located|reside)|where are you|based in|current.?residence/.test(l) && !/authoriz|authoris|sponsor|relocat|eligib|stated|willing/.test(l)) {
      return P.city ? (P.city + (P.state ? ', ' + P.state : '')) : '';
    }

    // --- links / education / work ------------------------------------
    if (/linkedin/.test(l)) return P.linkedin || P.linkedin_profile_url || '';
    if (/github/.test(l)) return P.github || P.github_url || '';
    if (/website|portfolio|personal.?url|personal.?site/.test(l)) return P.website || P.portfolio || P.website_url || '';
    if (/university|school|college|institution|alma.?mater/.test(l)) return P.school || P.university || '';
    // "Highest level of education completed" is the same question as
    // "Degree" and was matching neither.
    if (/\bdegree\b|qualification level|level of education|education level|highest.*education/.test(l)) return P.degree || '';
    if (/major|field.?of.?study|discipline|concentration/.test(l)) return P.major || '';
    if (/\bgpa\b|grade.?point/.test(l)) return P.gpa || '';
    if (/graduation|grad.?year|grad.?date/.test(l)) return P.graduation_year || P.grad_year || '';
    if (/company|employer|organisation|organization/.test(l) && !/why|about/.test(l)) return P.current_company || P.company || '';
    // "role" appears inside eligibility questions ("...of this role?").
    if (/job.?title|current.?title|\btitle\b|\bposition\b|\brole\b/.test(l) && !/company|authoriz|authoris|eligib|sponsor|apply|hear|why/.test(l)) {
      return P.current_title || P.title || '';
    }

    // --- standard screening answers ----------------------------------
    if (/years .*(experience|exp)|experience .*years|how many years/.test(l)) {
      const total = _totalYears(P);
      const threshold = _yearsThreshold(l);
      // "Years of experience with Kubernetes" asks about one tool, not a
      // career. Answering the career total claims years of something the
      // candidate may never have touched -- a false answer to a scored
      // screening question, and grounds for withdrawing an offer later.
      // _skillSubject/_profileMentions are the same pair the yes/no path
      // already uses for "do you have experience with X".
      const subject = _skillSubject(l);
      if (subject && !_profileMentions(P, subject)) return '';
      // "Do you have 5+ years?" is a Yes/No field. Writing a number into
      // it fails validation or leaves it unset, which scores as
      // "requirement not met".
      if (threshold != null) {
        if (total == null) return '';          // unknown: let the user answer
        return total >= threshold ? 'Yes' : 'No';
      }
      if (total != null) return String(total);
      // Nothing to compute from. Leave it blank rather than invent a
      // number: a wrong answer here is a knockout, and a false one is
      // grounds for withdrawing an offer later.
      return P.years ? String(P.years) : '';
    }
    if (/authoriz|authoris|legally .*(work|entitled)|eligible to work|right to work|work .*(right|permit).*(yes|no)?/.test(l)) {
      const byCountry = authorisedForQuestion(label, P);
      return byCountry || P.work_authorized || DEFAULTS.authorized;
    }
    if (/sponsor|visa|immigration|work.?permit/.test(l)) {
      // Sponsorship is the same fact asked the other way round.
      const byCountry = authorisedForQuestion(label, P);
      if (byCountry) return byCountry === 'Yes' ? 'No' : 'Yes';
      return P.sponsorship || DEFAULTS.sponsorship;
    }
    if (/relocat|willing to move/.test(l)) return DEFAULTS.relocation;
    if (/remote|work from home|hybrid|on.?site/.test(l)) return DEFAULTS.remote;
    if (/notice.?period|how soon|when can you start|available .*start|start.?date|availab/.test(l)) {
      return P.notice_period || DEFAULTS.availability;
    }
    if (/salary|compensation|desired pay|expected pay|rate/.test(l)) return P.expected_salary || '';
    if (/how .*hear|where .*(find|learn|discover)|source of|^source$|\bsource\b|\breferred\b/.test(l) && !/open source/.test(l)) return P.how_heard || DEFAULTS.howHeard;
    if (/gender|\bsex\b|pronoun/.test(l)) return P.gender || DEFAULTS.gender;
    // The other two EEO questions. Same reasoning as gender and
    // ethnicity: declining is one of the answers the form itself
    // offers, it asserts nothing, and the question is often required.
    if (/hispanic|latino|latinx/.test(l)) return P.hispanic_latino === true ? 'Yes' : DEFAULTS.ethnicity;
    if (/lgbt|sexual orientation|transgender/.test(l)) return P.lgbtq || DEFAULTS.gender;
    if (/ethnic|\brace\b|racial|heritage/.test(l)) return P.ethnicity || P.race || DEFAULTS.ethnicity;
    if (/veteran|military|armed forces/.test(l)) return P.veteran || DEFAULTS.veteran;
    if (/disabilit/.test(l)) return P.disability || DEFAULTS.disability;
    if (/\bage\b|over 18|at least 18|18 years/.test(l)) return '';
    if (/convicted|criminal|felony/.test(l)) return P.criminal_record || '';
    if (/drivers? licen[sc]e/.test(l)) return P.drivers_license || '';
    if (/security clearance/.test(l)) return P.security_clearance || '';
    if (/languages?|fluen/.test(l)) return P.languages || '';
    if (/skills/.test(l) && !/soft/.test(l)) return Array.isArray(P.skills) ? P.skills.slice(0, 12).join(', ') : (P.skills || '');
    if (/cover.?letter|message to|additional info|anything else/.test(l)) return o.coverLetter || P.cover_letter || '';
    if (/summary|about (yourself|you)|\bbio\b/.test(l)) return P.summary || P.cover_letter || '';
    // Date range fields: require a date-shaped label. Bare \bto\b/\bfrom\b
    // matched any sentence containing those words ("authorized TO work").
    if (/^from$|from (date|month|year)|start (date|month)/.test(l) && !/salary|pay/.test(l)) {
      return P.work_start_year ? ('01/' + P.work_start_year) : '';
    }
    if (/^to$|to (date|month|year)|end (date|month)/.test(l) && !/salary|pay|email/.test(l)) {
      return P.work_end_year ? ('12/' + P.work_end_year) : '';
    }
    if (/agree|acknowledge|consent|certif|attest|confirm/.test(l)) return '';
    return '';
  }

  /**
   * Is this asking why the user wants the role, rather than what they
   * have done? Only the first kind can be answered from prose the user
   * has already written.
   */
  function _isMotivationQuestion(l) {
    // Naming a specific skill or tool makes it a claim, not a motivation.
    if (_skillSubject(l)) return false;
    // Anything with a factual answer of its own is not motivation, even
    // when it is phrased as an open question.
    if (/how many|how much|years? of|rate your|level of|proficien|certif|licen[sc]e|salary|compensation|notice period|start date|available/.test(l)) return false;
    // Nor is anything the extension answers AUTHORITATIVELY further down.
    // This rule runs early, so without these it wins over the rules that
    // own these fields: "Why do you require sponsorship?" came back as
    // the cover letter instead of the sponsorship answer, and so did
    // "Why are you authorized to work in the US?". Those two are the
    // polarity-critical fields this file warns about, and a cover letter
    // is not an answer to either. Relocation and travel are preferences
    // held in the profile. "Why are you leaving?" stays out because the
    // honest answer is the user's, not a marketing paragraph.
    if (/sponsor|visa|authoriz|authoris|eligib|work permit|relocat|commut|travel|criminal|convict|background check|drug|clearance|leaving/.test(l)) return false;
    // "interest in" is anchored to the job itself. Left open it would
    // swallow "what is your interest in Kubernetes", which is a claim.
    return /why (do|would|are|should) (you|we)\b|why this|why our|why us\b|why work|what (interests|attracts|excites|motivates|appeals)|what makes you|good fit|right fit|best fit|suitable for this|interest in (this|our|the) (role|position|job|company|team|opportunity|vacancy)|tell us (why|about your interest)/.test(l);
  }

  // ===================================================================
  // YES / NO QUESTIONS
  // -------------------------------------------------------------------
  // A Yes/No control can only accept "Yes" or "No". answerFor answers by
  // FIELD, which is right for a text input and useless here: "Are you able
  // to commute to this job's location?" resolves to "Dublin", no option
  // matches, the field stays empty, and the Easy Apply flow stops on it as
  // an unanswered required question. These rules answer the QUESTION.
  //
  // Two things this must never get wrong:
  //   POLARITY. "Do you require sponsorship?" and "Are you authorised to
  //   work here?" are opposites and both contain the word "work". A
  //   flipped answer is a lie told to an employer in the user's name, so
  //   sponsorship is tested first and the "without sponsorship" phrasing
  //   is inverted explicitly.
  //
  //   CLAIMS. A question about whether the user HAS a skill, a licence or
  //   a qualification is answered from the profile, never assumed. When
  //   the profile does not say, this returns '' and the flow stops and
  //   asks -- which is the correct outcome. Answering "Yes" to be helpful
  //   would be inventing a credential.
  // ===================================================================
  function _pref(v, dflt) {
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (/^(y|yes|true|1)$/.test(s)) return 'Yes';
    if (/^(n|no|false|0)$/.test(s)) return 'No';
    return dflt;
  }

  /** Does the profile evidence this skill/tool/language? */
  function _profileMentions(P, term) {
    const t = _norm(term);
    if (!t || t.length < 2) return false;
    const hay = _norm([
      Array.isArray(P.skills) ? P.skills.join(' ') : (P.skills || ''),
      P.summary || '', P.current_title || P.title || '',
      P.languages || '', P.certifications || '', P.cover_letter || '',
    ].join(' '));
    return hay.indexOf(t) !== -1;
  }

  // The subject of "do you have experience with X" / "are you proficient
  // in X" -- what has to be checked against the profile before claiming it.
  function _skillSubject(l) {
    const m = l.match(/(?:experience (?:with|in|using)|proficien(?:t|cy) (?:with|in)|familiar with|worked with|knowledge of|skilled in|expertise (?:with|in))\s+(.+)$/);
    if (!m) return '';
    return m[1].replace(/\b(and|or|the|a|an|any|for|to|this|role|position|please|select|years?)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function yesNoFor(question, p) {
    const P = normaliseProfile(p);
    const l = String(question || '').toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!l) return '';

    // --- polarity pair, sponsorship first ----------------------------
    if (/sponsor|visa|work permit|employment pass|immigration status/.test(l)) {
      // "...work WITHOUT sponsorship", "...do NOT require sponsorship"
      // are the same question asked the other way round.
      // "without sponsorship", "without requiring visa sponsorship",
      // "without the need for employer sponsorship" -- all the same
      // inversion, so match across the words between the two.
      // The country the question names outranks any stored preference:
      // "do you require sponsorship to work in the United States" is a
      // question about the United States, not about the applicant's
      // usual answer.
      // THE COUNTRY ON THE FORM OUTRANKS THE STORED PREFERENCE.
      //
      // "Do you require sponsorship to work in the United States" is a
      // question about the United States. An applicant with the right
      // to work in Ireland requires sponsorship there, whatever a
      // country-less `sponsorship_required` flag says -- and the flag
      // was the only thing being read, with the country-aware answer
      // computed and then discarded on the line below it.
      const byCountry = authorisedForQuestion(question, P);
      const named = countryInQuestion(question);
      const needsSponsor = byCountry
        ? (byCountry === 'Yes' ? 'No' : 'Yes')
        : (named ? '' : _pref(P.sponsorship_required, ''));
      if (!needsSponsor) return '';
      if (/without[a-z ]{0,30}sponsor|not require|dont require|do not need|no sponsor/.test(l)) {
        // Inverted phrasing, so invert the SAME answer rather than
        // defaulting separately -- defaulting to the opposite here made
        // the two phrasings contradict each other.
        return needsSponsor === 'Yes' ? 'No' : 'Yes';
      }
      return needsSponsor;
    }
    if (/authoriz|authoris|legally (?:able|entitled|permitted|allowed)|right to work|eligible to work|permission to work|permitted to work/.test(l)) {
      const byCountry = authorisedForQuestion(question, P);
      if (byCountry) return byCountry;
      // A COUNTRY-LESS FLAG CANNOT ANSWER A QUESTION ABOUT A COUNTRY.
      //
      // "Do you have the unrestricted right to work for any employer in
      // the United States?" was being answered from `work_authorized`,
      // a boolean that means "I can work where I live". On a US posting
      // that produced a confident Yes from an applicant with EU
      // citizenship and no US status: a false statement on an
      // application, of the kind that withdraws an offer after it is
      // made. If the question names a country the saved list does not
      // cover, it goes unanswered.
      if (countryInQuestion(question)) return '';
      return _pref(P.work_authorized, '');
    }

    // --- location / working pattern ----------------------------------
    // "commute" is the one that used to resolve to the user's city.
    if (/commut|travel to (?:the )?(?:office|site)|report to (?:the )?office/.test(l)) return '';
    if (/relocat|willing to move/.test(l)) return _pref(P.willing_to_relocate, '');
    if (/remote|work from home|hybrid|on ?site|in ?office|in person/.test(l)) return '';

    // --- this employer, specifically ---------------------------------
    // "Have you worked here before" is not "are you employed" -- and a
    // wrong Yes here is a claim about a relationship that can be checked.
    if (/(?:current(?:ly)?|previous(?:ly)?|former(?:ly)?|ever) .{0,24}(?:employee|employed|worked|intern)\b.{0,4}(?:at|for|with|by|of)\b/.test(l)
        || /(?:employee|worked|intern) (?:at|for|with|of) (?:this|our) (?:company|organi)/.test(l)) {
      return _pref(P.worked_here_before, '');
    }
    if (/related to|family member|relative .{0,20}(?:work|employ)|know anyone who works/.test(l)) return '';
    if (/referred by|were you referred|employee referral/.test(l)) return _pref(P.was_referred, '');
    if (/currently employed|are you working/.test(l)) return _pref(P.currently_employed, '');

    // --- claims: answered from the profile or not at all -------------
    const subject = _skillSubject(l);
    if (subject) return _profileMentions(P, subject) ? 'Yes' : '';
    if (/do you (?:speak|write)|fluent|proficiency in|native speaker/.test(l)) {
      const lang = (l.match(/(?:speak|fluent in|proficiency in|write)\s+([a-z ]+)/) || [])[1] || '';
      if (lang && _profileMentions(P, lang.trim())) return '';
      return '';
    }
    if (/do you (?:have|hold) (?:a|an) .{0,30}(?:degree|diploma|certification|qualification|licen[sc]e|clearance|passport)/.test(l)
        || /have you completed|do you possess/.test(l)) {
      const what = (l.match(/(?:have|hold|possess|completed) (?:a|an|the)?\s*(.+)$/) || [])[1] || '';
      if (/driver/.test(l)) return _pref(P.drivers_license, '');
      if (/degree|diploma|bachelor|master/.test(l)) return P.degree || P.school || P.university ? 'Yes' : '';
      return what && _profileMentions(P, what) ? 'Yes' : '';
    }

    // --- standard screening ------------------------------------------
    if (/\b(?:over|at least|older than|minimum of)\b.{0,12}\b(?:18|16|21)\b|age of majority|legal working age/.test(l)) return '';
    if (/convicted|felony|criminal (?:record|history|convict)|pleaded guilty/.test(l)) return _pref(P.criminal_record, '');
    if (/background check|drug (?:test|screen)|reference check|credit check|right to represent/.test(l)) return '';
    if (/agree|acknowledge|consent|certif|attest|confirm|understand and accept|terms/.test(l)) return '';
    if (/available to start|able to start|can you start|start (?:on|by|immediately)/.test(l)) return '';
    if (/require .{0,20}(?:accommodation|adjustment)/.test(l)) return _pref(P.needs_accommodation, '');
    // The EEO pair again, reached through the yes/no path because both
    // are usually written as questions. Declining is one of the offered
    // answers on every one of these forms and claims nothing.
    if (/veteran|armed forces|military service/.test(l)) return _pref(P.veteran_status, DEFAULTS.veteran);
    if (/disabilit/.test(l)) return _pref(P.disability_status, DEFAULTS.disability);
    // Reached through this path because both are usually written as
    // questions -- "Are you Hispanic or Latino?", "Do you identify as
    // LGBTQ+?" -- and both were falling to the end and answering
    // nothing on a required EEO block.
    if (/hispanic|latino|latinx/.test(l)) return _pref(P.hispanic_latino, DEFAULTS.ethnicity);
    if (/lgbt|sexual orientation|transgender/.test(l)) return P.lgbtq || DEFAULTS.gender;
    if (/willing to|are you able to|can you |comfortable (?:with|working)/.test(l)) return '';

    return '';
  }

  /**
   * Is this control a Yes/No control? Placeholder options are ignored;
   * anything with a third real answer ("Prefer not to say") is not, and
   * must keep going through the general mapping.
   */
  function isYesNoOptions(texts) {
    const vals = (texts || []).map(_norm)
      .filter((t) => t && !/^(select|choose|please|pick|--)/.test(t));
    if (!vals.length || vals.length > 2) return false;
    return vals.every((t) => t === 'yes' || t === 'no');
  }

  // ===================================================================
  // FILL PRIMITIVES (React/Angular-safe)
  // ===================================================================
  function isVisible(el) {
    try {
      if (!el || el.disabled || el.readOnly) return false;
      if (el.type === 'hidden') return false;
      const st = el.ownerDocument.defaultView.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      return !(r.width === 0 && r.height === 0);
    } catch (e) {
      return false;
    }
  }

  /**
   * A field that says maxlength="300" REJECTS a 2000-character answer.
   *
   * maxlength constrains TYPING. Assigning through the native setter
   * below bypasses it entirely, so the long value lands in the box, the
   * site's own validator then refuses it, and the step will not advance
   * -- with the field visibly full. That reads as the form being broken
   * rather than the answer being too long, and nothing in the extension
   * read maxlength anywhere, so the longest answers we have (the cover
   * letter, the summary) were the ones most likely to be silently
   * rejected.
   */
  function _clampToMaxLength(el, value) {
    const s = String(value == null ? '' : value);
    const max = Number(el && el.maxLength);
    // Absent attribute reads as -1; a select has none at all.
    if (!isFinite(max) || max <= 0 || s.length <= max) return s;
    const cut = s.slice(0, max);
    // Prefer a sentence end, then a word boundary. A truncation through
    // the middle of a word is read by a person and looks like a fault.
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (stop > max * 0.6) return cut.slice(0, stop + 1).trim();
    const space = cut.lastIndexOf(' ');
    return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
  }

  // Frameworks track value via the native setter; assigning .value
  // directly leaves their internal state stale and the value reverts.
  // A VALUE THAT CANNOT BE RIGHT FOR THIS FIELD IS NOT WRITTEN.
  //
  // A Greenhouse form came back with a first name in the Email box and
  // the form's own validator saying "Please enter a valid email
  // address". Whatever mismatched the label -- and on a form that
  // stacks "Preferred First Name" directly above "Email" there are
  // several ways to -- the write itself was checkable and was not
  // checked. The field states its own type, in three places, and an
  // email field can only hold an email.
  //
  // A blocked write leaves the box EMPTY, which the form then flags for
  // the user to fill. That is strictly better than a wrong value the
  // form accepts, or a wrong value the user has to notice and clear.
  function _fieldKind(el) {
    try {
      const hay = ((el.type || '') + ' ' + (el.name || '') + ' ' + (el.id || '') + ' '
        + (el.getAttribute && (el.getAttribute('autocomplete') || '') || '') + ' '
        + (el.getAttribute && (el.getAttribute('inputmode') || '') || '')).toLowerCase();
      if (/\bemail\b/.test(hay)) return 'email';
      if (/\b(tel|phone|mobile)\b/.test(hay)) return 'phone';
      if (/\burl\b/.test(hay) || /linkedin|website|portfolio/.test(hay)) return 'url';
      return '';
    } catch (e) { return ''; }
  }

  function valueFitsField(el, value) {
    const v = String(value == null ? '' : value).trim();
    if (!v) return true;                       // clearing is always allowed
    switch (_fieldKind(el)) {
      case 'email': return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v);
      // Enough digits to be a phone number. "+1 202 555 0100" and
      // "2025550100" pass; a name or a single digit does not.
      case 'phone': return (v.replace(/\D/g, '').length >= 7);
      case 'url': return /^(https?:\/\/|www\.)|\.[a-z]{2,}(\/|$)/i.test(v);
      default: return true;
    }
  }

  function setValue(el, value) {
    if (!valueFitsField(el, value)) {
      try {
        console.warn('[JG-Autofill] Refused to write "' + String(value).slice(0, 40)
          + '" into a ' + _fieldKind(el) + ' field -- it is not a valid '
          + _fieldKind(el) + ', so the box is left for you to fill.');
      } catch (e) {}
      return false;
    }
    const clamped = _clampToMaxLength(el, value);
    try {
      const proto = el.tagName === 'TEXTAREA'
        ? global.HTMLTextAreaElement.prototype
        : global.HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, clamped);
      else el.value = clamped;
    } catch (e) {
      el.value = clamped;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return String(el.value) === String(clamped);
  }

  function _norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /**
   * The number without its country code, for a form that asks for the
   * code separately.
   *
   * Strips the stored code when the number carries it, so "+1 202 555 0100" with a code of "+1" becomes "202 555 0100". Falls back to
   * removing a leading + and one to three digits when no code is stored.
   * The remaining digits are never altered: only the prefix is removed,
   * and a number that does not start with a code is returned untouched.
   */
  function _nationalPhone(phone, countryCode) {
    const raw = String(phone == null ? '' : phone).trim();
    if (!raw || raw.charAt(0) !== '+') return raw;
    const cc = String(countryCode || '').replace(/\D/g, '');
    if (cc) {
      const digits = raw.replace(/[^\d]/g, '');
      if (digits.indexOf(cc) === 0) {
        // Walk the original, dropping characters until the country
        // code's digits are consumed, so the rest keeps its grouping.
        let seen = 0, i = 1;
        while (i < raw.length && seen < cc.length) {
          if (/\d/.test(raw.charAt(i))) seen++;
          i++;
        }
        return raw.slice(i).trim();
      }
    }
    return raw; // Cannot infer a dialing prefix from an unseparated number.
  }

  // Option matching that understands yes/no semantics -- the single most
  // common dropdown/radio answer on application forms.
  function optionMatches(optText, want) {
    const o = _norm(optText);
    const w = _norm(want);
    if (!o || !w) return false;
    if (o === w) return true;
    if (w === 'yes' || w === 'no') return o === w || o.startsWith(w + ' ');
    return false; // Ambiguous partial matches must be reviewed, not guessed.
  }

  // "IRELAND" AND "IRELAND (IE)" ARE THE SAME ANSWER.
  //
  // Exact-only matching is right for the general case -- guessing at a
  // partial overlap is how "Java" ends up selected for "JavaScript".
  // But a great many dropdowns qualify their labels after a separator:
  // "Ireland (IE)", "Dublin, County Dublin, Ireland", "Bachelor's
  // Degree - Honours". Refusing all of those leaves required fields
  // empty on forms where the right option is sitting in the list.
  //
  // So: a match only where the wanted value is the option's LEADING
  // segment, cut on a real separator. Never a substring in the middle,
  // never a prefix inside a word -- "United States" cannot claim
  // "United States Minor Outlying Islands", because no separator
  // follows. Callers apply it only when exactly one option qualifies,
  // so "Korea, Republic of" and "Korea, Democratic..." cancel out
  // rather than one of them being picked at random.
  function optionStartsWith(optText, want) {
    // The separator IS the evidence, so this cannot use _norm -- that
    // strips punctuation to spaces, which is exactly the difference
    // between "Ireland (IE)" and "United States Minor Outlying
    // Islands".
    const flat = (s) => String(s || '').toLowerCase()
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ').trim();
    const o = flat(optText);
    const w = flat(want);
    if (!o || !w || o === w || w.length < 3) return false;
    if (!o.startsWith(w)) return false;
    return /^ ?[,(\[\-–—/|:;]/.test(o.slice(w.length));
  }

  /** The one option that matches, exactly if possible, by leading segment if not. */
  function soleMatch(options, value, textOf) {
    const text = textOf || ((o) => o.textContent);
    for (const o of options) {
      if (optionMatches(text(o), value)) return o;
    }
    const near = options.filter((o) => optionStartsWith(text(o), value));
    if (near.length === 1) return near[0];
    // "Prefer not to say" and "I don't wish to answer" are the same
    // answer written by two different form designers. Matched only when
    // the form offers exactly one way of declining, so nothing else can
    // be picked up by it.
    if (_isDecline(value)) {
      const declines = options.filter((o) => _isDecline(text(o)));
      if (declines.length === 1) return declines[0];
    }
    return null;
  }

  function fillSelect(el, value) {
    if (!el.options || !el.options.length) return false;
    // Skip if a real (non-placeholder) option is already chosen.
    const cur = el.options[el.selectedIndex];
    if (cur && cur.value && !/select|choose|^--|please/i.test(cur.textContent || '')) return false;
    const choosable = Array.prototype.slice.call(el.options)
      .filter((opt) => !opt.disabled && !(opt.parentElement && opt.parentElement.disabled) && opt.value);
    // Exact on the label, then exact on the value, then -- only when
    // one option qualifies -- the leading-segment rule that lets
    // "Ireland" select "Ireland (IE)".
    const best = soleMatch(choosable, value)
      || soleMatch(choosable, value, (opt) => opt.value);
    if (!best) return false;
    const proto = el.ownerDocument.defaultView.HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, best.value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value === best.value;
  }

  function fillRadioGroup(doc, name, value) {
    if (!name) return false;
    const group = doc.querySelectorAll('input[type="radio"][name="' + escapeSelector(name) + '"]');
    if (!group.length) return false;
    for (const r of group) if (r.checked) return false;   // already answered
    for (const r of group) {
      const t = labelFor(r) || r.value;
      if (!r.disabled && isVisible(r) && optionMatches(t, value)) { r.click(); return r.checked; }
    }
    return false;
  }

  // Custom (non-<select>) dropdowns: LinkedIn/Ashby/Greenhouse render a
  // button + listbox. Open it, pick the matching option, and bail out
  // cleanly if the listbox never appears.
  async function fillCustomDropdown(el, value, options = {}) {
    try {
      const doc = el.ownerDocument;
      const isInput = el.tagName === 'INPUT';
      const previous = el.value || '';
      if (previous || el.getAttribute('aria-disabled') === 'true') return false;
      el.click();
      try { el.focus(); } catch (e) {}

      // A typeahead (LinkedIn's artdeco combobox, and most modern ATS)
      // is an <input role="combobox">. Typing is what makes its listbox
      // appear and filter; without it there is nothing to pick from.
      if (isInput) {
        setValue(el, value);
        el.dispatchEvent(new KeyboardEvent('keydown', { key: value.slice(-1), bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: value.slice(-1), bubbles: true }));
      }
      // THE SUGGESTIONS DO NOT ARRIVE IN 350 MILLISECONDS.
      //
      // Greenhouse's Location field, and every other typeahead backed
      // by a geo or skills API, fetches its list over the network after
      // the first keystroke. One fixed sleep read the listbox before it
      // existed, found nothing, and fell through to the revert below --
      // which is how a required Location came out empty, flagged
      // "Please enter your location", on a form the extension had
      // otherwise filled correctly.
      //
      // The listbox is usually rendered at body level and tied to the
      // control by aria-controls/aria-owns, so the control's own
      // subtree holds nothing. The referenced box is preferred, but the
      // document-wide fallback now runs whether or not aria-controls is
      // present: plenty of widgets name a wrapper that stays empty
      // until the fetch lands and render the real list in a portal.
      const listOptions = () => {
        let found = [];
        const owns = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
        if (owns) {
          for (const id of owns.split(/\s+/)) {
            const box = doc.getElementById(id);
            if (box) found.push(...box.querySelectorAll('[role="option"], li, [class*="option" i]'));
          }
        }
        if (!found.length) {
          found = Array.prototype.slice.call(
            doc.querySelectorAll('[role="option"], li[role="option"], [class*="option" i][role]'));
        }
        return found.filter((o) => isVisible(o) && o.getAttribute('aria-disabled') !== 'true');
      };

      let opts = [];
      const deadline = Date.now() + 1500;
      do {
        await new Promise((r) => setTimeout(r, 120));
        if (options.shouldContinue && !options.shouldContinue()) {
          if (isInput) setValue(el, previous);
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return false;
        }
        opts = listOptions();
        if (soleMatch(opts, value)) break;
      } while (Date.now() < deadline);

      const chosen = soleMatch(opts, value);
      if (chosen) {
        chosen.click();
        await new Promise((r) => setTimeout(r, 120));
        // A widget that reports its own state is believed. One that
        // reports nothing is judged on what the control now shows: a
        // click that put the value into the box IS the selection, and
        // demanding aria-selected as well threw those away.
        const shown = isInput ? el.value : el.textContent;
        if (chosen.getAttribute('aria-selected') === 'true'
          || el.getAttribute('aria-expanded') === 'false'
          || optionMatches(shown, value) || optionStartsWith(shown, value)) return true;
      }

      // NOTHING MATCHED, AND AN EMPTY REQUIRED FIELD IS NOT THE SAFER ANSWER.
      //
      // Wiping the box was meant to stop uncommitted filter text
      // passing for a selection. On a free-text typeahead -- which is
      // what a Location field is -- the typed value IS the answer: it
      // came from the saved profile, it is the applicant's own city,
      // and blanking it turns a filled form into one that will not
      // submit. Enter goes first, so a widget holding a highlighted
      // suggestion commits it; the value is then left in place and the
      // field blurred.
      //
      // A combobox that is not an input has no such answer to leave --
      // typed text means nothing there -- so it is still reverted, and
      // so is a box holding anything other than what we typed.
      if (isInput && String(el.value || '').trim() && optionMatches(el.value, value)) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }
      if (isInput) setValue(el, previous);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Fill every fillable control inside `root`.
   * Honest by construction: never overwrites a value the user already
   * entered, never ticks a checkbox that isn't an explicit consent, and
   * never clicks a submit control.
   */
  async function fillContainer(root, profile, opts) {
    const o = { ...(opts || {}) };
    const doc = (root && root.ownerDocument) || document;
    const scope = root || doc;
    const seenRadio = new Set();
    let filled = 0;
    // Counted so callers can tell "nothing to do" apart from "nothing
    // found". A step whose fields the site already prefilled reports
    // filled=0, which is success, not failure.
    let alreadySet = 0;
    let answerable = 0;

    const controls = scope.querySelectorAll('input, select, textarea, [role="combobox"], [aria-haspopup="listbox"]');

    // DOES THIS FORM ASK FOR THE COUNTRY CODE SEPARATELY?
    //
    // Workday does, and most enterprise forms do. When it has its own
    // control, the number field must NOT repeat it, or the form receives
    // +353 twice over. From a real application, with Country Phone Code
    // already set to Ireland (+353) and the number field filled from the
    // profile:
    //
    //   +1 202 555 0100
    //   Error: Enter a phone number in the valid format. The number
    //   isn't recognized. Verify the country phone code and number.
    //
    // A required field, rejected, on a form the user cannot submit. So
    // the number is passed to answerFor as national when, and only when,
    // the country code has somewhere else to go.
    let hasCountryCodeField = false;
    for (const el of controls) {
      try {
        const l = String(labelFor(el) || '').toLowerCase();
        if (/country.?code|phone.?code|dial.?code|calling.?code/.test(l)) {
          hasCountryCodeField = true;
          break;
        }
      } catch (e) {}
    }
    if (hasCountryCodeField) o.hasCountryCodeField = true;

    for (const el of controls) {
      if (o.shouldContinue && !o.shouldContinue()) break;
      try {
        const type = (el.type || '').toLowerCase();
        const customDropdown = el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox';
        if (['hidden', 'file', 'submit', 'reset', 'image', 'password'].includes(type) || (type === 'button' && !customDropdown)) continue;
        if (!isVisible(el)) continue;

        // Radios must resolve the GROUP question; their own label is just
        // the option text ("Yes"/"No") and yields no answer.
        const label = (type === 'radio') ? questionFor(el) : labelFor(el);
        if (!label) continue;

        // A control that only offers Yes and No has to be answered as a
        // QUESTION, not as a field. Asked as a field, "are you able to
        // commute to this location?" resolves to the user's city, no
        // option matches, and the step stalls on a required question.
        let boolOpts = null;
        if (el.tagName === 'SELECT') {
          boolOpts = Array.prototype.map.call(el.options, (op) => op.textContent);
        } else if (type === 'radio' && el.name) {
          boolOpts = Array.prototype.map.call(
            doc.querySelectorAll('input[type="radio"][name="' + escapeSelector(el.name) + '"]'),
            (r) => labelFor(r) || r.value
          );
        } else if (type === 'checkbox') {
          boolOpts = null;                       // a checkbox is its own consent path
        }

        let value = '';
        if (boolOpts && isYesNoOptions(boolOpts)) {
          value = yesNoFor(label, profile);
          // Fall back only if the general mapping produces a usable
          // Yes/No; anything else would never match an option anyway.
          if (!value) {
            const generic = answerFor(label, profile, o);
            if (/^(yes|no)$/i.test(String(generic).trim())) value = generic;
          }
        } else {
          value = answerFor(label, profile, o);
        }
        if (!value) continue;
        answerable++;

        if (el.tagName === 'SELECT') {
          if (fillSelect(el, value)) filled++;
        } else if (type === 'radio') {
          if (el.name && !seenRadio.has(el.name)) {
            seenRadio.add(el.name);
            if (fillRadioGroup(doc, el.name, value)) filled++;
          }
        } else if (type === 'checkbox') {
          // Only affirmative consent boxes -- never opt-ins to marketing.
          if (o.allowConsent === true && !el.checked && /^(yes|true)$/i.test(String(value)) && /agree|acknowledge|consent|certif|attest|confirm|terms|privacy/i.test(label) && !/marketing|subscribe|newsletter/i.test(label)) {
            el.click();
            filled++;
          }
        } else if (customDropdown) {
          // Inputs included. An <input role="combobox"> is a typeahead --
          // LinkedIn's Easy Apply shape -- and a plain setValue types the
          // text without ever committing a selection, so the step stays
          // invalid and the flow stalls on a field that looks filled.
          if (String(el.value || '').trim()) { alreadySet++; continue; }
          if (await fillCustomDropdown(el, value, o)) filled++;
        } else {
          if (String(el.value || '').trim()) { alreadySet++; continue; }  // respect user input
          if (setValue(el, value)) filled++;
        }
      } catch (e) { /* one bad field must never abort the pass */ }
    }
    // answerable = fields we had an answer for; alreadySet = of those, the
    // ones the site had already populated. filled=0 with alreadySet>0 means
    // the step was complete, not that the fill failed.
    return { filled, alreadySet, answerable };
  }

  // Shared profile loader: Job Genie profile merged with the autofill
  // engine's editable copy (the latter wins for fields the user set).
  function loadProfile() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['ats_profile', 'ua_profile'], (r) => {
          resolve(Object.assign({}, (r && r.ats_profile) || {}, (r && r.ua_profile) || {}));
        });
      } catch (e) {
        resolve({});
      }
    });
  }

  // Preferences that ship ON. Everything else stays opt-in, so this list is
  // the whole statement of what the extension does without being asked.
  //
  // Kept here because isToggleOn is the single place every content script
  // reads a preference: a default expressed in one script and not another
  // is how a toggle ends up ON in the popup and OFF in the page.
  //
  // Note what this means in practice: once LinkedIn Easy Apply autofill is
  // switched on, these carry the rest -- an opened Easy Apply dialog is
  // filled, advanced, submitted, and a published contact emailed. That is
  // why the LinkedIn toggle itself is opt-in and absent from this set. Submission cannot be
  // undone and goes to a real employer.
  const DEFAULT_ON = new Set([
    // linkedin_autofill_enabled is deliberately NOT here: LinkedIn Easy
    // Apply autofill is opt-in, so nothing touches an application dialog
    // until the user turns it on. The two below only ever apply once it
    // is on -- runAutoFlow checks this toggle first -- so they cannot act
    // on their own.
    'linkedin_autoadvance_enabled',
    // Submission requires an explicit opt-in.
    // Follow-up messages require an explicit opt-in.
  ]);

  function isToggleOn(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([key], (r) => {
          const v = r && r[key];
          // An explicit false always wins: turning something off must
          // survive, which "undefined means on" would otherwise undo.
          resolve(DEFAULT_ON.has(key) ? v !== false : v === true);
        });
      } catch (e) {
        // A storage failure must not silently start submitting applications.
        resolve(false);
      }
    });
  }

  global.AutofillCore = {
    __jg: true,
    labelFor, questionFor, answerFor, yesNoFor, isYesNoOptions, fillContainer, loadProfile, isToggleOn, DEFAULT_ON,
    authorisedCountries, countryInQuestion, authorisedForQuestion, _citizenshipCodes,
    normaliseProfile,
    setValue, valueFitsField, fillSelect, fillRadioGroup, fillCustomDropdown,
    isVisible, optionMatches, optionStartsWith, soleMatch, escapeSelector, DEFAULTS, _isDecline,
    // Exported so the boundary between "motivation" and "claim", and the
    // length clamp, can be asserted directly rather than through a DOM.
    _isMotivationQuestion, _clampToMaxLength, _nationalPhone,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.AutofillCore;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
