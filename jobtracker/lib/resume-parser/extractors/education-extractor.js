/**
 * Education Extractor - Extracts education from resume
 * Handles school, degree, field, dates, and GPA
 */

const EducationExtractor = {
  SCHOOL_KEYWORDS: /\b(University|College|Institute|School|Academy|IIT|IIM|NIT|BITS|IIIT)\b/i,

  DEGREES: ['Bachelor', 'Master', 'PhD', 'Ph.D', 'Doctorate', 'Associate', 'B.S.', 'B.A.', 'M.S.', 'M.A.', 'M.B.A.', 'MBA', 'B.E.', 'M.E.', 'B.Tech', 'M.Tech', 'BSc', 'MSc', 'BA', 'MA', 'BS', 'MS', 'Diploma'],

  extract(sections) {
    const lines = this.getSectionLines(sections, ['education', 'academic', 'qualification']);
    if (lines.length === 0) return [];

    const subsections = this.divideIntoSubsections(lines);
    const educations = [];

    for (const subsectionLines of subsections) {
      const entry = this.extractEntry(subsectionLines);
      if (entry && (entry.school || entry.degree)) {
        educations.push(entry);
      }
    }

    return educations;
  },

  getSectionLines(sections, keywords) {
    for (const sectionName of Object.keys(sections)) {
      const hasKeyword = keywords.some(kw => sectionName.toLowerCase().includes(kw));
      if (hasKeyword) {
        return sections[sectionName];
      }
    }
    return [];
  },

  divideIntoSubsections(lines) {
    if (lines.length <= 1) return lines.length === 1 ? [lines] : [];

    // Method 1: Line gap analysis
    const lineGapToCount = {};
    let lineGapWithMostCount = 0;
    let maxCount = 0;

    for (let i = 1; i < lines.length; i++) {
      if (lines[i - 1][0] && lines[i][0]) {
        const lineGap = Math.abs(Math.round(lines[i - 1][0].y - lines[i][0].y));
        lineGapToCount[lineGap] = (lineGapToCount[lineGap] || 0) + 1;
        if (lineGapToCount[lineGap] > maxCount) {
          lineGapWithMostCount = lineGap;
          maxCount = lineGapToCount[lineGap];
        }
      }
    }

    const threshold = lineGapWithMostCount > 0 ? lineGapWithMostCount * 1.4 : 20;

    let subsections = [];
    let subsection = [lines[0]];

    for (let i = 1; i < lines.length; i++) {
      let lineGap = 0;
      if (lines[i - 1][0] && lines[i][0]) {
        lineGap = Math.abs(Math.round(lines[i - 1][0].y - lines[i][0].y));
      }
      if (lineGap > threshold) {
        if (subsection.length > 0) subsections.push(subsection);
        subsection = [];
      }
      subsection.push(lines[i]);
    }
    if (subsection.length > 0) subsections.push(subsection);

    // Method 2: Bold text detection (fallback)
    if (subsections.length <= 1) {
      subsections = [];
      subsection = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const prevLine = lines[i - 1];

        const isBoldNow = line[0] && this.isBold(line[0]);
        const wasBold = prevLine && prevLine[0] && this.isBold(prevLine[0]);

        if (i > 0 && !wasBold && isBoldNow) {
          if (subsection.length > 0) subsections.push(subsection);
          subsection = [];
        }
        subsection.push(line);
      }
      if (subsection.length > 0) subsections.push(subsection);
    }

    // Method 3: School keyword detection (fallback)
    if (subsections.length <= 1) {
      subsections = [];
      subsection = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineText = line.map(item => item.text).join(' ');
        const hasSchool = this.SCHOOL_KEYWORDS.test(lineText);

        if (i > 0 && hasSchool && subsection.length > 0) {
          subsections.push(subsection);
          subsection = [];
        }
        subsection.push(line);
      }
      if (subsection.length > 0) subsections.push(subsection);
    }

    return subsections;
  },

  extractEntry(subsectionLines) {
    const infoTexts = subsectionLines.map(line => ({
      text: line.map(item => item.text).join(' ').trim(),
      isBold: line[0] && this.isBold(line[0])
    }));

    let school = '';
    let degree = '';
    let field = '';
    let date = '';
    let gpa = '';

    // Find school
    for (const info of infoTexts) {
      if (this.SCHOOL_KEYWORDS.test(info.text)) {
        school = info.text
          .replace(/\s*(?:\||–|—|-)?\s*\d{4}.*$/, '')
          .replace(/\s*(?:GPA|CGPA).*$/i, '')
          .trim();
        break;
      }
    }

    // Find degree
    for (const info of infoTexts) {
      if (this.hasDegree(info.text)) {
        const degreePattern = /(?:Bachelor(?:'s)?|Master(?:'s)?|Doctor(?:ate)?|Ph\.?D\.?|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|M\.?B\.?A\.?|B\.?E\.?|M\.?E\.?|B\.?Tech|M\.?Tech|Associate(?:'s)?|Diploma)[^,\n]*/i;
        const degreeMatch = info.text.match(degreePattern);
        if (degreeMatch) {
          degree = degreeMatch[0].trim();
        }
        break;
      }
    }

    // Find date/year
    for (const info of infoTexts) {
      const yearMatch = info.text.match(/\b(19|20)\d{2}\b/g);
      if (yearMatch) {
        date = yearMatch[yearMatch.length - 1]; // Graduation year is usually last
        break;
      }
    }

    // Find GPA
    for (const info of infoTexts) {
      const gpaMatch = info.text.match(/(?:GPA|CGPA)[:\s]*(\d+\.?\d*)/i);
      if (gpaMatch) {
        gpa = gpaMatch[1];
        break;
      }
    }

    // Fallback: first bold line as school
    if (!school) {
      const boldLine = infoTexts.find(i => i.isBold);
      if (boldLine) {
        school = boldLine.text.replace(/\s*\d{4}.*$/, '').trim();
      }
    }

    return { school, degree, field, date, gpa };
  },

  isBold(item) {
    return item.fontName && item.fontName.toLowerCase().includes('bold');
  },

  hasDegree(text) {
    return this.DEGREES.some(degree => text.includes(degree));
  }
};

if (typeof window !== 'undefined') {
  window.EducationExtractor = EducationExtractor;
}
