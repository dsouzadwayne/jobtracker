/**
 * Section Grouper - Groups lines into resume sections
 * Detects section titles by bold/uppercase text or keywords
 */

const SectionGrouper = {
  SECTION_KEYWORDS: [
    // Work/Experience
    'experience', 'employment', 'work', 'professional', 'career', 'history',
    // Education
    'education', 'academic', 'qualification', 'degree', 'university', 'school',
    // Skills
    'skill', 'competenc', 'expertise', 'technologies', 'technical', 'proficienc', 'abilities',
    // Projects
    'project', 'portfolio', 'personal project', 'side project',
    // Summary/Objective
    'summary', 'objective', 'profile', 'about', 'overview', 'introduction', 'statement',
    // Certifications
    'certification', 'certificate', 'license', 'credential', 'accreditation',
    // Awards
    'award', 'achievement', 'honor', 'recognition', 'accomplishment',
    // Publications
    'publication', 'paper', 'research', 'article', 'journal',
    // Languages
    'language', 'linguistic',
    // Volunteer/Leadership
    'volunteer', 'community', 'leadership', 'extracurricular', 'activities',
    // References
    'reference', 'referees',
    // Interests
    'interest', 'hobbies', 'hobby', 'passion'
  ],

  group(lines) {
    const sections = {};
    let sectionName = 'profile';
    let sectionLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (this.isSectionTitle(line, i)) {
        if (sectionLines.length > 0) {
          sections[sectionName] = [...sectionLines];
        }
        sectionName = this.normalizeSectionName(line[0]?.text?.trim() || 'unknown');
        sectionLines = [];
      } else {
        sectionLines.push(line);
      }
    }

    if (sectionLines.length > 0) {
      sections[sectionName] = [...sectionLines];
    }

    return sections;
  },

  isSectionTitle(line, lineNumber) {
    const isFirstTwoLines = lineNumber < 2;
    const hasMoreThanOneItem = line.length > 1;
    const hasNoItem = line.length === 0;

    if (isFirstTwoLines || hasMoreThanOneItem || hasNoItem) return false;

    const item = line[0];
    const text = item.text.trim();

    // Main heuristic: bold + all uppercase
    const isBold = item.fontName && item.fontName.toLowerCase().includes('bold');
    const isAllUpperCase = /[a-zA-Z]/.test(text) && text === text.toUpperCase();

    if (isBold && isAllUpperCase) return true;

    // Fallback: keyword match
    const textLower = text.toLowerCase();
    const hasKeyword = this.SECTION_KEYWORDS.some(kw => textLower.includes(kw));
    const hasAtMost2Words = text.split(' ').filter(s => s !== '&').length <= 2;
    const hasOnlyLetters = /^[A-Za-z\s&]+$/.test(text);

    if (hasAtMost2Words && hasOnlyLetters && hasKeyword) return true;

    return false;
  },

  normalizeSectionName(name) {
    const lower = name.toLowerCase();

    // Map common variations to standard names
    if (lower.includes('experience') || lower.includes('employment') || lower.includes('work') ||
        lower.includes('professional') || lower.includes('career') || lower.includes('history')) {
      return 'experience';
    }
    if (lower.includes('education') || lower.includes('academic') || lower.includes('qualification') ||
        lower.includes('degree') || lower.includes('university') || lower.includes('school')) {
      return 'education';
    }
    if (lower.includes('skill') || lower.includes('competenc') || lower.includes('expertise') ||
        lower.includes('technologies') || lower.includes('technical') || lower.includes('proficienc') ||
        lower.includes('abilities')) {
      return 'skills';
    }
    if (lower.includes('project') || lower.includes('portfolio')) {
      return 'projects';
    }
    if (lower.includes('summary') || lower.includes('objective') || lower.includes('profile') ||
        lower.includes('about') || lower.includes('overview') || lower.includes('introduction') ||
        lower.includes('statement')) {
      return 'summary';
    }
    if (lower.includes('certification') || lower.includes('certificate') || lower.includes('license') ||
        lower.includes('credential') || lower.includes('accreditation')) {
      return 'certifications';
    }
    if (lower.includes('award') || lower.includes('achievement') || lower.includes('honor') ||
        lower.includes('recognition') || lower.includes('accomplishment')) {
      return 'awards';
    }
    if (lower.includes('publication') || lower.includes('paper') || lower.includes('research') ||
        lower.includes('article') || lower.includes('journal')) {
      return 'publications';
    }
    if (lower.includes('language') || lower.includes('linguistic')) {
      return 'languages';
    }
    if (lower.includes('volunteer') || lower.includes('community') || lower.includes('leadership') ||
        lower.includes('extracurricular') || lower.includes('activities')) {
      return 'activities';
    }
    if (lower.includes('reference') || lower.includes('referees')) {
      return 'references';
    }
    if (lower.includes('interest') || lower.includes('hobby') || lower.includes('hobbies') ||
        lower.includes('passion')) {
      return 'interests';
    }

    return lower;
  }
};

if (typeof window !== 'undefined') {
  window.SectionGrouper = SectionGrouper;
}
