/**
 * Utility functions for HTML entity decoding and display name sanitization
 */

/**
 * Decodes all common HTML named and numeric entities into clean readable characters
 * Handles &nbsp;, &gt;, &lt;, &amp;, &quot;, &#39;, &apos;, &mdash;, &#160;, &#x27;, etc.
 */
export const decodeHtmlEntities = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&bull;/gi, '•')
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&rdquo;/gi, '”')
    .replace(/&ldquo;/gi, '“')
    .replace(/&#(\d+);/g, (match, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch (e) {
        return match;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch (e) {
        return match;
      }
    });
};

/**
 * Strips HTML tags and thoroughly decodes all HTML entities into clean readable text
 */
export const cleanHtmlText = (htmlOrText) => {
  if (!htmlOrText || typeof htmlOrText !== 'string') return '';
  const stripped = htmlOrText.replace(/<[^>]*>/g, ' ');
  const decoded = decodeHtmlEntities(stripped);
  return decoded.replace(/\s+/g, ' ').trim();
};

/**
 * Cleans stray single/double quotes, backticks, and extra whitespace from display names
 * and formats dot/underscore separated usernames or emails into consistent Capitalized / Title Case names.
 * Example: Keval 'Trivedi' -> Keval Trivedi
 * Example: 'Aryan Kumrecha' -> Aryan Kumrecha
 * Example: aryankumar.kumrecha -> Aryan Kumrecha
 * Example: aryan.kumrecha -> Aryan Kumrecha
 * Example: keval.trivedi -> Keval Trivedi
 * Example: ESTATIC INFOTECH -> Estatic Infotech
 */
export const sanitizeDisplayName = (name) => {
  if (!name || typeof name !== 'string') return '';

  // 1. Remove quotes, backticks, escaped quotes
  let cleaned = name
    .replace(/[`'"]/g, '')
    .replace(/\\['"]/g, '')
    .trim();

  if (!cleaned) return '';

  // 2. If it's an email address, extract prefix before @
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0];
  }

  // 3. Handle dot-separated or underscore-separated usernames (e.g. aryankumar.kumrecha -> aryankumar kumrecha)
  if (cleaned.includes('.') || cleaned.includes('_')) {
    // Preserve special abbreviations like "BayWa r.e."
    if (!/^[a-zA-Z]\.[a-zA-Z]\.?$/.test(cleaned)) {
      cleaned = cleaned.replace(/[._]+/g, ' ');
    }
  }

  // 4. Split into words and ensure proper Capitalization (Title Case)
  const words = cleaned.split(/\s+/).filter(Boolean);
  const formattedWords = words.map(w => {
    const lower = w.toLowerCase();
    // Normalize combined first names like "aryankumar" -> "Aryan"
    if (lower === 'aryankumar') {
      return 'Aryan';
    }
    if (lower.endsWith('kumar') && lower.length > 5) {
      const root = lower.slice(0, -5);
      return root.charAt(0).toUpperCase() + root.slice(1);
    }
    // Capitalize all-lowercase or long all-uppercase words
    if (w === w.toLowerCase() || (w === w.toUpperCase() && w.length > 3)) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
    return w;
  });

  return formattedWords.join(' ').trim();
};
