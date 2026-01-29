/**
 * Resume Maker - Utility Functions
 */

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize HTML using DOMPurify (if available)
 * Allows safe HTML while removing dangerous elements
 */
export function sanitizeHtml(html) {
  if (!html) return '';

  // Use DOMPurify if available
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
    });
  }

  // Fallback to full escape
  return escapeHtml(html);
}

/**
 * Format date for display
 * Uses JobTrackerFormat (Day.js) if available for consistency with dashboard
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';

  // Handle "Present" or "Current" strings
  if (typeof dateStr === 'string' && /present|current|now/i.test(dateStr)) {
    return 'Present';
  }

  // Use shared JobTrackerFormat if available
  if (typeof window.JobTrackerFormat !== 'undefined') {
    return window.JobTrackerFormat.formatDate(dateStr, 'MMM YYYY');
  }

  // Fallback to native date formatting
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format date range
 */
export function formatDateRange(startDate, endDate) {
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : 'Present';

  if (!start && !end) return '';
  if (!start) return end;
  if (start === end) return start;

  return `${start} - ${end}`;
}

/**
 * Format date and time for display
 * Uses JobTrackerFormat (Day.js) if available
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';

  // Use shared JobTrackerFormat if available
  if (typeof window.JobTrackerFormat !== 'undefined') {
    return window.JobTrackerFormat.formatDateTime(dateStr);
  }

  // Fallback
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format relative time
 * Uses JobTrackerFormat (Day.js) if available for consistency with dashboard
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';

  // Use shared JobTrackerFormat if available
  if (typeof window.JobTrackerFormat !== 'undefined') {
    return window.JobTrackerFormat.formatRelativeTime(timestamp);
  }

  // Fallback to manual calculation
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return formatDate(new Date(timestamp).toISOString());
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);

  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Parse URL parameters
 */
export function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};

  for (const [key, value] of params) {
    try {
      result[key] = JSON.parse(decodeURIComponent(value));
    } catch {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Show toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Parse description into bullet points
 */
export function parseDescription(description) {
  if (!description) return [];

  // Split by newlines or bullet points
  const lines = description
    .split(/\n|•|▪|■|●|-\s/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return lines;
}

/**
 * Format description for display
 */
export function formatDescription(description) {
  const bullets = parseDescription(description);
  if (bullets.length === 0) return '';
  if (bullets.length === 1) return bullets[0];
  return bullets.map(b => `• ${b}`).join('\n');
}

/**
 * Generate unique ID
 */
export function generateId(prefix = '') {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Check if element is visible in viewport
 */
export function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Smooth scroll to element
 */
export function scrollToElement(element, options = {}) {
  const { behavior = 'smooth', block = 'start' } = options;
  element.scrollIntoView({ behavior, block });
}

/**
 * Wait for specified milliseconds
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get theme from storage or system preference
 */
export function getPreferredTheme() {
  // Check localStorage first
  const stored = localStorage.getItem('theme');
  if (stored && stored !== 'system') return stored;

  // Fall back to system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply theme to document
 */
export function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('theme', theme);
}

/**
 * Toggle between light and dark theme
 */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let newTheme;
  if (!current || current === 'system') {
    newTheme = prefersDark ? 'light' : 'dark';
  } else {
    newTheme = current === 'dark' ? 'light' : 'dark';
  }

  applyTheme(newTheme);
  return newTheme;
}

/**
 * Initialize theme based on stored preference
 */
export function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored && stored !== 'system') {
    applyTheme(stored);
  }
}

/**
 * Decode HTML entities in a string
 * Uses he library with double-decode for double-encoded content
 */
export function decodeHtmlEntities(str) {
  if (!str) return '';
  if (typeof he !== 'undefined') {
    return he.decode(he.decode(str));
  }
  // Fallback to DOMParser method if he not loaded (safer than textarea.innerHTML)
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!DOCTYPE html><body>${str}`, 'text/html');
    return doc.body.textContent || '';
  } catch {
    // Final fallback - return as-is
    return str;
  }
}

/**
 * Strip HTML tags and convert to plain text
 * Preserves line breaks from block elements
 */
export function stripHtmlTags(str) {
  if (!str) return '';

  // First decode HTML entities
  let text = decodeHtmlEntities(str);

  // Check if text contains HTML tags
  if (!/<[a-z][\s\S]*>/i.test(text)) {
    return text; // No HTML tags, return as-is
  }

  // Use DOMParser for safe parsing (doesn't execute scripts)
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const body = doc.body;

  // Remove script, style, and other non-content elements
  body.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());

  // Convert block elements to line breaks before extracting text
  body.querySelectorAll('p, div, br, li, h1, h2, h3, h4, h5, h6, tr').forEach(el => {
    if (el.tagName === 'BR') {
      el.replaceWith('\n');
    } else if (el.tagName === 'LI') {
      el.prepend('• ');
      el.append('\n');
    } else {
      el.append('\n');
    }
  });

  // Get text content
  let plainText = body.textContent || body.innerText || '';

  // Clean up excessive whitespace
  plainText = plainText
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')     // Collapse spaces/tabs
    .replace(/^ +| +$/gm, '')    // Trim lines
    .trim();

  return plainText;
}
