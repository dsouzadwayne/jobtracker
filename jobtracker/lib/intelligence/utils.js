/**
 * JobTracker Intelligence Utilities
 * Shared utility functions for intelligence modules
 */

/**
 * Format platform name for display
 * @param {string} platform - Platform identifier
 * @returns {string} Formatted platform name
 */
export function formatPlatformName(platform) {
  const names = {
    linkedin: 'LinkedIn',
    indeed: 'Indeed',
    glassdoor: 'Glassdoor',
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    workday: 'Workday',
    icims: 'iCIMS',
    smartrecruiters: 'SmartRecruiters',
    naukri: 'Naukri',
    other: 'Other platforms'
  };
  return names[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

/**
 * Filter applications by date range
 * @param {Array} applications - Applications to filter
 * @param {number|Object} dateRange - Days or {start, end} object
 * @returns {Array} Filtered applications
 */
export function filterByDateRange(applications, dateRange) {
  if (!dateRange || dateRange === 'all') return applications;

  const now = new Date();
  let startDate;

  if (typeof dateRange === 'number') {
    startDate = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000);
  } else if (dateRange.start && dateRange.end) {
    startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    return applications.filter(app => {
      const appDate = new Date(app.dateApplied || app.meta?.createdAt);
      return appDate >= startDate && appDate <= endDate;
    });
  }

  if (!startDate) return applications;

  return applications.filter(app => {
    const appDate = new Date(app.dateApplied || app.meta?.createdAt);
    return appDate >= startDate;
  });
}

/**
 * Get days since a date
 * @param {Date|string} date - The date to compare
 * @returns {number} Number of days since the date
 */
export function getDaysSince(date) {
  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) return -1;

  const now = new Date();
  return Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
}

/**
 * Check if an application reached interview stage
 * @param {Object} app - Application object
 * @returns {boolean} True if reached interview
 */
export function reachedInterview(app) {
  return app.statusHistory?.some(h => h.status === 'interview') ||
    app.status === 'interview' ||
    app.status === 'offer';
}
