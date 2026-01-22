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
