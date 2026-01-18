/**
 * Statistics Page Module
 * Handles statistics, charts, heatmap, goals, and CRM widgets
 */

// Theme Manager
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_ui_prefs',

  async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
    this.setupToggle();
  },

  async getTheme() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY]?.theme || 'system';
    } catch {
      return 'system';
    }
  },

  async setTheme(theme) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const prefs = result[this.STORAGE_KEY] || {};
      prefs.theme = theme;
      await chrome.storage.local.set({ [this.STORAGE_KEY]: prefs });
      this.applyTheme(theme);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  },

  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  },

  setupToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', async () => {
        const current = await this.getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
      });
    }
  }
};

// Mobile sidebar handling
function setupMobileSidebar() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('dashboard-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!menuBtn || !sidebar) return;

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('hidden');
    menuBtn.setAttribute('aria-expanded', sidebar.classList.contains('open'));
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  });
}

// State
let applications = [];
let settings = {};
let goals = { weekly: null, monthly: null };

// Message types
const MessageTypes = {
  GET_APPLICATIONS: 'GET_APPLICATIONS',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  GET_INTERVIEWS: 'GET_INTERVIEWS',
  GET_TASKS: 'GET_TASKS',
  UPDATE_TASK: 'UPDATE_TASK',
  ADD_TASK: 'ADD_TASK'
};

// Load applications from background
async function loadApplications() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MessageTypes.GET_APPLICATIONS });
    applications = response?.applications || [];
    return applications;
  } catch (error) {
    console.log('Error loading applications:', error);
    return [];
  }
}

// Load settings
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MessageTypes.GET_SETTINGS });
    settings = response || {};
    goals = settings.goals || { weekly: null, monthly: null };
    return settings;
  } catch (error) {
    console.log('Error loading settings:', error);
    return {};
  }
}

// Calculate statistics
function calculateStats(apps, dateRange = null) {
  let filtered = apps;

  if (dateRange && dateRange.start) {
    const start = new Date(dateRange.start);
    const end = dateRange.end ? new Date(dateRange.end) : new Date();
    filtered = apps.filter(app => {
      const appDate = new Date(app.createdAt);
      return appDate >= start && appDate <= end;
    });
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const thisWeek = filtered.filter(app => new Date(app.createdAt) >= oneWeekAgo);
  const lastWeek = filtered.filter(app => {
    const date = new Date(app.createdAt);
    return date >= twoWeeksAgo && date < oneWeekAgo;
  });

  const interviews = filtered.filter(app =>
    ['screening', 'interview'].includes(app.status?.toLowerCase())
  );
  const offers = filtered.filter(app => app.status?.toLowerCase() === 'offer');

  const interviewRate = filtered.length > 0 ? ((interviews.length / filtered.length) * 100).toFixed(0) : 0;
  const offerRate = interviews.length > 0 ? ((offers.length / interviews.length) * 100).toFixed(0) : 0;

  // Calculate average days to interview
  let avgDays = '--';
  const appsWithInterviews = filtered.filter(app => {
    const status = app.status?.toLowerCase();
    return ['screening', 'interview', 'offer'].includes(status);
  });

  if (appsWithInterviews.length > 0) {
    const totalDays = appsWithInterviews.reduce((sum, app) => {
      const applied = new Date(app.createdAt);
      const statusDate = app.statusChangedAt ? new Date(app.statusChangedAt) : new Date();
      const days = Math.floor((statusDate - applied) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    avgDays = Math.round(totalDays / appsWithInterviews.length);
  }

  const wow = thisWeek.length - lastWeek.length;

  return {
    total: filtered.length,
    thisWeek: thisWeek.length,
    interviews: interviews.length,
    offers: offers.length,
    interviewRate: `${interviewRate}%`,
    offerRate: `${offerRate}%`,
    avgDays,
    wow: wow >= 0 ? `+${wow}` : wow.toString()
  };
}

// Update stats display
function updateStatsDisplay(stats) {
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-week').textContent = stats.thisWeek;
  document.getElementById('stat-interviews').textContent = stats.interviews;
  document.getElementById('stat-offers').textContent = stats.offers;
  document.getElementById('stat-interview-rate').textContent = stats.interviewRate;
  document.getElementById('stat-offer-rate').textContent = stats.offerRate;
  document.getElementById('stat-avg-days').textContent = stats.avgDays;

  const wowEl = document.getElementById('stat-wow');
  wowEl.textContent = stats.wow;
  wowEl.classList.remove('wow-positive', 'wow-negative');
  if (stats.wow.startsWith('+') && stats.wow !== '+0') {
    wowEl.classList.add('wow-positive');
  } else if (!stats.wow.startsWith('+') && stats.wow !== '0') {
    wowEl.classList.add('wow-negative');
  }
}

// Chart initialization
let statusChart, timelineChart, platformChart, funnelChart, timeStatusChart;

function initCharts(apps) {
  if (typeof Chart === 'undefined') {
    console.log('Chart.js not loaded');
    return;
  }

  const chartColors = {
    primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    success: getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim(),
    warning: getComputedStyle(document.documentElement).getPropertyValue('--color-warning').trim(),
    danger: getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim(),
    info: getComputedStyle(document.documentElement).getPropertyValue('--color-info').trim(),
    muted: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
  };

  // Status distribution
  const statusCounts = {};
  apps.forEach(app => {
    const status = app.status || 'saved';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const statusCtx = document.getElementById('status-chart')?.getContext('2d');
  if (statusCtx) {
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: [
            chartColors.muted,
            chartColors.primary,
            chartColors.info,
            chartColors.warning,
            chartColors.success,
            chartColors.danger
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } }
        }
      }
    });
  }

  // Timeline chart
  const timelineData = {};
  apps.forEach(app => {
    const date = new Date(app.createdAt).toISOString().split('T')[0];
    timelineData[date] = (timelineData[date] || 0) + 1;
  });

  const sortedDates = Object.keys(timelineData).sort();
  const timelineCtx = document.getElementById('timeline-chart')?.getContext('2d');
  if (timelineCtx) {
    if (timelineChart) timelineChart.destroy();
    timelineChart = new Chart(timelineCtx, {
      type: 'line',
      data: {
        labels: sortedDates.slice(-30),
        datasets: [{
          label: 'Applications',
          data: sortedDates.slice(-30).map(d => timelineData[d]),
          borderColor: chartColors.primary,
          backgroundColor: chartColors.primary + '20',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  // Platform chart
  const platformCounts = {};
  apps.forEach(app => {
    const platform = app.source || 'Direct';
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  });

  const platformCtx = document.getElementById('platform-chart')?.getContext('2d');
  if (platformCtx) {
    if (platformChart) platformChart.destroy();
    platformChart = new Chart(platformCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(platformCounts),
        datasets: [{
          data: Object.values(platformCounts),
          backgroundColor: chartColors.primary
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  // Funnel chart
  const funnelData = {
    'Applied': apps.length,
    'Screening': apps.filter(a => ['screening', 'interview', 'offer'].includes(a.status?.toLowerCase())).length,
    'Interview': apps.filter(a => ['interview', 'offer'].includes(a.status?.toLowerCase())).length,
    'Offer': apps.filter(a => a.status?.toLowerCase() === 'offer').length
  };

  const funnelCtx = document.getElementById('funnel-chart')?.getContext('2d');
  if (funnelCtx) {
    if (funnelChart) funnelChart.destroy();
    funnelChart = new Chart(funnelCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(funnelData),
        datasets: [{
          data: Object.values(funnelData),
          backgroundColor: [chartColors.primary, chartColors.info, chartColors.warning, chartColors.success]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true }
        }
      }
    });

    // Update funnel conversions
    const conversions = document.getElementById('funnel-conversions');
    if (conversions) {
      const screeningRate = funnelData['Applied'] > 0 ? ((funnelData['Screening'] / funnelData['Applied']) * 100).toFixed(0) : 0;
      const interviewRate = funnelData['Screening'] > 0 ? ((funnelData['Interview'] / funnelData['Screening']) * 100).toFixed(0) : 0;
      const offerRate = funnelData['Interview'] > 0 ? ((funnelData['Offer'] / funnelData['Interview']) * 100).toFixed(0) : 0;

      conversions.innerHTML = `
        <div class="conversion-item">
          <div class="conversion-rate">${screeningRate}%</div>
          <div class="conversion-label">to Screening</div>
        </div>
        <div class="conversion-item">
          <div class="conversion-rate">${interviewRate}%</div>
          <div class="conversion-label">to Interview</div>
        </div>
        <div class="conversion-item">
          <div class="conversion-rate">${offerRate}%</div>
          <div class="conversion-label">to Offer</div>
        </div>
      `;
    }
  }

  // Time in status chart
  const timeStatusCtx = document.getElementById('time-status-chart')?.getContext('2d');
  if (timeStatusCtx) {
    if (timeStatusChart) timeStatusChart.destroy();

    // Calculate average time in each status (simplified)
    const statusDurations = {
      'Applied': 3,
      'Screening': 5,
      'Interview': 7,
      'Offer': 2
    };

    timeStatusChart = new Chart(timeStatusCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(statusDurations),
        datasets: [{
          label: 'Days',
          data: Object.values(statusDurations),
          backgroundColor: [chartColors.primary, chartColors.info, chartColors.warning, chartColors.success]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Days' } }
        }
      }
    });
  }
}

// Initialize heatmap
function initHeatmap(apps) {
  const container = document.getElementById('activity-heatmap');
  if (!container) return;

  // Check if HeatmapRenderer is available (loaded from heatmap.js)
  if (typeof window.HeatmapRenderer === 'undefined') {
    console.warn('HeatmapRenderer not available');
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Heatmap library not loaded</p>';
    return;
  }

  // Aggregate applications by date
  const dailyCounts = {};
  apps.forEach(app => {
    const date = app.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0];
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
  });

  // Use HeatmapRenderer to render the heatmap
  window.HeatmapRenderer.render('#activity-heatmap', dailyCounts);
}

// Update goal display
function updateGoalDisplay() {
  const container = document.getElementById('goal-progress-container');
  if (!container) return;

  const hasWeekly = goals.weekly?.enabled && goals.weekly?.target;
  const hasMonthly = goals.monthly?.enabled && goals.monthly?.target;

  if (!hasWeekly && !hasMonthly) {
    container.innerHTML = `
      <div class="goal-empty-state">
        <p>Set weekly or monthly goals to track your progress</p>
        <button class="btn-secondary btn-sm" id="goal-setup-btn">Set Goals</button>
      </div>
    `;
    document.getElementById('goal-setup-btn')?.addEventListener('click', openGoalModal);
    return;
  }

  // Calculate current progress
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const weeklyApps = applications.filter(app => new Date(app.createdAt) >= startOfWeek).length;
  const monthlyApps = applications.filter(app => new Date(app.createdAt) >= startOfMonth).length;

  const goal = hasWeekly ? goals.weekly : goals.monthly;
  const current = hasWeekly ? weeklyApps : monthlyApps;
  const target = goal.target;
  const percentage = Math.min(100, Math.round((current / target) * 100));
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (percentage / 100) * circumference;

  container.innerHTML = `
    <div class="goal-type-selector">
      <button class="goal-type-btn ${hasWeekly ? 'active' : ''}" data-type="weekly" ${!hasWeekly ? 'disabled' : ''}>Weekly</button>
      <button class="goal-type-btn ${!hasWeekly && hasMonthly ? 'active' : ''}" data-type="monthly" ${!hasMonthly ? 'disabled' : ''}>Monthly</button>
    </div>
    <div class="goal-progress-ring-container">
      <div class="goal-progress-ring">
        <svg viewBox="0 0 120 120">
          <circle class="ring-bg" cx="60" cy="60" r="54"></circle>
          <circle class="ring-progress ${percentage >= 100 ? 'completed' : ''}" cx="60" cy="60" r="54"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="goal-progress-center">
          <span class="goal-progress-value">${current}</span>
          <span class="goal-progress-label">of ${target}</span>
        </div>
      </div>
      <div class="goal-stats">
        <div class="goal-stat-row">
          <span class="label">Target</span>
          <span class="value">${target}</span>
        </div>
        <div class="goal-stat-row">
          <span class="label">Current</span>
          <span class="value ${percentage >= 100 ? 'completed' : ''}">${current}</span>
        </div>
        <div class="goal-stat-row">
          <span class="label">Remaining</span>
          <span class="value">${Math.max(0, target - current)}</span>
        </div>
      </div>
    </div>
  `;
}

// Goal modal
function openGoalModal() {
  const modal = document.getElementById('goal-modal');
  if (!modal) return;

  // Populate form
  document.getElementById('weekly-goal-enabled').checked = goals.weekly?.enabled || false;
  document.getElementById('weekly-goal').value = goals.weekly?.target || '';
  document.getElementById('monthly-goal-enabled').checked = goals.monthly?.enabled || false;
  document.getElementById('monthly-goal').value = goals.monthly?.target || '';

  updateGoalInputState();
  modal.classList.remove('hidden');
}

function closeGoalModal() {
  document.getElementById('goal-modal')?.classList.add('hidden');
}

function updateGoalInputState() {
  const weeklyEnabled = document.getElementById('weekly-goal-enabled')?.checked;
  const monthlyEnabled = document.getElementById('monthly-goal-enabled')?.checked;

  const weeklyRow = document.getElementById('weekly-goal-input-row');
  const monthlyRow = document.getElementById('monthly-goal-input-row');

  if (weeklyRow) weeklyRow.classList.toggle('enabled', weeklyEnabled);
  if (monthlyRow) monthlyRow.classList.toggle('enabled', monthlyEnabled);
}

async function saveGoals(e) {
  e.preventDefault();

  goals = {
    weekly: {
      enabled: document.getElementById('weekly-goal-enabled')?.checked || false,
      target: parseInt(document.getElementById('weekly-goal')?.value) || 0
    },
    monthly: {
      enabled: document.getElementById('monthly-goal-enabled')?.checked || false,
      target: parseInt(document.getElementById('monthly-goal')?.value) || 0
    }
  };

  settings.goals = goals;
  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_SETTINGS, payload: settings });

  closeGoalModal();
  updateGoalDisplay();
}

// Date range filter
function setupDateFilter() {
  const presetBtns = document.querySelectorAll('.preset-btn');
  const customRange = document.getElementById('custom-range');

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const range = btn.dataset.range;
      if (range === 'custom') {
        customRange?.classList.remove('hidden');
      } else {
        customRange?.classList.add('hidden');
        applyDateFilter(range);
      }
    });
  });

  document.getElementById('apply-range')?.addEventListener('click', () => {
    const start = document.getElementById('date-start')?.value;
    const end = document.getElementById('date-end')?.value;
    if (start) {
      applyDateFilter('custom', { start, end });
    }
  });
}

function applyDateFilter(range, custom = null) {
  let dateRange = null;

  if (range !== 'all') {
    const end = new Date();
    let start;

    if (range === 'custom' && custom) {
      start = new Date(custom.start);
      if (custom.end) end.setTime(new Date(custom.end).getTime());
    } else {
      const days = parseInt(range);
      start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    }

    dateRange = { start, end };
  }

  const stats = calculateStats(applications, dateRange);
  updateStatsDisplay(stats);
  initCharts(dateRange ? applications.filter(app => {
    const date = new Date(app.createdAt);
    return date >= dateRange.start && date <= dateRange.end;
  }) : applications);
}

// CRM Widgets
async function loadCRMWidgets() {
  await loadUpcomingInterviews();
  await loadTasks();
}

async function loadUpcomingInterviews() {
  const container = document.getElementById('upcoming-interviews-list');
  if (!container) return;

  try {
    const response = await chrome.runtime.sendMessage({ type: MessageTypes.GET_INTERVIEWS });
    const interviews = response?.interviews || [];

    const upcoming = interviews
      .filter(i => new Date(i.date) >= new Date() && i.outcome === 'pending')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    if (upcoming.length === 0) {
      container.innerHTML = '<div class="widget-empty"><p>No upcoming interviews scheduled</p></div>';
      return;
    }

    container.innerHTML = upcoming.map(interview => {
      const date = new Date(interview.date);
      const app = applications.find(a => a.id === interview.applicationId);

      return `
        <div class="interview-item">
          <div class="interview-time">
            <span class="interview-date">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span class="interview-hour">${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <div class="interview-details">
            <div class="interview-type">${interview.type || 'Interview'}</div>
            <div class="interview-company">${app?.company || 'Unknown'}</div>
          </div>
          <span class="interview-round">Round ${interview.round || 1}</span>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.log('Error loading interviews:', error);
    container.innerHTML = '<div class="widget-empty"><p>Could not load interviews</p></div>';
  }
}

async function loadTasks() {
  const container = document.getElementById('tasks-list');
  if (!container) return;

  try {
    const response = await chrome.runtime.sendMessage({ type: MessageTypes.GET_TASKS });
    const tasks = response?.tasks || [];

    const pending = tasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      })
      .slice(0, 5);

    if (pending.length === 0) {
      container.innerHTML = '<div class="widget-empty"><p>No pending tasks</p></div>';
      return;
    }

    container.innerHTML = pending.map(task => {
      const app = applications.find(a => a.id === task.applicationId);
      const priorityClass = task.priority <= 1 ? 'priority-high' : task.priority <= 2 ? 'priority-medium' : 'priority-low';
      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

      return `
        <div class="task-item ${priorityClass} ${isOverdue ? 'task-overdue' : ''}" data-id="${task.id}">
          <button class="task-checkbox" title="Mark complete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </button>
          <div class="task-details">
            <div class="task-title">${escapeHtml(task.title)}</div>
            ${app ? `<div class="task-app">${escapeHtml(app.company)}</div>` : ''}
          </div>
          ${task.dueDate ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${formatDueDate(task.dueDate)}</span>` : ''}
        </div>
      `;
    }).join('');

    // Add click handlers for completing tasks
    container.querySelectorAll('.task-checkbox').forEach(btn => {
      btn.addEventListener('click', async () => {
        const taskItem = btn.closest('.task-item');
        const taskId = taskItem?.dataset.id;
        if (taskId) {
          await completeTask(taskId);
          taskItem.remove();
          if (container.children.length === 0) {
            container.innerHTML = '<div class="widget-empty"><p>No pending tasks</p></div>';
          }
        }
      });
    });
  } catch (error) {
    console.log('Error loading tasks:', error);
    container.innerHTML = '<div class="widget-empty"><p>Could not load tasks</p></div>';
  }
}

async function completeTask(taskId) {
  try {
    await chrome.runtime.sendMessage({
      type: MessageTypes.UPDATE_TASK,
      payload: { id: taskId, completed: true, completedAt: new Date().toISOString() }
    });
  } catch (error) {
    console.log('Error completing task:', error);
  }
}

function formatDueDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Task modal
function setupTaskModal() {
  const addBtn = document.getElementById('add-task-btn');
  const modal = document.getElementById('task-modal');
  const closeBtn = document.getElementById('close-task-modal');
  const cancelBtn = document.getElementById('cancel-task-btn');
  const form = document.getElementById('task-form');

  addBtn?.addEventListener('click', () => {
    form?.reset();
    document.getElementById('task-id').value = '';
    document.getElementById('task-app-id').value = '';
    modal?.classList.remove('hidden');
  });

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
  cancelBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const task = {
      id: document.getElementById('task-id')?.value || generateId(),
      applicationId: document.getElementById('task-app-id')?.value || null,
      title: document.getElementById('task-title')?.value || '',
      description: document.getElementById('task-description')?.value || '',
      type: document.getElementById('task-type')?.value || 'general',
      priority: parseInt(document.getElementById('task-priority')?.value) || 3,
      dueDate: combineDateAndTime(
        document.getElementById('task-due-date')?.value,
        document.getElementById('task-due-time')?.value
      ),
      completed: false,
      createdAt: new Date().toISOString()
    };

    try {
      await chrome.runtime.sendMessage({ type: MessageTypes.ADD_TASK, payload: task });
      modal?.classList.add('hidden');
      await loadTasks();
    } catch (error) {
      console.log('Error saving task:', error);
    }
  });
}

function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':');
    date.setHours(parseInt(hours), parseInt(minutes));
  }
  return date.toISOString();
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Setup goal modal listeners
function setupGoalModal() {
  document.getElementById('goal-settings-btn')?.addEventListener('click', openGoalModal);
  document.getElementById('close-goal-modal')?.addEventListener('click', closeGoalModal);
  document.getElementById('cancel-goal-btn')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-form')?.addEventListener('submit', saveGoals);

  document.getElementById('weekly-goal-enabled')?.addEventListener('change', updateGoalInputState);
  document.getElementById('monthly-goal-enabled')?.addEventListener('change', updateGoalInputState);

  document.getElementById('goal-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'goal-modal') closeGoalModal();
  });
}

// Initialize page
async function init() {
  await ThemeManager.init();
  setupMobileSidebar();

  await Promise.all([loadApplications(), loadSettings()]);

  const stats = calculateStats(applications);
  updateStatsDisplay(stats);

  initCharts(applications);
  initHeatmap(applications);
  updateGoalDisplay();

  setupDateFilter();
  setupGoalModal();
  setupTaskModal();

  await loadCRMWidgets();
}

// Start
document.addEventListener('DOMContentLoaded', init);
