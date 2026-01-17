/**
 * Dashboard Intelligence Module
 * Goals, insights, and recommendations
 */

import {
  elements, MessageTypes,
  getCurrentPage, getCurrentDateRange,
  getCurrentGoalType, setCurrentGoalType
} from './state.js';
import { escapeHtml, showNotification } from './utils.js';

// References to external functions (set during initialization)
let openModalCallback = null;
let switchPageCallback = null;
let applyFiltersCallback = null;

export function setIntelligenceCallbacks(callbacks) {
  openModalCallback = callbacks.openModal;
  switchPageCallback = callbacks.switchPage;
  applyFiltersCallback = callbacks.applyFilters;
}

// Setup intelligence panel event listeners
export function setupIntelligencePanel() {
  // Goal settings button
  elements.goalSettingsBtn?.addEventListener('click', openGoalModal);
  elements.goalSetupBtn?.addEventListener('click', openGoalModal);

  // Goal modal
  elements.closeGoalModal?.addEventListener('click', closeGoalModal);
  elements.cancelGoalBtn?.addEventListener('click', closeGoalModal);
  elements.goalModal?.addEventListener('click', (e) => {
    if (e.target === elements.goalModal) closeGoalModal();
  });
  elements.goalForm?.addEventListener('submit', handleGoalSubmit);

  // Toggle input rows based on checkbox state
  elements.weeklyGoalEnabled?.addEventListener('change', (e) => {
    elements.weeklyGoalInputRow?.classList.toggle('enabled', e.target.checked);
  });
  elements.monthlyGoalEnabled?.addEventListener('change', (e) => {
    elements.monthlyGoalInputRow?.classList.toggle('enabled', e.target.checked);
  });
}

// Load intelligence panel data
export async function loadIntelligencePanel() {
  if (getCurrentPage() !== 'stats') return;

  try {
    const [insights, recommendations, goalProgress] = await Promise.all([
      chrome.runtime.sendMessage({ type: MessageTypes.GET_INSIGHTS, payload: { dateRange: getCurrentDateRange() } }),
      chrome.runtime.sendMessage({ type: MessageTypes.GET_RECOMMENDATIONS }),
      chrome.runtime.sendMessage({ type: MessageTypes.GET_GOAL_PROGRESS })
    ]);

    renderInsights(insights || []);
    renderRecommendations(recommendations || []);
    renderGoalProgress(goalProgress);

    // Show the panel
    elements.intelligencePanel?.classList.remove('hidden');
  } catch (error) {
    console.error('Error loading intelligence panel:', error);
  }
}

// Render insights
function renderInsights(insights) {
  if (!elements.insightsList) return;

  if (!insights || insights.length === 0) {
    elements.insightsList.innerHTML = `
      <div class="insights-empty">
        <p>Add more applications to see insights</p>
      </div>
    `;
    return;
  }

  elements.insightsList.innerHTML = insights.map(insight => `
    <div class="insight-item insight-${insight.type}">
      <div class="insight-icon">
        ${getInsightIcon(insight.icon)}
      </div>
      <div class="insight-message">${escapeHtml(insight.message)}</div>
    </div>
  `).join('');
}

// Get SVG icon for insight type
function getInsightIcon(iconName) {
  const icons = {
    'trending-up': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
    'trending-down': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>',
    'calendar': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    'alert-circle': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    'clock': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
  };
  return icons[iconName] || icons['alert-circle'];
}

// Render recommendations
function renderRecommendations(recommendations) {
  if (!elements.recommendationsList) return;

  if (!recommendations || recommendations.length === 0) {
    elements.recommendationsList.innerHTML = `
      <div class="recommendations-empty">
        <p>Great job! No recommendations at this time.</p>
      </div>
    `;
    return;
  }

  elements.recommendationsList.innerHTML = recommendations.map(rec => `
    <div class="recommendation-item rec-${rec.type}">
      <div class="recommendation-header">
        <div class="recommendation-icon">
          ${getRecommendationIcon(rec.icon)}
        </div>
        <div class="recommendation-content">
          <h5 class="recommendation-title">${escapeHtml(rec.title)}</h5>
          <p class="recommendation-message">${escapeHtml(rec.message)}</p>
        </div>
      </div>
      ${rec.action ? `
        <div class="recommendation-action">
          <button class="recommendation-action-btn" data-action="${escapeHtml(rec.action.type)}">
            ${escapeHtml(rec.action.label)}
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');

  // Add event listeners for action buttons
  elements.recommendationsList.querySelectorAll('.recommendation-action-btn').forEach(btn => {
    btn.addEventListener('click', () => handleRecommendationAction(btn.dataset.action));
  });
}

// Get SVG icon for recommendation type
function getRecommendationIcon(iconName) {
  const icons = {
    'plus-circle': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
    'mail': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    'target': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
    'check-circle': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    'award': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>'
  };
  return icons[iconName] || icons['target'];
}

// Handle recommendation action button click
function handleRecommendationAction(actionType) {
  switch (actionType) {
    case 'add_application':
      openModalCallback?.();
      break;
    case 'filter_screening':
      // Switch to applications view and filter by screening
      switchPageCallback?.('applications');
      elements.filterStatus.value = 'screening';
      applyFiltersCallback?.();
      break;
    default:
      console.log('Unknown action:', actionType);
  }
}

// Render goal progress
function renderGoalProgress(progress) {
  if (!elements.goalProgressContainer || !progress) return;

  const hasWeeklyGoal = progress.weekly.enabled && progress.weekly.target > 0;
  const hasMonthlyGoal = progress.monthly.enabled && progress.monthly.target > 0;

  if (!hasWeeklyGoal && !hasMonthlyGoal) {
    elements.goalProgressContainer.innerHTML = `
      <div class="goal-empty-state">
        <p>Set weekly or monthly goals to track your progress</p>
        <button class="btn-secondary btn-sm" id="goal-setup-btn-inner">Set Goals</button>
      </div>
    `;
    document.getElementById('goal-setup-btn-inner')?.addEventListener('click', openGoalModal);
    return;
  }

  // Determine which goal to show (prefer weekly if both enabled)
  const currentGoalType = getCurrentGoalType();
  const activeGoal = (currentGoalType === 'weekly' && hasWeeklyGoal) ? progress.weekly :
                     (currentGoalType === 'monthly' && hasMonthlyGoal) ? progress.monthly :
                     hasWeeklyGoal ? progress.weekly : progress.monthly;
  const goalLabel = activeGoal === progress.weekly ? 'This Week' : 'This Month';

  // Calculate circumference for SVG ring (radius = 42)
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (activeGoal.percentage / 100) * circumference;

  elements.goalProgressContainer.innerHTML = `
    ${(hasWeeklyGoal && hasMonthlyGoal) ? `
      <div class="goal-type-selector">
        <button class="goal-type-btn ${currentGoalType === 'weekly' ? 'active' : ''}" data-type="weekly">Weekly</button>
        <button class="goal-type-btn ${currentGoalType === 'monthly' ? 'active' : ''}" data-type="monthly">Monthly</button>
      </div>
    ` : ''}
    <div class="goal-progress-ring-container">
      <div class="goal-progress-ring">
        <svg viewBox="0 0 100 100">
          <circle class="ring-bg" cx="50" cy="50" r="42"></circle>
          <circle class="ring-progress ${activeGoal.completed ? 'completed' : ''}" cx="50" cy="50" r="42"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="goal-progress-center">
          <div class="goal-progress-value">${activeGoal.percentage}%</div>
          <div class="goal-progress-label">${goalLabel}</div>
        </div>
      </div>
      <div class="goal-stats">
        <div class="goal-stat-row">
          <span class="label">Current</span>
          <span class="value ${activeGoal.completed ? 'completed' : ''}">${activeGoal.current} apps</span>
        </div>
        <div class="goal-stat-row">
          <span class="label">Target</span>
          <span class="value">${activeGoal.target} apps</span>
        </div>
        <div class="goal-stat-row">
          <span class="label">Remaining</span>
          <span class="value">${Math.max(0, activeGoal.target - activeGoal.current)} apps</span>
        </div>
      </div>
    </div>
  `;

  // Add event listeners for goal type toggle
  elements.goalProgressContainer.querySelectorAll('.goal-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrentGoalType(btn.dataset.type);
      // Re-render with new goal type
      const newActiveGoal = getCurrentGoalType() === 'weekly' ? progress.weekly : progress.monthly;
      const newLabel = getCurrentGoalType() === 'weekly' ? 'This Week' : 'This Month';
      const newCircumference = 2 * Math.PI * 42;
      const newOffset = newCircumference - (newActiveGoal.percentage / 100) * newCircumference;

      // Update active button
      elements.goalProgressContainer.querySelectorAll('.goal-type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === getCurrentGoalType());
      });

      // Update ring
      const ringProgress = elements.goalProgressContainer.querySelector('.ring-progress');
      const progressValue = elements.goalProgressContainer.querySelector('.goal-progress-value');
      const progressLabel = elements.goalProgressContainer.querySelector('.goal-progress-label');
      const statsValues = elements.goalProgressContainer.querySelectorAll('.goal-stat-row .value');

      if (ringProgress) {
        ringProgress.style.strokeDashoffset = newOffset;
        ringProgress.classList.toggle('completed', newActiveGoal.completed);
      }
      if (progressValue) progressValue.textContent = `${newActiveGoal.percentage}%`;
      if (progressLabel) progressLabel.textContent = newLabel;
      if (statsValues[0]) {
        statsValues[0].textContent = `${newActiveGoal.current} apps`;
        statsValues[0].classList.toggle('completed', newActiveGoal.completed);
      }
      if (statsValues[1]) statsValues[1].textContent = `${newActiveGoal.target} apps`;
      if (statsValues[2]) statsValues[2].textContent = `${Math.max(0, newActiveGoal.target - newActiveGoal.current)} apps`;
    });
  });
}

// Open goal modal
async function openGoalModal() {
  try {
    const settings = await chrome.runtime.sendMessage({ type: MessageTypes.GET_SETTINGS });
    const goals = settings?.goals || { weekly: { target: 0, enabled: false }, monthly: { target: 0, enabled: false } };

    // Populate form
    elements.weeklyGoalEnabled.checked = goals.weekly.enabled;
    elements.weeklyGoal.value = goals.weekly.target || '';
    elements.weeklyGoalInputRow.classList.toggle('enabled', goals.weekly.enabled);

    elements.monthlyGoalEnabled.checked = goals.monthly.enabled;
    elements.monthlyGoal.value = goals.monthly.target || '';
    elements.monthlyGoalInputRow.classList.toggle('enabled', goals.monthly.enabled);

    elements.goalModal?.classList.remove('hidden');
    elements.weeklyGoal.focus();
  } catch (error) {
    console.error('Error opening goal modal:', error);
  }
}

// Close goal modal
function closeGoalModal() {
  elements.goalModal?.classList.add('hidden');
}

// Handle goal form submission
async function handleGoalSubmit(e) {
  e.preventDefault();

  const goals = {
    weekly: {
      enabled: elements.weeklyGoalEnabled.checked,
      target: parseInt(elements.weeklyGoal.value) || 0
    },
    monthly: {
      enabled: elements.monthlyGoalEnabled.checked,
      target: parseInt(elements.monthlyGoal.value) || 0
    }
  };

  try {
    await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_GOALS, payload: goals });
    closeGoalModal();
    // Refresh intelligence panel
    await loadIntelligencePanel();
  } catch (error) {
    console.error('Error saving goals:', error);
    showNotification('Failed to save goals. Please try again.', 'error');
  }
}
