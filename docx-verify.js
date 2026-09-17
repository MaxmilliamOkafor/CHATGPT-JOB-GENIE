/**
 * WHAT THE APPLICANT TRACKING SYSTEM ACTUALLY SEES.
 *
 * Every coverage number in this extension has been measured against a
 * string held in memory -- the text we MEANT to write. The file that
 * reaches the employer is a .docx built from that string by a separate
 * renderer, and nothing has ever read it back.
 *
 * That gap is where the worst bugs in this project have lived. A second
 * scorer once reported a number for a document nobody sent. The PDF
 * fallback silently dropped every injected keyword. The recruiter audit
 * rewrote the CV after the coverage pass had measured it. Each time the
 * number described one document and the employer received another, and
 * each time it took a real application to notice.
 *
 * An ATS does not read the page. It reads the text layer, which for a
 * .docx is word/document.xml. So that is what this reads: the actual
 * bytes of the actual attachment, extracted the way a parser extracts
 * them, and then checked for the things that make a good-looking CV
 * arrive as nothing.
 *
 *   - the contact details present as literal text, not only as a
 *     hyperlink target or an icon
 *   - the reading order matching what a person sees
 *   - no replacement characters or unmapped glyphs
 *   - the posting's requirements findable in the extracted text
 *
 * DEPENDENCY-FREE, deliberately. docx-generator.js writes its own zip
 * with STORED entries (method 0, no compression) precisely so this file
 * can read one back without pulling in a zip library.
 *
 *   window.DocxVerify
 */
(function (global) {
  'use strict';

  // ── READING THE ZIP ──────────────────────────────────────────────────
  //
  // A .docx is a zip. Local file headers start with PK\x03\x04 and carry
  // the compression method at offset 8: 0 is stored, 8 is deflate. Only
  // stored entries can be read without an inflater, which is exactly
  // what our own renderer writes. A deflated entry is reported rather
  // than guessed at.
  const SIG = 0x04034b50;

  function _u16(b, i) { return b[i] | (b[i + 1] << 8); }
  function _u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }

  function toBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (typeof input === 'string') {
      // base64, with or without a data: prefix
      const b64 = input.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
      if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    }
    if (input && input.buffer) return new Uint8Array(input.buffer);
    return new Uint8Array(0);
  }

  /** Every stored entry in the archive, by name. */
  function entries(bytes) {
    const out = new Map();
    for (let i = 0; i + 30 < bytes.length; i += 1) {
      if (_u32(bytes, i) !== SIG) continue;
      const method = _u16(bytes, i + 8);
      const size = _u32(bytes, i + 18);
      const nameLen = _u16(bytes, i + 26);
      const extraLen = _u16(bytes, i + 28);
      const nameAt = i + 30;
      if (nameAt + nameLen > bytes.length) continue;
      let name = '';
      for (let j = 0; j < nameLen; j += 1) name += String.fromCharCode(bytes[nameAt + j]);
      const dataAt = nameAt + nameLen + extraLen;
      out.set(name, { method, at: dataAt, size, compressed: method !== 0 });
      i = dataAt + (method === 0 ? size : 0) - 1;
    }
    return out;
  }

  function utf8(bytes, at, size) {
    const slice = bytes.subarray(at, at + size);
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(slice);
    return Buffer.from(slice).toString('utf8');
  }

  // ── THE TEXT LAYER ───────────────────────────────────────────────────

  const _ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

  function _unescape(s) {
    return String(s).replace(/&(amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);/g, (m, e) => {
      if (_ENT[e] !== undefined) return _ENT[e];
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    });
  }

  /**
   * The document as a parser reads it: runs in document order, tabs and
   * breaks as whitespace, one line per paragraph.
   *
   * Reading order comes out of the XML order, which is the same order a
   * single-column document is read in. That is the point of the check:
   * where a renderer uses a table or a text box the XML order stops
   * matching the visual order, and the extraction interleaves.
   */
  function textLayer(documentXml) {
    const body = String(documentXml || '');
    const lines = [];
    for (const p of body.split(/<w:p[\s>]/).slice(1)) {
      let line = '';
      for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)) {
        line += m[1] === undefined ? ' ' : _unescape(m[1]);
      }
      lines.push(line.replace(/[ \t]+/g, ' ').trim());
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Hyperlink targets, which live in the rels part and NOT in the text. */
  function linkTargets(relsXml) {
    const out = [];
    for (const m of String(relsXml || '').matchAll(/Target="([^"]+)"/g)) out.push(_unescape(m[1]));
    return out;
  }

  // ── THE CHECKS ───────────────────────────────────────────────────────

  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/;
  const PHONE = /(?:\+\d[\d\s().-]{7,}|\b0\d[\d\s().-]{7,})/;
  // A font embedded without a Unicode map extracts as these. The page
  // looks perfect and the parser sees nothing usable.
  const GARBLED = /\(cid:\d+\)|�/;

  /**
   * Read a generated .docx back and report what a parser would find.
   *
   * Returns { ok, text, problems, warnings, coverage } -- `problems` are
   * things that cost the application, `warnings` are things worth
   * knowing. Never throws: a verifier that breaks the run would be worse
   * than the bug it looks for.
   */
  function verify(docx, options) {
    const opts = options || {};
    const result = { ok: false, text: '', problems: [], warnings: [], entries: [] };
    let bytes;
    try { bytes = toBytes(docx); } catch (e) { bytes = new Uint8Array(0); }
    if (!bytes.length) {
      result.problems.push('the attachment is empty');
      return result;
    }
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
      result.problems.push('the attachment is not a zip, so it is not a .docx');
      return result;
    }

    let parts;
    try { parts = entries(bytes); } catch (e) { parts = new Map(); }
    result.entries = [...parts.keys()];
    const doc = parts.get('word/document.xml');
    if (!doc) {
      result.problems.push('word/document.xml is missing, so there is no text layer at all');
      return result;
    }
    if (doc.compressed) {
      result.warnings.push('the text layer is compressed, so it could not be read here; '
        + 'this checks the renderer that writes stored entries');
      return result;
    }

    let xml = '';
    try { xml = utf8(bytes, doc.at, doc.size); } catch (e) {
      result.problems.push('the text layer could not be decoded as UTF-8');
      return result;
    }
    const text = textLayer(xml);
    result.text = text;
    if (!text.trim()) {
      result.problems.push('the text layer is empty: the document looks right and parses to nothing');
      return result;
    }

    // THE CONTACT DETAILS MUST BE LITERAL TEXT.
    //
    // A detail carried only by a hyperlink target or an icon is invisible
    // to a parser: the address is in the rels part, which nothing reads,
    // and the page still looks complete.
    const rels = parts.get('word/_rels/document.xml.rels');
    const targets = rels && !rels.compressed
      ? linkTargets(utf8(bytes, rels.at, rels.size)) : [];
    const wantedEmail = opts.email || '';
    if (wantedEmail) {
      if (text.indexOf(wantedEmail) === -1) {
        const inLink = targets.some((t) => t.indexOf(wantedEmail) !== -1);
        result.problems.push(inLink
          ? 'the email address exists only as a hyperlink target, which a parser does not read'
          : 'the email address is not in the text layer');
      }
    } else if (!EMAIL.test(text)) {
      result.problems.push('no email address in the text layer');
    }
    if (!PHONE.test(text)) {
      result.warnings.push('no phone number found in the text layer');
    }

    if (GARBLED.test(text)) {
      result.problems.push('the text layer contains unmapped glyphs, so a parser sees garbage '
        + 'where the page looks correct');
    }

    // READING ORDER. The heading a person sees first must be the text a
    // parser reads first; a multi-column layout interleaves them.
    const first = text.split('\n').find((l) => l.trim());
    if (opts.name && first && first.toLowerCase().indexOf(String(opts.name).toLowerCase().split(/\s+/)[0]) === -1) {
      result.warnings.push('the first line of the text layer is not the candidate name, '
        + 'which is what a parser expects to find there: ' + JSON.stringify(first.slice(0, 60)));
    }

    // A REPEATED LINE IN THE HEADER.
    //
    // A real CV arrived with the employer's name twice where the role
    // belongs, above two contact lines. Several passes write into that
    // block and each checked only its own line, so nothing saw the
    // duplication. It is the first thing both a parser and a person
    // read, and it is trivial to detect here.
    {
      const head = text.split('\n').slice(0, 8).map((l) => l.trim()).filter(Boolean);
      const seen = new Set();
      const dupes = [];
      for (const line of head) {
        const key = line.toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) dupes.push(line);
        seen.add(key);
      }
      if (dupes.length) {
        result.problems.push('the header repeats ' + dupes.length + ' line(s): '
          + dupes.slice(0, 3).map((d) => JSON.stringify(d.slice(0, 40))).join(', '));
      }
      const contacts = head.filter((l) => l.indexOf('@') !== -1);
      if (contacts.length > 1) {
        result.problems.push('the header carries ' + contacts.length + ' contact lines');
      }
      if (opts.company) {
        const c = String(opts.company).toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (head.slice(1, 3).some((l) => l.toLowerCase().replace(/[^a-z0-9]+/g, '') === c)) {
          result.problems.push('the line under the name is the employer\'s name, '
            + 'not a job title');
        }
      }
    }

    // AND THE SECTIONS AN ATS LOOKS FOR.
    const wantSections = opts.kind === 'cover-letter' ? []
      : ['EXPERIENCE', 'EDUCATION', 'SKILLS'];
    for (const heading of wantSections) {
      if (!new RegExp(heading, 'i').test(text)) {
        result.warnings.push('no ' + heading.toLowerCase() + ' heading in the text layer');
      }
    }

    // COVERAGE, MEASURED ON THE DELIVERED FILE.
    //
    // This is the number that was never checked. Everything else in the
    // extension measures the string it meant to write.
    const asked = Array.isArray(opts.keywords) ? opts.keywords
      : (opts.keywords && Array.isArray(opts.keywords.all) ? opts.keywords.all : null);
    if (asked && asked.length) {
      const TX = (global && global.KeywordTaxonomy)
        || (typeof KeywordTaxonomy !== 'undefined' ? KeywordTaxonomy : null);
      const matched = [];
      const missing = [];
      for (const k of asked) {
        const hit = TX && typeof TX.appearsIn === 'function'
          ? TX.appearsIn(text, k)
          : new RegExp('\\b' + String(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text);
        (hit ? matched : missing).push(k);
      }
      result.coverage = {
        matched, missing,
        score: asked.length ? Math.round((matched.length / asked.length) * 100) : 0,
      };
      if (missing.length) {
        result.warnings.push(missing.length + ' requirement(s) are not in the delivered file: '
          + missing.slice(0, 8).join(', '));
      }
    }

    result.ok = result.problems.length === 0;
    return result;
  }

  global.DocxVerify = { verify, textLayer, entries, toBytes, linkTargets };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.DocxVerify;
})(typeof window !== 'undefined' ? window : globalThis);
