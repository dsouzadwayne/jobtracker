/**
 * Section Grouper - Groups lines into resume sections
 * Detects section titles by bold/uppercase text or keywords
 */

const SectionGrouper = {
  SECTION_KEYWORDS: ['experience', 'education', 'project', 'skill', 'summary', 'objective', 'certification', 'award', 'work', 'employment', 'qualification', 'professional'],

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
    if (lower.includes('experience') || lower.includes('employment') || lower.includes('work') || lower.includes('professional')) {
      return 'experience';
    }
    if (lower.includes('education') || lower.includes('academic') || lower.includes('qualification')) {
      return 'education';
    }
    if (lower.includes('skill') || lower.includes('competenc') || lower.includes('expertise') || lower.includes('technologies')) {
      return 'skills';
    }
    if (lower.includes('project')) {
      return 'projects';
    }
    if (lower.includes('summary') || lower.includes('objective') || lower.includes('profile')) {
      return 'summary';
    }
    if (lower.includes('certification') || lower.includes('certificate')) {
      return 'certifications';
    }
    if (lower.includes('award') || lower.includes('achievement')) {
      return 'awards';
    }

    return lower;
  }
};

if (typeof window !== 'undefined') {
  window.SectionGrouper = SectionGrouper;
}
