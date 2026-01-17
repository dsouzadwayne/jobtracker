/**
 * Dashboard Utility Functions
 * Common helper functions used across dashboard modules
 */

import { VALID_STATUSES } from './state.js';

// Escape HTML to prevent XSS
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Format date for display
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  // Escape HTML first
  let formatted = escapeHtml(text);

  // Convert lines starting with bullet-like characters to proper bullets
  formatted = formatted
    // Handle lines starting with •, -, *, or similar
    .replace(/^[\s]*[•\-\*\●\○\■\□\►\▸]\s*/gm, '<li>')
    // Handle numbered lists (1. 2. etc)
    .replace(/^[\s]*\d+[\.\)]\s+/gm, '<li>')
    // Wrap consecutive <li> items in <ul>
    .replace(/(<li>.*?)(?=(?:<li>|$))/gs, '$1</li>');

  // Wrap sequences of list items in ul tags
  formatted = formatted.replace(/((?:<li>.*?<\/li>\s*)+)/gs, '<ul class="job-desc-list">$1</ul>');

  // Convert double line breaks to paragraph breaks
  formatted = formatted.replace(/\n\n+/g, '</p><p>');

  // Convert remaining single line breaks
  formatted = formatted.replace(/\n/g, '<br>');

  // Wrap in paragraph if not empty
  if (formatted.trim()) {
    formatted = '<p>' + formatted + '</p>';
  }

  // Clean up empty paragraphs
  formatted = formatted.replace(/<p>\s*<\/p>/g, '');

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
