/**
 * JobTracker Utility Functions
 * Common helper functions used across the extension
 */

const JobTrackerUtils = {
  // Format date for display
  formatDate(dateString, format = 'short') {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    if (format === 'short') {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } else if (format === 'long') {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } else if (format === 'relative') {
      return this.getRelativeTime(date);
    }
    return date.toLocaleDateString();
  },

  // Get relative time (e.g., "2 days ago")
  getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    return this.formatDate(date, 'short');
  },

  // Format date for input fields (YYYY-MM)
  formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  },

  // Parse month-year input to ISO date
  parseMonthYearInput(value) {
    if (!value) return '';
    const [year, month] = value.split('-');
    return new Date(year, month - 1, 1).toISOString();
  },

  // Truncate text with ellipsis
  truncate(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    if (maxLength < 4) return text.substring(0, maxLength);
    return text.substring(0, maxLength - 3) + '...';
  },

  // Capitalize first letter
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // Convert status to display text
  getStatusDisplay(status) {
    const statusMap = {
      'saved': 'Saved',
      'applied': 'Applied',
      'screening': 'Screening',
      'interview': 'Interview',
      'offer': 'Offer',
      'rejected': 'Rejected',
      'withdrawn': 'Withdrawn'
    };
    return statusMap[status] || this.capitalize(status);
  },

  // Get status color class
  getStatusColor(status) {
    const colorMap = {
      'saved': 'status-saved',
      'applied': 'status-applied',
      'screening': 'status-screening',
      'interview': 'status-interview',
      'offer': 'status-offer',
      'rejected': 'status-rejected',
      'withdrawn': 'status-withdrawn'
    };
    return colorMap[status] || 'status-default';
  },

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Sanitize HTML to prevent XSS
  // Uses DOMPurify if available, falls back to basic escaping
  sanitizeHTML(str) {
    if (!str) return '';

    // Use DOMPurify if available (recommended)
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(str, {
        ALLOWED_TAGS: [
          'b', 'i', 'em', 'strong', 'u', 's',
          'p', 'br', 'hr',
          'ul', 'ol', 'li',
          'a', 'span', 'div'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
        ALLOW_DATA_ATTR: false
      });
    }

    // Fallback: escape all HTML entities (returns text only, no HTML preserved)
    // This returns HTML-encoded text that can be safely used in innerHTML
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  // Sanitize and set innerHTML safely
  // This is the preferred method for setting innerHTML
  setInnerHTML(element, html) {
    if (!element) return;

    if (typeof DOMPurify !== 'undefined') {
      element.innerHTML = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'b', 'i', 'em', 'strong', 'u', 's',
          'p', 'br', 'hr',
          'ul', 'ol', 'li',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'a', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
          'svg', 'path', 'line', 'circle', 'rect', 'polyline', 'polygon'
        ],
        ALLOWED_ATTR: [
          'href', 'target', 'rel', 'class', 'id', 'title',
          'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
          'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
          'points', 'aria-hidden', 'aria-label', 'role'
        ],
        ALLOW_DATA_ATTR: false
      });
    } else {
      // Fallback: use textContent for safety when DOMPurify is unavailable
      // This strips all HTML but ensures no XSS vulnerabilities
      element.textContent = html;
    }
  },

  // Check if DOMPurify is available
  isPurifyAvailable() {
    return typeof DOMPurify !== 'undefined';
  },

  // Escape special regex characters
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  // Check if URL matches a pattern
  urlMatches(url, pattern) {
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(regexPattern, 'i').test(url);
  },

  // Extract domain from URL
  getDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  },

  // Detect job board platform from URL
  detectPlatform(url) {
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
  },

  // Deep clone an object
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // Merge objects deeply
  deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && key in target) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  },

  // Download data as JSON file
  downloadJSON(data, filename = 'jobtracker-export.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Read file as JSON
  readFileAsJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  },

  // Show notification (if permissions allow)
  async showNotification(title, message, options = {}) {
    if (typeof chrome !== 'undefined' && chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
        title,
        message,
        ...options
      });
    }
  },

  // Send message to background script
  async sendMessage(type, payload = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime.sendMessage({ type, payload });
    }
    return null;
  },

  // Get current tab URL
  async getCurrentTabUrl() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.url || window.location.href;
    }
    return window.location.href;
  },

  // Create element helper
  createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = this.sanitizeHTML(value);
      } else if (key.startsWith('on')) {
        element.addEventListener(key.substring(2).toLowerCase(), value);
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else {
        element.setAttribute(key, value);
      }
    }
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
    return element;
  },

  // Wait for element to appear in DOM
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      let timeoutId;
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          clearTimeout(timeoutId);
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      timeoutId = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);
    });
  },

  // Sleep helper
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerUtils = JobTrackerUtils;
}
