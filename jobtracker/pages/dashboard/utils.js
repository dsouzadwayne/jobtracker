/**
 * Dashboard Utility Functions
 * Common helper functions used across dashboard modules
 */

import { VALID_STATUSES } from './state.js';

// Decode HTML entities in text
export function decodeHtmlEntities(str) {
  if (!str) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

// Escape HTML to prevent XSS
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Decode HTML entities then escape for safe display
// Use this for data that may contain HTML entities from web scraping
export function safeText(str) {
  if (!str) return '';
  return escapeHtml(decodeHtmlEntities(str));
}

// Format date for display
export function formatDate(dateStr) {
  if (!dateStr) return '';

  // Use JobTrackerFormat if available (Day.js powered)
  if (typeof window !== 'undefined' && window.JobTrackerFormat) {
    return window.JobTrackerFormat.formatDate(dateStr);
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format date with relative time option
export function formatDateRelative(dateStr, useRelative = true) {
  if (!dateStr) return '';

  // Use JobTrackerFormat if available (Day.js powered)
  if (typeof window !== 'undefined' && window.JobTrackerFormat && useRelative) {
    return window.JobTrackerFormat.formatDaysAgo(dateStr);
  }

  return formatDate(dateStr);
}

// Format date for input fields
export function formatDateInput(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

// Format datetime for input fields
export function formatDateTimeInput(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

// Format time from datetime
export function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Capitalize status string
export function capitalizeStatus(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
}

// Sanitize status to prevent XSS via class injection
export function sanitizeStatus(status) {
  const normalized = (status || 'applied').toLowerCase();
  return VALID_STATUSES.includes(normalized) ? normalized : 'applied';
}

// Detect job platform from URL
export function detectPlatform(url) {
  if (!url) return 'other';
  const platforms = {
    'linkedin': /linkedin\.com/i,
    'indeed': /indeed\.com/i,
    'glassdoor': /glassdoor\.(com|co\.uk)/i,
    'greenhouse': /greenhouse\.io/i,
    'lever': /lever\.(co|com)/i,
    'workday': /(myworkdayjobs|workday)\.com/i,
    'icims': /icims\.com/i,
    'smartrecruiters': /smartrecruiters\.com/i
  };

  for (const [platform, pattern] of Object.entries(platforms)) {
    if (pattern.test(url)) return platform;
  }
  return 'other';
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Validate URL format and protocol (prevent XSS via javascript: URLs)
export function isValidUrl(url) {
  if (!url || !url.trim()) return true; // Empty URLs are valid (optional field)
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Sanitize URL for safe use in href attributes
export function sanitizeUrl(url) {
  if (!url || !url.trim()) return '';
  if (!isValidUrl(url)) return '#invalid-url';
  return escapeHtml(url);
}

// Get relative time string
export function getTimeAgo(timestamp) {
  // Use JobTrackerFormat if available (Day.js powered)
  if (typeof window !== 'undefined' && window.JobTrackerFormat) {
    return window.JobTrackerFormat.formatRelativeTime(timestamp);
  }

  // Fallback
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp);
}

// Show notification toast
export function showNotification(message, type = 'info') {
  // Remove existing notification if any
  const existing = document.getElementById('notification-toast');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'notification-toast';
  notification.className = `notification-toast notification-${type}`;
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'assertive');
  notification.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="notification-close" aria-label="Dismiss">&times;</button>
  `;

  document.body.appendChild(notification);

  // Add close handler
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('notification-fade-out');
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

// Format job description with bullet points and structure
export function formatJobDescription(text) {
  if (!text) return '';

  // First decode any HTML entities (e.g., &lt;p&gt; -> <p>)
  let decoded = decodeHtmlEntities(text);

  // Check if the decoded text contains HTML tags
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(decoded);

  if (hasHtmlTags) {
    // Content has HTML - sanitize and render it
    // Create a temporary div to parse HTML safely
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = decoded;

    // Remove any script tags and event handlers for security
    tempDiv.querySelectorAll('script, style').forEach(el => el.remove());
    tempDiv.querySelectorAll('*').forEach(el => {
      // Remove all event handlers
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    // Add styling class to lists
    tempDiv.querySelectorAll('ul, ol').forEach(el => {
      el.classList.add('job-desc-list');
    });

    return tempDiv.innerHTML;
  }

  // Plain text - format with bullet detection
  let escaped = escapeHtml(decoded);

  // Split into lines for processing
  const lines = escaped.split('\n');
  const result = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if line starts with a bullet character
    const bulletMatch = trimmedLine.match(/^[•\-\*\●\○\■\□\►\▸]\s*(.*)$/);
    // Check if line starts with a number (numbered list)
    const numberMatch = trimmedLine.match(/^\d+[\.\)]\s+(.*)$/);

    if (bulletMatch || numberMatch) {
      // Start a list if not already in one
      if (!inList) {
        result.push('<ul class="job-desc-list">');
        inList = true;
      }
      const content = bulletMatch ? bulletMatch[1] : numberMatch[1];
      result.push(`<li>${content}</li>`);
    } else {
      // Close the list if we were in one
      if (inList) {
        result.push('</ul>');
        inList = false;
      }

      // Handle empty lines as paragraph breaks
      if (trimmedLine === '') {
        // Only add break if previous wasn't already a break
        if (result.length > 0 && !result[result.length - 1].endsWith('</ul>')) {
          result.push('<br><br>');
        }
      } else {
        // Regular text line
        result.push(trimmedLine + '<br>');
      }
    }
  }

  // Close any remaining open list
  if (inList) {
    result.push('</ul>');
  }

  let formatted = result.join('\n');

  // Clean up excessive line breaks
  formatted = formatted.replace(/(<br>\s*){3,}/g, '<br><br>');
  formatted = formatted.replace(/^<br>|<br>$/g, '');

  return formatted;
}

// Validate form data
export function validateFormData(appData) {
  const errors = [];

  // Required fields
  if (!appData.company || appData.company.length === 0) {
    errors.push('Company name is required');
  }
  if (!appData.position || appData.position.length === 0) {
    errors.push('Position is required');
  }

  // Max length validation (prevent excessive data)
  const maxLengths = {
    company: 200,
    position: 200,
    location: 200,
    salary: 100,
    jobUrl: 2000,
    jobDescription: 50000,
    notes: 10000
  };

  for (const [field, maxLen] of Object.entries(maxLengths)) {
    if (appData[field] && appData[field].length > maxLen) {
      errors.push(`${capitalizeStatus(field)} exceeds maximum length of ${maxLen} characters`);
    }
  }

  // URL validation
  if (appData.jobUrl && !isValidUrl(appData.jobUrl)) {
    errors.push('Please enter a valid URL starting with http:// or https://');
  }

  return errors;
}
