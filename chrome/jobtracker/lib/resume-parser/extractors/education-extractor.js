/**
 * Education Extractor - Extracts education from resume
 * Handles school, degree, field, dates, and GPA
 */

const EducationExtractor = {
  SCHOOL_KEYWORDS: /\b(University|College|Institute|School|Academy|Polytechnic|IIT|IIM|NIT|BITS|IIIT|MIT|Stanford|Harvard|Berkeley|UCLA|NYU|Columbia|Princeton|Yale|Oxford|Cambridge)\b/i,

  DEGREES: [
    // Full names
    'Bachelor', 'Master', 'Doctorate', 'Associate', 'Diploma', 'Certificate',
    // US abbreviations
    'B.S.', 'B.A.', 'M.S.', 'M.A.', 'M.B.A.', 'Ph.D.', 'Ph.D', 'J.D.', 'M.D.',
    'B.Sc.', 'M.Sc.', 'B.F.A.', 'M.F.A.', 'B.B.A.', 'M.P.A.', 'M.P.H.',
    // Without periods
    'BS', 'BA', 'MS', 'MA', 'MBA', 'PhD', 'JD', 'MD', 'BSc', 'MSc', 'BFA', 'MFA', 'BBA', 'MPA', 'MPH',
    // Engineering (India/International)
    'B.E.', 'M.E.', 'B.Tech', 'M.Tech', 'BE', 'ME', 'BTech', 'MTech',
    // Other
    'B.Com', 'M.Com', 'BCom', 'MCom', 'BCA', 'MCA', 'LLB', 'LLM', 'MBBS'
  ],

  // Common fields of study
  FIELDS_OF_STUDY: [
    'Computer Science', 'Computer Engineering', 'Software Engineering', 'Information Technology',
    'Electrical Engineering', 'Electronics', 'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering',
    'Data Science', 'Machine Learning', 'Artificial Intelligence', 'Cybersecurity', 'Information Systems',
    'Business Administration', 'Finance', 'Accounting', 'Economics', 'Marketing', 'Management',
    'Mathematics', 'Statistics', 'Physics', 'Chemistry', 'Biology', 'Biotechnology',
    'Psychology', 'Sociology', 'Political Science', 'History', 'English', 'Communications',
    'Graphic Design', 'Industrial Design', 'Architecture', 'Fine Arts', 'Music',
    'Nursing', 'Medicine', 'Public Health', 'Pharmacy', 'Law'
  ],

  // Honors and distinctions
  HONORS: /\b(Summa Cum Laude|Magna Cum Laude|Cum Laude|With Honors|With Distinction|Dean's List|First Class|Second Class|Distinction|Merit|Honors?)\b/i,

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

    const fullText = infoTexts.map(i => i.text).join(' ');

    let school = '';
    let degree = '';
    let field = '';
    let date = '';
    let startDate = '';
    let endDate = '';
    let gpa = '';
    let honors = '';

    // Find school
    for (const info of infoTexts) {
      if (this.SCHOOL_KEYWORDS.test(info.text)) {
        school = info.text
          .replace(/\s*(?:\||–|—|-)?\s*\d{4}.*$/, '')
          .replace(/\s*(?:GPA|CGPA).*$/i, '')
          .replace(/\s*,\s*[A-Z][a-z]+.*$/, '')  // Remove location suffix
          .trim();
        break;
      }
    }

    // Find degree
    for (const info of infoTexts) {
      if (this.hasDegree(info.text)) {
        const degreePattern = /(?:Bachelor(?:'s)?(?:\s+of\s+\w+)?|Master(?:'s)?(?:\s+of\s+\w+)?|Doctor(?:ate)?(?:\s+of\s+\w+)?|Ph\.?D\.?|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|M\.?B\.?A\.?|B\.?E\.?|M\.?E\.?|B\.?Tech|M\.?Tech|B\.?Com|M\.?Com|BCA|MCA|Associate(?:'s)?|Diploma|Certificate)/i;
        const degreeMatch = info.text.match(degreePattern);
        if (degreeMatch) {
          degree = degreeMatch[0].trim();
        }
        break;
      }
    }

    // Find field of study
    for (const fieldName of this.FIELDS_OF_STUDY) {
      const fieldRegex = new RegExp(`\\b${fieldName.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (fieldRegex.test(fullText)) {
        field = fieldName;
        break;
      }
    }

    // Alternative: extract field from "in [Field]" or "of [Field]" patterns
    if (!field) {
      const fieldPattern = /(?:in|of)\s+([A-Z][a-zA-Z\s&]+?)(?:\s*[,\|]|\s*\d{4}|\s*$)/i;
      const fieldMatch = fullText.match(fieldPattern);
      if (fieldMatch && fieldMatch[1].length < 50) {
        field = fieldMatch[1].trim();
      }
    }

    // Find date/year - handle ranges like "2018 - 2022" or "Aug 2018 - May 2022"
    const dateRangePattern = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{4})\s*[-–—to]+\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{4}|Present|Expected)/i;
    const dateRangeMatch = fullText.match(dateRangePattern);
    if (dateRangeMatch) {
      startDate = dateRangeMatch[1];
      endDate = dateRangeMatch[2];
      date = endDate === 'Present' || endDate === 'Expected' ? '' : endDate;
    } else {
      // Single year (graduation)
      const yearMatch = fullText.match(/\b(19|20)\d{2}\b/g);
      if (yearMatch) {
        date = yearMatch[yearMatch.length - 1]; // Graduation year is usually last
        endDate = date;
      }
    }

    // Find GPA - handle various formats
    const gpaPatterns = [
      /(?:GPA|CGPA|Grade)[:\s]*(\d+\.?\d*)(?:\s*\/\s*\d+\.?\d*)?/i,
      /(\d+\.\d+)\s*(?:\/\s*\d+\.?\d*)?\s*(?:GPA|CGPA)/i
    ];
    for (const pattern of gpaPatterns) {
      const gpaMatch = fullText.match(pattern);
      if (gpaMatch) {
        gpa = gpaMatch[1];
        break;
      }
    }

    // Find honors/distinctions
    const honorsMatch = fullText.match(this.HONORS);
    if (honorsMatch) {
      honors = honorsMatch[0].trim();
    }

    // Fallback: first bold line as school
    if (!school) {
      const boldLine = infoTexts.find(i => i.isBold);
      if (boldLine) {
        school = boldLine.text.replace(/\s*\d{4}.*$/, '').trim();
      }
    }

    return { school, degree, field, date, startDate, endDate, gpa, honors };
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
