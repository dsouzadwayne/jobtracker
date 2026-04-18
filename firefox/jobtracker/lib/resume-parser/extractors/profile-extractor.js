/**
 * Profile Extractor - Extracts personal information from resume
 * Handles name, email, phone, LinkedIn, location
 */

const ProfileExtractor = {
  PATTERNS: {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // International phone formats: US, UK, India, EU, etc.
    phone: /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{1,5}\)?[-.\s]?)?(?:\d{2,5}[-.\s]?){1,4}\d{2,5}/g,
    linkedIn: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/i,
    github: /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/?/i,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[\w-]+\/?/i,
    portfolio: /(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:com|io|dev|me|co|net|org)(?:\/[\w-]*)?/gi,
    url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
    // International locations: City, State/Country formats
    location: /(?:[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?|[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+(?:,\s*[A-Z][a-zA-Z\s]+)?)/g
  },

  // Common name suffixes to handle
  NAME_SUFFIXES: ['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV', 'PhD', 'Ph.D', 'Ph.D.', 'MD', 'M.D.', 'MBA', 'CPA', 'Esq', 'Esq.'],

  extract(sections) {
    const lines = sections.profile || [];
    const firstFewLines = lines.slice(0, 3);

    // Convert to plain text for regex matching
    const profileText = lines.map(line =>
      line.map(item => item.text).join(' ')
    ).join('\n');

    const result = {
      name: '',
      email: '',
      phone: '',
      location: '',
      url: '',
      linkedin: '',
      github: '',
      twitter: ''
    };

    // Extract NAME from first few lines
    const nameItems = firstFewLines.flat();
    result.name = this.extractName(nameItems);

    // Extract EMAIL - prefer professional-looking emails
    const emailMatches = profileText.match(this.PATTERNS.email) || [];
    if (emailMatches.length > 0) {
      // Prefer non-noreply, non-example emails
      const validEmails = emailMatches.filter(e =>
        !e.includes('noreply') && !e.includes('example.com')
      );
      result.email = (validEmails[0] || emailMatches[0]).toLowerCase();
    }

    // Extract PHONE - filter out numbers that are likely years or IDs
    const phoneMatches = profileText.match(this.PATTERNS.phone) || [];
    for (const phone of phoneMatches) {
      const cleaned = phone.replace(/\D/g, '');
      // Valid phone numbers are typically 10-15 digits, not 4-digit years
      if (cleaned.length >= 10 && cleaned.length <= 15) {
        result.phone = this.formatPhone(phone);
        break;
      }
    }

    // Extract LinkedIn
    const linkedInMatch = profileText.match(this.PATTERNS.linkedIn);
    if (linkedInMatch) {
      let linkedin = linkedInMatch[0].replace(/\/$/, ''); // Remove trailing slash
      if (!linkedin.startsWith('http')) {
        linkedin = 'https://' + linkedin;
      }
      result.linkedin = linkedin;
    }

    // Extract GitHub
    const githubMatch = profileText.match(this.PATTERNS.github);
    if (githubMatch) {
      let github = githubMatch[0].replace(/\/$/, '');
      if (!github.startsWith('http')) {
        github = 'https://' + github;
      }
      result.github = github;
    }

    // Extract Twitter/X
    const twitterMatch = profileText.match(this.PATTERNS.twitter);
    if (twitterMatch) {
      let twitter = twitterMatch[0].replace(/\/$/, '');
      if (!twitter.startsWith('http')) {
        twitter = 'https://' + twitter;
      }
      result.twitter = twitter;
    }

    // Extract portfolio/personal website (exclude social media)
    const urlMatches = profileText.match(this.PATTERNS.url) || [];
    for (const url of urlMatches) {
      if (!url.includes('linkedin.com') &&
          !url.includes('github.com') &&
          !url.includes('twitter.com') &&
          !url.includes('x.com') &&
          !url.includes('facebook.com') &&
          !url.includes('instagram.com')) {
        result.url = url;
        break;
      }
    }

    // Extract location - try multiple patterns
    const locationMatches = profileText.match(this.PATTERNS.location) || [];
    if (locationMatches.length > 0) {
      // Filter out matches that look like dates or names
      const validLocations = locationMatches.filter(loc =>
        !(/\d{4}/.test(loc)) && loc.length > 3 && loc.length < 60
      );
      if (validLocations.length > 0) {
        result.location = validLocations[0].trim();
      }
    }

    return result;
  },

  extractName(items) {
    // First pass: look for bold or all-caps name
    for (const item of items) {
      const text = item.text.trim();

      // Skip contact info
      if (text.includes('@')) continue;
      if (/\d{3,}/.test(text)) continue;
      if (/linkedin|github/i.test(text)) continue;
      if (text.length > 40 || text.length < 3) continue;

      // Check if it looks like a name
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const isNameLike = words.length >= 2 && words.length <= 4 &&
                         words.every(w => /^[A-Za-z''.-]+$/.test(w));

      const isBold = item.fontName && item.fontName.toLowerCase().includes('bold');
      const isAllCaps = /[A-Z]/.test(text) && text === text.toUpperCase();

      if (isNameLike && (isBold || isAllCaps || words.length === 2)) {
        return text;
      }
    }

    // Second pass: any name-like text
    for (const item of items) {
      const text = item.text.trim();
      if (text.includes('@') || /\d{3,}/.test(text)) continue;

      const words = text.split(/\s+/).filter(w => /^[A-Za-z''.-]+$/.test(w));
      if (words.length >= 2 && words.length <= 4) {
        return words.join(' ');
      }
    }

    return '';
  },

  formatPhone(phone) {
    // Use CountryCodes module if available
    if (typeof CountryCodes !== 'undefined') {
      return CountryCodes.formatPhone(phone);
    }
    // Fallback to basic formatting
    if (!phone) return '';
    return phone.trim();
  },

  splitName(name) {
    if (!name) return { firstName: '', middleName: '', lastName: '', suffix: '' };

    let parts = name.trim().split(/\s+/);

    // Extract suffix if present
    let suffix = '';
    const lastPart = parts[parts.length - 1];
    if (this.NAME_SUFFIXES.some(s => s.toLowerCase() === lastPart.toLowerCase().replace(/\.$/, ''))) {
      suffix = lastPart;
      parts = parts.slice(0, -1);
    }

    if (parts.length === 0) {
      return { firstName: '', middleName: '', lastName: '', suffix };
    }

    if (parts.length === 1) {
      return { firstName: parts[0], middleName: '', lastName: '', suffix };
    }

    if (parts.length === 2) {
      return {
        firstName: parts[0],
        middleName: '',
        lastName: parts[1],
        suffix
      };
    }

    // 3+ parts: first, middle(s), last
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1],
      suffix
    };
  }
};

if (typeof window !== 'undefined') {
  window.ProfileExtractor = ProfileExtractor;
}
