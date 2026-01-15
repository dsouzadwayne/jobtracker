/**
 * Section Detector - Identifies resume sections
 * Splits resume text into logical sections (Experience, Education, Skills, etc.)
 */

const ResumeSectionDetector = {
  // Section header patterns
  SECTION_PATTERNS: {
    summary: {
      patterns: [
        /^(?:professional\s+)?summary$/im,
        /^(?:career\s+)?objective$/im,
        /^profile$/im,
        /^about\s*me$/im,
        /^overview$/im
      ]
    },
    experience: {
      patterns: [
        /^(?:work\s+)?experience$/im,
        /^(?:professional\s+)?experience$/im,
        /^employment(?:\s+history)?$/im,
        /^work\s+history$/im,
        /^career\s+history$/im,
        /^positions?\s+held$/im
      ]
    },
    education: {
      patterns: [
        /^education(?:al\s+background)?$/im,
        /^academic(?:\s+background)?(?:\s+qualifications)?$/im,
        /^qualifications?$/im,
        /^degrees?$/im,
        /^schooling$/im,
        /^education\s*[:\-]/im,
        /^academics?$/im,
        /^educational\s+qualifications?$/im
      ]
    },
    skills: {
      patterns: [
        /^(?:technical\s+)?skills$/im,
        /^(?:core\s+)?competenc(?:ies|y)$/im,
        /^expertise$/im,
        /^proficienc(?:ies|y)$/im,
        /^technologies$/im,
        /^tools?\s*(?:&|and)?\s*technologies$/im
      ]
    },
    certifications: {
      patterns: [
        /^certifications?$/im,
        /^licenses?\s*(?:&|and)?\s*certifications?$/im,
        /^credentials?$/im,
        /^professional\s+certifications?$/im,
        /^accreditations?$/im
      ]
    },
    projects: {
      patterns: [
        /^(?:key\s+)?projects?$/im,
        /^portfolio$/im,
        /^selected\s+(?:work|projects)$/im
      ]
    },
    awards: {
      patterns: [
        /^awards?\s*(?:&|and)?\s*honors?$/im,
        /^achievements?$/im,
        /^recognition$/im,
        /^accomplishments?$/im
      ]
    },
    languages: {
      patterns: [
        /^languages?$/im,
        /^language\s+(?:skills|proficiency)$/im
      ]
    },
    interests: {
      patterns: [
        /^interests?$/im,
        /^hobbies?$/im,
        /^activities?$/im
      ]
    },
    references: {
      patterns: [
        /^references?$/im,
        /^references?\s+available$/im
      ]
    }
  },

  /**
   * Detect sections in resume text
   * @param {string} text - Resume text content
   * @returns {Object} - Object with section names and their content
   */
  detectSections(text) {
    const lines = text.split('\n');
    const sections = {
      header: '',       // Name and contact info (before first section)
      summary: '',
      experience: '',
      education: '',
      skills: '',
      certifications: '',
      projects: '',
      awards: '',
      languages: '',
      interests: '',
      references: '',
      unknown: []       // Unrecognized sections
    };

    let currentSection = 'header';
    let currentContent = [];
    let sectionPositions = [];

    // First pass: find all section headers and their positions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const detectedSection = this.detectSectionHeader(line);
      if (detectedSection) {
        sectionPositions.push({
          section: detectedSection,
          lineIndex: i,
          headerText: line
        });
      }
    }

    // Second pass: extract content for each section
    if (sectionPositions.length === 0) {
      // No sections found - treat entire text as unstructured
      sections.header = text;
      return sections;
    }

    // Content before first section is the header (name/contact)
    const firstSectionLine = sectionPositions[0].lineIndex;
    sections.header = lines.slice(0, firstSectionLine).join('\n').trim();

    // Extract content for each section
    for (let i = 0; i < sectionPositions.length; i++) {
      const current = sectionPositions[i];
      const startLine = current.lineIndex + 1; // Skip the header line
      const endLine = (i + 1 < sectionPositions.length)
        ? sectionPositions[i + 1].lineIndex
        : lines.length;

      const content = lines.slice(startLine, endLine).join('\n').trim();

      if (sections.hasOwnProperty(current.section)) {
        // Append to existing section (in case of duplicates)
        if (sections[current.section]) {
          sections[current.section] += '\n\n' + content;
        } else {
          sections[current.section] = content;
        }
      } else {
        sections.unknown.push({
          header: current.headerText,
          content: content
        });
      }
    }

    return sections;
  },

  /**
   * Detect if a line is a section header
   * @param {string} line - A single line of text
   * @returns {string|null} - Section name or null if not a header
   */
  detectSectionHeader(line) {
    // Skip very short or very long lines
    if (line.length < 3 || line.length > 50) return null;

    // Skip lines that look like content (contain too many words)
    const wordCount = line.split(/\s+/).length;
    if (wordCount > 5) return null;

    // Clean the line for matching
    const cleanLine = line
      .replace(/[:\-_|]/g, '')
      .replace(/^\d+\.\s*/, '')
      .trim();

    // Check against all section patterns
    for (const [sectionName, config] of Object.entries(this.SECTION_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(cleanLine)) {
          return sectionName;
        }
      }
    }

    return null;
  },

  /**
   * Check if text appears to be a section header
   * @param {string} text - Text to check
   * @returns {boolean} - True if likely a header
   */
  isLikelyHeader(text) {
    // Headers are typically:
    // - Short (less than 5 words)
    // - Often ALL CAPS or Title Case
    // - Don't end with common punctuation (except colon)

    const trimmed = text.trim();
    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount > 5) return false;
    if (trimmed.endsWith('.') || trimmed.endsWith(',')) return false;

    // Check for ALL CAPS
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) return true;

    // Check for Title Case (most words start with capital)
    const words = trimmed.split(/\s+/);
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
    if (capitalizedWords.length >= words.length * 0.8) return true;

    return false;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ResumeSectionDetector = ResumeSectionDetector;
}
