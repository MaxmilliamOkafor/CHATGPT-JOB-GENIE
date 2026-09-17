// ============================================================
// THE LETTER IS THE PAGE THAT SAYS SOMETHING THE CV DOES NOT.
//
// Measured on real output, two paragraphs shared 61% and 41% of their content
// words with CV bullets. A reviewer holds both documents, so a restated bullet
// spends the only page that can add anything on repetition. This module drops
// restating sentences outright and reports what was measured, so a paragraph
// that merely re-tells an achievement cannot survive to the PDF.
//
// It also decides the line under the candidate's name. That line is a JOB
// TITLE. Real output printed the employer's name there, twice.
// ============================================================

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at", "by", "for", "with",
  "from", "into", "over", "under", "as", "is", "are", "was", "were", "be", "been", "being", "it",
  "its", "this", "that", "these", "those", "i", "my", "me", "we", "our", "us", "you", "your",
  "they", "their", "them", "he", "she", "his", "her", "which", "who", "whom", "whose", "what",
  "when", "where", "while", "than", "then", "so", "such", "not", "no", "nor", "all", "any", "both",
  "each", "more", "most", "other", "some", "only", "own", "same", "too", "very", "can", "will",
  "would", "should", "could", "have", "has", "had", "do", "does", "did", "there", "here", "also",
  "across", "within", "after", "before", "during", "through", "about", "up", "out", "down", "off",
]);

/** Lowercase content words: punctuation stripped, stopwords and one/two letter noise dropped. */
export function contentWords(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9%£$#+./&\s-]/g, " ")
    .split(/[\s,;:()"']+/)
    .map((w) => w.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Share of `sentence`'s content words that also appear in `bullet`. 0 when either is empty. */
export function overlapRatio(sentence: string, bullet: string): number {
  const a = contentWords(sentence);
  if (!a.length) return 0;
  const b = new Set(contentWords(bullet));
  if (!b.size) return 0;
  const shared = new Set(a.filter((w) => b.has(w)));
  return shared.size / new Set(a).size;
}

const MASK = "\u0001";

function splitSentences(paragraph: string): string[] {
  const masked = paragraph
    .replace(/(\d)\.(?=\d)/g, `$1${MASK}`)
    .replace(/\b([A-Z])\.(?=[A-Z]\.)/g, `$1${MASK}`);
  const parts = masked.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  if (!parts) return [paragraph];
  return parts.map((s) => s.replaceAll(MASK, ".").trim()).filter(Boolean);
}

/** Salutation, Re: line, signature and contact block are structure, not prose. */
export function isStructuralParagraph(paragraph: string): boolean {
  const p = paragraph.trim();
  return /^(dear|re:|sincerely|date:|kind regards|yours|best regards)/i.test(p) || /[@|]/.test(p);
}

const FIGURE = /(\d+(?:[.,]\d+)?\s*(?:%|percent|k|m|bn|months?|weeks?|days?|years?|hours?)|[£$€]\s?\d)/i;

/** A sentence that recounts something already done, rather than claiming something forward-looking. */
export function looksLikePastExample(sentence: string, bullets: string[]): boolean {
  const hasFigure = FIGURE.test(sentence);
  const echoes = bullets.some((b) => overlapRatio(sentence, b) >= 0.2);
  return echoes || (hasFigure && /\b(?:delivered|led|built|migrated|architected|reduced|cut|owned|ran|managed|shipped|rolled out|automated|scaled|launched|implemented|designed)\b/i.test(sentence));
}

export interface CoverLetterOriginality {
  text: string;
  removedSentences: string[];
  /** Highest single-sentence overlap with a CV bullet that survived, 0-1. */
  maxSentenceOverlap: number;
  /** Paragraph-level overlap with the CV, measured after removal, 0-1. */
  paragraphOverlaps: number[];
  /**
   * Paragraphs where EVERY sentence restated a bullet, so the weakest one
   * was kept rather than letting the paragraph vanish. Each is a paragraph
   * the writing model should be asked to redo: it had nothing original in
   * it at all.
   */
  emptiedParagraphs: string[];
  /**
   * Sentences put back because removing them left the letter below the
   * body floor. Originality is enforced up to the point where the
   * document stops being a letter, and no further.
   */
  restoredForLength: string[];
  /**
   * Set when the first body paragraph still opens on a demonstrative
   * ("This approach", "These results"), which points at something the
   * reader has not been shown. It cannot be stripped without leaving a
   * subjectless sentence, so it is reported for a rewrite.
   */
  danglingOpening: string;
}

/**
 * Drops any sentence that restates a CV bullet, and keeps at most ONE past
 * example per paragraph. A sentence is a restatement when 45% or more of its
 * content words come from a single bullet: at that level a reviewer is reading
 * the same claim twice, whatever the wording.
 */
export function enforceCoverLetterOriginality(
  letter: string,
  cvBullets: string[],
  options: { restatementThreshold?: number } = {},
): CoverLetterOriginality {
  const threshold = options.restatementThreshold ?? 0.45;
  const bullets = (cvBullets || []).map((b) => String(b || "").replace(/^\s*[-•*]\s*/, "")).filter(Boolean);
  const removedSentences: string[] = [];
  const paragraphOverlaps: number[] = [];
  let maxSentenceOverlap = 0;

  const emptiedParagraphs: string[] = [];
  const paragraphs = (letter || "").split(/\n{2,}/).map((para) => {
    if (!para.trim() || isStructuralParagraph(para)) return para;
    let pastExampleKept = false;
    const kept: string[] = [];
    const sentences = splitSentences(para);
    const overlapOf = (sentence: string) =>
      bullets.reduce((max, b) => Math.max(max, overlapRatio(sentence, b)), 0);

    for (const sentence of sentences) {
      const best = overlapOf(sentence);
      if (bullets.length && best >= threshold) {
        removedSentences.push(sentence);
        continue;
      }
      if (looksLikePastExample(sentence, bullets)) {
        if (pastExampleKept) {
          removedSentences.push(sentence);
          continue;
        }
        pastExampleKept = true;
      }
      maxSentenceOverlap = Math.max(maxSentenceOverlap, best);
      kept.push(sentence);
    }

    // A PARAGRAPH IS NEVER DELETED, ONLY THINNED.
    //
    // Removing sentences one at a time is right. Removing ALL of them
    // leaves "", the empty paragraph is filtered out below, and the
    // letter loses a whole paragraph without anything noticing -- each
    // individual removal was correct and the hole is invisible to the
    // loop that made it.
    //
    // This is not hypothetical. A delivered letter began "Additionally,
    // I mentored two junior engineers", with nothing in front of it: the
    // opening paragraph restated a CV bullet, every sentence in it
    // crossed the threshold, and the paragraph went. Eighty-five words
    // of body reached a real employer.
    //
    // When everything would go, the least-restating sentence stays. A
    // thin paragraph is a writing problem the report can name. A missing
    // one is a document that no longer makes sense.
    if (!kept.length && sentences.length) {
      let weakest = sentences[0];
      let lowest = overlapOf(weakest);
      for (const sentence of sentences) {
        const score = overlapOf(sentence);
        if (score < lowest) { lowest = score; weakest = sentence; }
      }
      const at = removedSentences.lastIndexOf(weakest);
      if (at !== -1) removedSentences.splice(at, 1);
      maxSentenceOverlap = Math.max(maxSentenceOverlap, lowest);
      kept.push(weakest);
      emptiedParagraphs.push(para.trim());
    }

    const rebuilt = kept.join(" ").replace(/[ \t]{2,}/g, " ").trim();
    if (rebuilt) {
      paragraphOverlaps.push(bullets.reduce((max, b) => Math.max(max, overlapRatio(rebuilt, b)), 0));
    }
    return rebuilt;
  });

  // AND NO PARAGRAPH IS LEFT REFERRING TO ONE THAT WENT.
  //
  // Thinning a paragraph can still strip the sentence a later one points
  // back at, and "Additionally" with nothing behind it tells a reader the
  // document was assembled rather than written. The connective is dropped
  // and the sentence keeps its meaning; only the back-reference goes.
  // A DEMONSTRATIVE IS A BACK-REFERENCE TOO.
  //
  // The first version caught only connectives. The next letter out
  // opened "This consultative approach resulted in improved patient
  // outcomes", which points back just as hard and reads just as broken.
  // "This approach", "These results", "Such work", "It did" -- all of
  // them name something the reader has not been shown.
  //
  // A demonstrative cannot be stripped the way a connective can, because
  // removing "This" leaves a sentence with no subject. It is reported
  // instead, and the length floor below is what actually saves the
  // letter.
  const ORPHAN = /^(additionally|furthermore|moreover|in addition|also|secondly|similarly|likewise|besides|what(?:'s| is) more)\b[,]?\s*/i;
  const DANGLING = /^(this|these|those|that|such|it)\b/i;
  let seenBody = false;
  const stitched = paragraphs.map((para) => {
    if (!para.trim() || isStructuralParagraph(para)) return para;
    const wasFirst = !seenBody;
    seenBody = true;
    if (!wasFirst || !ORPHAN.test(para.trim())) return para;
    const rest = para.trim().replace(ORPHAN, "");
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : para;
  });

  // ORIGINALITY IS NEVER ENFORCED DOWN TO NOTHING.
  //
  // This is the guarantee that was missing, and the one that matters.
  // Two letters went to real employers at 85 and 80 words of body, both
  // opening on a reference to a paragraph that had been removed. Every
  // deletion was individually correct and the result was not a letter.
  //
  // Removal is capped by the document: sentences come back, least
  // restating first, until the body clears the floor. A letter carrying
  // one sentence that echoes the CV is a letter. One that is three
  // sentences long is a fragment, and no amount of originality makes it
  // worth sending.
  const FLOOR_WORDS = 150;
  let body = stitched.filter((p) => p.trim() && !isStructuralParagraph(p));
  const restoredForLength: string[] = [];
  const countWords = (list: string[]) =>
    list.join(" ").split(/\s+/).filter(Boolean).length;

  if (removedSentences.length && countWords(body) < FLOOR_WORDS) {
    const byLeastRestating = removedSentences
      .map((sentence) => ({
        sentence,
        overlap: bullets.reduce((max, b) => Math.max(max, overlapRatio(sentence, b)), 0),
      }))
      .sort((a, b) => a.overlap - b.overlap);
    for (const { sentence } of byLeastRestating) {
      if (countWords(body) >= FLOOR_WORDS) break;
      restoredForLength.push(sentence);
      body = body.concat(sentence);
      const at = removedSentences.indexOf(sentence);
      if (at !== -1) removedSentences.splice(at, 1);
    }
  }

  // Restored sentences rejoin the last body paragraph rather than
  // standing alone, so the letter keeps its shape.
  let out = stitched.filter((p) => p.trim());
  if (restoredForLength.length) {
    for (let i = out.length - 1; i >= 0; i--) {
      if (isStructuralParagraph(out[i])) continue;
      out[i] = (out[i].trim() + " " + restoredForLength.join(" ")).replace(/[ \t]{2,}/g, " ");
      break;
    }
  }

  const firstBody = out.find((p) => p.trim() && !isStructuralParagraph(p)) || "";
  const danglingOpening = DANGLING.test(firstBody.trim()) ? firstBody.trim().slice(0, 120) : "";

  return {
    text: out.join("\n\n"),
    emptiedParagraphs,
    restoredForLength,
    danglingOpening,
    removedSentences,
    maxSentenceOverlap,
    paragraphOverlaps,
  };
}

const RANK_WORDS = /\b(senior|junior|lead|principal|staff|head|chief|director|manager|officer|associate|assistant|analyst|engineer|coordinator|specialist|executive|vp|vice president)\b/gi;

const normalise = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The line under the name is a job title, never the employer. When the posting
 * title is missing, or is nothing but the company name, the candidate's most
 * relevant HELD title is used instead.
 */
export function chooseHeadline(input: {
  targetTitle?: string;
  company?: string;
  currentTitle?: string;
  heldTitles?: string[];
}): { headline: string; usedFallback: boolean; reason: string } {
  const company = normalise(input.company);
  const held = (input.heldTitles || []).map((t) => String(t || "").trim()).filter(Boolean);
  const fallback = (input.currentTitle || "").trim() || held[0] || "";

  let target = String(input.targetTitle || "").trim().replace(/\s*[|\-–—]\s*careers?\s*$/i, "").trim();

  // A title that is only the company name (or the company name plus rank noise)
  // is not a title.
  if (target && company) {
    const stripped = normalise(target).split(" ").filter((w) => !company.split(" ").includes(w)).join(" ");
    const meaningful = stripped.replace(RANK_WORDS, "").trim();
    if (!stripped || (normalise(target) === company) || (!meaningful && stripped === normalise(target).replace(/\s+/g, " ") && stripped.split(" ").length <= 1)) {
      return {
        headline: fallback,
        usedFallback: true,
        reason: fallback
          ? "Posting title was the employer name; used the candidate's held title"
          : "Posting title was the employer name and no held title was available",
      };
    }
  }

  if (!target) {
    return {
      headline: fallback,
      usedFallback: true,
      reason: fallback ? "No posting title supplied; used the candidate's held title" : "No title available",
    };
  }

  return { headline: target, usedFallback: false, reason: "Posting title used as supplied" };
}

/** True when the line is the employer's name and nothing else. */
export function isEmployerNameLine(line: string, company?: string): boolean {
  const c = normalise(company);
  if (!c) return false;
  return normalise(line) === c;
}
