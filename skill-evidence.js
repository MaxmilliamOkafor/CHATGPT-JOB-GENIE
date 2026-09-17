/**
 * SKILLS WITH A QUOTATION ATTACHED, AND MATCHING THAT ONLY READS LETTERS.
 *
 * Everything else in this extension answers "is this requirement
 * satisfied?" and answers it generously: the taxonomy knows that
 * PostgreSQL is Postgres, that ML is Machine Learning, that a plural is
 * the same requirement as its singular. That is the right behaviour for
 * deciding whether a CV covers a posting.
 *
 * It is the wrong behaviour for answering "what does this posting
 * actually say?" -- and that is a different question, asked for a
 * different reason. So this module shares nothing with the taxonomy. It
 * does not stem, expand an acronym, resolve a synonym, or know that Java
 * and JavaScript are related. SQL inside MySQL is not SQL. C inside C++
 * is not C. "managed teams" does not contain "management".
 *
 * TWO LAYERS, DELIBERATELY SEPARATE.
 *
 *   EXTRACTION decides what the posting asks for. It is a model
 *   decision, driven by a written specification, and it lives on the
 *   server because that is where the credential is.
 *
 *   VALIDATION AND MATCHING are here, in code, and take nothing on
 *   trust. Every record must carry a quotation that appears in the
 *   source character for character, with the term inside it. A record
 *   that fails is not discarded quietly: it is returned, with the reason,
 *   so a fabricated skill is visible rather than absent.
 *
 * WHAT A RESUME COUNT IS. Literal presence of a phrase, nothing more.
 * "No SQL experience" contains SQL. It is not proficiency, not a
 * semantic match, and not a score. No number here ranks anything.
 *
 *   window.SkillEvidence
 */
(function (global) {
  'use strict';

  const CATEGORIES = ['hard_skill', 'soft_skill'];
  const REQUIREMENTS = ['required', 'preferred', 'unspecified'];
  const FIELDS = ['term', 'category', 'evidence', 'requirement',
    'review_required', 'review_reason'];

  /** Identity for deduplication: case and runs of whitespace ignored. */
  function key(text) {
    return String(text == null ? '' : text).split(/\s+/).filter(Boolean)
      .join(' ').toLowerCase();
  }

  function _escape(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Every literal occurrence of `term` in `text`.
   *
   * Case-insensitive, and a run of whitespace in the term matches any run
   * of whitespace in the text, so a phrase broken across a line break is
   * still one occurrence.
   *
   * The boundaries carry the weight. `+` and `#` are word characters for
   * this purpose and nothing else in this codebase treats them that way:
   * without it "C" matches inside "C++" and "C#", "SQL" matches inside
   * "MySQL" and "SQLAlchemy", and a report that says the posting asks for
   * C is reporting something the posting never said.
   *
   * Offsets index the string as given, with an exclusive end.
   */
  function occurrences(text, term) {
    const haystack = String(text == null ? '' : text);
    const needle = String(term == null ? '' : term);
    if (!needle.trim() || !haystack) return [];
    const body = needle.split(/\s+/).filter(Boolean).map(_escape).join('\\s+');
    if (!body) return [];
    let re;
    try {
      re = new RegExp('(?<![\\w+#])' + body + '(?![\\w+#])', 'gi');
    } catch (e) {
      // A runtime with no lookbehind. Falling back to a version without
      // the leading boundary would report SQL inside MySQL, so it
      // reports nothing instead: a missing count is visible, a wrong one
      // is not.
      return [];
    }
    const out = [];
    let m;
    while ((m = re.exec(haystack)) !== null) {
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      if (m.index === re.lastIndex) re.lastIndex++;   // zero-width guard
    }
    return out;
  }

  /**
   * The model's reply, unwrapped.
   *
   * An incomplete response and a refusal are both errors with their own
   * message. Neither produces a partial report: half an extraction that
   * looks like a whole one is worse than none, because the gap is
   * invisible.
   */
  function parseResponse(response) {
    const res = response || {};

    // THREE ENVELOPES, BECAUSE THE SERVER IS NOT OURS TO PIN.
    //
    // This was written against the Responses API shape. The function
    // that actually got deployed calls chat/completions and returns the
    // model's JSON with no envelope at all, so the extension unwrapped
    // an undefined and reported "the extraction did not complete" on
    // every call. A working key would not have fixed it.
    //
    // Reading all three is a few lines here and removes a whole class of
    // failure: the one where each side is correct and together they do
    // nothing.
    if (Array.isArray(res.skills)) return res;              // bare result
    if (res.choices) {                                      // chat/completions
      const choice = Array.isArray(res.choices) ? res.choices[0] : null;
      if (choice && choice.finish_reason === 'content_filter') {
        throw new Error('The model declined to extract from this posting; no report was produced.');
      }
      const message = choice && choice.message;
      if (message && typeof message.refusal === 'string' && message.refusal) {
        throw new Error('The model declined to extract from this posting; no report was produced.');
      }
      const text = message && typeof message.content === 'string' ? message.content : '';
      if (!text.trim()) throw new Error('The extraction returned no text.');
      return JSON.parse(text);
    }

    if (res.status !== 'completed') {                       // responses API
      throw new Error('The extraction did not complete, so no report was produced.');
    }
    const chunks = [];
    for (const item of Array.isArray(res.output) ? res.output : []) {
      for (const part of Array.isArray(item && item.content) ? item.content : []) {
        if (part && part.type === 'refusal') {
          throw new Error('The model declined to extract from this posting; no report was produced.');
        }
        if (part && part.type === 'output_text' && typeof part.text === 'string') {
          chunks.push(part.text);
        }
      }
    }
    if (!chunks.length) throw new Error('The extraction returned no text.');
    return JSON.parse(chunks.join(''));
  }

  /**
   * Check every record against the source it claims to come from.
   *
   * Returns { accepted, rejected }. A rejected record keeps its reason,
   * because "the model invented this" and "the model returned nothing"
   * are different problems and only one of them is fixable by rerunning.
   */
  function validate(data, jobText) {
    const jd = String(jobText == null ? '' : jobText);
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || !Array.isArray(data.skills)) {
      throw new Error('Expected an object containing a skills array.');
    }
    const accepted = [];
    const rejected = [];
    const seen = new Map();

    for (const raw of data.skills) {
      let reason = null;
      const fields = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? Object.keys(raw) : null;
      if (!fields || fields.length !== FIELDS.length
        || !FIELDS.every((f) => Object.prototype.hasOwnProperty.call(raw, f))) {
        reason = 'Incorrect record fields';
      } else if (FIELDS.some((f) => f !== 'review_required' && typeof raw[f] !== 'string')) {
        reason = 'Expected string fields';
      } else if (typeof raw.review_required !== 'boolean') {
        reason = 'review_required must be boolean';
      } else if (CATEGORIES.indexOf(raw.category) === -1
        || REQUIREMENTS.indexOf(raw.requirement) === -1) {
        reason = 'Invalid category or requirement';
      } else if (!raw.term.trim() || !raw.evidence.trim()) {
        reason = 'Empty term or evidence';
      } else if (jd.indexOf(raw.evidence) === -1 || raw.evidence.indexOf(raw.term) === -1) {
        // THE CHECK THE WHOLE MODULE EXISTS FOR. A quotation that is not
        // in the source is a fabrication, however plausible it reads.
        reason = 'Term/evidence is not an exact source quotation';
      } else if (!occurrences(raw.evidence, raw.term).length) {
        reason = 'Term occurs only inside a larger token';
      }

      if (reason) { rejected.push({ record: raw, reason }); continue; }

      const identity = key(raw.term);
      if (seen.has(identity)) {
        // Identical wording, said twice. Merged, unless the two records
        // disagree about what it is or whether it is required, which is
        // a question for a person rather than a tiebreak for this code.
        const previous = seen.get(identity);
        if (previous.category !== raw.category || previous.requirement !== raw.requirement) {
          previous.review_required = true;
          previous.review_reason = 'Conflicting duplicate classifications; review source.';
        } else if (raw.review_required) {
          previous.review_required = true;
          previous.review_reason = raw.review_reason || 'Model requested review.';
        }
        continue;
      }

      const item = {};
      for (const f of FIELDS) item[f] = raw[f];
      if (item.review_required && !item.review_reason) {
        item.review_reason = 'Model requested review.';
      }
      const hits = occurrences(jd, item.term);
      item.jd_literal_occurrences = hits;
      item.jd_literal_count = hits.length;
      accepted.push(item);
      seen.set(identity, item);
    }

    // Source order, so the report reads in the order the posting does.
    // A term whose evidence validated but whose own boundaries do not
    // survive in the wider document sorts last rather than throwing:
    // the reference implementation indexes [0] unguarded here.
    accepted.sort((a, b) => {
      const A = a.jd_literal_occurrences.length ? a.jd_literal_occurrences[0].start : Infinity;
      const B = b.jd_literal_occurrences.length ? b.jd_literal_occurrences[0].start : Infinity;
      return A - B;
    });
    return { accepted, rejected };
  }

  /**
   * The finished report.
   *
   * `resumeText` is optional and is never sent anywhere: the comparison
   * is a string search that runs wherever this module runs.
   */
  function buildReport(data, jobText, resumeText) {
    const { accepted, rejected } = validate(data, jobText);
    if (resumeText != null) {
      const cv = String(resumeText);
      for (const item of accepted) {
        const hits = occurrences(cv, item.term);
        item.resume_literal_occurrences = hits;
        item.resume_literal_count = hits.length;
        item.literal_present = hits.length > 0;
      }
    }
    return {
      method: 'proposed_extractor_v1_not_jobscan',
      matching: 'case-insensitive literal phrases; flexible whitespace; no stemming or synonyms',
      notes: [
        'Quotation validation does not prove semantic correctness or completeness.',
        'Literal presence is not evidence of proficiency; negated resume mentions also count.',
        'Counts include all literal occurrences, including unrelated contexts.',
        'No ATS ranking, Jobscan score, or semantic resume match is calculated.',
      ],
      hard_skills: accepted.filter((x) => x.category === 'hard_skill'),
      soft_skills: accepted.filter((x) => x.category === 'soft_skill'),
      rejected_records: rejected,
      needs_review: rejected.length > 0 || accepted.some((x) => x.review_required),
    };
  }

  // The schema the extraction is constrained to. Held here rather than in
  // the edge function so the shape the validator enforces and the shape
  // the model is asked for cannot drift apart.
  const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['skills'],
    properties: {
      skills: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: FIELDS.slice(),
          properties: {
            term: { type: 'string' },
            category: { type: 'string', enum: CATEGORIES.slice() },
            evidence: { type: 'string' },
            requirement: { type: 'string', enum: REQUIREMENTS.slice() },
            review_required: { type: 'boolean' },
            review_reason: { type: 'string' },
          },
        },
      },
    },
  };

  global.SkillEvidence = {
    key, occurrences, parseResponse, validate, buildReport,
    SCHEMA, FIELDS: FIELDS.slice(),
    CATEGORIES: CATEGORIES.slice(), REQUIREMENTS: REQUIREMENTS.slice(),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SkillEvidence;
})(typeof window !== 'undefined' ? window : globalThis);
