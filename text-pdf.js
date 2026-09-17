// A PDF THE EMPLOYER WILL ACCEPT, BUILT FROM THE SAME TEXT AS THE DOCX.
//
// DOCX is the format this extension attaches, and it is the right
// default: it parses cleanly in every major ATS and it is the file a
// recruiter can open and edit. But a meaningful number of employers
// publish `accept=".pdf"` on the resume field, and until now that ended
// the run -- "This upload field does not accept DOCX. Download and use
// a format allowed by the employer." The applicant then had to leave
// the page, find the file, convert it, and come back.
//
// So: the same reviewed text, rendered as a real PDF with real text
// objects. Not an image, not a screenshot -- Helvetica, one of the
// fourteen fonts every PDF reader carries without embedding, and one
// text-showing operator per line. Any parser that can read a PDF at all
// reads every word of it.
//
// It is deliberately plain. This is the fallback for a form that will
// not take the properly formatted document, and a plain, correctly
// parsed CV beats a beautiful one the employer's field rejects.
(function (global) {
  'use strict';

  const PAGE_W = 595.28;          // A4, points
  const PAGE_H = 841.89;
  const MARGIN = 56;              // ~20mm
  const SIZE = 10;
  const LEADING = 13.2;
  const MAX_WIDTH = PAGE_W - MARGIN * 2;

  // Helvetica advance widths, in 1/1000 em, for the printable ASCII
  // range. Wrapping by real widths rather than by character count keeps
  // a long skills line from running off the page.
  const W = (() => {
    const w = {};
    const set = (chars, width) => { for (const c of chars) w[c] = width; };
    set(' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~', 556);
    set(' !,.:;|\'`[]{}()', 278);
    set('"', 355); set('*', 389); set('/', 278); set('\\', 278);
    set('ijlt', 222); set('fr', 278); set('I', 278);
    set('MW', 889); set('m', 833); set('w', 722);
    set('ABDEHKNORSUVXY', 667); set('CG', 722); set('Q', 778);
    set('FPLTZJ', 611); set('J', 500);
    set('abcdeghknopqsuvxyz', 556); set('cs', 500); set('y', 500);
    return w;
  })();

  function widthOf(text) {
    let total = 0;
    for (const ch of String(text)) total += (W[ch] || 556);
    return total / 1000 * SIZE;
  }

  // WinAnsi is the encoding declared below, so anything outside it is
  // folded to the nearest plain equivalent rather than emitted as a
  // byte the reader will render as a box. An unreadable character in a
  // parsed CV is worse than a plain one.
  const FOLD = {
    '‘': "'", '’': "'", '‚': "'", '“': '"', '”': '"',
    // Every dash a word processor produces, including the non-breaking
    // hyphen a pasted CV carries invisibly through "end-to-end".
    '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-',
    '−': '-', '•': '-', '·': '-', '‧': '-',
    '′': "'", '″': '"', '™': '(TM)', '℠': '(SM)',
    '…': '...', ' ': ' ', '→': '->', '«': '"', '»': '"',
    '‹': "'", '›': "'", 'ʼ': "'", 'ﬁ': 'fi', 'ﬂ': 'fl',
  };

  function toWinAnsi(text) {
    let out = '';
    for (const ch of String(text == null ? '' : text)) {
      if (FOLD[ch] !== undefined) { out += FOLD[ch]; continue; }
      const code = ch.codePointAt(0);
      if (code === 9) { out += '    '; continue; }
      if (code < 32) continue;
      if (code <= 255) { out += ch; continue; }
      // Strip a combining accent rather than drop the letter it sits on.
      const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out += (plain && plain.codePointAt(0) <= 255) ? plain : '?';
    }
    return out;
  }

  function escapePdf(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  /** One source line becomes one or more rendered lines, wrapped on words. */
  function wrap(line) {
    const text = toWinAnsi(line).replace(/\s+$/, '');
    if (!text) return [''];
    if (widthOf(text) <= MAX_WIDTH) return [text];
    const words = text.split(/ +/);
    const out = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (widthOf(candidate) <= MAX_WIDTH) { current = candidate; continue; }
      if (current) out.push(current);
      // A single word longer than the line (a URL) is cut on width.
      let rest = word;
      while (widthOf(rest) > MAX_WIDTH) {
        let cut = rest.length;
        while (cut > 1 && widthOf(rest.slice(0, cut)) > MAX_WIDTH) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    if (current) out.push(current);
    return out;
  }

  function paginate(text) {
    const perPage = Math.floor((PAGE_H - MARGIN * 2) / LEADING);
    const lines = [];
    for (const raw of String(text == null ? '' : text).split(/\r?\n/)) {
      for (const piece of wrap(raw)) lines.push(piece);
    }
    const pages = [];
    for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
    return pages.length ? pages : [['']];
  }

  function contentStream(lines) {
    const parts = ['BT', '/F1 ' + SIZE + ' Tf', LEADING.toFixed(2) + ' TL',
      '1 0 0 1 ' + MARGIN.toFixed(2) + ' ' + (PAGE_H - MARGIN).toFixed(2) + ' Tm'];
    for (const line of lines) {
      parts.push(line ? '(' + escapePdf(line) + ') Tj' : '');
      parts.push('T*');
    }
    parts.push('ET');
    return parts.filter((p) => p !== '').join('\n');
  }

  /**
   * A complete PDF as a binary string (one char per byte), or '' if the
   * text is empty. Callers turn it into a File.
   */
  function build(text) {
    const source = String(text == null ? '' : text);
    if (!source.trim()) return '';
    const pages = paginate(source);

    // Object 1 catalog, 2 pages, 3 font, then per page: page + content.
    const objects = [];
    const pageIds = pages.map((_, i) => 4 + i * 2);
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push('<< /Type /Pages /Kids [' + pageIds.map((id) => id + ' 0 R').join(' ')
      + '] /Count ' + pages.length + ' >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    pages.forEach((lines, i) => {
      const contentId = pageIds[i] + 1;
      objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H
        + '] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentId + ' 0 R >>');
      const stream = contentStream(lines);
      objects.push('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
    });
    const xrefAt = pdf.length;
    pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    for (const off of offsets) pdf += String(off).padStart(10, '0') + ' 00000 n \n';
    pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n'
      + xrefAt + '\n%%EOF\n';
    return pdf;
  }

  global.TextPdf = { build, paginate, wrap, toWinAnsi, widthOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.TextPdf;
})(typeof window !== 'undefined' ? window : globalThis);
