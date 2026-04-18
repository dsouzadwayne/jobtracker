/**
 * JobTracker Recommendations Module
 * Generates actionable recommendations based on user behavior
 */

import { formatPlatformName } from './utils.js';

/**
 * Get recommendations based on user behavior
 * @param {Array} applications - All applications
 * @param {Object} goals - Goal settings
 * @param {Object} goalProgress - Current goal progress
 * @returns {Array} Array of recommendation objects
 */
export function getRecommendations(applications, goals, goalProgress) {
  const recommendations = [];

  // Inactivity recommendation
  const inactivityRec = recommendBasedOnInactivity(applications);
  if (inactivityRec) recommendations.push(inactivityRec);

  // Follow-up recommendations
  const followUpRec = recommendFollowUps(applications);
  if (followUpRec) recommendations.push(followUpRec);

  // Platform focus recommendation
  const platformRec = recommendPlatformFocus(applications);
  if (platformRec) recommendations.push(platformRec);

  // Goal-based recommendations
  const goalRec = recommendGoalProgress(goals, goalProgress);
  if (goalRec) recommendations.push(goalRec);

  return recommendations;
}

/**
 * Recommend applying if inactive
 */
function recommendBasedOnInactivity(apps) {
  if (apps.length === 0) {
    return {
      type: 'activity',
      icon: 'plus-circle',
      title: 'Start Your Job Search',
      message: 'Add your first application to begin tracking your progress',
      action: { type: 'add_application', label: 'Add Application' }
    };
  }

  let mostRecent = null;
  apps.forEach(app => {
    const appDate = new Date(app.dateApplied || app.meta?.createdAt);
    if (!isNaN(appDate.getTime()) && (!mostRecent || appDate > mostRecent)) {
      mostRecent = appDate;
    }
  });

  if (mostRecent) {
    const daysSince = Math.floor((new Date() - mostRecent) / (1000 * 60 * 60 * 24));
    if (daysSince >= 3) {
      return {
        type: 'activity',
        icon: 'plus-circle',
        title: 'Keep the Momentum',
        message: `It's been ${daysSince} days since your last application. Regular activity improves your chances.`,
        action: { type: 'add_application', label: 'Add Application' }
      };
    }
  }

  return null;
}

/**
 * Recommend following up on stale applications
 */
function recommendFollowUps(apps) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const staleScreening = apps.filter(app => {
    if (app.status !== 'screening') return false;
    const lastUpdate = app.statusHistory?.length > 0
      ? new Date(app.statusHistory[app.statusHistory.length - 1].date)
      : new Date(app.dateApplied || app.meta?.createdAt);
    return lastUpdate < sevenDaysAgo;
  });

  if (staleScreening.length > 0) {
    return {
      type: 'followup',
      icon: 'mail',
      title: 'Follow Up on Applications',
      message: `${staleScreening.length} application${staleScreening.length !== 1 ? 's are' : ' is'} in screening for over a week. Consider sending a follow-up email.`,
      action: { type: 'filter_screening', label: 'View Applications' },
      data: { count: staleScreening.length }
    };
  }

  return null;
}

/**
 * Recommend focusing on high-performing platforms
 */
function recommendPlatformFocus(apps) {
  if (apps.length < 5) return null;

  const platformStats = {};
  apps.forEach(app => {
    const platform = app.platform || 'other';
    if (!platformStats[platform]) {
      platformStats[platform] = { total: 0, interviews: 0 };
    }
    platformStats[platform].total++;

    if (app.statusHistory?.some(h => h.status === 'interview') ||
        app.status === 'interview' || app.status === 'offer') {
      platformStats[platform].interviews++;
    }
  });

  let bestPlatform = null;
  let bestRate = 0;

  Object.entries(platformStats).forEach(([platform, stats]) => {
    if (stats.total >= 3) {
      const rate = (stats.interviews / stats.total) * 100;
      if (rate > bestRate && rate >= 20) {
        bestRate = rate;
        bestPlatform = platform;
      }
    }
  });

  if (bestPlatform) {
    return {
      type: 'platform',
      icon: 'target',
      title: 'Focus on What Works',
      message: `${formatPlatformName(bestPlatform)} has a ${Math.round(bestRate)}% interview rate. Consider focusing more applications there.`,
      data: { platform: bestPlatform, rate: Math.round(bestRate) }
    };
  }

  return null;
}

/**
 * Goal-based motivational recommendations
 */
function recommendGoalProgress(goals, progress) {
  if (!goals || !progress) return null;

  // Weekly goal encouragement
  if (goals.weekly?.enabled && goals.weekly?.target > 0) {
    const remaining = goals.weekly.target - progress.weekly.current;

    if (progress.weekly.completed) {
      return {
        type: 'goal',
        icon: 'check-circle',
        title: 'Weekly Goal Achieved!',
        message: `Great job! You've met your weekly goal of ${goals.weekly.target} applications.`,
        data: { goalType: 'weekly', completed: true }
      };
    } else if (remaining <= 2 && remaining > 0) {
      return {
        type: 'goal',
        icon: 'target',
        title: 'Almost There!',
        message: `Just ${remaining} more application${remaining !== 1 ? 's' : ''} to reach your weekly goal!`,
        action: { type: 'add_application', label: 'Add Application' },
        data: { goalType: 'weekly', remaining }
      };
    }
  }

  // Monthly goal progress
  if (goals.monthly?.enabled && goals.monthly?.target > 0) {
    if (progress.monthly.completed) {
      return {
        type: 'goal',
        icon: 'award',
        title: 'Monthly Goal Crushed!',
        message: `Amazing! You've exceeded your monthly goal with ${progress.monthly.current} applications.`,
        data: { goalType: 'monthly', completed: true }
      };
    }
  }

  return null;
}
