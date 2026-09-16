// universal-jd-parser.js - Universal Job Description Parser with Structure Detection
// Shared parsing for supported HTML and text descriptions; unknown content is preserved.

(function(global) {
  'use strict';

  // ============ CACHING LAYER ============
  const JD_CACHE = new Map();
  const KEYWORD_CACHE = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCacheKey(text) {
    // Fast hash for caching
    let hash = 0;
    const sample = String(text || '');
    for (let i = 0; i < sample.length; i++) {
      hash = ((hash << 5) - hash) + sample.charCodeAt(i);
      hash |= 0;
    }
    return `jd_${hash}_${text.length}`;
  }

  function getCached(key, cache) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    cache.delete(key);
    return null;
  }

  function setCache(key, data, cache) {
    cache.set(key, { data, timestamp: Date.now() });
    // Limit cache size
    if (cache.size > 100) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
  }

  // ============ STRUCTURE DETECTION ============
  const STRUCTURE_TYPES = {
    BULLETS: 'bullets',
    SECTIONS: 'sections',
    NARRATIVE: 'narrative',
    PHRASES: 'phrases',
    RAW_TEXT: 'raw_text'
  };

  /**
   * Detect the structure type of a job description
   * @param {string} text - Clean text to analyze
   * @returns {string} Structure type
   */
  function detectStructure(text) {
    const bulletPattern = /(?:^|\n)\s*[-•●○◦▪▸►]\s*\S|(?:^|\n)\s*\d+[.)]\s*\S/gm;
    const bulletMatches = (text.match(bulletPattern) || []).length;
    
    const sectionPattern = /(?:requirements|qualifications|skills|responsibilities|experience|about|what we|you will|your role|key|must have|nice to have)[:\s]/gi;
    const sectionMatches = (text.match(sectionPattern) || []).length;
    
    const narrativePattern = /you['']?ll|you will|we['']?re looking|we are seeking|your role|join our|be responsible/gi;
    const narrativeMatches = (text.match(narrativePattern) || []).length;

    // Priority: bullets > sections > narrative > phrases > raw
    if (bulletMatches >= 5) return STRUCTURE_TYPES.BULLETS;
    if (sectionMatches >= 2) return STRUCTURE_TYPES.SECTIONS;
    if (narrativeMatches >= 2) return STRUCTURE_TYPES.NARRATIVE;
    
    // Check for phrase-heavy text (technical keywords separated by spaces/commas)
    const words = text.split(/\s+/).filter(w => w.length >= 3);
    const techPattern = /^[A-Za-z][A-Za-z0-9\+\#\.\-]+$/;
    const techWords = words.filter(w => techPattern.test(w)).length;
    if (techWords / words.length > 0.3) return STRUCTURE_TYPES.PHRASES;
    
    return STRUCTURE_TYPES.RAW_TEXT;
  }

  // ============ TEXT CLEANING ============
  
  /**
   * Clean raw HTML/text to normalized plain text
   * @param {string} rawHTML - Raw HTML or text
   * @returns {string} Cleaned text
   */
  function stripHTML(rawHTML) {
    if (!rawHTML) return '';
    
    if (!/<\/?[a-z][^>]*>/i.test(rawHTML)) return normalizeWhitespace(rawHTML);
    // Preserve block boundaries before reading textContent.
    rawHTML = rawHTML.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6]|section|article|tr)>/gi, '$&\n');

    // Create temporary element for HTML parsing
    const temp = document.createElement('div');
    temp.innerHTML = rawHTML;
    
    // Remove navigation, header, footer, scripts, styles
    const removeSelectors = [
      'nav', 'header', 'footer', 'script', 'style', 'noscript',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '.nav', '.header', '.footer', '.menu', '.sidebar', '.advertisement'
    ];
    removeSelectors.forEach(sel => {
      temp.querySelectorAll(sel).forEach(el => el.remove());
    });
    
    let text = temp.textContent || temp.innerText || '';
    return normalizeWhitespace(text);
  }

  /**
   * Normalize whitespace in text
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  function normalizeWhitespace(text) {
    return text
      .replace(/[\r\n]+/g, '\n')           // Normalize line endings
      .replace(/[ \t]+/g, ' ')             // Collapse horizontal whitespace
      .replace(/\n /g, '\n')               // Remove leading spaces after newlines
      .replace(/ \n/g, '\n')               // Remove trailing spaces before newlines
      .replace(/\n{3,}/g, '\n\n')          // Max 2 consecutive newlines
      .trim();
  }

  /**
   * Remove common boilerplate sections
   * @param {string} text - Text to clean
   * @returns {string} Text without boilerplate
   */
  function removeBoilerplate(text) {
    // Only explicit form boundaries end a description. An Apply button
    // above the responsibilities must not discard the actual job text.
    const form = /(?:^|\n)\s*(?:apply for this job|voluntary self-identification|voluntary self identification|submit your application)\s*[:*]?\s*(?:\n|$)/i.exec(text);
    let cleaned = form ? text.slice(0, form.index) : text;
    const relevantHeading = /^(?:(?:minimum|preferred|required|basic)\s+)?(?:requirements|qualifications|responsibilities|skills|experience|key focuses|duties|summary|about (?:the role|you)|what you(?: will|'ll) do|who you are|your role)\s*:?$/i;
    const irrelevantHeading = /^(?:benefits(?: include)?|our benefits|perks|about us|about our company|who we are|our mission|equal opportunity(?: employer)?|privacy notice)\s*:?$/i;
    const lines = cleaned.split('\n');
    const out = [];
    let skip = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (relevantHeading.test(trimmed)) skip = false;
      else if (irrelevantHeading.test(trimmed)) { skip = true; continue; }
      if (/^(?:apply now|apply|back to jobs)\s*$/i.test(trimmed)) continue;
      if (!skip) out.push(line);
    }
    return normalizeWhitespace(out.join('\n'));
  }

  /**
   * Truncate text to safe limit for processing
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length (default 10000)
   * @returns {string} Truncated text
   */
  function truncateToSafeLimit(text, maxLength = 10000) {
    if (text.length <= maxLength) return text;
    
    // Try to cut at paragraph boundary
    const cutPoint = text.lastIndexOf('\n\n', maxLength);
    if (cutPoint > maxLength * 0.7) {
      return text.slice(0, cutPoint);
    }
    
    // Try to cut at sentence boundary
    const sentenceEnd = text.lastIndexOf('. ', maxLength);
    if (sentenceEnd > maxLength * 0.8) {
      return text.slice(0, sentenceEnd + 1);
    }
    
    return text.slice(0, maxLength);
  }

  // ============ MAIN PROCESSING ============

  /**
   * Process any job description format universally
   * @param {string} rawHTML - Raw HTML or text of job description
   * @returns {Object} Parsed result with structure and clean text
   */
  function processAnyJobDescription(rawHTML) {
    if (!rawHTML) {
      return { text: '', structure: STRUCTURE_TYPES.RAW_TEXT, sections: {} };
    }

    // Check cache first
    const cacheKey = getCacheKey(rawHTML);
    const cached = getCached(cacheKey, JD_CACHE);
    if (cached) return cached;

    // Step 1: Universal cleaning
    let cleanText = stripHTML(rawHTML);
    
    // Step 2: Remove boilerplate
    cleanText = removeBoilerplate(cleanText);
    
    // Step 3: Truncate if needed
    cleanText = truncateToSafeLimit(cleanText);
    
    // Step 4: Detect structure
    const structure = detectStructure(cleanText);
    
    // Step 5: Extract sections if applicable
    const sections = structure === STRUCTURE_TYPES.SECTIONS 
      ? extractSections(cleanText) 
      : {};

    const result = { text: cleanText, structure, sections };
    
    // Cache the result
    setCache(cacheKey, result, JD_CACHE);
    
    return result;
  }

  /**
   * Extract sections from sectioned job descriptions
   * @param {string} text - Clean text
   * @returns {Object} Sections object
   */
  function extractSections(text) {
    const sections = {
      requirements: '',
      responsibilities: '',
      qualifications: '',
      skills: '',
      about: '',
      other: ''
    };

    const sectionPatterns = [
      { key: 'requirements', pattern: /(?:^|\n)(?:requirements|what we need|what you need|must have)[:\s]*/i },
      { key: 'responsibilities', pattern: /(?:^|\n)(?:responsibilities|duties|what you['']?ll do|your role|job duties)[:\s]*/i },
      { key: 'qualifications', pattern: /(?:^|\n)(?:qualifications|who you are|ideal candidate|about you)[:\s]*/i },
      { key: 'skills', pattern: /(?:^|\n)(?:skills|technical skills|required skills|key skills|core competencies)[:\s]*/i },
      { key: 'about', pattern: /(?:^|\n)(?:about (?:the role|this role|the position)|overview|summary)[:\s]*/i }
    ];

    // Find all section starts
    const sectionStarts = [];
    sectionPatterns.forEach(({ key, pattern }) => {
      const match = text.match(pattern);
      if (match) {
        sectionStarts.push({ key, index: match.index, length: match[0].length });
      }
    });

    // Sort by position
    sectionStarts.sort((a, b) => a.index - b.index);

    // Extract section contents
    for (let i = 0; i < sectionStarts.length; i++) {
      const current = sectionStarts[i];
      const startIdx = current.index + current.length;
      const endIdx = i < sectionStarts.length - 1 
        ? sectionStarts[i + 1].index 
        : text.length;
      
      sections[current.key] = text.slice(startIdx, endIdx).trim();
    }

    // Anything before first section or not in a section goes to 'other'
    if (sectionStarts.length > 0 && sectionStarts[0].index > 0) {
      sections.other = text.slice(0, sectionStarts[0].index).trim();
    }

    return sections;
  }

  // ============ EXPORTS ============
  
  global.UniversalJDParser = {
    processAnyJobDescription,
    detectStructure,
    stripHTML,
    normalizeWhitespace,
    removeBoilerplate,
    truncateToSafeLimit,
    extractSections,
    STRUCTURE_TYPES,
    // Cache utilities
    clearCache: () => { JD_CACHE.clear(); KEYWORD_CACHE.clear(); },
    getCacheStats: () => ({ jdCacheSize: JD_CACHE.size, keywordCacheSize: KEYWORD_CACHE.size }),
    // For keyword extractor to use
    JD_CACHE,
    KEYWORD_CACHE,
    getCached,
    setCache,
    getCacheKey
  };

})(typeof window !== 'undefined' ? window : global);
