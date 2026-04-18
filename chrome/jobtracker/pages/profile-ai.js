/**
 * Profile AI Service Module
 * Initializes AI service for resume enhancement
 */

import { aiService } from '../lib/ai-service.js';

// Expose aiService globally for profile.js
window.aiService = aiService;

// Initialize AI service when page loads
window.initAIService = async function() {
  try {
    await aiService.init();
    console.log('[Profile] AI Service initialized');
    return true;
  } catch (error) {
    console.log('[Profile] AI Service init failed:', error);
    return false;
  }
};

console.log('[Profile] AI module loaded');
