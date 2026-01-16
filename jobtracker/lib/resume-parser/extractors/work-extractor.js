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
    console.log('[WorkExtractor] Found', lines.length, 'lines in work section');
    if (lines.length === 0) return [];

    const subsections = this.divideIntoSubsections(lines);
    console.log('[WorkExtractor] Divided into', subsections.length, 'subsections');

    // Log each subsection's content
    subsections.forEach((sub, i) => {
      console.log(`[WorkExtractor] Subsection ${i}:`);
      sub.forEach((line, j) => {
        const lineText = line.map(item => item.text).join(' ').trim();
        const isBold = line[0] && line[0].fontName && line[0].fontName.toLowerCase().includes('bold');
        console.log(`  Line ${j} [${isBold ? 'BOLD' : 'NORM'}]: "${lineText.substring(0, 80)}${lineText.length > 80 ? '...' : ''}"`);
      });
    });

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
    // Flatten all text items from all lines for individual item analysis (like OpenResume)
    const allItems = subsectionLines.flat();

    console.log('[WorkExtractor.extractEntry] Processing', subsectionLines.length, 'lines with', allItems.length, 'text items');

    let jobTitle = '';
    let company = '';
    let date = '';
    let descriptions = [];

    // Step 1: Find job title by looking at individual text items
    for (const item of allItems) {
      const text = item.text.trim();
      if (!text) continue;

      // Skip if it's a date or separator
      if (/^[-–—]$/.test(text)) continue;
      if (this.hasYear(text) && text.length < 15) continue;
      if (/^(Present|Current|Now|Ongoing)$/i.test(text)) continue;

      // Check if this individual item contains a job title keyword
      if (this.hasJobTitle(text) && text.length < 80) {
        // Make sure it's not a description (too long or too many words)
        const wordCount = text.split(/\s+/).length;
        if (wordCount <= 5) {
          jobTitle = text;
          console.log('[WorkExtractor.extractEntry] Found job title:', jobTitle);
          break;
        }
      }
    }

    // Step 2: Find date by looking at individual text items
    const dateItems = [];
    for (const item of allItems) {
      const text = item.text.trim();
      if (!text) continue;

      if (this.hasYear(text) || /^(Present|Current|Now|Ongoing)$/i.test(text)) {
        dateItems.push(text);
      }
    }
    if (dateItems.length > 0) {
      date = dateItems.join(' ').replace(/\s*-\s*/g, ' - ');
      console.log('[WorkExtractor.extractEntry] Found date:', date);
    }

    // Step 3: Find company - look for bold items that aren't job titles
    for (const item of allItems) {
      const text = item.text.trim();
      if (!text) continue;

      if (this.isBold(item) && !this.hasJobTitle(text) && text.length < 80) {
        // Skip if it's the job title we already found
        if (text === jobTitle) continue;
        // Skip if it contains dates
        if (this.hasYear(text)) continue;

        company = text;
        console.log('[WorkExtractor.extractEntry] Found company:', company);
        break;
      }
    }

    // Step 4: If no company found, check for known companies or company indicators
    if (!company) {
      for (const item of allItems) {
        const text = item.text.trim();
        if (!text || text === jobTitle) continue;

        if (this.COMPANY_INDICATORS.test(text) || this.KNOWN_COMPANIES.test(text)) {
          if (text.length < 80 && !this.hasYear(text)) {
            company = text;
            console.log('[WorkExtractor.extractEntry] Found company (indicator):', company);
            break;
          }
        }
      }
    }

    // Step 5: Extract descriptions - lines after the first few info lines
    const descriptionsLineIdx = this.getDescriptionsLineIdx(subsectionLines);
    const descriptionLines = subsectionLines.slice(descriptionsLineIdx);
    descriptions = this.getBulletPoints(descriptionLines);

    const parsedDates = this.parseDate(date);

    const result = {
      company,
      jobTitle,
      date,
      startDate: parsedDates.start,
      endDate: parsedDates.end,
      current: parsedDates.current,
      descriptions
    };

    // Debug logging
    console.log('[WorkExtractor] Extracted entry:', {
      jobTitle: result.jobTitle,
      company: result.company,
      date: result.date,
      descriptionsCount: result.descriptions.length
    });

    return result;
  },

  getDescriptionsLineIdx(lines) {
    console.log('[getDescriptionsLineIdx] *** NEW CODE v3 *** Processing', lines.length, 'lines');

    // Check for bullet points
    for (let i = 0; i < lines.length; i++) {
      for (const item of lines[i]) {
        const trimmedText = item.text.trim();

        // Check for special bullet point characters
        if (this.BULLET_POINTS.some(bp => trimmedText.includes(bp))) {
          console.log(`[getDescriptionsLineIdx] Found bullet point char in line ${i}: "${trimmedText.substring(0, 30)}"`);
          return i;
        }

        // Check for dash/asterisk bullet, but NOT if it's a date prefix like "-Feb 2025"
        if (/^[-•*]/.test(trimmedText)) {
          // Skip if this looks like a date (dash followed by month name or year)
          const isDatePrefix = /^-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})/i.test(trimmedText);
          if (!isDatePrefix) {
            console.log(`[getDescriptionsLineIdx] Found bullet dash in line ${i}: "${trimmedText.substring(0, 30)}"`);
            return i;
          } else {
            console.log(`[getDescriptionsLineIdx] Skipped date-prefix dash in line ${i}: "${trimmedText.substring(0, 30)}"`);
          }
        }
      }
    }

    // Track the last line with job title or date info
    let lastInfoLineIdx = -1;

    // Check ALL lines (not just single-item lines) for job title or date info
    for (let i = 0; i < lines.length; i++) {
      // Join all text items in the line
      const lineText = lines[i].map(item => item.text).join(' ').trim();

      // Check if this line contains job title/date info
      const hasJobTitle = this.hasJobTitle(lineText);
      const hasDate = this.hasYear(lineText) || this.hasPresent(lineText);

      console.log(`[getDescriptionsLineIdx] Line ${i}: hasJobTitle=${hasJobTitle}, hasDate=${hasDate}, text="${lineText.substring(0, 50)}..."`);

      // If this line has job title or date, mark it as info line
      if (hasJobTitle || hasDate) {
        console.log(`[getDescriptionsLineIdx] Line ${i} marked as INFO line`);
        lastInfoLineIdx = i;
        continue;
      }

      // If line has 8+ words and no job title/date, it's likely a description
      const wordCount = lineText.split(/\s/).filter(w => !/[0-9]/.test(w)).length;
      if (wordCount >= 8) {
        // Only return if we've already found at least one info line
        if (lastInfoLineIdx >= 0) {
          return i;
        }
      }
    }

    // If we found info lines, return the line after the last one
    if (lastInfoLineIdx >= 0) {
      return lastInfoLineIdx + 1;
    }

    // Default: use line 2 or less
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

  extractDateSubstring(text) {
    if (!text) return '';

    // Pattern 1: Month-Year ranges (e.g., "Feb 2025 - Present", "Jan 2020 - Dec 2022")
    const monthYearRangePattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}\s*[-–—to]+\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}\s*[-–—to]+\s*(?:Present|Current|Now|Ongoing)/i;
    const monthYearRangeMatch = text.match(monthYearRangePattern);
    if (monthYearRangeMatch) return monthYearRangeMatch[0].trim();

    // Pattern 2: Single Month-Year with Present (e.g., "Feb 2025 Present")
    const monthYearPresentPattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}\s+(?:Present|Current|Now|Ongoing)/i;
    const monthYearPresentMatch = text.match(monthYearPresentPattern);
    if (monthYearPresentMatch) return monthYearPresentMatch[0].trim();

    // Pattern 3: Year ranges (e.g., "2020 - 2022", "2020 - Present")
    const yearRangePattern = /\b(19|20)\d{2}\s*[-–—to]+\s*(?:(19|20)\d{2}|Present|Current|Now|Ongoing)\b/i;
    const yearRangeMatch = text.match(yearRangePattern);
    if (yearRangeMatch) return yearRangeMatch[0].trim();

    // Pattern 4: Multiple month-year dates (e.g., "Jan 2020 Feb 2022")
    const multipleDatesPattern = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}(?:\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4})+/i;
    const multipleDatesMatch = text.match(multipleDatesPattern);
    if (multipleDatesMatch) return multipleDatesMatch[0].trim();

    // Pattern 5: Single year (fallback)
    const singleYearPattern = /\b(19|20)\d{2}\b/;
    const singleYearMatch = text.match(singleYearPattern);
    if (singleYearMatch) return singleYearMatch[0].trim();

    return '';
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
