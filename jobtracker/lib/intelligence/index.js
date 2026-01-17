/**
 * JobTracker Intelligence Module
 * Main entry point - exports all intelligence functionality
 */

import { generateInsights } from './insights.js';
import { getRecommendations } from './recommendations.js';
import { calculateGoalProgress, getDefaultGoals } from './goals.js';
import { filterByDateRange, formatPlatformName } from './utils.js';

/**
 * Intelligence API object
 * Provides a unified interface for all intelligence features
 */
const JobTrackerIntelligence = {
  generateInsights,
  getRecommendations,
  calculateGoalProgress,
  getDefaultGoals,
  filterByDateRange,
  formatPlatformName
};

export { JobTrackerIntelligence };

// Also export individual functions for direct imports
export {
  generateInsights,
  getRecommendations,
  calculateGoalProgress,
  getDefaultGoals,
  filterByDateRange,
  formatPlatformName
};
