/**
 * JobTracker Format Utilities
 * Shared formatting functions for autofill and display
 * Includes Day.js powered date formatting
 */

// Initialize Day.js with relativeTime plugin if available
const dayjsAvailable = typeof dayjs !== 'undefined';
if (dayjsAvailable && typeof dayjs_plugin_relativeTime !== 'undefined') {
  dayjs.extend(dayjs_plugin_relativeTime);
}

const JobTrackerFormat = {
  // Currency symbols map
  CURRENCY_SYMBOLS: {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CAD': 'C$',
    'AUD': 'A$',
    'SGD': 'S$',
    'AED': 'AED ',
    'JPY': '¥',
    'CNY': '¥'
  },

  /**
   * Format CTC amount with currency symbol
   * @param {string} amount - The CTC amount
   * @param {string} currency - Currency code (INR, USD, etc.)
   * @returns {string} Formatted amount with currency symbol
   */
  formatCtc(amount, currency) {
    if (!amount) return '';
    const symbol = this.CURRENCY_SYMBOLS[currency] || '';
    return symbol + amount;
  },

  /**
   * Format phone number (basic formatting)
   * @param {string} phone - Phone number
   * @returns {string} Formatted phone
   */
  formatPhone(phone) {
    if (!phone) return '';
    return phone.trim();
  },

  /**
   * Format full name from parts
   * @param {string} firstName
   * @param {string} middleName
   * @param {string} lastName
   * @returns {string} Full name
   */
  formatFullName(firstName, middleName, lastName) {
    return [firstName, middleName, lastName]
      .filter(name => name && name.trim())
      .join(' ');
  },

  /**
   * Get currency symbol for a currency code
   * @param {string} currency - Currency code
   * @returns {string} Currency symbol
   */
  getCurrencySymbol(currency) {
    return this.CURRENCY_SYMBOLS[currency] || '';
  },

  // ==================== DATE FORMATTING (Day.js powered) ====================

  /**
   * Check if Day.js is available
   * @returns {boolean}
   */
  isDayjsAvailable() {
    return dayjsAvailable;
  },

  /**
   * Format date to relative time ("2 days ago", "in 3 hours")
   * @param {string|Date} date - Date to format
   * @returns {string} Relative time string
   */
  formatRelativeTime(date) {
    if (!date) return '';

    if (dayjsAvailable) {
      return dayjs(date).fromNow();
    }

    // Fallback: manual relative time calculation
    return this._fallbackRelativeTime(date);
  },

  /**
   * Format date to "X days ago" or "X days left" (for deadlines)
   * @param {string|Date} date - Date to format
   * @param {boolean} isFuture - If true, format as time remaining
   * @returns {string} Relative time string
   */
  formatDaysAgo(date, isFuture = false) {
    if (!date) return '';

    const now = new Date();
    const target = new Date(date);
    const diffMs = isFuture ? (target - now) : (now - target);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return isFuture ? 'Expired' : 'In the future';
    }

    if (diffDays === 0) {
      return 'Today';
    }

    if (diffDays === 1) {
      return isFuture ? '1 day left' : '1 day ago';
    }

    if (diffDays < 7) {
      return isFuture ? `${diffDays} days left` : `${diffDays} days ago`;
    }

    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return isFuture
        ? `${weeks} week${weeks > 1 ? 's' : ''} left`
        : `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }

    const months = Math.floor(diffDays / 30);
    return isFuture
      ? `${months} month${months > 1 ? 's' : ''} left`
      : `${months} month${months > 1 ? 's' : ''} ago`;
  },

  /**
   * Format date for display (e.g., "Jan 15, 2024")
   * @param {string|Date} date - Date to format
   * @param {string} format - Optional Day.js format string
   * @returns {string} Formatted date
   */
  formatDate(date, format = 'MMM D, YYYY') {
    if (!date) return '';

    if (dayjsAvailable) {
      return dayjs(date).format(format);
    }

    // Fallback to browser's toLocaleDateString
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  /**
   * Format date and time for display
   * @param {string|Date} date - Date to format
   * @param {string} format - Optional Day.js format string
   * @returns {string} Formatted date and time
   */
  formatDateTime(date, format = 'MMM D, YYYY h:mm A') {
    if (!date) return '';

    if (dayjsAvailable) {
      return dayjs(date).format(format);
    }

    // Fallback
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  },

  /**
   * Get time until a date (for deadlines)
   * @param {string|Date} date - Target date
   * @returns {object} { days, hours, minutes, expired }
   */
  getTimeUntil(date) {
    if (!date) return { days: 0, hours: 0, minutes: 0, expired: true };

    const now = new Date();
    const target = new Date(date);
    const diffMs = target - now;

    if (diffMs <= 0) {
      return { days: 0, hours: 0, minutes: 0, expired: true };
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, expired: false };
  },

  /**
   * Calculate days between two dates
   * @param {string|Date} startDate
   * @param {string|Date} endDate
   * @returns {number} Number of days
   */
  daysBetween(startDate, endDate) {
    if (!startDate || !endDate) return 0;

    if (dayjsAvailable) {
      return dayjs(endDate).diff(dayjs(startDate), 'day');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  },

  /**
   * Check if a date is in the past
   * @param {string|Date} date
   * @returns {boolean}
   */
  isPast(date) {
    if (!date) return false;

    if (dayjsAvailable) {
      return dayjs(date).isBefore(dayjs());
    }

    return new Date(date) < new Date();
  },

  /**
   * Check if a date is today
   * @param {string|Date} date
   * @returns {boolean}
   */
  isToday(date) {
    if (!date) return false;

    if (dayjsAvailable) {
      return dayjs(date).isSame(dayjs(), 'day');
    }

    const d = new Date(date);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  },

  /**
   * Fallback relative time calculation when Day.js is not available
   * @private
   */
  _fallbackRelativeTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now - target;
    const isFuture = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);

    const seconds = Math.floor(absDiffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    const suffix = isFuture ? '' : ' ago';
    const prefix = isFuture ? 'in ' : '';

    if (seconds < 60) return isFuture ? 'in a few seconds' : 'just now';
    if (minutes === 1) return `${prefix}a minute${suffix}`;
    if (minutes < 60) return `${prefix}${minutes} minutes${suffix}`;
    if (hours === 1) return `${prefix}an hour${suffix}`;
    if (hours < 24) return `${prefix}${hours} hours${suffix}`;
    if (days === 1) return `${prefix}a day${suffix}`;
    if (days < 30) return `${prefix}${days} days${suffix}`;
    if (months === 1) return `${prefix}a month${suffix}`;
    if (months < 12) return `${prefix}${months} months${suffix}`;
    if (years === 1) return `${prefix}a year${suffix}`;
    return `${prefix}${years} years${suffix}`;
  }
};

// Make available globally for content scripts
window.JobTrackerFormat = JobTrackerFormat;
