/**
 * JobTracker Format Utilities
 * Shared formatting functions for autofill and display
 */

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
  }
};

// Make available globally for content scripts
window.JobTrackerFormat = JobTrackerFormat;
