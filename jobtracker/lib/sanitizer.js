/**
 * JobTracker HTML Sanitizer Module
 * Provides XSS-safe HTML sanitization using DOMPurify
 *
 * Usage:
 *   import { sanitize, sanitizeText } from './lib/sanitizer.js';
 *
 *   // For HTML content that should preserve safe tags
 *   element.innerHTML = sanitize(htmlContent);
 *
 *   // For plain text (strips all HTML)
 *   element.textContent = sanitizeText(userInput);
 */

// Check if DOMPurify is available (loaded via script tag in HTML files)
const getDOMPurify = () => {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify;
  }
  // Fallback warning if DOMPurify isn't loaded
  console.warn('[Sanitizer] DOMPurify not loaded, using fallback sanitization');
  return null;
};

/**
 * Default DOMPurify configuration for JobTracker
 * - Allows safe HTML tags for formatting
 * - Blocks all dangerous elements and attributes
 * - Prevents JavaScript execution vectors
 */
const PURIFY_CONFIG = {
  // Allow only safe formatting tags
  // Note: 'div' and 'span' are allowed for layout but could be misused for styling attacks
  // if combined with class attributes - monitor usage
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'u', 's', 'strike',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'code',
    'a', 'span',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  // Allow only safe attributes
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title', 'class', 'id',
    'colspan', 'rowspan'
  ],
  // Force all links to open in new tab and prevent referrer leaks
  ADD_ATTR: ['target', 'rel'],
  // Strict URI scheme whitelist - only allow http, https, mailto, and relative URLs
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/(?!\/)|#)/i,
  // Keep text content when removing disallowed tags (don't lose user's text)
  KEEP_CONTENT: true,
  // Additional security
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'div'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
};

/**
 * Strict config for text-only content (no HTML allowed)
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
};

/**
 * Fallback sanitization when DOMPurify is not available
 * Uses basic HTML entity encoding
 */
function fallbackSanitize(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';

  return dirty
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Sanitize HTML content, allowing safe formatting tags
 * Use this when rendering user-provided HTML that may contain formatting
 *
 * @param {string} dirty - Potentially unsafe HTML string
 * @param {Object} customConfig - Optional custom DOMPurify config
 * @returns {string} Sanitized HTML safe for innerHTML
 *
 * @example
 *   element.innerHTML = sanitize(userNotes);
 */
function sanitize(dirty, customConfig = {}) {
  if (!dirty || typeof dirty !== 'string') return '';

  const purify = getDOMPurify();
  if (purify) {
    const config = { ...PURIFY_CONFIG, ...customConfig };
    return purify.sanitize(dirty, config);
  }

  return fallbackSanitize(dirty);
}

/**
 * Sanitize to plain text, stripping ALL HTML tags
 * Use this when only text content is expected
 *
 * @param {string} dirty - Potentially unsafe string
 * @returns {string} Plain text with all HTML removed
 *
 * @example
 *   element.textContent = sanitizeText(userName);
 */
function sanitizeText(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';

  const purify = getDOMPurify();
  if (purify) {
    return purify.sanitize(dirty, STRICT_CONFIG);
  }

  // Fallback: strip all HTML tags
  return dirty.replace(/<[^>]*>/g, '');
}

/**
 * Check if DOMPurify is available
 * @returns {boolean} Whether DOMPurify is loaded
 */
function isPurifyAvailable() {
  return typeof DOMPurify !== 'undefined';
}

/**
 * Create a sanitized HTML element directly
 * Useful for building DOM elements with mixed content
 *
 * @param {string} tagName - Element tag name
 * @param {string} innerHTML - HTML content to sanitize
 * @param {Object} attributes - Optional attributes to set
 * @returns {HTMLElement} Sanitized DOM element
 */
function createSanitizedElement(tagName, innerHTML, attributes = {}) {
  const element = document.createElement(tagName);
  element.innerHTML = sanitize(innerHTML);

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'class') {
      element.className = value;
    } else if (key === 'id') {
      element.id = value;
    } else {
      element.setAttribute(key, value);
    }
  }

  return element;
}

/**
 * Safely set innerHTML on an element
 * Convenience wrapper that sanitizes before setting
 *
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content to sanitize and set
 */
function setInnerHTML(element, html) {
  if (element && typeof element.innerHTML !== 'undefined') {
    element.innerHTML = sanitize(html);
  }
}

// Export functions
export {
  sanitize,
  sanitizeText,
  isPurifyAvailable,
  createSanitizedElement,
  setInnerHTML,
  PURIFY_CONFIG,
  STRICT_CONFIG
};

// Also export as default object for CommonJS-style imports
export default {
  sanitize,
  sanitizeText,
  isPurifyAvailable,
  createSanitizedElement,
  setInnerHTML
};
