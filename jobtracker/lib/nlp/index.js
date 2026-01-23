/**
 * NLP Module Index
 * Unified API for NLP extraction using Compromise.js and Transformers.js
 *
 * Features:
 * - Job title extraction using POS tagging
 * - Company name detection (organizations)
 * - Skill extraction from text
 * - Label text normalization for form matching
 * - Location and date extraction
 */

export { CompromiseExtractor, compromiseExtractor } from './compromise-extractor.js';
export {
  extractJobInfo,
  extractResumeInfo,
  normalizeLabel,
  extractSkills,
  isAvailable,
  resetSettings,
  nlpPipeline
} from './nlp-pipeline.js';

/**
 * Quick extraction using fastest available method
 * @param {string} text - Text to analyze
 * @param {string} type - 'job' or 'resume'
 * @returns {Object} Extracted information
 */
export async function quickExtract(text, type = 'job') {
  try {
    const { extractJobInfo, extractResumeInfo } = await import('./nlp-pipeline.js');

    if (type === 'resume') {
      return extractResumeInfo(text, { useTransformers: false });
    }

    return extractJobInfo(text, { useTransformers: false });
  } catch (error) {
    console.error('[NLP Index] Quick extraction import failed:', error.message);
    return {
      success: false,
      error: `Import failed: ${error.message}`,
      data: null
    };
  }
}

/**
 * Full extraction using all available methods
 * @param {string} text - Text to analyze
 * @param {string} type - 'job' or 'resume'
 * @returns {Object} Extracted information
 */
export async function fullExtract(text, type = 'job') {
  try {
    const { extractJobInfo, extractResumeInfo } = await import('./nlp-pipeline.js');

    if (type === 'resume') {
      return extractResumeInfo(text, { useTransformers: true });
    }

    return extractJobInfo(text, { useTransformers: true });
  } catch (error) {
    console.error('[NLP Index] Full extraction import failed:', error.message);
    return {
      success: false,
      error: `Import failed: ${error.message}`,
      data: null
    };
  }
}

// ============================================================
// Plugin-based convenience exports
// These provide direct access to the Compromise.js plugin methods
// ============================================================

/**
 * Extract salary information from text
 * @param {string} text - Text containing salary information
 * @returns {Object} Salary data with normalized values
 */
export async function extractSalary(text) {
  const { compromiseExtractor } = await import('./compromise-extractor.js');
  return compromiseExtractor.extractSalary(text);
}

/**
 * Extract experience requirements from text
 * @param {string} text - Text containing experience requirements
 * @returns {Object} Experience data with minimum years
 */
export async function extractExperienceRequirements(text) {
  const { compromiseExtractor } = await import('./compromise-extractor.js');
  return compromiseExtractor.extractExperienceRequirements(text);
}

/**
 * Extract and classify paragraphs from text
 * @param {string} text - Text to analyze
 * @returns {Object} Paragraph data with sections
 */
export async function extractParagraphs(text) {
  const { compromiseExtractor } = await import('./compromise-extractor.js');
  return compromiseExtractor.extractParagraphs(text);
}

/**
 * Extract and classify sentences from text
 * @param {string} text - Text to analyze
 * @returns {Object} Sentence data with requirements, benefits, responsibilities
 */
export async function extractSentences(text) {
  const { compromiseExtractor } = await import('./compromise-extractor.js');
  return compromiseExtractor.extractSentences(text);
}

/**
 * Extract dates with enhanced parsing (duration calculation, ranges)
 * @param {string} text - Text containing dates
 * @returns {Object} Enhanced date data with ranges and duration
 */
export async function extractDatesEnhanced(text) {
  const { compromiseExtractor } = await import('./compromise-extractor.js');
  return compromiseExtractor.extractDatesEnhanced(text);
}

/**
 * Extract structured work history with promotion detection
 * @param {string} text - Resume text
 * @returns {Object} Work history with positions and promotions
 */
export async function extractWorkHistory(text) {
  const { compromiseExtractor } = await import('./compromise-extractor.js');
  return compromiseExtractor.extractWorkHistory(text);
}
