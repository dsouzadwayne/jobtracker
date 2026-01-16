/**
 * Profile Extractor - Extracts personal information from resume
 * Handles name, email, phone, LinkedIn, location
 */

const ProfileExtractor = {
  PATTERNS: {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4,6}/g,
    linkedIn: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i,
    github: /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i,
    url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
    location: /[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\b/
  },

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
      linkedin: ''
    };

    // Extract NAME from first few lines
    const nameItems = firstFewLines.flat();
    result.name = this.extractName(nameItems);

    // Extract EMAIL
    const emailMatch = profileText.match(this.PATTERNS.email);
    if (emailMatch) {
      result.email = emailMatch[0].toLowerCase();
    }

    // Extract PHONE
    const phoneMatch = profileText.match(this.PATTERNS.phone);
    if (phoneMatch) {
      result.phone = this.formatPhone(phoneMatch[0]);
    }

    // Extract LinkedIn
    const linkedInMatch = profileText.match(this.PATTERNS.linkedIn);
    if (linkedInMatch) {
      let linkedin = linkedInMatch[0];
      if (!linkedin.startsWith('http')) {
        linkedin = 'https://' + linkedin;
      }
      result.linkedin = linkedin;
    }

    // Extract GitHub or other URL
    const githubMatch = profileText.match(this.PATTERNS.github);
    if (githubMatch) {
      let github = githubMatch[0];
      if (!github.startsWith('http')) {
        github = 'https://' + github;
      }
      result.url = github;
    }

    // Extract location
    const locationMatch = profileText.match(this.PATTERNS.location);
    if (locationMatch) {
      result.location = locationMatch[0];
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
    if (!name) return { firstName: '', lastName: '' };

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }
};

if (typeof window !== 'undefined') {
  window.ProfileExtractor = ProfileExtractor;
}
