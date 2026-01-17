/**
 * Dashboard AI Features Module
 * Provides UI for AI-powered features:
 * - Smart tag suggestions
 * - Resume parsing
 * - Job posting extraction
 * - Skill matching
 *
 * NOTE: AI features are disabled by default.
 * Users must enable them in settings.
 */

import { aiService } from '../../lib/ai-service.js';
import { elements, MessageTypes, getApplications, getCachedSettings } from './state.js';
import { escapeHtml, showNotification } from './utils.js';

// Track AI status
let aiInitialized = false;
let aiAvailable = false;
let aiEnabled = false;  // Controlled by settings

/**
 * Check if AI is enabled in settings
 */
export function isAIEnabled() {
  const settings = getCachedSettings();
  return settings?.ai?.enabled === true;
}

/**
 * Initialize AI features (only if enabled in settings)
 */
export async function initAI() {
  // Check settings first
  aiEnabled = isAIEnabled();

  if (!aiEnabled) {
    console.log('[AI Features] Disabled in settings. Skipping initialization.');
    return false;
  }

  try {
    await aiService.init();
    aiAvailable = aiService.isMLAvailable();
    aiInitialized = true;

    // Set up progress callback
    aiService.setProgressCallback((progress) => {
      console.log(`[AI] Loading ${progress.model}: ${progress.progress}%`);
      updateLoadingIndicator(progress);
    });

    console.log(`[AI Features] Initialized. ML available: ${aiAvailable}`);
    return true;
  } catch (error) {
    console.error('[AI Features] Failed to initialize:', error);
    return false;
  }
}

/**
 * Enable AI features (call after user enables in settings)
 */
export async function enableAI() {
  aiEnabled = true;
  if (!aiInitialized) {
    return await initAI();
  }
  return true;
}

/**
 * Disable AI features
 */
export function disableAI() {
  aiEnabled = false;
  console.log('[AI Features] Disabled');
}

/**
 * Update loading indicator during model download
 */
function updateLoadingIndicator(progress) {
  let indicator = document.getElementById('ai-loading-indicator');

  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'ai-loading-indicator';
    indicator.className = 'ai-loading-indicator';
    document.body.appendChild(indicator);
  }

  indicator.innerHTML = `
    <div class="ai-loading-content">
      <div class="ai-loading-spinner"></div>
      <span>Loading AI model: ${progress.progress}%</span>
    </div>
  `;
  indicator.classList.remove('hidden');

  if (progress.progress >= 100) {
    setTimeout(() => indicator.classList.add('hidden'), 1000);
  }
}

/**
 * Get smart tag suggestions for text
 * @param {string} text - Job description or notes
 * @returns {string[]} Suggested tags
 */
export async function getSmartTags(text) {
  if (!aiEnabled) return [];  // AI disabled

  const settings = getCachedSettings();
  if (!settings?.ai?.autoSuggestTags) return [];  // Tag suggestions disabled

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return [];  // Failed to initialize

  try {
    // Always try ML first, falls back to regex in worker
    const tags = await aiService.suggestTags(text);
    return tags || [];
  } catch (error) {
    console.warn('[AI Features] Tag suggestion failed:', error);
    return [];
  }
}

/**
 * Parse resume text and extract structured data
 * @param {string} text - Resume content
 * @returns {Object} Extracted data
 */
export async function parseResumeText(text) {
  if (!aiEnabled) return null;  // AI disabled

  const settings = getCachedSettings();
  if (!settings?.ai?.enhanceResumeParsing) return null;

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return null;

  try {
    const result = await aiService.parseResume(text, aiAvailable);
    return result;
  } catch (error) {
    console.warn('[AI Features] Resume parsing failed:', error);
    // Return basic regex extraction as fallback
    return await aiService.extractBasic(text);
  }
}

/**
 * Parse job posting and extract structured data
 * @param {string} text - Job posting content
 * @returns {Object} Extracted data
 */
export async function parseJobText(text) {
  if (!aiEnabled) return null;  // AI disabled

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return null;

  try {
    const result = await aiService.parseJobPosting(text, aiAvailable);
    return result;
  } catch (error) {
    console.warn('[AI Features] Job parsing failed:', error);
    return await aiService.extractBasic(text);
  }
}

/**
 * Match resume against job posting
 * @param {string} resumeText - Resume content
 * @param {string} jobText - Job posting content
 * @returns {Object} Match analysis
 */
export async function matchResumeToJob(resumeText, jobText) {
  if (!aiEnabled) return null;  // AI disabled

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return null;

  try {
    return await aiService.matchResumeToJob(resumeText, jobText);
  } catch (error) {
    console.warn('[AI Features] Matching failed:', error);
    return null;
  }
}

/**
 * Extract skills from text
 * @param {string} text - Text to analyze
 * @returns {Object} Skills by category
 */
export async function extractSkills(text) {
  if (!aiEnabled) return {};  // AI disabled

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return {};

  try {
    return await aiService.extractSkills(text);
  } catch (error) {
    console.warn('[AI Features] Skill extraction failed:', error);
    return {};
  }
}

/**
 * Render AI tag suggestions UI
 * @param {HTMLElement} container - Container element
 * @param {string} text - Text to analyze
 * @param {function} onSelect - Callback when tag is selected
 */
export async function renderTagSuggestions(container, text, onSelect) {
  // Check if AI is enabled
  if (!aiEnabled) {
    container.innerHTML = '';  // Hide container if AI disabled
    return;
  }

  if (!text || text.length < 50) {
    container.innerHTML = '<span class="text-muted">Add more text for suggestions</span>';
    return;
  }

  container.innerHTML = '<span class="text-muted">Analyzing...</span>';

  try {
    const tags = await getSmartTags(text);

    if (tags.length === 0) {
      container.innerHTML = '<span class="text-muted">No suggestions</span>';
      return;
    }

    container.innerHTML = tags.map(tag => `
      <button type="button" class="suggested-tag" data-tag="${escapeHtml(tag)}">
        + ${escapeHtml(tag)}
      </button>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.suggested-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        onSelect(tag);
        btn.remove();
      });
    });
  } catch (error) {
    container.innerHTML = '<span class="text-muted">Suggestions unavailable</span>';
  }
}

/**
 * Render skill match visualization
 * @param {HTMLElement} container - Container element
 * @param {Object} matchResult - Result from matchResumeToJob
 */
export function renderSkillMatch(container, matchResult) {
  if (!matchResult) {
    container.innerHTML = '<p class="text-muted">Unable to analyze match</p>';
    return;
  }

  const { matchPercentage, matchingSkills, missingSkills, overallSimilarity } = matchResult;

  // Color based on match percentage
  let matchColor = 'var(--color-danger)';
  if (matchPercentage >= 70) matchColor = 'var(--color-success)';
  else if (matchPercentage >= 40) matchColor = 'var(--color-warning)';

  container.innerHTML = `
    <div class="skill-match-result">
      <div class="match-score" style="--match-color: ${matchColor}">
        <div class="match-percentage">${matchPercentage}%</div>
        <div class="match-label">Skill Match</div>
      </div>

      <div class="match-details">
        <div class="match-section">
          <h5>✓ Matching Skills (${matchingSkills.length})</h5>
          <div class="skill-chips matching">
            ${matchingSkills.length > 0
              ? matchingSkills.map(s => `<span class="skill-chip match">${escapeHtml(s)}</span>`).join('')
              : '<span class="text-muted">None found</span>'
            }
          </div>
        </div>

        <div class="match-section">
          <h5>✗ Missing Skills (${missingSkills.length})</h5>
          <div class="skill-chips missing">
            ${missingSkills.length > 0
              ? missingSkills.slice(0, 10).map(s => `<span class="skill-chip missing">${escapeHtml(s)}</span>`).join('')
              : '<span class="text-muted">None - great match!</span>'
            }
            ${missingSkills.length > 10 ? `<span class="text-muted">+${missingSkills.length - 10} more</span>` : ''}
          </div>
        </div>

        ${overallSimilarity !== undefined ? `
          <div class="similarity-bar">
            <label>Content Similarity</label>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${Math.round(overallSimilarity * 100)}%"></div>
            </div>
            <span>${Math.round(overallSimilarity * 100)}%</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Auto-fill application form from job posting
 * @param {string} jobText - Job posting text
 * @returns {Object} Extracted application data
 */
export async function autofillFromJobPosting(jobText) {
  const parsed = await parseJobText(jobText);

  return {
    company: parsed.entities?.organizations?.[0] || parsed.company || '',
    position: '', // Hard to extract reliably
    location: parsed.entities?.locations?.join(', ') || parsed.location || '',
    salary: parsed.salary || '',
    jobType: parsed.jobType || '',
    tags: parsed.suggestedTags || [],
    skills: parsed.skills || {}
  };
}

/**
 * Get AI status info for display
 */
export function getAIStatus() {
  return {
    enabled: aiEnabled,
    initialized: aiInitialized,
    mlAvailable: aiAvailable,
    mode: !aiEnabled ? 'Disabled' : (aiAvailable ? 'ML + Regex' : 'Regex Only')
  };
}

/**
 * Preload AI models for faster subsequent use
 */
export async function preloadModels() {
  if (!aiInitialized) await initAI();

  if (!aiAvailable) {
    console.log('[AI Features] ML not available, skipping preload');
    return false;
  }

  try {
    showNotification('Loading AI models...', 'info');
    await aiService.preloadModels(false); // Don't preload NER by default (saves memory)
    showNotification('AI models ready!', 'success');
    return true;
  } catch (error) {
    console.error('[AI Features] Preload failed:', error);
    showNotification('AI models failed to load', 'error');
    return false;
  }
}

/**
 * Clean up AI resources
 */
export async function cleanup() {
  if (aiInitialized) {
    await aiService.unloadModels();
    aiService.terminate();
    aiInitialized = false;
  }
}
