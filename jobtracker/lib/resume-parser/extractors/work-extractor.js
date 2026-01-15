/**
 * Work Extractor - Extracts work experience from resume
 * Handles company, job title, dates, and descriptions
 */

const WorkExtractor = {
  BULLET_POINTS: ['⋅', '∙', '🞄', '•', '⦁', '⚫', '●', '⬤', '⚬', '○'],

  JOB_TITLES: ['Accountant', 'Administrator', 'Advisor', 'Agent', 'Analyst', 'Apprentice', 'Architect', 'Assistant', 'Associate', 'Auditor', 'Bartender', 'Bookkeeper', 'Buyer', 'Cashier', 'CEO', 'Clerk', 'Consultant', 'Coordinator', 'CTO', 'Developer', 'Designer', 'Director', 'Driver', 'Editor', 'Engineer', 'Founder', 'Freelancer', 'Head', 'Intern', 'Lead', 'Manager', 'Member', 'Officer', 'Operator', 'President', 'Producer', 'Recruiter', 'Representative', 'Researcher', 'Sales', 'Scientist', 'Specialist', 'Supervisor', 'Teacher', 'Technician', 'Trainee', 'VP', 'Volunteer', 'Worker'],

  COMPANY_INDICATORS: /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Company|Co\.?|Technologies|Solutions|Services|Group|Partners|Consulting|Media|Entertainment|Studios?|Labs?|Global|International|Pvt\.?|Private|Limited)\b/i,

  KNOWN_COMPANIES: /\b(Google|Microsoft|Amazon|Apple|Meta|Facebook|Netflix|Gracenote|Nielsen|Spotify|Adobe|Salesforce|Oracle|IBM|Intel|Cisco|VMware|SAP|Uber|Lyft|Airbnb|Twitter|LinkedIn|Snap|Pinterest|TikTok|Stripe|PayPal|Shopify|Zoom|Slack|Dropbox|Atlassian|GitHub|MongoDB|Snowflake|Twilio|Infosys|TCS|Wipro|HCL|Tech Mahindra|Cognizant|Accenture|Deloitte|PwC|EY|KPMG|McKinsey|BCG|Bain)\b/i,

  MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],

  extract(sections) {
    const lines = this.getSectionLines(sections, ['experience', 'employment', 'work', 'professional']);
    if (lines.length === 0) return [];

    const subsections = this.divideIntoSubsections(lines);
    const workExperiences = [];

    for (const subsectionLines of subsections) {
      const entry = this.extractEntry(subsectionLines);
      if (entry && (entry.company || entry.jobTitle)) {
        workExperiences.push(entry);
      }
    }

    return workExperiences;
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
        const isBullet = line[0] && /^[-•*]/.test(line[0].text.trim());

        if (i > 0 && !wasBold && isBoldNow && !isBullet) {
          if (subsection.length > 0) subsections.push(subsection);
          subsection = [];
        }
        subsection.push(line);
      }
      if (subsection.length > 0) subsections.push(subsection);
    }

    // Method 3: Job title keyword detection (fallback)
    if (subsections.length <= 1) {
      const titleKeywords = /\b(Engineer|Developer|Designer|Manager|Director|Analyst|Specialist|Consultant|Coordinator|Lead|Senior|Junior|Intern|Editor|Writer|Producer|Architect|Administrator|Executive|Associate)\b/i;

      subsections = [];
      subsection = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineText = line.map(item => item.text).join(' ');
        const isBullet = /^[-•*]/.test(lineText.trim());
        const hasTitle = titleKeywords.test(lineText) && lineText.length < 80;

        if (i > 0 && hasTitle && !isBullet && subsection.length > 0) {
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
    const descriptionsLineIdx = this.getDescriptionsLineIdx(subsectionLines);
    const infoLines = subsectionLines.slice(0, descriptionsLineIdx);
    const descriptionLines = subsectionLines.slice(descriptionsLineIdx);

    const infoTexts = infoLines.map(line => ({
      text: line.map(item => item.text).join(' ').trim(),
      items: line,
      isBold: line[0] && this.isBold(line[0])
    }));

    let jobTitle = '';
    let company = '';
    let date = '';

    // Step 1: Find date
    for (const info of infoTexts) {
      if (this.hasYear(info.text) || this.hasPresent(info.text)) {
        date = info.text;
        break;
      }
    }

    // Step 2: Find job title
    for (const info of infoTexts) {
      if (info.text === date) continue;
      if (/^[-•*]/.test(info.text)) continue;
      if (this.hasJobTitle(info.text)) {
        const titleMatch = info.text.match(/^(.+?)\s*(?:at|@|\||–|—|-)\s*/i);
        if (titleMatch) {
          jobTitle = titleMatch[1].trim();
          const rest = info.text.slice(titleMatch[0].length).trim();
          if (rest && !this.hasYear(rest)) {
            company = rest.replace(/\s*(?:\||–|—|-)?\s*\d{4}.*$/, '').trim();
          }
        } else {
          jobTitle = info.text.replace(/\s*(?:\||–|—|-)?\s*\d{4}.*$/, '').trim();
        }
        break;
      }
    }

    // Step 3: Find company
    if (!company) {
      for (const info of infoTexts) {
        if (info.text === date || info.text === jobTitle) continue;
        if (/^[-•*]/.test(info.text)) continue;

        const hasCompanyIndicator = this.COMPANY_INDICATORS.test(info.text);
        const isKnownCompany = this.KNOWN_COMPANIES.test(info.text);
        const isShortAndCapitalized = info.text.length < 60 && /^[A-Z]/.test(info.text);

        if (hasCompanyIndicator || isKnownCompany || (info.isBold && isShortAndCapitalized)) {
          company = info.text.replace(/\s*(?:\||–|—|-)?\s*\d{4}.*$/, '').trim();
          break;
        }
      }
    }

    // Step 4: Fallback - first bold line as company
    if (!company && infoTexts.length > 0) {
      const firstBold = infoTexts.find(i => i.isBold && !this.hasJobTitle(i.text));
      if (firstBold) {
        company = firstBold.text.replace(/\s*(?:\||–|—|-)?\s*\d{4}.*$/, '').trim();
      }
    }

    const parsedDates = this.parseDate(date);
    const descriptions = this.getBulletPoints(descriptionLines);

    return {
      company,
      jobTitle,
      date,
      startDate: parsedDates.start,
      endDate: parsedDates.end,
      current: parsedDates.current,
      descriptions
    };
  },

  getDescriptionsLineIdx(lines) {
    // Check for bullet points
    for (let i = 0; i < lines.length; i++) {
      for (const item of lines[i]) {
        if (this.BULLET_POINTS.some(bp => item.text.includes(bp)) || /^[-•*]/.test(item.text.trim())) {
          return i;
        }
      }
    }

    // Fallback: line with 8+ words
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length === 1) {
        const wordCount = lines[i][0].text.split(/\s/).filter(w => !/[0-9]/.test(w)).length;
        if (wordCount >= 8) return i;
      }
    }

    return Math.min(2, lines.length);
  },

  getBulletPoints(lines) {
    if (lines.length === 0) return [];

    let lineStr = '';
    for (const item of lines.flat()) {
      if (!lineStr.endsWith(' ') && !item.text.startsWith(' ')) {
        lineStr += ' ';
      }
      lineStr += item.text;
    }

    // Find most common bullet
    let commonBullet = this.BULLET_POINTS[0];
    let maxCount = 0;
    for (const bullet of this.BULLET_POINTS) {
      const count = (lineStr.match(new RegExp(bullet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        commonBullet = bullet;
      }
    }

    // Also check for - or *
    const dashCount = (lineStr.match(/\s-\s/g) || []).length;
    if (dashCount > maxCount) {
      maxCount = dashCount;
      commonBullet = '-';
    }

    if (maxCount > 0) {
      const regex = commonBullet === '-' ? /\s-\s/ : new RegExp(commonBullet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const firstIdx = lineStr.search(regex);
      if (firstIdx !== -1) lineStr = lineStr.slice(firstIdx);
      return lineStr.split(regex).map(s => s.trim()).filter(s => s && s.length > 5);
    }

    return lines.map(line => line.map(item => item.text).join(' ').trim()).filter(s => s && s.length > 5);
  },

  parseDate(text) {
    const result = { start: '', end: '', current: false };
    if (!text) return result;

    if (/Present|Current|Now|Ongoing/i.test(text)) {
      result.current = true;
    }

    const monthYearPattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}/gi;
    const monthYearDates = text.match(monthYearPattern) || [];

    if (monthYearDates.length >= 1) {
      result.start = monthYearDates[0];
    }
    if (monthYearDates.length >= 2) {
      result.end = monthYearDates[1];
    }

    if (!result.start) {
      const years = text.match(/\b(19|20)\d{2}\b/g) || [];
      if (years.length >= 1) result.start = years[0];
      if (years.length >= 2 && !result.current) result.end = years[1];
    }

    return result;
  },

  isBold(item) {
    return item.fontName && item.fontName.toLowerCase().includes('bold');
  },

  hasJobTitle(text) {
    return this.JOB_TITLES.some(title =>
      text.split(/\s/).some(word => word.toLowerCase() === title.toLowerCase())
    );
  },

  hasYear(text) {
    return /(?:19|20)\d{2}/.test(text);
  },

  hasPresent(text) {
    return /present|current/i.test(text);
  }
};

if (typeof window !== 'undefined') {
  window.WorkExtractor = WorkExtractor;
}
