/**
 * Compromise.js NLP Extractor
 * Lightweight NLP for job titles, companies, skills, and label normalization
 * Uses Compromise.js (~200KB) for fast main-thread extraction
 */

// Compromise.js will be loaded dynamically
let nlp = null;
let loadingPromise = null;

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
 * Compromise Extractor class
 * Provides lightweight NLP extraction using Compromise.js
 */
class CompromiseExtractor {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the extractor by loading Compromise.js
   */
  async init() {
    if (this.initialized) return;
    await loadCompromise();
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

    const dates = [];

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
}

// Export singleton instance
const compromiseExtractor = new CompromiseExtractor();

export { CompromiseExtractor, compromiseExtractor };
