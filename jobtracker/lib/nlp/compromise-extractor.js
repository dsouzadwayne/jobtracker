/**
 * Compromise.js NLP Extractor
 * Lightweight NLP for job titles, companies, skills, and label normalization
 * Uses Compromise.js (~200KB) for fast main-thread extraction
 */

// Compromise.js will be loaded dynamically
let nlp = null;
let loadingPromise = null;

// Plugin configuration - always enabled
const COMPROMISE_PLUGINS = {
  paragraphs: { file: 'compromise-paragraphs.min.js', globalName: 'compromiseParagraphs' },
  sentences: { file: 'compromise-sentences.min.js', globalName: 'compromiseSentences' },
  dates: { file: 'compromise-dates.min.js', globalName: 'compromiseDates' },
  numbers: { file: 'compromise-numbers.min.js', globalName: 'compromiseNumbers' }
};
let pluginsLoaded = false;

/**
 * Check if running in service worker context (no DOM)
 */
function isServiceWorker() {
  return typeof window === 'undefined' || typeof document === 'undefined';
}

/**
 * Load Compromise.js dynamically
 * Handles both content script (DOM) and service worker (importScripts) contexts
 */
async function loadCompromise() {
  if (nlp) return nlp;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Check if already loaded globally
      if (typeof globalThis !== 'undefined' && globalThis.nlp) {
        nlp = globalThis.nlp;
        return nlp;
      }

      if (typeof window !== 'undefined' && window.nlp) {
        nlp = window.nlp;
        return nlp;
      }

      // Service worker context - use importScripts
      if (isServiceWorker()) {
        try {
          const url = typeof chrome !== 'undefined' && chrome.runtime
            ? chrome.runtime.getURL('lib/vendor/compromise.min.js')
            : './vendor/compromise.min.js';

          // Use importScripts for service worker
          if (typeof importScripts === 'function') {
            importScripts(url);
            nlp = globalThis.nlp;
            console.log('[CompromiseExtractor] Loaded via importScripts');
            return nlp;
          }

          // Fallback for ES modules in service worker - this shouldn't normally run
          // but provides a graceful degradation
          console.warn('[CompromiseExtractor] No loading method available in service worker');
          throw new Error('Cannot load Compromise.js in this context');
        } catch (error) {
          console.error('[CompromiseExtractor] Service worker load failed:', error);
          loadingPromise = null; // Clear so retry is possible
          throw error;
        }
      }

      // Content script context - use script tag injection
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const url = typeof chrome !== 'undefined' && chrome.runtime
          ? chrome.runtime.getURL('lib/vendor/compromise.min.js')
          : '../vendor/compromise.min.js';

        script.src = url;

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          loadingPromise = null; // Clear so retry is possible
          reject(new Error('Timeout loading Compromise.js'));
        }, 10000);

        script.onload = () => {
          clearTimeout(timeout);
          nlp = window.nlp;
          if (!nlp) {
            loadingPromise = null;
            reject(new Error('Compromise.js loaded but nlp not available'));
            return;
          }
          console.log('[CompromiseExtractor] Loaded successfully');
          resolve(nlp);
        };
        script.onerror = (error) => {
          clearTimeout(timeout);
          console.error('[CompromiseExtractor] Failed to load:', error);
          loadingPromise = null; // Clear so retry is possible
          reject(new Error('Failed to load Compromise.js'));
        };

        document.head.appendChild(script);
      });
    } catch (error) {
      loadingPromise = null; // Clear so retry is possible
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * Load Compromise.js plugins (paragraphs, sentences, dates, numbers)
 * Called automatically after base library loads
 */
async function loadCompromisePlugins() {
  if (pluginsLoaded || !nlp) return;

  const getPluginUrl = (filename) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime.getURL(`lib/vendor/${filename}`);
    }
    return `./vendor/${filename}`;
  };

  // Service worker context - use importScripts
  if (isServiceWorker()) {
    for (const [name, config] of Object.entries(COMPROMISE_PLUGINS)) {
      try {
        const url = getPluginUrl(config.file);
        importScripts(url);
        const plugin = globalThis[config.globalName];
        if (plugin) {
          nlp.extend(plugin);
          console.log(`[CompromiseExtractor] Loaded plugin: ${name}`);
        } else {
          console.warn(`[CompromiseExtractor] Plugin ${name} loaded but global not found`);
        }
      } catch (error) {
        console.warn(`[CompromiseExtractor] Failed to load plugin ${name}:`, error.message);
      }
    }
    pluginsLoaded = true;
    return;
  }

  // Content script context - inject script tags sequentially
  for (const [name, config] of Object.entries(COMPROMISE_PLUGINS)) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = getPluginUrl(config.file);

        const timeout = setTimeout(() => {
          reject(new Error(`Timeout loading plugin: ${name}`));
        }, 5000);

        script.onload = () => {
          clearTimeout(timeout);
          const plugin = window[config.globalName];
          if (plugin) {
            nlp.extend(plugin);
            console.log(`[CompromiseExtractor] Loaded plugin: ${name}`);
          } else {
            console.warn(`[CompromiseExtractor] Plugin ${name} loaded but global not found`);
          }
          resolve();
        };

        script.onerror = (error) => {
          clearTimeout(timeout);
          console.warn(`[CompromiseExtractor] Failed to load plugin ${name}:`, error);
          resolve(); // Continue loading other plugins even if one fails
        };

        document.head.appendChild(script);
      });
    } catch (error) {
      console.warn(`[CompromiseExtractor] Error loading plugin ${name}:`, error.message);
    }
  }
  pluginsLoaded = true;
}

/**
 * Compromise Extractor class
 * Provides lightweight NLP extraction using Compromise.js
 */
class CompromiseExtractor {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the extractor by loading Compromise.js and plugins
   */
  async init() {
    if (this.initialized) return;
    await loadCompromise();
    await loadCompromisePlugins();
    this.initialized = true;
  }

  /**
   * Extract job title from text using POS tagging
   * @param {string} text - Text to analyze
   * @returns {Object} Extracted job title info
   */
  async extractJobTitle(text) {
    await this.init();

    if (!nlp) {
      console.error('[CompromiseExtractor] nlp not loaded, cannot extract job title');
      return { title: null, confidence: 0, source: null };
    }

    const doc = nlp(text);

    // Common job title patterns
    const titlePatterns = [
      '#Noun+ (engineer|developer|designer|manager|analyst|specialist|coordinator|consultant|architect|lead|director|executive|officer|administrator)',
      'senior #Noun+',
      'junior #Noun+',
      'staff #Noun+',
      'principal #Noun+',
      '#Adjective? (software|product|project|data|marketing|sales|finance|hr|human resources) #Noun+'
    ];

    // Try each pattern
    for (const pattern of titlePatterns) {
      const match = doc.match(pattern);
      if (match.found) {
        return {
          title: match.text('normal'),
          confidence: 0.8,
          source: 'pattern'
        };
      }
    }

    // Fallback: Look for capitalized noun phrases
    const nouns = doc.nouns().toTitleCase().out('array');
    if (nouns.length > 0) {
      // Filter to likely job titles
      const jobKeywords = /engineer|developer|designer|manager|analyst|director|specialist|consultant|architect|lead|coordinator|administrator|executive|officer/i;
      const titleCandidates = nouns.filter(n => jobKeywords.test(n));

      if (titleCandidates.length > 0) {
        return {
          title: titleCandidates[0],
          confidence: 0.6,
          source: 'noun-filter'
        };
      }
    }

    return { title: null, confidence: 0, source: null };
  }

  /**
   * Extract company names from text
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted company names
   */
  async extractCompanies(text) {
    await this.init();

    if (!nlp) {
      console.error('[CompromiseExtractor] nlp not loaded, cannot extract companies');
      return [];
    }

    const doc = nlp(text);
    const companies = [];

    // Look for organizations
    const orgs = doc.organizations().out('array');
    companies.push(...orgs.map(o => ({ name: o, confidence: 0.8, source: 'organization' })));

    // Look for patterns like "at Company" or "Company Inc."
    const patterns = [
      'at #ProperNoun+',
      '#ProperNoun+ (Inc|LLC|Ltd|Corp|Corporation|Company|Co|Group|Technologies|Solutions|Labs|Studio|Studios)',
      'join #ProperNoun+',
      'for #ProperNoun+'
    ];

    for (const pattern of patterns) {
      const matches = doc.match(pattern);
      if (matches.found) {
        matches.forEach(m => {
          const name = m.text('normal')
            .replace(/^(at|join|for)\s+/i, '')
            .trim();
          if (name && !companies.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            companies.push({ name, confidence: 0.7, source: 'pattern' });
          }
        });
      }
    }

    return companies;
  }

  /**
   * Extract skills from text
   * @param {string} text - Text to analyze
   * @returns {Object} Categorized skills
   */
  async extractSkills(text) {
    await this.init();

    // Skills extraction uses regex primarily, nlp is optional for this method
    if (!nlp) {
      console.warn('[CompromiseExtractor] nlp not loaded, using regex-only skill extraction');
    }

    const doc = nlp ? nlp(text.toLowerCase()) : null;
    const skills = {
      programming: [],
      frameworks: [],
      tools: [],
      databases: [],
      cloud: [],
      soft: [],
      other: []
    };

    // Skill keyword dictionaries
    const skillPatterns = {
      programming: [
        'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'golang',
        'rust', 'php', 'swift', 'kotlin', 'scala', 'perl', 'r', 'matlab', 'sql', 'html', 'css'
      ],
      frameworks: [
        'react', 'reactjs', 'react.js', 'angular', 'angularjs', 'vue', 'vuejs', 'vue.js',
        'svelte', 'node', 'nodejs', 'node.js', 'express', 'expressjs', 'django', 'flask',
        'spring', 'springboot', 'rails', 'ruby on rails', 'laravel', 'fastapi', 'nextjs',
        'next.js', 'nuxt', 'nuxtjs', 'gatsby', 'tailwind', 'bootstrap', 'jquery'
      ],
      tools: [
        'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'slack', 'figma',
        'sketch', 'postman', 'jenkins', 'travis', 'circleci', 'webpack', 'vite', 'babel',
        'npm', 'yarn', 'pnpm', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible'
      ],
      databases: [
        'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
        'cassandra', 'oracle', 'sqlite', 'mssql', 'sql server', 'mariadb', 'neo4j', 'graphql'
      ],
      cloud: [
        'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'heroku', 'vercel',
        'netlify', 'digitalocean', 'cloudflare', 'firebase', 'supabase'
      ],
      soft: [
        'leadership', 'communication', 'teamwork', 'collaboration', 'problem solving',
        'critical thinking', 'time management', 'project management', 'agile', 'scrum',
        'kanban', 'mentoring', 'presentation', 'negotiation'
      ]
    };

    const textLower = text.toLowerCase();

    for (const [category, keywords] of Object.entries(skillPatterns)) {
      for (const keyword of keywords) {
        // Use word boundary check
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textLower)) {
          if (!skills[category].includes(keyword)) {
            skills[category].push(keyword);
          }
        }
      }
    }

    return skills;
  }

  /**
   * Extract location information
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted locations
   */
  async extractLocations(text) {
    await this.init();

    if (!nlp) {
      console.error('[CompromiseExtractor] nlp not loaded, cannot extract locations');
      return [];
    }

    const doc = nlp(text);
    const locations = [];

    // Get places from Compromise.js
    const places = doc.places().out('array');
    locations.push(...places.map(p => ({ location: p, confidence: 0.8, type: 'place' })));

    // Look for common location patterns
    const locationPatterns = [
      'in #Place+',
      'located in #ProperNoun+',
      '#ProperNoun+, #ProperNoun+', // City, State pattern
      'remote',
      'hybrid',
      'on-site',
      'onsite'
    ];

    for (const pattern of locationPatterns) {
      const matches = doc.match(pattern);
      if (matches.found) {
        matches.forEach(m => {
          const loc = m.text('normal').replace(/^(in|located in)\s+/i, '').trim();
          if (loc && !locations.some(l => l.location.toLowerCase() === loc.toLowerCase())) {
            locations.push({ location: loc, confidence: 0.7, type: 'pattern' });
          }
        });
      }
    }

    return locations;
  }

  /**
   * Extract dates and date ranges
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted dates
   */
  async extractDates(text) {
    await this.init();

    // If nlp is not loaded, fall back to regex-only extraction
    if (!nlp) {
      console.warn('[CompromiseExtractor] nlp not loaded, using regex-only date extraction');
      return this.extractDatesWithRegex(text);
    }

    const doc = nlp(text);
    const dates = [];

    // Get dates from Compromise.js
    const docDates = doc.dates().out('array');
    dates.push(...docDates.map(d => ({ date: d, confidence: 0.8, type: 'date' })));

    // Look for date range patterns common in resumes
    const rangePatterns = [
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*[-–to]+\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}/gi,
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*[-–to]+\s*(?:Present|Current)/gi,
      /\d{4}\s*[-–to]+\s*\d{4}/g,
      /\d{4}\s*[-–to]+\s*(?:Present|Current)/gi
    ];

    for (const pattern of rangePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => {
          if (!dates.some(d => d.date === m)) {
            dates.push({ date: m, confidence: 0.9, type: 'range' });
          }
        });
      }
    }

    return dates;
  }

  /**
   * Extract dates using regex patterns only (fallback when nlp not loaded)
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted dates
   */
  extractDatesWithRegex(text) {
    const dates = [];

    // Look for date range patterns common in resumes
    const rangePatterns = [
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*[-–to]+\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}/gi,
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*[-–to]+\s*(?:Present|Current)/gi,
      /\d{4}\s*[-–to]+\s*\d{4}/g,
      /\d{4}\s*[-–to]+\s*(?:Present|Current)/gi
    ];

    for (const pattern of rangePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => {
          if (!dates.some(d => d.date === m)) {
            dates.push({ date: m, confidence: 0.9, type: 'range' });
          }
        });
      }
    }

    return dates;
  }

  /**
   * Extract person names
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted names
   */
  async extractNames(text) {
    await this.init();

    if (!nlp) {
      console.error('[CompromiseExtractor] nlp not loaded, cannot extract names');
      return [];
    }

    const doc = nlp(text);
    const names = [];

    // Get people names from Compromise.js
    const people = doc.people().out('array');
    names.push(...people.map(p => ({ name: p, confidence: 0.8, source: 'people' })));

    // Common name patterns at the start of resumes
    const firstLine = text.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 50) {
      // Check if first line looks like a name (2-4 capitalized words)
      const words = firstLine.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        const allCapitalized = words.every(w => /^[A-Z]/.test(w));
        if (allCapitalized && !names.some(n => n.name === firstLine)) {
          names.push({ name: firstLine, confidence: 0.7, source: 'first-line' });
        }
      }
    }

    return names;
  }

  /**
   * Normalize form label text to match profile fields
   * @param {string} labelText - Label text to normalize
   * @returns {Object} Normalized field info
   */
  async normalizeLabel(labelText) {
    await this.init();

    const text = labelText.toLowerCase().trim();

    // Direct mappings for common labels
    const directMappings = {
      'first name': 'personal.firstName',
      'firstname': 'personal.firstName',
      'given name': 'personal.firstName',
      'last name': 'personal.lastName',
      'lastname': 'personal.lastName',
      'surname': 'personal.lastName',
      'family name': 'personal.lastName',
      'full name': 'personal.fullName',
      'name': 'personal.fullName',
      'email': 'personal.email',
      'e-mail': 'personal.email',
      'email address': 'personal.email',
      'phone': 'personal.phone',
      'telephone': 'personal.phone',
      'phone number': 'personal.phone',
      'mobile': 'personal.phone',
      'cell': 'personal.phone',
      'linkedin': 'personal.linkedIn',
      'linkedin url': 'personal.linkedIn',
      'linkedin profile': 'personal.linkedIn',
      'github': 'personal.github',
      'github url': 'personal.github',
      'portfolio': 'personal.portfolio',
      'website': 'personal.website',
      'personal website': 'personal.website',
      'city': 'personal.location.city',
      'state': 'personal.location.state',
      'province': 'personal.location.state',
      'country': 'personal.location.country',
      'zip': 'personal.location.zipCode',
      'zip code': 'personal.location.zipCode',
      'postal code': 'personal.location.zipCode',
      'address': 'personal.address.street',
      'street address': 'personal.address.street'
    };

    // Check direct mappings first
    if (directMappings[text]) {
      return { field: directMappings[text], confidence: 1.0, method: 'direct' };
    }

    // Check partial matches
    for (const [key, value] of Object.entries(directMappings)) {
      if (text.includes(key) || key.includes(text)) {
        return { field: value, confidence: 0.8, method: 'partial' };
      }
    }

    // Use NLP to identify field type (if nlp is loaded)
    if (!nlp) {
      return { field: null, confidence: 0, method: null };
    }

    const doc = nlp(labelText);

    // Check for name-related terms
    if (doc.has('(name|first|last|given|surname|family)')) {
      if (doc.has('(first|given)')) return { field: 'personal.firstName', confidence: 0.7, method: 'nlp' };
      if (doc.has('(last|surname|family)')) return { field: 'personal.lastName', confidence: 0.7, method: 'nlp' };
      return { field: 'personal.fullName', confidence: 0.6, method: 'nlp' };
    }

    // Check for contact-related terms
    if (doc.has('(email|mail)')) return { field: 'personal.email', confidence: 0.7, method: 'nlp' };
    if (doc.has('(phone|cell|mobile|telephone)')) return { field: 'personal.phone', confidence: 0.7, method: 'nlp' };

    // Check for location-related terms
    if (doc.has('(city|town)')) return { field: 'personal.location.city', confidence: 0.7, method: 'nlp' };
    if (doc.has('(state|province|region)')) return { field: 'personal.location.state', confidence: 0.7, method: 'nlp' };
    if (doc.has('(country|nation)')) return { field: 'personal.location.country', confidence: 0.7, method: 'nlp' };

    return { field: null, confidence: 0, method: null };
  }

  /**
   * Extract all relevant information from job posting text
   * @param {string} text - Job posting text
   * @returns {Object} Extracted job information
   */
  async extractJobInfo(text) {
    const [title, companies, skills, locations, dates] = await Promise.all([
      this.extractJobTitle(text),
      this.extractCompanies(text),
      this.extractSkills(text),
      this.extractLocations(text),
      this.extractDates(text)
    ]);

    return {
      position: title.title,
      company: companies[0]?.name || null,
      allCompanies: companies,
      skills,
      location: locations[0]?.location || null,
      allLocations: locations,
      dates,
      positionConfidence: title.confidence,
      companyConfidence: companies[0]?.confidence || 0
    };
  }

  /**
   * Extract all relevant information from resume text
   * @param {string} text - Resume text
   * @returns {Object} Extracted resume information
   */
  async extractResumeInfo(text) {
    const [names, companies, skills, locations, dates] = await Promise.all([
      this.extractNames(text),
      this.extractCompanies(text),
      this.extractSkills(text),
      this.extractLocations(text),
      this.extractDates(text)
    ]);

    return {
      name: names[0]?.name || null,
      allNames: names,
      companies: companies.map(c => c.name),
      skills,
      locations: locations.map(l => l.location),
      dates: dates.map(d => d.date),
      nameConfidence: names[0]?.confidence || 0
    };
  }

  // ============================================
  // Plugin-based extraction methods
  // ============================================

  /**
   * Extract paragraphs from text (uses compromise-paragraphs plugin)
   * Useful for resume section detection and bullet point grouping
   * @param {string} text - Text to analyze
   * @returns {Object} Extracted paragraphs with metadata
   */
  async extractParagraphs(text) {
    await this.init();

    if (!nlp) {
      console.warn('[CompromiseExtractor] nlp not loaded, using fallback paragraph extraction');
      return this.extractParagraphsWithRegex(text);
    }

    const doc = nlp(text);

    // Check if paragraphs plugin is available
    if (typeof doc.paragraphs !== 'function') {
      console.warn('[CompromiseExtractor] paragraphs plugin not available, using fallback');
      return this.extractParagraphsWithRegex(text);
    }

    const paragraphs = doc.paragraphs();
    const result = {
      count: paragraphs.length,
      paragraphs: [],
      sections: []
    };

    // Process each paragraph
    paragraphs.forEach((p, index) => {
      const paragraphText = p.text();
      const sentences = p.sentences ? p.sentences() : null;

      result.paragraphs.push({
        index,
        text: paragraphText,
        sentenceCount: sentences ? sentences.length : paragraphText.split(/[.!?]+/).filter(s => s.trim()).length,
        hasBullets: /^[\s]*[-•*]\s/.test(paragraphText) || /\n[\s]*[-•*]\s/.test(paragraphText),
        isHeader: paragraphText.length < 50 && /^[A-Z]/.test(paragraphText) && !/[.!?]$/.test(paragraphText.trim())
      });
    });

    // Detect resume sections based on common headers
    const sectionHeaders = [
      'experience', 'work experience', 'employment', 'professional experience',
      'education', 'academic', 'qualifications',
      'skills', 'technical skills', 'core competencies',
      'summary', 'professional summary', 'objective', 'profile',
      'projects', 'certifications', 'awards', 'publications', 'references'
    ];

    result.paragraphs.forEach((p, index) => {
      const textLower = p.text.toLowerCase().trim();
      const matchedSection = sectionHeaders.find(header =>
        textLower === header || textLower.startsWith(header + ':') || textLower.startsWith(header + '\n')
      );
      if (matchedSection || p.isHeader) {
        result.sections.push({
          header: p.text.trim(),
          type: matchedSection || 'unknown',
          startIndex: index
        });
      }
    });

    return result;
  }

  /**
   * Fallback paragraph extraction using regex
   */
  extractParagraphsWithRegex(text) {
    const rawParagraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    return {
      count: rawParagraphs.length,
      paragraphs: rawParagraphs.map((p, index) => ({
        index,
        text: p.trim(),
        sentenceCount: p.split(/[.!?]+/).filter(s => s.trim()).length,
        hasBullets: /^[\s]*[-•*]\s/.test(p) || /\n[\s]*[-•*]\s/.test(p),
        isHeader: p.trim().length < 50 && /^[A-Z]/.test(p) && !/[.!?]$/.test(p.trim())
      })),
      sections: []
    };
  }

  /**
   * Extract sentences from text (uses compromise-sentences plugin)
   * Useful for splitting job descriptions and classifying requirements vs benefits
   * @param {string} text - Text to analyze
   * @returns {Object} Extracted sentences with classification
   */
  async extractSentences(text) {
    await this.init();

    if (!nlp) {
      console.warn('[CompromiseExtractor] nlp not loaded, using fallback sentence extraction');
      return this.extractSentencesWithRegex(text);
    }

    const doc = nlp(text);

    // Check if sentences plugin is available
    if (typeof doc.sentences !== 'function') {
      console.warn('[CompromiseExtractor] sentences plugin not available, using fallback');
      return this.extractSentencesWithRegex(text);
    }

    const sentences = doc.sentences();
    const result = {
      count: sentences.length,
      sentences: [],
      requirements: [],
      benefits: [],
      responsibilities: []
    };

    // Keywords for classification
    const requirementKeywords = /\b(require|must|should|need|essential|mandatory|minimum|at least|proficient|experience in|knowledge of|degree in)\b/i;
    const benefitKeywords = /\b(offer|provide|benefit|bonus|salary|compensation|insurance|vacation|remote|flexible|401k|health|dental|vision|pto|equity|stock)\b/i;
    const responsibilityKeywords = /\b(responsible|will|duties|manage|develop|create|build|design|implement|maintain|support|lead|coordinate)\b/i;

    sentences.forEach((s, index) => {
      const sentenceText = s.text();
      const sentenceData = {
        index,
        text: sentenceText,
        type: 'statement'
      };

      // Classify sentence type using plugin if available
      if (typeof s.isQuestion === 'function' && s.isQuestion().found) {
        sentenceData.type = 'question';
      } else if (typeof s.isExclamation === 'function' && s.isExclamation().found) {
        sentenceData.type = 'exclamation';
      }

      result.sentences.push(sentenceData);

      // Classify by content
      if (requirementKeywords.test(sentenceText)) {
        result.requirements.push({ index, text: sentenceText });
      }
      if (benefitKeywords.test(sentenceText)) {
        result.benefits.push({ index, text: sentenceText });
      }
      if (responsibilityKeywords.test(sentenceText)) {
        result.responsibilities.push({ index, text: sentenceText });
      }
    });

    return result;
  }

  /**
   * Fallback sentence extraction using regex
   */
  extractSentencesWithRegex(text) {
    const rawSentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    return {
      count: rawSentences.length,
      sentences: rawSentences.map((s, index) => ({
        index,
        text: s.trim(),
        type: /\?$/.test(s.trim()) ? 'question' : /!$/.test(s.trim()) ? 'exclamation' : 'statement'
      })),
      requirements: [],
      benefits: [],
      responsibilities: []
    };
  }

  /**
   * Enhanced date extraction with duration calculation (uses compromise-dates plugin)
   * Parses date ranges like "Jan 2020 - Present" and calculates durations
   * @param {string} text - Text to analyze
   * @returns {Object} Extracted dates with parsed values and durations
   */
  async extractDatesEnhanced(text) {
    await this.init();

    if (!nlp) {
      console.warn('[CompromiseExtractor] nlp not loaded, using basic date extraction');
      return { dates: this.extractDatesWithRegex(text), parsed: [], totalDuration: null };
    }

    const doc = nlp(text);
    const result = {
      dates: [],
      parsed: [],
      ranges: [],
      totalDuration: null
    };

    // Check if dates plugin provides enhanced functionality
    const docDates = doc.dates();

    if (docDates.found) {
      // Try to get parsed date objects if available
      const dateTexts = docDates.out('array');

      dateTexts.forEach(dateText => {
        const dateEntry = {
          text: dateText,
          confidence: 0.9
        };

        // Try to parse with plugin's json method if available
        try {
          const dateDoc = nlp(dateText).dates();
          if (typeof dateDoc.json === 'function') {
            const jsonData = dateDoc.json();
            if (jsonData && jsonData[0]) {
              dateEntry.parsed = jsonData[0];
              if (jsonData[0].start) dateEntry.start = jsonData[0].start;
              if (jsonData[0].end) dateEntry.end = jsonData[0].end;
            }
          }
        } catch (e) {
          // Plugin method not available, continue with text only
        }

        result.dates.push(dateEntry);
      });
    }

    // Extract and parse date ranges with duration calculation
    const rangePatterns = [
      { regex: /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{4}\s*[-–to]+\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{4}/gi, type: 'month-range' },
      { regex: /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{4}\s*[-–to]+\s*(?:Present|Current|Now)/gi, type: 'ongoing' },
      { regex: /\d{4}\s*[-–to]+\s*\d{4}/g, type: 'year-range' },
      { regex: /\d{4}\s*[-–to]+\s*(?:Present|Current|Now)/gi, type: 'ongoing-year' }
    ];

    for (const { regex, type } of rangePatterns) {
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(match => {
          const range = this.parseDateRange(match, type);
          if (range && !result.ranges.some(r => r.text === match)) {
            result.ranges.push(range);
          }
        });
      }
    }

    // Calculate total duration from ranges
    if (result.ranges.length > 0) {
      let totalMonths = 0;
      result.ranges.forEach(range => {
        if (range.durationMonths) {
          totalMonths += range.durationMonths;
        }
      });
      if (totalMonths > 0) {
        result.totalDuration = {
          months: totalMonths,
          years: Math.floor(totalMonths / 12),
          remainingMonths: totalMonths % 12,
          formatted: `${Math.floor(totalMonths / 12)} years, ${totalMonths % 12} months`
        };
      }
    }

    return result;
  }

  /**
   * Parse a date range string and calculate duration
   * @param {string} rangeText - Date range text like "Jan 2020 - Present"
   * @param {string} type - Type of range pattern matched
   * @returns {Object} Parsed range with start, end, and duration
   */
  parseDateRange(rangeText, type) {
    const monthMap = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11
    };

    const result = { text: rangeText, type };

    try {
      const parts = rangeText.split(/\s*[-–]\s*|\s+to\s+/i);
      if (parts.length !== 2) return result;

      const startPart = parts[0].trim();
      const endPart = parts[1].trim();

      // Parse start date
      const startMonthMatch = startPart.match(/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i);
      const startYearMatch = startPart.match(/(\d{4})/);

      if (startYearMatch) {
        result.startYear = parseInt(startYearMatch[1]);
        result.startMonth = startMonthMatch ? monthMap[startMonthMatch[1].toLowerCase().substring(0, 3)] : 0;
      }

      // Parse end date
      const isOngoing = /present|current|now/i.test(endPart);
      if (isOngoing) {
        result.ongoing = true;
        const now = new Date();
        result.endYear = now.getFullYear();
        result.endMonth = now.getMonth();
      } else {
        const endMonthMatch = endPart.match(/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i);
        const endYearMatch = endPart.match(/(\d{4})/);

        if (endYearMatch) {
          result.endYear = parseInt(endYearMatch[1]);
          result.endMonth = endMonthMatch ? monthMap[endMonthMatch[1].toLowerCase().substring(0, 3)] : 11;
        }
      }

      // Calculate duration
      if (result.startYear && result.endYear) {
        const startDate = new Date(result.startYear, result.startMonth || 0);
        const endDate = new Date(result.endYear, result.endMonth || 11);
        const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
        result.durationMonths = Math.max(0, diffMonths);
        result.durationYears = Math.floor(result.durationMonths / 12);
      }
    } catch (e) {
      // Parsing failed, return basic result
    }

    return result;
  }

  /**
   * Extract structured work history with promotion detection
   * @param {string} text - Resume text
   * @returns {Object} Work history with positions and promotions
   */
  async extractWorkHistory(text) {
    await this.init();

    const result = {
      positions: [],
      promotions: [],
      companies: new Set(),
      totalExperience: null
    };

    // Date range pattern to find job entries
    const dateRangePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*[-–to]+\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*[-–to]+\s*(?:Present|Current|Now)|\d{4}\s*[-–to]+\s*(?:\d{4}|Present|Current|Now)/gi;

    // Find all date ranges and their positions in text
    const dateMatches = [...text.matchAll(dateRangePattern)];

    // Track last company for inheritance (when company is listed once for multiple roles)
    let lastCompany = null;

    for (let i = 0; i < dateMatches.length; i++) {
      const dateMatch = dateMatches[i];
      const dateRange = this.parseDateRange(dateMatch[0], 'auto');

      // Get context around this date (100 chars before, 500 chars after)
      const contextStart = Math.max(0, dateMatch.index - 100);
      const contextEnd = Math.min(text.length, dateMatch.index + dateMatch[0].length + 500);
      const context = text.substring(contextStart, contextEnd);

      // Extract job title and company from context
      const titleResult = await this.extractJobTitle(context);
      const companyResult = await this.extractCompanies(context);

      const position = {
        title: titleResult.title,
        company: companyResult[0]?.name || null,
        dateRange: dateMatch[0],
        startDate: dateRange.startYear ? `${(dateRange.startMonth || 0) + 1}/${dateRange.startYear}` : null,
        endDate: dateRange.ongoing ? 'Present' : (dateRange.endYear ? `${(dateRange.endMonth || 11) + 1}/${dateRange.endYear}` : null),
        durationMonths: dateRange.durationMonths || null,
        context: context.trim()
      };

      // Track company for inheritance
      if (position.company) {
        lastCompany = position.company;
        result.companies.add(position.company);
      } else if (lastCompany) {
        position.company = lastCompany;
        position.inheritedCompany = true;
      }

      result.positions.push(position);
    }

    // Detect promotions: same company, different titles, consecutive dates
    const companyPositions = {};
    for (const pos of result.positions) {
      if (pos.company) {
        const key = pos.company.toLowerCase();
        if (!companyPositions[key]) companyPositions[key] = [];
        companyPositions[key].push(pos);
      }
    }

    for (const [company, positions] of Object.entries(companyPositions)) {
      if (positions.length > 1) {
        // Sort by start date (oldest first)
        positions.sort((a, b) => {
          const aDate = a.startDate ? new Date(a.startDate) : new Date(0);
          const bDate = b.startDate ? new Date(b.startDate) : new Date(0);
          return aDate - bDate;
        });

        // Each consecutive pair is a potential promotion
        for (let i = 0; i < positions.length - 1; i++) {
          result.promotions.push({
            company: positions[i].company,
            from: positions[i].title,
            to: positions[i + 1].title,
            fromDate: positions[i].dateRange,
            toDate: positions[i + 1].dateRange
          });
        }
      }
    }

    // Calculate total experience
    const totalMonths = result.positions.reduce((sum, p) => sum + (p.durationMonths || 0), 0);
    if (totalMonths > 0) {
      result.totalExperience = {
        months: totalMonths,
        years: Math.floor(totalMonths / 12),
        remainingMonths: totalMonths % 12,
        formatted: `${Math.floor(totalMonths / 12)} years, ${totalMonths % 12} months`
      };
    }

    // Convert Set to Array for serialization
    result.companies = [...result.companies];
    return result;
  }

  /**
   * Extract salary information from text (uses compromise-numbers plugin)
   * Normalizes salary ranges like "$120k-$150k" to structured data
   * @param {string} text - Text to analyze
   * @returns {Object} Extracted salary information
   */
  async extractSalary(text) {
    await this.init();

    const result = {
      found: false,
      salaries: [],
      normalized: null
    };

    if (!nlp) {
      console.warn('[CompromiseExtractor] nlp not loaded, using regex-only salary extraction');
      return this.extractSalaryWithRegex(text);
    }

    const doc = nlp(text);

    // Check if money method is available from numbers plugin
    if (typeof doc.money === 'function') {
      const moneyMatches = doc.money();
      if (moneyMatches.found) {
        const moneyData = moneyMatches.json();
        moneyData.forEach(m => {
          result.salaries.push({
            text: m.text,
            value: m.number || null,
            currency: this.detectCurrency(m.text)
          });
        });
        result.found = result.salaries.length > 0;
      }
    }

    // Also use regex patterns for common salary formats
    const regexResult = this.extractSalaryWithRegex(text);
    regexResult.salaries.forEach(s => {
      if (!result.salaries.some(existing => existing.text === s.text)) {
        result.salaries.push(s);
      }
    });
    result.found = result.salaries.length > 0;

    // Normalize to min/max range
    if (result.salaries.length > 0) {
      const values = result.salaries.map(s => s.value).filter(v => v !== null);
      if (values.length >= 2) {
        result.normalized = {
          min: Math.min(...values),
          max: Math.max(...values),
          currency: result.salaries[0].currency || 'USD'
        };
      } else if (values.length === 1) {
        result.normalized = {
          min: values[0],
          max: values[0],
          currency: result.salaries[0].currency || 'USD'
        };
      }
    }

    return result;
  }

  /**
   * Regex-based salary extraction fallback
   */
  extractSalaryWithRegex(text) {
    const result = {
      found: false,
      salaries: [],
      normalized: null
    };

    // Common salary patterns
    const salaryPatterns = [
      // $120k - $150k, $120K-$150K
      /\$\s*(\d{2,3})\s*k\s*[-–to]+\s*\$?\s*(\d{2,3})\s*k/gi,
      // $120,000 - $150,000
      /\$\s*([\d,]+)\s*[-–to]+\s*\$?\s*([\d,]+)/g,
      // Single values: $120k, $120,000
      /\$\s*(\d{2,3})\s*k(?!\s*[-–to])/gi,
      /\$\s*([\d,]+)(?:\s*(?:per|\/)\s*(?:year|yr|annum|annual))?(?!\s*[-–to])/gi,
      // Range with "to": $120k to $150k
      /\$\s*(\d{2,3})\s*k\s+to\s+\$?\s*(\d{2,3})\s*k/gi
    ];

    const textClean = text.replace(/,/g, '');

    for (const pattern of salaryPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const matchText = match[0];

        // Parse values
        if (match[2]) {
          // Range pattern
          const val1 = this.parseSalaryValue(match[1]);
          const val2 = this.parseSalaryValue(match[2]);
          result.salaries.push({
            text: matchText,
            value: val1,
            currency: 'USD',
            isRange: true,
            min: Math.min(val1, val2),
            max: Math.max(val1, val2)
          });
        } else if (match[1]) {
          // Single value
          const val = this.parseSalaryValue(match[1]);
          result.salaries.push({
            text: matchText,
            value: val,
            currency: 'USD',
            isRange: false
          });
        }
      }
    }

    result.found = result.salaries.length > 0;

    // Create normalized range
    if (result.salaries.length > 0) {
      const rangeMatch = result.salaries.find(s => s.isRange);
      if (rangeMatch) {
        result.normalized = {
          min: rangeMatch.min,
          max: rangeMatch.max,
          currency: 'USD'
        };
      } else {
        const values = result.salaries.map(s => s.value).filter(v => v !== null);
        if (values.length > 0) {
          result.normalized = {
            min: Math.min(...values),
            max: Math.max(...values),
            currency: 'USD'
          };
        }
      }
    }

    return result;
  }

  /**
   * Parse salary value string to number
   */
  parseSalaryValue(str) {
    if (!str) return null;
    const cleaned = str.replace(/[,$]/g, '').trim();
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    // Check if it's in thousands (k notation or small number)
    if (num < 1000) {
      return num * 1000;
    }
    return num;
  }

  /**
   * Detect currency from text
   */
  detectCurrency(text) {
    if (/\$|USD|dollars?/i.test(text)) return 'USD';
    if (/€|EUR|euros?/i.test(text)) return 'EUR';
    if (/£|GBP|pounds?/i.test(text)) return 'GBP';
    if (/¥|JPY|yen/i.test(text)) return 'JPY';
    if (/₹|INR|rupees?/i.test(text)) return 'INR';
    if (/CAD|C\$/i.test(text)) return 'CAD';
    if (/AUD|A\$/i.test(text)) return 'AUD';
    return 'USD'; // Default
  }

  /**
   * Extract experience requirements from text (uses compromise-numbers plugin)
   * Parses patterns like "5+ years experience" or "3-5 years"
   * @param {string} text - Text to analyze
   * @returns {Object} Extracted experience requirements
   */
  async extractExperienceRequirements(text) {
    await this.init();

    const result = {
      found: false,
      requirements: [],
      minimumYears: null,
      maximumYears: null
    };

    // Experience patterns
    const experiencePatterns = [
      // "5+ years", "5+ yrs"
      { regex: /(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)?/gi, type: 'minimum' },
      // "3-5 years", "3 to 5 years"
      { regex: /(\d+)\s*[-–to]+\s*(\d+)\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)?/gi, type: 'range' },
      // "at least 5 years"
      { regex: /(?:at\s+least|minimum(?:\s+of)?)\s+(\d+)\s*(?:years?|yrs?)/gi, type: 'minimum' },
      // "up to 10 years"
      { regex: /(?:up\s+to|maximum(?:\s+of)?)\s+(\d+)\s*(?:years?|yrs?)/gi, type: 'maximum' },
      // "experience: 5 years"
      { regex: /experience[:\s]+(\d+)\s*(?:years?|yrs?)/gi, type: 'exact' }
    ];

    // Use numbers plugin if available for better extraction
    if (nlp) {
      const doc = nlp(text);
      if (typeof doc.numbers === 'function') {
        // Plugin is available - can use for validation
      }
    }

    for (const { regex, type } of experiencePatterns) {
      let match;
      regex.lastIndex = 0; // Reset regex state
      while ((match = regex.exec(text)) !== null) {
        const entry = {
          text: match[0],
          type
        };

        if (type === 'range' && match[2]) {
          entry.minYears = parseInt(match[1]);
          entry.maxYears = parseInt(match[2]);
        } else if (type === 'minimum') {
          entry.minYears = parseInt(match[1]);
        } else if (type === 'maximum') {
          entry.maxYears = parseInt(match[1]);
        } else {
          entry.years = parseInt(match[1]);
        }

        result.requirements.push(entry);
      }
    }

    result.found = result.requirements.length > 0;

    // Calculate overall min/max
    if (result.requirements.length > 0) {
      const allMins = result.requirements
        .map(r => r.minYears || r.years)
        .filter(v => v !== undefined);
      const allMaxs = result.requirements
        .map(r => r.maxYears || r.years)
        .filter(v => v !== undefined);

      if (allMins.length > 0) {
        result.minimumYears = Math.min(...allMins);
      }
      if (allMaxs.length > 0) {
        result.maximumYears = Math.max(...allMaxs);
      }
    }

    return result;
  }
}

// Export singleton instance
const compromiseExtractor = new CompromiseExtractor();

export { CompromiseExtractor, compromiseExtractor };
