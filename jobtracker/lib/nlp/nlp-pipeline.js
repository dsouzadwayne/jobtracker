/**
 * NLP Pipeline
 * Hybrid extraction pipeline that combines fast (Compromise.js) and accurate (BERT NER) extraction
 *
 * Stage 1: Compromise.js (fast, main thread)
 * Stage 2: BERT NER (accurate fallback, web worker)
 */

import { compromiseExtractor } from './compromise-extractor.js';

// Cache for settings
let nlpSettings = null;

// Default timeout for chrome.runtime.sendMessage calls (30 seconds)
const MESSAGE_TIMEOUT_MS = 30000;

/**
 * Send a message to the background script with timeout
 * Prevents hanging if background worker is unresponsive
 * @param {Object} message - Message to send
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Response from background script
 */
function sendMessageWithTimeout(message, timeoutMs = MESSAGE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Message timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    chrome.runtime.sendMessage(message)
      .then(response => {
        clearTimeout(timeout);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * Load NLP settings from storage
 */
async function loadSettings() {
  if (nlpSettings !== null) return nlpSettings;

  try {
    const response = await sendMessageWithTimeout({ type: 'GET_SETTINGS' }, 5000);
    nlpSettings = response?.nlp || {
      enabled: true,
      useCompromise: true,
      useTransformers: true,
      fallbackToTransformers: true
    };
  } catch (error) {
    console.log('[NLP Pipeline] Failed to load settings:', error.message);
    // Default settings if message fails
    nlpSettings = {
      enabled: true,
      useCompromise: true,
      useTransformers: true,
      fallbackToTransformers: true
    };
  }

  return nlpSettings;
}

/**
 * Reset cached settings (call when settings change)
 */
function resetSettings() {
  nlpSettings = null;
}

/**
 * Extract job information using hybrid NLP pipeline
 * @param {string} text - Text to analyze
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted job information
 */
async function extractJobInfo(text, options = {}) {
  const settings = await loadSettings();

  if (!settings.enabled) {
    return { success: false, error: 'NLP disabled', data: null };
  }

  const {
    useCompromise = settings.useCompromise,
    useTransformers = settings.fallbackToTransformers,
    requireFields = ['position', 'company']
  } = options;

  let result = {
    position: null,
    company: null,
    location: null,
    skills: {},
    dates: [],
    salary: null,
    experienceRequired: null,
    requirements: [],
    benefits: [],
    responsibilities: [],
    confidence: 0,
    source: null
  };

  // Stage 1: Fast extraction with Compromise.js
  if (useCompromise) {
    try {
      const compromiseResult = await compromiseExtractor.extractJobInfo(text);

      result.position = compromiseResult.position;
      result.company = compromiseResult.company;
      result.location = compromiseResult.location;
      result.skills = compromiseResult.skills;
      result.dates = compromiseResult.dates?.map(d => d.date) || [];
      result.confidence = Math.min(compromiseResult.positionConfidence || 0, compromiseResult.companyConfidence || 0);
      result.source = 'compromise';

      // Extract additional data using plugin methods (salary, experience, sentences)
      try {
        const [salaryData, experienceData, sentenceData] = await Promise.all([
          compromiseExtractor.extractSalary(text),
          compromiseExtractor.extractExperienceRequirements(text),
          compromiseExtractor.extractSentences(text)
        ]);

        result.salary = salaryData.normalized;
        result.experienceRequired = experienceData.minimumYears;
        result.requirements = sentenceData.requirements || [];
        result.benefits = sentenceData.benefits || [];
        result.responsibilities = sentenceData.responsibilities || [];
      } catch (pluginError) {
        console.log('[NLP Pipeline] Plugin extraction failed:', pluginError.message);
      }

      // Check if we have all required fields
      const missingFields = requireFields.filter(f => !result[f]);
      if (missingFields.length === 0) {
        return { success: true, data: result, source: 'compromise' };
      }

      // Some fields missing, try transformer fallback
      if (useTransformers && missingFields.length > 0) {
        console.log('[NLP Pipeline] Missing fields from Compromise:', missingFields, '- trying BERT NER');
      }
    } catch (error) {
      console.log('[NLP Pipeline] Compromise extraction failed:', error.message);
    }
  }

  // Stage 2: Accurate extraction with BERT NER (via AI worker)
  if (useTransformers) {
    try {
      const transformerResult = await extractWithTransformers(text);

      if (transformerResult) {
        // Merge results, preferring existing values from Stage 1
        result.position = result.position || transformerResult.position;
        result.company = result.company || transformerResult.company;
        result.location = result.location || transformerResult.location;

        // Merge skills
        if (transformerResult.skills) {
          for (const [category, skillList] of Object.entries(transformerResult.skills)) {
            if (!result.skills[category]) {
              result.skills[category] = skillList;
            } else {
              // Add new skills that aren't already present
              const existing = new Set(result.skills[category].map(s => s.toLowerCase()));
              const newSkills = skillList.filter(s => !existing.has(s.toLowerCase()));
              result.skills[category].push(...newSkills);
            }
          }
        }

        result.confidence = Math.max(result.confidence, transformerResult.confidence || 0);
        result.source = result.source ? `${result.source}+transformers` : 'transformers';
      }
    } catch (error) {
      console.log('[NLP Pipeline] Transformer extraction failed:', error.message);
    }
  }

  const success = result.position || result.company;
  return { success, data: result, source: result.source };
}

/**
 * Extract resume information using hybrid NLP pipeline
 * @param {string} text - Resume text
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted resume information
 */
async function extractResumeInfo(text, options = {}) {
  const settings = await loadSettings();

  if (!settings.enabled) {
    return { success: false, error: 'NLP disabled', data: null };
  }

  const {
    useCompromise = settings.useCompromise,
    useTransformers = settings.fallbackToTransformers
  } = options;

  let result = {
    name: null,
    email: null,
    phone: null,
    companies: [],
    skills: {},
    locations: [],
    dates: [],
    workDuration: null,
    dateRanges: [],
    sections: [],
    workHistory: null,
    promotions: [],
    confidence: 0,
    source: null
  };

  // Stage 1: Fast extraction with Compromise.js
  if (useCompromise) {
    try {
      const compromiseResult = await compromiseExtractor.extractResumeInfo(text);

      result.name = compromiseResult.name;
      result.companies = compromiseResult.companies || [];
      result.skills = compromiseResult.skills;
      result.locations = compromiseResult.locations || [];
      result.dates = compromiseResult.dates || [];
      result.confidence = compromiseResult.nameConfidence || 0;
      result.source = 'compromise';

      // Also extract email/phone with regex (Compromise doesn't handle these well)
      const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) result.email = emailMatch[0];

      const phoneMatch = text.match(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) result.phone = phoneMatch[0];

      // Extract additional data using plugin methods (enhanced dates, paragraphs, work history)
      try {
        const [enhancedDates, paragraphData, workHistoryData] = await Promise.all([
          compromiseExtractor.extractDatesEnhanced(text),
          compromiseExtractor.extractParagraphs(text),
          compromiseExtractor.extractWorkHistory(text)
        ]);

        result.workDuration = enhancedDates.totalDuration;
        result.dateRanges = enhancedDates.ranges || [];
        result.sections = paragraphData.sections || [];
        result.workHistory = workHistoryData.positions || [];
        result.promotions = workHistoryData.promotions || [];
      } catch (pluginError) {
        console.log('[NLP Pipeline] Plugin extraction failed:', pluginError.message);
      }

    } catch (error) {
      console.log('[NLP Pipeline] Compromise resume extraction failed:', error.message);
    }
  }

  // Stage 2: Enhanced extraction with BERT NER
  if (useTransformers && (!result.name || result.confidence < 0.7)) {
    try {
      const transformerResult = await extractResumeWithTransformers(text);

      if (transformerResult) {
        // Merge results
        result.name = result.name || transformerResult.name;
        result.email = result.email || transformerResult.email;
        result.phone = result.phone || transformerResult.phone;

        // Merge companies
        if (transformerResult.companies) {
          const existing = new Set(result.companies.map(c => c.toLowerCase()));
          const newCompanies = transformerResult.companies.filter(c => !existing.has(c.toLowerCase()));
          result.companies.push(...newCompanies);
        }

        // Merge locations
        if (transformerResult.locations) {
          const existing = new Set(result.locations.map(l => l.toLowerCase()));
          const newLocations = transformerResult.locations.filter(l => !existing.has(l.toLowerCase()));
          result.locations.push(...newLocations);
        }

        result.confidence = Math.max(result.confidence, transformerResult.confidence || 0);
        result.source = result.source ? `${result.source}+transformers` : 'transformers';
      }
    } catch (error) {
      console.log('[NLP Pipeline] Transformer resume extraction failed:', error.message);
    }
  }

  return { success: !!result.name || !!result.email, data: result, source: result.source };
}

/**
 * Normalize form label using NLP
 * @param {string} labelText - Label text to normalize
 * @returns {Object} Normalized field info
 */
async function normalizeLabel(labelText) {
  const settings = await loadSettings();

  if (!settings.enabled || !settings.useCompromise) {
    return { field: null, confidence: 0 };
  }

  try {
    return await compromiseExtractor.normalizeLabel(labelText);
  } catch (error) {
    console.log('[NLP Pipeline] Label normalization failed:', error.message);
    return { field: null, confidence: 0 };
  }
}

/**
 * Extract skills from text
 * @param {string} text - Text to analyze
 * @returns {Object} Categorized skills
 */
async function extractSkills(text) {
  const settings = await loadSettings();

  if (!settings.enabled || !settings.useCompromise) {
    return {};
  }

  try {
    return await compromiseExtractor.extractSkills(text);
  } catch (error) {
    console.log('[NLP Pipeline] Skill extraction failed:', error.message);
    return {};
  }
}

/**
 * Extract using Transformers.js (via AI worker message)
 * @param {string} text - Text to analyze
 * @returns {Object} Extracted information
 */
async function extractWithTransformers(text) {
  try {
    const response = await sendMessageWithTimeout({
      type: 'AI_EXTRACT_JOB',
      payload: { text }
    });

    if (response?.success && response?.data) {
      // Use actual confidence from response if available, otherwise estimate based on data quality
      const hasPosition = !!response.data.position;
      const hasCompany = !!response.data.company;
      const estimatedConfidence = (hasPosition && hasCompany) ? 0.85 : (hasPosition || hasCompany) ? 0.7 : 0.5;

      return {
        position: response.data.position || null,
        company: response.data.company || null,
        location: response.data.location || null,
        skills: response.data.skills || {},
        confidence: response.data.confidence || estimatedConfidence
      };
    }
  } catch (error) {
    console.log('[NLP Pipeline] Transformer job extraction failed:', error.message);
  }

  return null;
}

/**
 * Extract resume info using Transformers.js (via AI worker message)
 * @param {string} text - Resume text
 * @returns {Object} Extracted information
 */
async function extractResumeWithTransformers(text) {
  try {
    const response = await sendMessageWithTimeout({
      type: 'AI_PARSE_RESUME',
      payload: { text }
    });

    if (response?.success && response?.data) {
      // Use actual confidence from response if available, otherwise estimate based on data quality
      const hasName = !!response.data.name;
      const hasEmail = !!(response.data.emails?.[0] || response.data.email);
      const estimatedConfidence = (hasName && hasEmail) ? 0.85 : hasName ? 0.7 : 0.5;

      return {
        name: response.data.name || null,
        email: response.data.emails?.[0] || response.data.email || null,
        phone: response.data.phones?.[0] || response.data.phone || null,
        companies: response.data.companies || [],
        locations: response.data.locations || [],
        confidence: response.data.confidence || estimatedConfidence
      };
    }
  } catch (error) {
    console.log('[NLP Pipeline] Transformer resume extraction failed:', error.message);
  }

  return null;
}

/**
 * Check if NLP is available and enabled
 * @returns {boolean}
 */
async function isAvailable() {
  const settings = await loadSettings();
  return settings.enabled && settings.useCompromise;
}

// Export functions
export {
  extractJobInfo,
  extractResumeInfo,
  normalizeLabel,
  extractSkills,
  isAvailable,
  resetSettings
};

// Also export as named object for convenience
export const nlpPipeline = {
  extractJobInfo,
  extractResumeInfo,
  normalizeLabel,
  extractSkills,
  isAvailable,
  resetSettings
};
