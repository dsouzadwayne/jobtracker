/**
 * Field Extractor - Extracts specific fields from resume text
 * Uses regex patterns to identify emails, phones, dates, skills, etc.
 */

const ResumeFieldExtractor = {
  // Regex patterns for field extraction
  PATTERNS: {
    // Contact Information
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // International phone pattern - handles +91, +1, etc.
    phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4,6}/g,

    // Social Links
    linkedIn: /(?:linkedin\.com\/in\/|linkedin:\s*)([a-zA-Z0-9_-]+)/i,
    github: /(?:github\.com\/|github:\s*)([a-zA-Z0-9_-]+)/i,
    portfolio: /(?:portfolio|website|site|web)(?::\s*|\s*:\s*)(https?:\/\/[^\s]+)/i,
    url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,

    // Address Components
    zipCode: /\b(\d{5}(?:-\d{4})?)\b/,
    usState: /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming)\b/i,

    // Date patterns
    monthYear: /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}/gi,
    dateRange: /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}\s*[-–—to]+\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}|Present|Current|Now|Ongoing)/gi,
    yearRange: /\b(19|20)\d{2}\s*[-–—to]+\s*(?:(19|20)\d{2}|Present|Current|Now|Ongoing)\b/gi,
    yearOnly: /\b(19|20)\d{2}\b/g,

    // Education patterns
    degree: /(?:Bachelor(?:'s)?|Master(?:'s)?|Doctor(?:ate)?|Ph\.?D\.?|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|M\.?B\.?A\.?|B\.?E\.?|M\.?E\.?|B\.?Tech|M\.?Tech|Associate(?:'s)?|Diploma)\s*(?:of|in)?\s*[^,\n]*/gi,
    gpa: /(?:GPA|Grade|CGPA)[:\s]*([0-4]\.[0-9]{1,2})\s*(?:\/\s*4(?:\.0)?)?/i,
    graduationYear: /(?:Class\s+of|Graduated?|Expected|Graduation)[:\s]*(\d{4})/i,

    // Skills patterns (common technical skills)
    programmingLanguages: /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|C|Ruby|Go|Golang|Rust|PHP|Swift|Kotlin|Scala|R|MATLAB|Perl|Shell|Bash|PowerShell|SQL|HTML|CSS|SASS|SCSS|Less)\b/gi,
    frameworks: /\b(React(?:\.?js)?|Angular(?:\.?js)?|Vue(?:\.?js)?|Next(?:\.?js)?|Nuxt(?:\.?js)?|Svelte|Node(?:\.?js)?|Express(?:\.?js)?|NestJS|Django|Flask|FastAPI|Spring(?:\s*Boot)?|\.NET|ASP\.NET|Rails|Ruby\s+on\s+Rails|Laravel|Symfony|TensorFlow|PyTorch|Keras|Pandas|NumPy|Scikit-learn|jQuery|Bootstrap|Tailwind(?:\s*CSS)?|Material[\s-]?UI|Chakra[\s-]?UI)\b/gi,
    tools: /\b(Git|GitHub|GitLab|Bitbucket|Jira|Confluence|Slack|Trello|Asana|Notion|Figma|Sketch|Adobe\s*XD|Photoshop|Illustrator|VS\s*Code|Visual\s*Studio|IntelliJ|Eclipse|PyCharm|WebStorm|Postman|Insomnia|Docker|Kubernetes|K8s|Jenkins|CircleCI|Travis\s*CI|GitHub\s*Actions|AWS|Azure|GCP|Google\s*Cloud|Heroku|Vercel|Netlify|Firebase|MongoDB|PostgreSQL|MySQL|Redis|Elasticsearch|RabbitMQ|Kafka|Nginx|Apache|Linux|Unix|Windows\s*Server|Webpack|Vite|Rollup|Parcel|npm|yarn|pnpm)\b/gi,
    softSkills: /\b(Leadership|Communication|Teamwork|Team\s*Player|Problem[\s-]?Solving|Critical\s+Thinking|Time\s+Management|Project\s+Management|Agile|Scrum|Kanban|Collaboration|Adaptability|Creativity|Attention\s+to\s+Detail|Analytical|Strategic\s+(?:Thinking|Planning)|Decision[\s-]?Making|Mentoring|Coaching|Presentation|Public\s+Speaking|Negotiation|Conflict\s+Resolution)\b/gi
  },

  /**
   * Extract all fields from resume text
   * @param {string} text - Full resume text
   * @param {Object} sections - Detected sections
   * @returns {Object} - Extracted fields
   */
  extractAll(text, sections) {
    return {
      personal: this.extractPersonalInfo(text, sections),
      workHistory: this.extractWorkHistory(sections.experience || text),
      education: this.extractEducation(sections.education || text),
      skills: this.extractSkills(sections.skills || text, text)
    };
  },

  /**
   * Extract personal information
   * @param {string} text - Full resume text
   * @param {Object} sections - Detected sections
   * @returns {Object} - Personal info fields
   */
  extractPersonalInfo(text, sections) {
    const headerText = sections.header || text.slice(0, 1000);
    const result = {};

    // Extract name (usually first line or largest text)
    const nameMatch = this.extractName(headerText);
    if (nameMatch) {
      result.firstName = nameMatch.firstName;
      result.middleName = nameMatch.middleName;
      result.lastName = nameMatch.lastName;
    }

    // Extract email
    const emailMatch = headerText.match(this.PATTERNS.email);
    if (emailMatch && emailMatch.length > 0) {
      result.email = emailMatch[0].toLowerCase();
    }

    // Extract phone
    const phoneMatch = headerText.match(this.PATTERNS.phone);
    if (phoneMatch && phoneMatch.length > 0) {
      result.phone = this.formatPhone(phoneMatch[0]);
    }

    // Extract LinkedIn
    const linkedInMatch = text.match(this.PATTERNS.linkedIn);
    if (linkedInMatch) {
      result.linkedIn = `https://linkedin.com/in/${linkedInMatch[1]}`;
    }

    // Extract GitHub
    const githubMatch = text.match(this.PATTERNS.github);
    if (githubMatch) {
      result.github = `https://github.com/${githubMatch[1]}`;
    }

    // Extract portfolio/website
    const portfolioMatch = text.match(this.PATTERNS.portfolio);
    if (portfolioMatch) {
      result.portfolio = portfolioMatch[1];
    }

    // Extract address components
    const address = this.extractAddress(headerText);
    if (Object.keys(address).length > 0) {
      result.address = address;
    }

    return result;
  },

  /**
   * Extract name from header text
   * @param {string} text - Header section text
   * @returns {Object|null} - Name components or null
   */
  extractName(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return null;

    // First, try to find a name-like pattern in the first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];

      // Skip lines that are clearly not names
      if (line.includes('@')) continue;  // Email
      if (/\d{3}/.test(line)) continue;  // Phone number
      if (line.length > 50) continue;     // Too long
      if (/^(experience|education|skills|summary|profile|objective)/i.test(line)) continue; // Section header

      // Check if line looks like a name (2-4 capitalized words, handles D'Souza, O'Brien, etc.)
      const words = line.split(/\s+/).filter(w => /^[A-Z][a-z'']+$/.test(w) || /^[A-Z]+$/.test(w) || /^[A-Z]'[A-Z][a-z]+$/.test(w));
      if (words.length >= 2 && words.length <= 4) {
        return this.parseNameWords(words);
      }

      // Also try to extract name from a line with separators (e.g., "Dwayne D'Souza | email | phone")
      const namePart = line.split(/[|•·,]/).find(part => {
        const cleaned = part.trim();
        const nameWords = cleaned.split(/\s+/).filter(w => /^[A-Z][a-z'']+$/.test(w) || /^[A-Z]'[A-Z][a-z]+$/.test(w));
        return nameWords.length >= 2 && nameWords.length <= 4 && !cleaned.includes('@') && !/\d{3}/.test(cleaned);
      });

      if (namePart) {
        const words = namePart.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length >= 2) {
          return this.parseNameWords(words);
        }
      }
    }

    // Fallback: Try to extract name from email address
    const emailMatch = text.match(this.PATTERNS.email);
    if (emailMatch) {
      const email = emailMatch[0].toLowerCase();
      const localPart = email.split('@')[0];
      // Try patterns like firstname.lastname, firstname_lastname, firstnamelastname
      const nameParts = localPart
        .replace(/\d+/g, '') // Remove numbers
        .split(/[._]/)
        .filter(p => p.length > 1);

      if (nameParts.length >= 2) {
        return {
          firstName: this.capitalizeWord(nameParts[0]),
          middleName: '',
          lastName: this.capitalizeWord(nameParts[nameParts.length - 1])
        };
      } else if (nameParts.length === 1 && nameParts[0].length > 3) {
        // Try to split camelCase or find common name patterns
        const name = nameParts[0];
        // Check for common first names
        const commonFirstNames = ['dwayne', 'john', 'james', 'michael', 'david', 'robert', 'william', 'richard', 'joseph', 'thomas', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan'];
        for (const firstName of commonFirstNames) {
          if (name.startsWith(firstName) && name.length > firstName.length) {
            return {
              firstName: this.capitalizeWord(firstName),
              middleName: '',
              lastName: this.capitalizeWord(name.slice(firstName.length))
            };
          }
        }
      }
    }

    return null;
  },

  /**
   * Parse name words into components
   * @param {Array} words - Array of name words
   * @returns {Object} - Name components
   */
  parseNameWords(words) {
    if (words.length === 2) {
      return {
        firstName: this.capitalizeWord(words[0]),
        middleName: '',
        lastName: this.capitalizeWord(words[1])
      };
    } else if (words.length === 3) {
      return {
        firstName: this.capitalizeWord(words[0]),
        middleName: this.capitalizeWord(words[1]),
        lastName: this.capitalizeWord(words[2])
      };
    } else {
      return {
        firstName: this.capitalizeWord(words[0]),
        middleName: words.slice(1, -1).map(w => this.capitalizeWord(w)).join(' '),
        lastName: this.capitalizeWord(words[words.length - 1])
      };
    }
  },

  /**
   * Extract address components - handles international addresses
   * @param {string} text - Text to search
   * @returns {Object} - Address components
   */
  extractAddress(text) {
    const address = {};

    // Common country patterns
    const countryPatterns = {
      'india': 'India', 'in': 'India',
      'usa': 'United States', 'us': 'United States', 'united states': 'United States',
      'uk': 'United Kingdom', 'united kingdom': 'United Kingdom',
      'canada': 'Canada', 'ca': 'Canada',
      'australia': 'Australia', 'au': 'Australia',
      'germany': 'Germany', 'de': 'Germany',
      'france': 'France', 'fr': 'France',
      'uae': 'United Arab Emirates', 'dubai': 'United Arab Emirates', 'abu dhabi': 'United Arab Emirates'
    };

    // Try to find country first
    const textLower = text.toLowerCase();
    for (const [pattern, country] of Object.entries(countryPatterns)) {
      // Match as whole word
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(text)) {
        address.country = country;
        break;
      }
    }

    // Extract zip/postal code (various formats)
    const zipMatch = text.match(/\b(\d{5,6}(?:[-\s]?\d{4})?)\b/);
    if (zipMatch) {
      address.zipCode = zipMatch[1];
    }

    // Only try US state extraction if no international country detected
    if (!address.country || address.country === 'United States') {
      const stateMatch = text.match(this.PATTERNS.usState);
      if (stateMatch) {
        // Check if this is actually a country code (IN = India, not Indiana)
        const matched = stateMatch[1].toUpperCase();
        if (matched === 'IN' && /india|mumbai|delhi|bangalore|chennai|hyderabad|pune|kolkata/i.test(text)) {
          address.country = 'India';
        } else if (matched.length === 2 && countryPatterns[matched.toLowerCase()]) {
          address.country = countryPatterns[matched.toLowerCase()];
        } else {
          address.state = this.normalizeState(stateMatch[1]);
          if (!address.country) {
            address.country = 'United States';
          }
        }
      }
    }

    // Try to extract city
    const cityPatterns = [
      /\b(Mumbai|Delhi|Bangalore|Bengaluru|Chennai|Hyderabad|Pune|Kolkata|Ahmedabad|Jaipur|Lucknow|Kanpur|Nagpur|Indore|Thane|Bhopal|Visakhapatnam|Patna|Vadodara|Ghaziabad|Ludhiana|Agra|Nashik|Faridabad|Meerut|Rajkot|Varanasi|Srinagar|Aurangabad|Dhanbad|Amritsar|Allahabad|Ranchi|Howrah|Coimbatore|Jabalpur|Gwalior|Vijayawada|Jodhpur|Madurai|Raipur|Kota|Guwahati|Chandigarh|Solapur|Hubli|Tiruchirappalli|Bareilly|Mysore|Tiruppur|Gurgaon|Noida)\b/i,
      /\b(Abu Dhabi|Dubai|Sharjah|Ajman)\b/i,
      /\b(New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|San Jose|Austin|Jacksonville|Fort Worth|Columbus|Charlotte|San Francisco|Indianapolis|Seattle|Denver|Boston|El Paso|Nashville|Detroit|Portland|Memphis|Oklahoma City|Las Vegas|Louisville|Baltimore|Milwaukee|Albuquerque|Tucson|Fresno|Sacramento|Mesa|Kansas City|Atlanta|Miami|Colorado Springs|Raleigh|Omaha|Long Beach|Virginia Beach|Oakland|Minneapolis|Tulsa|Arlington|Tampa|New Orleans)\b/i,
      /\b(London|Birmingham|Manchester|Liverpool|Leeds|Sheffield|Bristol|Glasgow|Edinburgh|Cardiff)\b/i,
      /\b(Toronto|Montreal|Vancouver|Calgary|Edmonton|Ottawa)\b/i
    ];

    for (const pattern of cityPatterns) {
      const cityMatch = text.match(pattern);
      if (cityMatch) {
        address.city = cityMatch[1];
        break;
      }
    }

    return address;
  },

  /**
   * Extract work history entries using subsection detection
   * Uses line gap analysis (1.4× typical gap) to split into job entries
   * @param {string} text - Experience section text
   * @returns {Array} - Array of work entries
   */
  extractWorkHistory(text) {
    if (!text || text.trim().length === 0) return [];

    const lines = text.split('\n');
    const nonEmptyLines = lines.map((l, i) => ({ text: l.trim(), index: i })).filter(l => l.text);

    if (nonEmptyLines.length === 0) return [];

    // Step 1: Detect subsections using line gap analysis
    const subsections = this.divideIntoSubsections(lines);

    // Step 2: Extract work entry from each subsection using feature scoring
    const entries = [];
    for (const subsection of subsections) {
      const entry = this.extractWorkEntryWithScoring(subsection);
      if (entry && (entry.company || entry.title)) {
        entries.push(entry);
      }
    }

    return this.deduplicateEntries(entries);
  },

  /**
   * Divide text into subsections based on line gaps
   * A gap larger than 1.4× the typical gap indicates a new subsection
   * @param {Array} lines - Array of text lines
   * @returns {Array} - Array of subsection texts
   */
  divideIntoSubsections(lines) {
    const nonEmptyLines = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed) {
        nonEmptyLines.push({ text: trimmed, originalIndex: i });
      }
    }

    if (nonEmptyLines.length <= 1) {
      return nonEmptyLines.length === 1 ? [nonEmptyLines[0].text] : [];
    }

    // Calculate line gaps (number of empty lines between non-empty lines)
    const gaps = [];
    for (let i = 1; i < nonEmptyLines.length; i++) {
      const gap = nonEmptyLines[i].originalIndex - nonEmptyLines[i - 1].originalIndex - 1;
      gaps.push(gap);
    }

    // Find the most common gap (typical gap)
    const gapCounts = {};
    let mostCommonGap = 0;
    let maxCount = 0;
    for (const gap of gaps) {
      gapCounts[gap] = (gapCounts[gap] || 0) + 1;
      if (gapCounts[gap] > maxCount) {
        maxCount = gapCounts[gap];
        mostCommonGap = gap;
      }
    }

    // Threshold: 1.4× typical gap, minimum of 1 empty line
    const threshold = Math.max(mostCommonGap * 1.4, 1);

    // Split into subsections at gaps exceeding threshold
    const subsections = [];
    let currentSubsection = [nonEmptyLines[0].text];

    for (let i = 1; i < nonEmptyLines.length; i++) {
      const gap = nonEmptyLines[i].originalIndex - nonEmptyLines[i - 1].originalIndex - 1;

      if (gap > threshold) {
        // New subsection
        if (currentSubsection.length > 0) {
          subsections.push(currentSubsection.join('\n'));
        }
        currentSubsection = [nonEmptyLines[i].text];
      } else {
        currentSubsection.push(nonEmptyLines[i].text);
      }
    }

    // Add last subsection
    if (currentSubsection.length > 0) {
      subsections.push(currentSubsection.join('\n'));
    }

    // If only one subsection found, try alternative detection (by title keywords)
    if (subsections.length <= 1) {
      return this.divideByTitleKeywords(nonEmptyLines.map(l => l.text));
    }

    return subsections;
  },

  /**
   * Fallback: divide by detecting job title keywords
   * @param {Array} lines - Array of non-empty text lines
   * @returns {Array} - Array of subsection texts
   */
  divideByTitleKeywords(lines) {
    const titleKeywords = /\b(Engineer|Developer|Designer|Manager|Director|Analyst|Specialist|Consultant|Coordinator|Lead|Senior|Junior|Staff|Principal|Architect|Administrator|Executive|Associate|Intern|Editor|Writer|Producer|Content\s+Analyst|Marketing|Sales|Support|Operations|Product|Program|Project|Technical|Software|Data|Business|Financial|Account|Customer|Client|Web|Frontend|Backend|Full[\s-]?Stack|DevOps|QA|Quality|Research|Scientist|Technician)\b/i;

    const subsections = [];
    let currentSubsection = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line looks like a new job entry (has title keyword and is short)
      const looksLikeTitle = titleKeywords.test(line) && line.length < 80 && !line.startsWith('-') && !line.startsWith('•');

      if (looksLikeTitle && currentSubsection.length > 0) {
        // Start new subsection
        subsections.push(currentSubsection.join('\n'));
        currentSubsection = [line];
      } else {
        currentSubsection.push(line);
      }
    }

    if (currentSubsection.length > 0) {
      subsections.push(currentSubsection.join('\n'));
    }

    return subsections;
  },

  /**
   * Extract work entry from subsection using feature scoring
   * Scores each line for likelihood of being title, company, date, or description
   * @param {string} text - Subsection text
   * @returns {Object} - Work entry object
   */
  extractWorkEntryWithScoring(text) {
    const entry = {
      company: '',
      title: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: ''
    };

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return entry;

    // Score each line for different categories
    const lineScores = lines.map((line, index) => ({
      line,
      index,
      titleScore: this.scoreTitleLine(line),
      companyScore: this.scoreCompanyLine(line),
      dateScore: this.scoreDateLine(line),
      descriptionScore: this.scoreDescriptionLine(line)
    }));

    // Find best title (highest title score, not a description)
    let bestTitle = null;
    let bestTitleScore = 0;
    for (const scored of lineScores) {
      if (scored.titleScore > bestTitleScore && scored.descriptionScore < 2) {
        bestTitleScore = scored.titleScore;
        bestTitle = scored;
      }
    }

    // Find best company (highest company score, not the title line, not a description)
    let bestCompany = null;
    let bestCompanyScore = 0;
    for (const scored of lineScores) {
      if (bestTitle && scored.index === bestTitle.index) continue;
      if (scored.companyScore > bestCompanyScore && scored.descriptionScore < 2) {
        bestCompanyScore = scored.companyScore;
        bestCompany = scored;
      }
    }

    // Find date line
    let dateLine = null;
    for (const scored of lineScores) {
      if (scored.dateScore >= 2) {
        dateLine = scored;
        break;
      }
    }

    // Extract title
    if (bestTitle && bestTitleScore >= 2) {
      entry.title = this.cleanTitleText(bestTitle.line);
    }

    // Extract company
    if (bestCompany && bestCompanyScore >= 1) {
      entry.company = this.cleanCompanyText(bestCompany.line);
    }

    // If no company found but title exists, check if title line has "at Company" or "Company -"
    if (!entry.company && entry.title) {
      const combined = this.extractTitleAndCompanyFromLine(bestTitle ? bestTitle.line : lines[0]);
      if (combined.company) {
        entry.company = combined.company;
        if (combined.title) entry.title = combined.title;
      }
    }

    // Extract dates
    if (dateLine) {
      const dates = this.parseDateRange(dateLine.line);
      entry.startDate = dates.start;
      entry.endDate = dates.end;
      entry.current = dates.current;
    }

    // Collect description lines
    const descriptionLines = [];
    for (const scored of lineScores) {
      // Skip title, company, and date lines
      if (bestTitle && scored.index === bestTitle.index) continue;
      if (bestCompany && scored.index === bestCompany.index) continue;
      if (dateLine && scored.index === dateLine.index) continue;

      // Include if it looks like a description
      if (scored.descriptionScore >= 1 || scored.line.length > 50) {
        descriptionLines.push(scored.line.replace(/^[-•*]\s*/, '').trim());
      }
    }

    entry.description = descriptionLines.slice(0, 10).join('\n');

    return entry;
  },

  /**
   * Score a line for likelihood of being a job title
   * @param {string} line - Text line
   * @returns {number} - Score (higher = more likely title)
   */
  scoreTitleLine(line) {
    let score = 0;

    // Title keywords: +4
    const titleKeywords = /\b(Engineer|Developer|Designer|Manager|Director|Analyst|Specialist|Consultant|Coordinator|Lead|Senior|Junior|Staff|Principal|Architect|Administrator|Executive|Associate|Intern|Editor|Writer|Producer|Content\s+Analyst|Marketing|Sales|Support|Operations|Product|Program|Project|Technical|Software|Data|Business|Financial|Account|Customer|Client|Web|Frontend|Backend|Full[\s-]?Stack|DevOps|QA|Quality|Research|Scientist|Technician)\b/i;
    if (titleKeywords.test(line)) score += 4;

    // Short line (< 60 chars): +1
    if (line.length < 60) score += 1;

    // Has numbers (usually not a title): -3
    if (/\d{4}/.test(line)) score -= 3;

    // Starts with bullet: -4
    if (/^[-•*]/.test(line)) score -= 4;

    // Very long line: -2
    if (line.length > 80) score -= 2;

    // Contains "at" or "@" (might be "Title at Company"): +1
    if (/\s+(?:at|@)\s+/i.test(line)) score += 1;

    return score;
  },

  /**
   * Score a line for likelihood of being a company name
   * @param {string} line - Text line
   * @returns {number} - Score (higher = more likely company)
   */
  scoreCompanyLine(line) {
    let score = 0;

    // Company indicators: +3
    const companyIndicators = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Company|Co\.?|Technologies|Solutions|Services|Group|Partners|Consulting|Media|Entertainment|Studios?|Labs?|Global|International|Pvt\.?|Private|Limited)\b/i;
    if (companyIndicators.test(line)) score += 3;

    // Known company names: +4
    const knownCompanies = /\b(Google|Microsoft|Amazon|Apple|Meta|Facebook|Netflix|Gracenote|Spotify|Adobe|Salesforce|Oracle|IBM|Intel|Cisco|VMware|SAP|Uber|Lyft|Airbnb|Twitter|LinkedIn|Snap|Pinterest|TikTok|Stripe|PayPal|Shopify|Zoom|Slack|Dropbox|Atlassian|GitHub|MongoDB|Snowflake|Twilio|Infosys|TCS|Wipro|HCL|Tech Mahindra|Cognizant|Accenture|Deloitte|PwC|EY|KPMG|McKinsey|BCG|Bain)\b/i;
    if (knownCompanies.test(line)) score += 4;

    // Starts with capital letter: +1
    if (/^[A-Z]/.test(line)) score += 1;

    // Short line (< 50 chars): +1
    if (line.length < 50) score += 1;

    // Has job title keywords (probably not just a company): -2
    const titleKeywords = /\b(Engineer|Developer|Designer|Manager|Director|Analyst|Specialist)\b/i;
    if (titleKeywords.test(line)) score -= 2;

    // Has year/date (probably not just a company): -1
    if (/\b(19|20)\d{2}\b/.test(line)) score -= 1;

    // Starts with bullet: -4
    if (/^[-•*]/.test(line)) score -= 4;

    // Very long line: -3
    if (line.length > 70) score -= 3;

    return score;
  },

  /**
   * Score a line for likelihood of containing dates
   * @param {string} line - Text line
   * @returns {number} - Score (higher = more likely date)
   */
  scoreDateLine(line) {
    let score = 0;

    // Has month name: +2
    if (/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i.test(line)) {
      score += 2;
    }

    // Has year: +1
    if (/\b(19|20)\d{2}\b/.test(line)) score += 1;

    // Has "Present", "Current": +2
    if (/\b(Present|Current|Now|Ongoing)\b/i.test(line)) score += 2;

    // Has date range separator: +1
    if (/[-–—]/.test(line) && /\b(19|20)\d{2}\b/.test(line)) score += 1;

    return score;
  },

  /**
   * Score a line for likelihood of being a description/bullet point
   * @param {string} line - Text line
   * @returns {number} - Score (higher = more likely description)
   */
  scoreDescriptionLine(line) {
    let score = 0;

    // Starts with bullet: +3
    if (/^[-•*]/.test(line)) score += 3;

    // Long line (> 60 chars): +2
    if (line.length > 60) score += 2;

    // Contains action verbs: +1
    if (/\b(Developed|Created|Managed|Led|Designed|Implemented|Built|Achieved|Increased|Reduced|Improved|Launched|Delivered|Coordinated|Analyzed|Supported|Maintained|Established)\b/i.test(line)) {
      score += 1;
    }

    // Contains metrics/numbers (but not years): +1
    if (/\d+[%+]|\d+\s*(hours?|clients?|users?|projects?)/i.test(line)) score += 1;

    return score;
  },

  /**
   * Clean title text by removing company/date parts
   * @param {string} text - Raw title text
   * @returns {string} - Cleaned title
   */
  cleanTitleText(text) {
    return text
      .replace(/\s*[-–—|@]\s*.*$/i, '') // Remove everything after separator
      .replace(/\s*\b(at|@)\s+.*$/i, '') // Remove "at Company"
      .replace(/\s*,\s*[A-Z].*$/i, '') // Remove ", Company"
      .replace(/\s*\d{4}.*$/i, '') // Remove year and after
      .trim();
  },

  /**
   * Clean company text by removing title/date parts
   * @param {string} text - Raw company text
   * @returns {string} - Cleaned company
   */
  cleanCompanyText(text) {
    return text
      .replace(/\s*[-–—|]\s*\d{4}.*$/i, '') // Remove date parts
      .replace(/\s*,\s*\d{4}.*$/i, '') // Remove ", 2020..."
      .replace(/\s*[-–—|]\s*(?:Present|Current).*$/i, '') // Remove "- Present"
      .trim();
  },

  /**
   * Extract title and company from a combined line like "Title at Company"
   * @param {string} line - Combined line
   * @returns {Object} - { title, company }
   */
  extractTitleAndCompanyFromLine(line) {
    const result = { title: '', company: '' };

    // Pattern: "Title at Company" or "Title @ Company"
    const atMatch = line.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s*[-–—|]|$)/i);
    if (atMatch) {
      result.title = atMatch[1].trim();
      result.company = atMatch[2].trim();
      return result;
    }

    // Pattern: "Company - Title" or "Company | Title"
    const dashMatch = line.match(/^([A-Z][^-–—|]+?)\s*[-–—|]\s*(.+?(?:Engineer|Developer|Designer|Manager|Director|Analyst|Editor|Writer|Lead).*)$/i);
    if (dashMatch) {
      result.company = dashMatch[1].trim();
      result.title = dashMatch[2].replace(/\s*[-–—|].*$/, '').trim();
      return result;
    }

    // Pattern: "Title, Company"
    const commaMatch = line.match(/^(.+?(?:Engineer|Developer|Designer|Manager|Director|Analyst|Editor|Writer|Lead)[^,]*),\s*(.+?)(?:\s*[-–—|]|$)/i);
    if (commaMatch) {
      result.title = commaMatch[1].trim();
      result.company = commaMatch[2].trim();
      return result;
    }

    return result;
  },

  /**
   * Deduplicate work entries by company+title
   * @param {Array} entries - Array of work entries
   * @returns {Array} - Deduplicated entries
   */
  deduplicateEntries(entries) {
    const seen = new Set();
    return entries.filter(entry => {
      const key = `${entry.company}|${entry.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },


  /**
   * Extract education entries
   * @param {string} text - Education section text
   * @returns {Array} - Array of education entries
   */
  extractEducation(text) {
    if (!text || text.trim().length === 0) return [];

    const entries = [];
    const usedSchools = new Set(); // Track schools to avoid duplicates

    // School name patterns - more comprehensive
    const schoolPatterns = [
      // Universities and colleges
      /([A-Z][A-Za-z.''\s]+(?:University|College|Institute|School|Academy)[A-Za-z.''\s,]*)/gi,
      // St. prefix schools (St. Andrew's, St. Xavier's, etc.)
      /\b(St\.?\s+[A-Z][A-Za-z'']+(?:'s)?\s+(?:College|School|Academy|Institute)[A-Za-z.''\s,]*)/gi,
      // Schools with location (e.g., "Abu Dhabi Indian School")
      /\b([A-Z][A-Za-z\s]+(?:Indian|International|American|British|Public|Private|High|Secondary)?\s*School[A-Za-z\s,]*)/gi,
      // IIT, IIM, NIT patterns
      /\b((?:IIT|IIM|NIT|BITS|IIIT)\s*[A-Za-z\s,]+)/gi
    ];

    // First try to find all schools in the text
    const schoolsFound = [];
    for (const pattern of schoolPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const schoolName = this.cleanSchoolName(match[1]);
        if (schoolName && !usedSchools.has(schoolName.toLowerCase())) {
          usedSchools.add(schoolName.toLowerCase());
          schoolsFound.push({
            name: schoolName,
            index: match.index
          });
        }
      }
    }

    // For each school found, extract the full education entry
    for (const school of schoolsFound) {
      // Get surrounding text (200 chars before and after)
      const startIdx = Math.max(0, school.index - 100);
      const endIdx = Math.min(text.length, school.index + school.name.length + 200);
      const surroundingText = text.slice(startIdx, endIdx);

      const entry = {
        school: school.name,
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
        gpa: '',
        location: ''
      };

      // Extract degree
      const degreeMatch = surroundingText.match(this.PATTERNS.degree);
      if (degreeMatch) {
        entry.degree = degreeMatch[0].trim();
      }

      // Extract GPA/CGPA
      const gpaMatch = surroundingText.match(this.PATTERNS.gpa);
      if (gpaMatch) {
        entry.gpa = gpaMatch[1];
      }

      // Extract graduation year
      const gradYearMatch = surroundingText.match(this.PATTERNS.graduationYear);
      if (gradYearMatch) {
        entry.endDate = gradYearMatch[1];
      } else {
        // Look for any year in context
        const yearMatches = surroundingText.match(this.PATTERNS.yearOnly);
        if (yearMatches && yearMatches.length > 0) {
          // Use the most likely graduation year (usually the last one)
          entry.endDate = yearMatches[yearMatches.length - 1];
        }
      }

      entries.push(entry);
    }

    // If no schools found but degrees exist, try the old method
    if (entries.length === 0) {
      const entry = this.extractSingleEducationEntry(text);
      if (entry && (entry.school || entry.degree)) {
        entries.push(entry);
      }
    }

    return entries;
  },

  /**
   * Clean up school name
   * @param {string} name - Raw school name
   * @returns {string} - Cleaned school name
   */
  cleanSchoolName(name) {
    if (!name) return '';
    return name
      .replace(/\s+/g, ' ')
      .replace(/[,\n]+$/, '')
      .replace(/^\s*[-–—]\s*/, '')
      .trim();
  },

  /**
   * Extract single education entry
   * @param {string} text - Text for one education entry
   * @returns {Object} - Education entry
   */
  extractSingleEducationEntry(text) {
    const entry = {
      school: '',
      degree: '',
      field: '',
      startDate: '',
      endDate: '',
      gpa: '',
      location: ''
    };

    // Extract school
    const schoolMatch = text.match(/([A-Z][A-Za-z\s]+(?:University|College|Institute|School)[A-Za-z\s]*)/);
    if (schoolMatch) {
      entry.school = schoolMatch[1].trim();
    }

    // Extract degree
    const degreeMatch = text.match(this.PATTERNS.degree);
    if (degreeMatch) {
      entry.degree = degreeMatch[0].trim();
    }

    // Extract GPA
    const gpaMatch = text.match(this.PATTERNS.gpa);
    if (gpaMatch) {
      entry.gpa = gpaMatch[1];
    }

    // Extract year
    const yearMatches = text.match(this.PATTERNS.yearOnly);
    if (yearMatches && yearMatches.length > 0) {
      entry.endDate = yearMatches[yearMatches.length - 1];
    }

    return entry;
  },

  /**
   * Extract skills from text
   * @param {string} skillsSection - Skills section text
   * @param {string} fullText - Full resume text
   * @returns {Object} - Categorized skills
   */
  extractSkills(skillsSection, fullText) {
    const searchText = skillsSection + '\n' + fullText;

    const skills = {
      languages: [],
      frameworks: [],
      tools: [],
      soft: []
    };

    // Extract programming languages
    const langMatches = searchText.match(this.PATTERNS.programmingLanguages) || [];
    skills.languages = [...new Set(langMatches.map(s => this.normalizeSkill(s)))];

    // Extract frameworks
    const frameworkMatches = searchText.match(this.PATTERNS.frameworks) || [];
    skills.frameworks = [...new Set(frameworkMatches.map(s => this.normalizeSkill(s)))];

    // Extract tools
    const toolMatches = searchText.match(this.PATTERNS.tools) || [];
    skills.tools = [...new Set(toolMatches.map(s => this.normalizeSkill(s)))];

    // Extract soft skills
    const softMatches = searchText.match(this.PATTERNS.softSkills) || [];
    skills.soft = [...new Set(softMatches.map(s => this.normalizeSkill(s)))];

    return skills;
  },

  // Helper methods

  /**
   * Format phone number - preserves international format
   * @param {string} phone - Raw phone number
   * @returns {string} - Cleaned phone (not reformatted to preserve international numbers)
   */
  formatPhone(phone) {
    // Use CountryCodes module if available
    if (typeof CountryCodes !== 'undefined') {
      return CountryCodes.formatPhone(phone);
    }
    // Fallback to basic formatting
    if (!phone) return '';
    return phone.trim();
  },

  /**
   * Capitalize a word properly
   * @param {string} word - Word to capitalize
   * @returns {string} - Capitalized word
   */
  capitalizeWord(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  },

  /**
   * Normalize US state to abbreviation
   * @param {string} state - State name or abbreviation
   * @returns {string} - State abbreviation
   */
  normalizeState(state) {
    const stateMap = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };

    const normalized = state.toLowerCase().trim();
    return stateMap[normalized] || state.toUpperCase();
  },

  /**
   * Parse date range string
   * @param {string} dateRange - Date range string like "Jan 2020 - Present" or "2020 - 2022"
   * @returns {Object} - Start date, end date, and current status
   */
  parseDateRange(dateRange) {
    const result = { start: '', end: '', current: false };

    if (!dateRange) return result;

    // Check for "Present" or "Current"
    if (/Present|Current|Now|Ongoing/i.test(dateRange)) {
      result.current = true;
    }

    // Try month-year patterns first
    const monthYearDates = dateRange.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.,]?\s*['']?\d{2,4}/gi) || [];

    if (monthYearDates.length >= 1) {
      result.start = this.normalizeDate(monthYearDates[0]);
    }
    if (monthYearDates.length >= 2) {
      result.end = this.normalizeDate(monthYearDates[1]);
    }

    // If no month-year patterns, try year-only patterns
    if (!result.start) {
      const years = dateRange.match(/\b(19|20)\d{2}\b/g) || [];
      if (years.length >= 1) {
        result.start = `${years[0]}-01`;
      }
      if (years.length >= 2 && !result.current) {
        result.end = `${years[1]}-01`;
      }
    }

    return result;
  },

  /**
   * Normalize date to YYYY-MM format
   * @param {string} dateStr - Date string like "Jan 2020"
   * @returns {string} - Normalized date in YYYY-MM format
   */
  normalizeDate(dateStr) {
    const monthMap = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    const match = dateStr.match(/([A-Za-z]+)[.,]?\s*(\d{4})/);
    if (!match) return '';

    const month = match[1].toLowerCase().slice(0, 3);
    const year = match[2];

    return `${year}-${monthMap[month] || '01'}`;
  },

  /**
   * Normalize skill name
   * @param {string} skill - Raw skill name
   * @returns {string} - Normalized skill name
   */
  normalizeSkill(skill) {
    // Common normalizations
    const normalizations = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'nodejs': 'Node.js',
      'node.js': 'Node.js',
      'reactjs': 'React',
      'react.js': 'React',
      'vuejs': 'Vue.js',
      'vue.js': 'Vue.js',
      'angularjs': 'Angular',
      'angular.js': 'Angular',
      'nextjs': 'Next.js',
      'next.js': 'Next.js',
      'expressjs': 'Express.js',
      'express.js': 'Express.js',
      'mongodb': 'MongoDB',
      'postgresql': 'PostgreSQL',
      'mysql': 'MySQL',
      'github': 'GitHub',
      'gitlab': 'GitLab',
      'vs code': 'VS Code',
      'vscode': 'VS Code'
    };

    const lower = skill.toLowerCase().trim();
    return normalizations[lower] || skill.trim();
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ResumeFieldExtractor = ResumeFieldExtractor;
}
