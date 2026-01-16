/**
 * Country Codes Module
 * Comprehensive list of international dialing codes
 */
const CountryCodes = {
  // Sorted by code length (longest first) for matching priority
  CODES: [
    // 4-digit codes
    { code: '1684', country: 'American Samoa', minLen: 14 },
    { code: '1670', country: 'Northern Mariana Islands', minLen: 14 },
    { code: '1671', country: 'Guam', minLen: 14 },

    // 3-digit codes (ordered by code for deterministic matching)
    { code: '971', country: 'UAE', minLen: 12 },
    { code: '966', country: 'Saudi Arabia', minLen: 12 },
    { code: '965', country: 'Kuwait', minLen: 11 },
    { code: '968', country: 'Oman', minLen: 11 },
    { code: '974', country: 'Qatar', minLen: 11 },
    { code: '973', country: 'Bahrain', minLen: 11 },
    { code: '962', country: 'Jordan', minLen: 12 },
    { code: '961', country: 'Lebanon', minLen: 11 },
    { code: '972', country: 'Israel', minLen: 12 },
    { code: '963', country: 'Syria', minLen: 12 },
    { code: '964', country: 'Iraq', minLen: 13 },
    { code: '353', country: 'Ireland', minLen: 12 },
    { code: '354', country: 'Iceland', minLen: 10 },
    { code: '358', country: 'Finland', minLen: 12 },
    { code: '351', country: 'Portugal', minLen: 12 },
    { code: '352', country: 'Luxembourg', minLen: 11 },
    { code: '370', country: 'Lithuania', minLen: 11 },
    { code: '371', country: 'Latvia', minLen: 11 },
    { code: '372', country: 'Estonia', minLen: 11 },
    { code: '380', country: 'Ukraine', minLen: 12 },
    { code: '381', country: 'Serbia', minLen: 12 },
    { code: '385', country: 'Croatia', minLen: 12 },
    { code: '386', country: 'Slovenia', minLen: 11 },
    { code: '420', country: 'Czech Republic', minLen: 12 },
    { code: '421', country: 'Slovakia', minLen: 12 },
    { code: '852', country: 'Hong Kong', minLen: 11 },
    { code: '853', country: 'Macau', minLen: 11 },
    { code: '886', country: 'Taiwan', minLen: 12 },
    { code: '880', country: 'Bangladesh', minLen: 13 },
    { code: '977', country: 'Nepal', minLen: 13 },
    { code: '994', country: 'Azerbaijan', minLen: 12 },
    { code: '995', country: 'Georgia', minLen: 12 },
    { code: '998', country: 'Uzbekistan', minLen: 12 },

    // 2-digit codes (most common)
    { code: '91', country: 'India', minLen: 12 },
    { code: '92', country: 'Pakistan', minLen: 12 },
    { code: '93', country: 'Afghanistan', minLen: 12 },
    { code: '94', country: 'Sri Lanka', minLen: 11 },
    { code: '95', country: 'Myanmar', minLen: 12 },
    { code: '98', country: 'Iran', minLen: 12 },
    { code: '90', country: 'Turkey', minLen: 12 },
    { code: '82', country: 'South Korea', minLen: 12 },
    { code: '81', country: 'Japan', minLen: 12 },
    { code: '86', country: 'China', minLen: 13 },
    { code: '84', country: 'Vietnam', minLen: 12 },
    { code: '66', country: 'Thailand', minLen: 11 },
    { code: '65', country: 'Singapore', minLen: 10 },
    { code: '63', country: 'Philippines', minLen: 12 },
    { code: '62', country: 'Indonesia', minLen: 13 },
    { code: '60', country: 'Malaysia', minLen: 11 },
    { code: '61', country: 'Australia', minLen: 11 },
    { code: '64', country: 'New Zealand', minLen: 11 },
    { code: '44', country: 'UK', minLen: 12 },
    { code: '49', country: 'Germany', minLen: 12 },
    { code: '33', country: 'France', minLen: 11 },
    { code: '34', country: 'Spain', minLen: 11 },
    { code: '39', country: 'Italy', minLen: 12 },
    { code: '31', country: 'Netherlands', minLen: 11 },
    { code: '32', country: 'Belgium', minLen: 11 },
    { code: '41', country: 'Switzerland', minLen: 11 },
    { code: '43', country: 'Austria', minLen: 12 },
    { code: '45', country: 'Denmark', minLen: 10 },
    { code: '46', country: 'Sweden', minLen: 11 },
    { code: '47', country: 'Norway', minLen: 10 },
    { code: '48', country: 'Poland', minLen: 11 },
    { code: '36', country: 'Hungary', minLen: 11 },
    { code: '30', country: 'Greece', minLen: 12 },
    { code: '40', country: 'Romania', minLen: 11 },
    { code: '27', country: 'South Africa', minLen: 11 },
    { code: '20', country: 'Egypt', minLen: 12 },
    { code: '55', country: 'Brazil', minLen: 13 },
    { code: '52', country: 'Mexico', minLen: 12 },
    { code: '54', country: 'Argentina', minLen: 13 },
    { code: '56', country: 'Chile', minLen: 11 },
    { code: '57', country: 'Colombia', minLen: 12 },
    { code: '58', country: 'Venezuela', minLen: 12 },
    { code: '51', country: 'Peru', minLen: 11 },

    // 1-digit code (must be last for matching)
    { code: '1', country: 'US/Canada', minLen: 11 },
    { code: '7', country: 'Russia/Kazakhstan', minLen: 11 },
  ],

  /**
   * Find matching country code from digits
   * @param {string} digits - Phone number digits only
   * @returns {Object|null} - { code, country, minLen } or null
   */
  findMatch(digits) {
    for (const entry of this.CODES) {
      if (digits.startsWith(entry.code) && digits.length >= entry.minLen) {
        return entry;
      }
    }
    return null;
  },

  /**
   * Format phone number with country code
   * @param {string} phone - Raw phone number
   * @returns {string} - Formatted phone number
   */
  formatPhone(phone) {
    if (!phone) return '';

    let cleaned = phone.trim()
      .replace(/\s+/g, ' ')
      .replace(/[()]/g, '')
      .replace(/\s*-\s*/g, '-');

    // Already has country code with +
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    const digits = cleaned.replace(/\D/g, '');

    if (digits.length > 10) {
      const match = this.findMatch(digits);
      if (match) {
        return `+${match.code} ${digits.slice(match.code.length)}`;
      }
      // Unknown country code, just add +
      return `+${digits}`;
    }

    return cleaned;
  }
};

if (typeof window !== 'undefined') {
  window.CountryCodes = CountryCodes;
}
