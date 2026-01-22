/**
 * Result Merger Module
 * Merges extraction results from multiple strategies by confidence
 */

import {
  calculateFieldConfidence,
  calculateCrossValidationBoost,
  selectBestCandidate,
  calculateOverallConfidence
} from './confidence.js';

import {
  filterValidCandidates,
  cleanText
} from './validators.js';

/**
 * Merge results from multiple extraction strategies
 * @param {Array} strategyResults - Array of extraction results from strategies
 * @returns {Object} Merged extraction result
 */
function mergeResults(strategyResults) {
  const merged = {
    position: [],
    company: [],
    location: [],
    salary: [],
    jobDescription: [],
    _meta: {
      strategiesUsed: [],
      mergedAt: new Date().toISOString()
    }
  };

  // Collect all candidates from all strategies
  for (const result of strategyResults) {
    if (!result) continue;

    // Track which strategies contributed
    if (result.metadata?.source) {
      merged._meta.strategiesUsed.push(result.metadata.source);
    }

    // Merge each field
    for (const field of ['position', 'company', 'location', 'salary', 'jobDescription']) {
      if (result[field] && Array.isArray(result[field])) {
        merged[field].push(...result[field]);
      }
    }
  }

  return merged;
}

/**
 * Select the best candidate for each field
 * @param {Object} mergedResults - Merged results with all candidates
 * @returns {Object} Final extraction with best candidates per field
 */
function selectBestCandidates(mergedResults) {
  const fields = ['position', 'company', 'location', 'salary', 'jobDescription'];
  const final = {
    _extractionMeta: {
      strategiesUsed: mergedResults._meta?.strategiesUsed || [],
      conflicts: {}
    }
  };

  for (const field of fields) {
    const candidates = mergedResults[field] || [];

    // Validate and filter candidates
    const validCandidates = filterValidCandidates(candidates, field);

    if (validCandidates.length === 0) {
      final[field] = { value: '', confidence: 0, source: null };
      continue;
    }

    // Calculate confidence scores
    const scoredCandidates = validCandidates.map(c => ({
      ...c,
      confidence: c.confidence || calculateFieldConfidence(c, field)
    }));

    // Select best candidate
    const best = selectBestCandidate(scoredCandidates, field);

    if (best) {
      final[field] = {
        value: best.value,
        confidence: best.confidence,
        source: best.source,
        selector: best.selector
      };

      // Track conflicts (multiple different values)
      if (best.alternates && best.alternates.length > 0) {
        const uniqueAlternates = best.alternates
          .filter(a => normalize(a.value) !== normalize(best.value))
          .map(a => a.value);

        if (uniqueAlternates.length > 0) {
          final._extractionMeta.conflicts[field] = [best.value, ...uniqueAlternates];
        }
      }
    } else {
      final[field] = { value: '', confidence: 0, source: null };
    }
  }

  // Calculate overall confidence
  final.overallConfidence = calculateOverallConfidence(final);

  return final;
}

/**
 * Merge DOM extraction results with ML extraction results
 * @param {Object} domResults - Results from DOM strategies
 * @param {Object} mlResults - Results from ML extraction
 * @returns {Object} Combined results
 */
function mergeDOMAndML(domResults, mlResults) {
  const merged = mergeResults([domResults]);

  // Add ML results with source indication
  if (mlResults) {
    const mlFields = {
      position: mlResults.position || mlResults.title,
      company: mlResults.company || mlResults.organization,
      location: mlResults.location,
      salary: mlResults.salary,
      jobDescription: mlResults.description
    };

    for (const [field, value] of Object.entries(mlFields)) {
      if (value && typeof value === 'string' && value.trim()) {
        merged[field].push({
          value: cleanText(value),
          source: 'ml-ner',
          confidence: 0.70,  // Base ML confidence
          selector: 'ml-extraction'
        });
      }
    }

    merged._meta.strategiesUsed.push('ml-ner');
  }

  return merged;
}

/**
 * Merge with LLM fallback results
 * @param {Object} currentBest - Current best extraction
 * @param {Object} llmResults - Results from LLM extraction
 * @returns {Object} Final results with LLM data merged in
 */
function mergeWithLLM(currentBest, llmResults) {
  if (!llmResults) return currentBest;

  const merged = { ...currentBest };

  const llmFields = {
    position: llmResults.position || llmResults.title,
    company: llmResults.company,
    location: llmResults.location,
    salary: llmResults.salary
  };

  // LLM results only fill in missing or low-confidence fields
  for (const [field, value] of Object.entries(llmFields)) {
    if (!value) continue;

    const current = merged[field];

    // Fill if missing or very low confidence
    if (!current?.value || current.confidence < 0.3) {
      merged[field] = {
        value: cleanText(String(value)),
        confidence: 0.90,  // LLM has high confidence
        source: 'llm'
      };
    }
    // Boost if LLM agrees with current
    else if (normalize(current.value) === normalize(String(value))) {
      merged[field].confidence = Math.min(1.0, current.confidence * 1.15);
    }
  }

  // Recalculate overall confidence
  merged.overallConfidence = calculateOverallConfidence(merged);

  // Mark that LLM was used
  if (!merged._extractionMeta) {
    merged._extractionMeta = { strategiesUsed: [] };
  }
  merged._extractionMeta.llmUsed = true;

  return merged;
}

/**
 * Create a flat extraction result object (for backwards compatibility)
 * @param {Object} bestResults - Best candidate results
 * @returns {Object} Flat object with just values
 */
function flattenResults(bestResults) {
  return {
    position: bestResults.position?.value || '',
    company: bestResults.company?.value || '',
    location: bestResults.location?.value || '',
    salary: bestResults.salary?.value || '',
    jobDescription: bestResults.jobDescription?.value || '',
    overallConfidence: bestResults.overallConfidence,
    _extractionMeta: bestResults._extractionMeta
  };
}

/**
 * Convert structured results to the format expected by the rest of the app
 * @param {Object} results - Extraction results
 * @param {string} url - Job URL
 * @param {string} platform - Detected platform
 * @returns {Object} Application-compatible job info
 */
function toJobInfo(results, url, platform = 'other') {
  return {
    company: results.company?.value || results.company || '',
    position: results.position?.value || results.position || '',
    location: results.location?.value || results.location || '',
    salary: results.salary?.value || results.salary || '',
    jobDescription: results.jobDescription?.value || results.jobDescription || '',
    jobUrl: url,
    platform: platform,
    _extractionMeta: results._extractionMeta,
    _confidence: results.overallConfidence
  };
}

/**
 * Normalize a string for comparison
 */
function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Deduplicate candidates by normalized value
 * @param {Array} candidates - Array of candidates
 * @returns {Array} Deduplicated candidates (keeping highest confidence)
 */
function deduplicateCandidates(candidates) {
  const seen = new Map();

  for (const candidate of candidates) {
    const key = normalize(candidate.value);
    if (!seen.has(key) || seen.get(key).confidence < candidate.confidence) {
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}

export {
  mergeResults,
  selectBestCandidates,
  mergeDOMAndML,
  mergeWithLLM,
  flattenResults,
  toJobInfo,
  deduplicateCandidates,
  normalize
};
