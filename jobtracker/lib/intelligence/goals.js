/**
 * JobTracker Goals Module
 * Calculates goal progress for weekly/monthly targets
 */

/**
 * Calculate goal progress for weekly/monthly targets
 * @param {Array} applications - All applications
 * @param {Object} goals - Goal settings
 * @returns {Object} Goal progress data
 */
export function calculateGoalProgress(applications, goals) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count applications this week and month
  let weeklyCount = 0;
  let monthlyCount = 0;

  applications.forEach(app => {
    const appDate = new Date(app.dateApplied || app.meta?.createdAt);
    if (isNaN(appDate.getTime())) return;

    if (appDate >= weekStart) {
      weeklyCount++;
    }
    if (appDate >= monthStart) {
      monthlyCount++;
    }
  });

  return {
    weekly: {
      current: weeklyCount,
      target: goals.weekly?.target || 0,
      enabled: goals.weekly?.enabled || false,
      percentage: goals.weekly?.target > 0
        ? Math.min(100, Math.round((weeklyCount / goals.weekly.target) * 100))
        : 0,
      completed: goals.weekly?.target > 0 && weeklyCount >= goals.weekly.target
    },
    monthly: {
      current: monthlyCount,
      target: goals.monthly?.target || 0,
      enabled: goals.monthly?.enabled || false,
      percentage: goals.monthly?.target > 0
        ? Math.min(100, Math.round((monthlyCount / goals.monthly.target) * 100))
        : 0,
      completed: goals.monthly?.target > 0 && monthlyCount >= goals.monthly.target
    }
  };
}

/**
 * Get default goal settings
 * @returns {Object} Default goal configuration
 */
export function getDefaultGoals() {
  return {
    weekly: { target: 0, enabled: false },
    monthly: { target: 0, enabled: false },
    updatedAt: null
  };
}
