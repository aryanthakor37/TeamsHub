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
 * Example: Keval 'Trivedi' -> Keval Trivedi
 * Example: 'Aryan Kumrecha' -> Aryan Kumrecha
 * Example: "Estatic Infotech" -> Estatic Infotech
 */
export const sanitizeDisplayName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/[`'"]/g, '')
    .replace(/\\['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};
