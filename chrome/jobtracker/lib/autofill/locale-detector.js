/**
 * JobTracker Locale Detector
 * Detects page locale and provides locale-aware pattern matching
 * Supports German, French, Spanish, Portuguese, and Hindi
 */

const JobTrackerLocaleDetector = {
  /**
   * Supported locales with their language codes
   */
  SUPPORTED_LOCALES: {
    en: { name: 'English', codes: ['en', 'en-us', 'en-gb', 'en-au', 'en-ca'] },
    de: { name: 'German', codes: ['de', 'de-de', 'de-at', 'de-ch'] },
    fr: { name: 'French', codes: ['fr', 'fr-fr', 'fr-ca', 'fr-be', 'fr-ch'] },
    es: { name: 'Spanish', codes: ['es', 'es-es', 'es-mx', 'es-ar', 'es-co'] },
    pt: { name: 'Portuguese', codes: ['pt', 'pt-br', 'pt-pt'] },
    hi: { name: 'Hindi', codes: ['hi', 'hi-in'] }
  },

  /**
   * Domain patterns that indicate a specific locale
   */
  DOMAIN_LOCALE_MAP: {
    // German domains
    '.de': 'de',
    '.at': 'de',
    '.ch': 'de',
    'xing.com': 'de',
    'stepstone.de': 'de',
    'monster.de': 'de',

    // French domains
    '.fr': 'fr',
    '.be': 'fr',
    'apec.fr': 'fr',
    'pole-emploi.fr': 'fr',

    // Spanish domains
    '.es': 'es',
    '.mx': 'es',
    '.ar': 'es',
    '.co': 'es',
    'infojobs.net': 'es',

    // Portuguese domains
    '.br': 'pt',
    '.pt': 'pt',
    'vagas.com.br': 'pt',

    // Indian domains (Hindi)
    'naukri.com': 'hi',
    '.in': 'hi'
  },

  /**
   * Content indicators for locale detection
   * Words that strongly suggest a specific language
   */
  CONTENT_INDICATORS: {
    de: [/stellenanzeige/i, /bewerbung/i, /lebenslauf/i, /arbeitgeber/i, /gehalt/i],
    fr: [/offre\s*d'emploi/i, /candidature/i, /cv/i, /employeur/i, /salaire/i],
    es: [/oferta\s*de\s*empleo/i, /solicitud/i, /curr[ií]culum/i, /empresa/i, /salario/i],
    pt: [/vaga/i, /candidatura/i, /curr[ií]culo/i, /empresa/i, /sal[áa]rio/i],
    hi: [/\u0928\u094c\u0915\u0930\u0940/i]  // नौकरी (job)
  },

  /**
   * Cached locale for current page
   */
  _cachedLocale: null,
  _cacheUrl: null,

  /**
   * Detect the locale of the current page
   * Uses multiple signals: html lang, meta tags, domain, content
   * @returns {string} Detected locale code (e.g., 'en', 'de', 'fr')
   */
  detectPageLocale() {
    // Check cache
    if (this._cachedLocale && this._cacheUrl === window.location.href) {
      return this._cachedLocale;
    }

    let locale = 'en'; // Default
    let confidence = 0;

    // Signal 1: HTML lang attribute (highest priority)
    const htmlLang = document.documentElement.lang?.toLowerCase();
    if (htmlLang) {
      const detectedFromLang = this._normalizeLocale(htmlLang);
      if (detectedFromLang) {
        locale = detectedFromLang;
        confidence = 1.0;
      }
    }

    // Signal 2: Meta language tags
    if (confidence < 1.0) {
      const metaLang = this._getMetaLanguage();
      if (metaLang) {
        const detectedFromMeta = this._normalizeLocale(metaLang);
        if (detectedFromMeta && confidence < 0.9) {
          locale = detectedFromMeta;
          confidence = 0.9;
        }
      }
    }

    // Signal 3: Domain-based detection
    if (confidence < 0.8) {
      const domainLocale = this._detectFromDomain();
      if (domainLocale && confidence < 0.7) {
        locale = domainLocale;
        confidence = 0.7;
      }
    }

    // Signal 4: Content-based detection (lowest priority, for verification)
    if (confidence < 0.7) {
      const contentLocale = this._detectFromContent();
      if (contentLocale) {
        locale = contentLocale;
        confidence = 0.5;
      }
    }

    // Signal 5: Navigator language (fallback)
    if (confidence < 0.3) {
      const navLocale = this._normalizeLocale(navigator.language);
      if (navLocale) {
        locale = navLocale;
      }
    }

    // Cache the result
    this._cachedLocale = locale;
    this._cacheUrl = window.location.href;

    return locale;
  },

  /**
   * Normalize a locale string to our supported locale codes
   * @param {string} langCode - Language code (e.g., 'de-DE', 'fr-ca')
   * @returns {string|null} Normalized locale or null
   */
  _normalizeLocale(langCode) {
    if (!langCode) return null;

    const normalized = langCode.toLowerCase().trim();

    // Check exact match first
    for (const [locale, config] of Object.entries(this.SUPPORTED_LOCALES)) {
      if (config.codes.includes(normalized)) {
        return locale;
      }
    }

    // Check prefix match (e.g., 'de-AT' → 'de')
    const prefix = normalized.split('-')[0];
    if (this.SUPPORTED_LOCALES[prefix]) {
      return prefix;
    }

    return null;
  },

  /**
   * Get language from meta tags
   * @returns {string|null}
   */
  _getMetaLanguage() {
    // Check content-language meta
    const contentLang = document.querySelector('meta[http-equiv="content-language"]');
    if (contentLang) {
      return contentLang.getAttribute('content');
    }

    // Check og:locale
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) {
      return ogLocale.getAttribute('content');
    }

    return null;
  },

  /**
   * Detect locale from domain
   * @returns {string|null}
   */
  _detectFromDomain() {
    const hostname = window.location.hostname.toLowerCase();

    // Check specific domain patterns first
    for (const [pattern, locale] of Object.entries(this.DOMAIN_LOCALE_MAP)) {
      if (hostname.includes(pattern)) {
        return locale;
      }
    }

    // Check TLD
    const tld = '.' + hostname.split('.').pop();
    if (this.DOMAIN_LOCALE_MAP[tld]) {
      return this.DOMAIN_LOCALE_MAP[tld];
    }

    return null;
  },

  /**
   * Detect locale from page content
   * @returns {string|null}
   */
  _detectFromContent() {
    // Get sample of page text
    const bodyText = (document.body?.textContent || '').slice(0, 5000);

    let bestLocale = null;
    let bestMatches = 0;

    for (const [locale, indicators] of Object.entries(this.CONTENT_INDICATORS)) {
      let matches = 0;
      for (const pattern of indicators) {
        if (pattern.test(bodyText)) {
          matches++;
        }
      }
      if (matches > bestMatches) {
        bestMatches = matches;
        bestLocale = locale;
      }
    }

    // Require at least 2 matches for content-based detection
    return bestMatches >= 2 ? bestLocale : null;
  },

  /**
   * Get patterns for a field type with locale-specific patterns included
   * @param {string} fieldType - Field type name
   * @param {string|null} locale - Optional locale override (auto-detects if null)
   * @returns {RegExp[]} Array of patterns
   */
  getPatternsForLocale(fieldType, locale = null) {
    const registry = window.JobTrackerFieldRegistry;
    if (!registry) {
      console.log('[LocaleDetector] FieldRegistry not available');
      return [];
    }

    // Auto-detect locale if not provided
    const effectiveLocale = locale || this.detectPageLocale();

    return registry.getPatterns(fieldType, effectiveLocale);
  },

  /**
   * Get all patterns for a field including all locales
   * Useful for generic matching
   * @param {string} fieldType - Field type name
   * @returns {RegExp[]} Array of all patterns
   */
  getAllPatternsForField(fieldType) {
    const registry = window.JobTrackerFieldRegistry;
    if (!registry) {
      return [];
    }

    return registry.getAllPatterns(fieldType);
  },

  /**
   * Check if a text matches field patterns for the current locale
   * @param {string} text - Text to match
   * @param {string} fieldType - Field type name
   * @param {string|null} locale - Optional locale override
   * @returns {boolean}
   */
  matchesField(text, fieldType, locale = null) {
    const patterns = this.getPatternsForLocale(fieldType, locale);
    return patterns.some(p => p.test(text));
  },

  /**
   * Identify field type from text for current locale
   * @param {string} text - Text to identify
   * @param {string|null} locale - Optional locale override
   * @returns {{fieldType: string, confidence: number}|null}
   */
  identifyFieldType(text, locale = null) {
    const registry = window.JobTrackerFieldRegistry;
    if (!registry) return null;

    const effectiveLocale = locale || this.detectPageLocale();
    const fieldTypes = registry.getFieldTypes();

    for (const fieldType of fieldTypes) {
      const patterns = registry.getPatterns(fieldType, effectiveLocale);
      const field = registry.getFieldConfig(fieldType);

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          // Higher confidence for exact patterns
          const isExact = field.patterns.exact?.some(p => p.test(text));
          return {
            fieldType,
            confidence: isExact ? 0.9 : 0.7,
            locale: effectiveLocale
          };
        }
      }
    }

    return null;
  },

  /**
   * Get locale-specific common phrases for form labels
   * @param {string} locale - Locale code
   * @returns {Object} Map of field types to common phrases
   */
  getCommonPhrases(locale) {
    const phrases = {
      en: {
        firstName: 'First Name',
        lastName: 'Last Name',
        email: 'Email Address',
        phone: 'Phone Number'
      },
      de: {
        firstName: 'Vorname',
        lastName: 'Nachname',
        email: 'E-Mail-Adresse',
        phone: 'Telefonnummer'
      },
      fr: {
        firstName: 'Pr\u00e9nom',
        lastName: 'Nom de famille',
        email: 'Adresse e-mail',
        phone: 'Num\u00e9ro de t\u00e9l\u00e9phone'
      },
      es: {
        firstName: 'Nombre',
        lastName: 'Apellido',
        email: 'Correo electr\u00f3nico',
        phone: 'N\u00famero de tel\u00e9fono'
      },
      pt: {
        firstName: 'Nome',
        lastName: 'Sobrenome',
        email: 'Endere\u00e7o de e-mail',
        phone: 'N\u00famero de telefone'
      },
      hi: {
        firstName: '\u092a\u0939\u0932\u093e \u0928\u093e\u092e',
        lastName: '\u0909\u092a\u0928\u093e\u092e',
        email: '\u0908\u092e\u0947\u0932',
        phone: '\u092b\u093c\u094b\u0928 \u0928\u0902\u092c\u0930'
      }
    };

    return phrases[locale] || phrases.en;
  },

  /**
   * Clear locale cache (useful for SPA navigation)
   */
  clearCache() {
    this._cachedLocale = null;
    this._cacheUrl = null;
  },

  /**
   * Get current cached locale (for debugging)
   * @returns {{locale: string|null, url: string|null}}
   */
  getCacheStatus() {
    return {
      locale: this._cachedLocale,
      url: this._cacheUrl
    };
  }
};

// Register with namespace if available
if (typeof window !== 'undefined') {
  window.JobTrackerLocaleDetector = JobTrackerLocaleDetector;

  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('locale-detector');
  }
}
