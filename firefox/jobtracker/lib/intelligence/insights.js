/**
 * JobTracker Insights Module
 * Analyzes application data to generate actionable insights
 */

import { filterByDateRange, formatPlatformName } from './utils.js';

/**
 * Generate insights from application data
 * @param {Array} applications - All applications
 * @param {Object} options - Optional filtering options
 * @returns {Array} Array of insight objects
 */
export function generateInsights(applications, options = {}) {
  const filteredApps = options.dateRange
    ? filterByDateRange(applications, options.dateRange)
    : applications;

  const insights = [];

  // Need at least 3 applications to generate meaningful insights
  if (filteredApps.length < 3) {
    return insights;
  }

  // Analyze platform performance
  const platformInsight = analyzePlatformPerformance(filteredApps);
  if (platformInsight) insights.push(platformInsight);

  // Analyze activity patterns
  const activityInsight = analyzeActivityPatterns(filteredApps);
  if (activityInsight) insights.push(activityInsight);

  // Analyze progress trends
  const trendInsight = analyzeProgressTrends(filteredApps, applications);
  if (trendInsight) insights.push(trendInsight);

  // Analyze follow-up needed
  const followUpInsight = analyzeFollowUpNeeded(filteredApps);
  if (followUpInsight) insights.push(followUpInsight);

  // Analyze inactivity periods
  const inactivityInsight = analyzeInactivityPeriods(applications);
  if (inactivityInsight) insights.push(inactivityInsight);

  return insights;
}

/**
 * Analyze platform performance for interview rates
 */
function analyzePlatformPerformance(apps) {
  const platformStats = {};

  apps.forEach(app => {
    const platform = app.platform || 'other';
    if (!platformStats[platform]) {
      platformStats[platform] = { total: 0, interviews: 0 };
    }
    platformStats[platform].total++;

    // Check if app reached interview stage
    if (app.statusHistory?.some(h => h.status === 'interview') || app.status === 'interview' || app.status === 'offer') {
      platformStats[platform].interviews++;
    }
  });

  // Find best performing platform (minimum 2 applications)
  let bestPlatform = null;
  let bestRate = 0;

  Object.entries(platformStats).forEach(([platform, stats]) => {
    if (stats.total >= 2) {
      const rate = (stats.interviews / stats.total) * 100;
      if (rate > bestRate) {
        bestRate = rate;
        bestPlatform = platform;
      }
    }
  });

  if (bestPlatform && bestRate > 0) {
    return {
      type: 'success',
      icon: 'trending-up',
      message: `${formatPlatformName(bestPlatform)} has your best interview rate at ${Math.round(bestRate)}%`,
      data: { platform: bestPlatform, rate: Math.round(bestRate) }
    };
  }

  return null;
}

/**
 * Analyze activity patterns (most active day)
 */
function analyzeActivityPatterns(apps) {
  const dayCount = [0, 0, 0, 0, 0, 0, 0]; // Sunday to Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  apps.forEach(app => {
    const appDate = new Date(app.dateApplied || app.meta?.createdAt);
    if (!isNaN(appDate.getTime())) {
      dayCount[appDate.getDay()]++;
    }
  });

  const maxCount = Math.max(...dayCount);
  if (maxCount < 2) return null;

  const mostActiveDay = dayCount.indexOf(maxCount);

  return {
    type: 'info',
    icon: 'calendar',
    message: `${dayNames[mostActiveDay]}s are your most active day for applying`,
    data: { day: dayNames[mostActiveDay], count: maxCount }
  };
}

/**
 * Analyze progress trends (compare recent vs previous period)
 */
function analyzeProgressTrends(recentApps, allApps) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  let recentInterviews = 0;
  let recentTotal = 0;
  let previousInterviews = 0;
  let previousTotal = 0;

  allApps.forEach(app => {
    const appDate = new Date(app.dateApplied || app.meta?.createdAt);
    if (isNaN(appDate.getTime())) return;

    const hadInterview = app.statusHistory?.some(h => h.status === 'interview') ||
      app.status === 'interview' || app.status === 'offer';

    if (appDate >= thirtyDaysAgo) {
      recentTotal++;
      if (hadInterview) recentInterviews++;
    } else if (appDate >= sixtyDaysAgo) {
      previousTotal++;
      if (hadInterview) previousInterviews++;
    }
  });

  // Need at least 3 applications in each period to compare
  if (recentTotal < 3 || previousTotal < 3) return null;

  const recentRate = (recentInterviews / recentTotal) * 100;
  const previousRate = (previousInterviews / previousTotal) * 100;
  const change = recentRate - previousRate;

  if (Math.abs(change) >= 5) {
    if (change > 0) {
      return {
        type: 'success',
        icon: 'trending-up',
        message: `Interview rate improved ${Math.round(change)}% compared to last month`,
        data: { change: Math.round(change), direction: 'up' }
      };
    } else {
      return {
        type: 'warning',
        icon: 'trending-down',
        message: `Interview rate decreased ${Math.round(Math.abs(change))}% from last month`,
        data: { change: Math.round(Math.abs(change)), direction: 'down' }
      };
    }
  }

  return null;
}

/**
 * Find applications needing follow-up
 */
function analyzeFollowUpNeeded(apps) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const needFollowUp = apps.filter(app => {
    if (app.status !== 'screening' && app.status !== 'applied') return false;

    const lastUpdate = app.statusHistory?.length > 0
      ? new Date(app.statusHistory[app.statusHistory.length - 1].date)
      : new Date(app.dateApplied || app.meta?.createdAt);

    return lastUpdate < sevenDaysAgo;
  });

  if (needFollowUp.length > 0) {
    return {
      type: 'action',
      icon: 'clock',
      message: `${needFollowUp.length} application${needFollowUp.length !== 1 ? 's' : ''} in screening/applied for 7+ days`,
      data: { count: needFollowUp.length, applications: needFollowUp.slice(0, 5).map(a => a.id) }
    };
  }

  return null;
}

/**
 * Detect inactivity periods
 */
function analyzeInactivityPeriods(apps) {
  if (apps.length === 0) return null;

  let mostRecent = null;
  apps.forEach(app => {
    const appDate = new Date(app.dateApplied || app.meta?.createdAt);
    if (!isNaN(appDate.getTime())) {
      if (!mostRecent || appDate > mostRecent) {
        mostRecent = appDate;
      }
    }
  });

  if (!mostRecent) return null;

  const now = new Date();
  const daysSinceLastApp = Math.floor((now - mostRecent) / (1000 * 60 * 60 * 24));

  if (daysSinceLastApp >= 3) {
    return {
      type: 'warning',
      icon: 'alert-circle',
      message: `You haven't applied in ${daysSinceLastApp} days`,
      data: { days: daysSinceLastApp }
    };
  }

  return null;
}
