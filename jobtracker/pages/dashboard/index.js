/**
 * JobTracker Dashboard - Main Entry Point
 * Coordinates all dashboard modules
 */

// Import state and core
import {
  state, elements, initElements, MessageTypes,
  setApplications, setFilteredApplications, getFilteredApplications,
  getSelectedAppId, setSelectedAppId, getApplications,
  getCurrentView, setCurrentView, getCachedSettings, setCachedSettings,
  getCurrentDateRange, setCurrentDateRange,
  getSelectedTags
} from './state.js';

// Import utilities
import { debounce } from './utils.js';

// Import theme
import { ThemeManager, setUpdateStatsCallback } from './theme.js';

// Import charts
import { initCharts } from './charts.js';

// Import views
import {
  initViewToggle, toggleView, render, exportToCSV,
  setViewCallbacks
} from './views.js';

// Import modals
import {
  openModal, closeModal, closeModalWithConfirm, handleSubmit,
  setupModalListeners, setModalCallbacks
} from './modals.js';

// Import navigation
import {
  setupNavigation, switchPage, toggleMobileSidebar, checkUrlParams,
  selectApp, showDetailsPanel, closeDetailsPanel,
  setNavigationCallbacks
} from './navigation.js';

// Import intelligence
import {
  setupIntelligencePanel, loadIntelligencePanel,
  setIntelligenceCallbacks
} from './intelligence.js';

// Import CRM
import {
  loadTags, renderTagFilter, setupCRMFeatures,
  loadUpcomingInterviews, loadUpcomingTasks,
  openInterviewModal, openTaskModal, completeTask,
  loadActivityTimeline, renderActivityTimeline,
  setCRMCallbacks
} from './crm.js';

// Import Enhanced Task System (Planify-inspired)
import { taskManager } from './tasks-enhanced.js';

// Import keyboard
import {
  setupKeyboardShortcuts, setupEscapeHandler,
  setKeyboardCallbacks
} from './keyboard.js';

// Import AI features
import {
  initAI, getSmartTags, parseResumeText, parseJobText,
  matchResumeToJob, extractSkills, renderTagSuggestions,
  getAIStatus, isAIEnabled, enableAI, disableAI,
  cleanup as cleanupAI, setupModelDownloadListeners,
  setupSettingsListeners, loadStorageSizes, loadDashboardSettings
} from './ai-features.js';

// Search index (Fuse.js)
let searchIndex = null;

// BroadcastChannel for cross-page real-time updates
const applicationChannel = new BroadcastChannel('jobtracker-applications');
applicationChannel.onmessage = async (event) => {
  if (event.data.type === 'DATA_CHANGED') {
    try {
      await loadApplications();
      await loadTags();
      await updateStats();
      // Refresh intelligence panel and CRM widgets if on stats page
      if (state.currentPage === 'stats') {
        await loadIntelligencePanel();
        await loadUpcomingInterviews();
        await loadUpcomingTasks();
      }
    } catch (error) {
      console.error('Failed to reload data:', error);
      const { showNotification } = await import('./utils.js');
      showNotification('Failed to sync data. Please refresh.', 'error');
    }
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize DOM elements
  initElements();

  // Setup callbacks for modules
  setupModuleCallbacks();

  // Initialize theme
  await ThemeManager.init();
  setUpdateStatsCallback(updateStats);

  // Load data
  await loadSettings();
  await loadApplications();
  await loadTags();
  await updateStats();

  // Initialize enhanced task manager (Planify-inspired)
  try {
    await taskManager.init();
    // Request notification permission for task reminders
    await taskManager.requestNotificationPermission();
    console.log('JobTracker: Enhanced task manager initialized');
  } catch (error) {
    console.log('JobTracker: Enhanced task manager initialization failed:', error);
  }

  // Setup AI model download listeners (for progress toasts)
  setupModelDownloadListeners();

  // Setup settings page listeners
  setupSettingsListeners();

  // Initialize AI features (non-blocking)
  initAI().then(initialized => {
    if (initialized) {
      const status = getAIStatus();
      console.log(`JobTracker: AI features initialized (${status.mode})`);
    }
  }).catch(error => {
    console.log('JobTracker: AI features initialization failed:', error);
  });

  // Setup UI
  setupEventListeners();
  setupKeyboardShortcuts();
  setupEscapeHandler();
  initViewToggle();
  setupNavigation();
  initDateRangeFilter();
  setupIntelligencePanel();
  setupCRMFeatures();
  checkUrlParams();
});

// Setup module callbacks
function setupModuleCallbacks() {
  // Views callbacks
  setViewCallbacks({
    selectApp,
    openModal,
    deleteApplication
  });

  // Modals callbacks
  setModalCallbacks({
    loadApplications,
    loadTags,
    updateStats
  });

  // Navigation callbacks
  setNavigationCallbacks({
    openModal,
    deleteApplication,
    updateStats,
    loadIntelligencePanel,
    loadUpcomingInterviews,
    loadUpcomingTasks,
    openInterviewModal,
    openTaskModal,
    completeTask,
    loadActivityTimeline,
    renderActivityTimeline
  });

  // Intelligence callbacks
  setIntelligenceCallbacks({
    openModal,
    switchPage,
    applyFilters
  });

  // CRM callbacks
  setCRMCallbacks({
    applyFilters,
    showDetailsPanel
  });

  // Keyboard callbacks
  setKeyboardCallbacks({
    openModal,
    selectApp,
    closeModalWithConfirm,
    closeDetailsPanel
  });
}

// Load settings from IndexedDB
async function loadSettings() {
  try {
    const settings = await chrome.runtime.sendMessage({ type: MessageTypes.GET_SETTINGS });
    setCachedSettings(settings);

    // Check for localStorage migration (one-time)
    const localStorageView = localStorage.getItem('dashboardView');
    if (localStorageView && !settings?.ui?.dashboardView) {
      // Migrate from localStorage to IndexedDB
      settings.ui = settings.ui || {};
      settings.ui.dashboardView = localStorageView;
      try {
        await chrome.runtime.sendMessage({
          type: MessageTypes.SAVE_SETTINGS,
          payload: settings
        });
        localStorage.removeItem('dashboardView');
        console.log('JobTracker: Migrated dashboardView from localStorage to IndexedDB');
        setCachedSettings(settings);
      } catch (error) {
        console.error('Settings migration failed, keeping localStorage:', error);
      }
    }

    if (settings?.ui?.dashboardView) {
      setCurrentView(settings.ui.dashboardView);
    }
  } catch (error) {
    console.log('Error loading settings:', error);
  }
}

// Load applications
async function loadApplications() {
  try {
    const apps = await chrome.runtime.sendMessage({ type: MessageTypes.GET_APPLICATIONS }) || [];
    setApplications(apps);

    // Initialize fuzzy search index (Fuse.js loaded globally)
    if (typeof window.JobTrackerSearch !== 'undefined') {
      searchIndex = new window.JobTrackerSearch();
      searchIndex.setData(apps);
    }

    applyFilters();
  } catch (error) {
    console.log('Error loading applications:', error);
  }
}

// Update stats
async function updateStats() {
  try {
    const currentDateRange = getCurrentDateRange();
    const message = {
      type: MessageTypes.GET_APPLICATION_STATS,
      payload: currentDateRange ? { dateRange: currentDateRange } : {}
    };
    const stats = await chrome.runtime.sendMessage(message);
    if (stats) {
      // Update basic stats (always present on dashboard)
      elements.statTotal.textContent = stats.total || 0;
      elements.statWeek.textContent = stats.thisWeek || 0;
      elements.statInterviews.textContent = stats.byStatus?.interview || 0;
      elements.statOffers.textContent = stats.byStatus?.offer || 0;

      // Phase 2 metrics are now on statistics.html page
      // Only update if elements exist (for backward compatibility)
      if (elements.statInterviewRate) {
        elements.statInterviewRate.textContent = `${stats.interviewRate || 0}%`;
      }
      if (elements.statOfferRate) {
        elements.statOfferRate.textContent = `${stats.offerRate || 0}%`;
      }
      if (elements.statAvgDays) {
        elements.statAvgDays.textContent = stats.avgDaysToInterview !== null
          ? `${stats.avgDaysToInterview}d`
          : '--';
      }
      if (elements.statWow) {
        const wow = stats.weekOverWeekChange || 0;
        elements.statWow.textContent = wow >= 0 ? `+${wow}` : `${wow}`;
        elements.statWow.className = 'stat-value' + (wow > 0 ? ' wow-positive' : wow < 0 ? ' wow-negative' : '');
      }
    }
  } catch (error) {
    console.log('Error loading stats:', error);
  }
}

// Apply filters and render
function applyFilters() {
  const searchTerm = elements.searchInput.value.trim();
  const statusFilter = elements.filterStatus.value;
  const sortOrder = elements.filterSort.value;
  const selectedTags = getSelectedTags();
  const applications = getApplications();

  // Use fuzzy search if available and search term exists
  let searchResults;
  if (searchTerm && searchIndex) {
    searchResults = searchIndex.search(searchTerm);
  } else {
    searchResults = applications;
  }

  // Filter by status and tags
  let filtered = searchResults.filter(app => {
    const matchesStatus = !statusFilter || app.status === statusFilter;

    // CRM Enhancement: Tag filter
    const matchesTags = selectedTags.length === 0 ||
      (app.tags && selectedTags.every(tag => app.tags.includes(tag)));

    return matchesStatus && matchesTags;
  });

  // Sort
  filtered.sort((a, b) => {
    switch (sortOrder) {
      case 'date-desc':
        return new Date(b.dateApplied || b.meta?.createdAt) - new Date(a.dateApplied || a.meta?.createdAt);
      case 'date-asc':
        return new Date(a.dateApplied || a.meta?.createdAt) - new Date(b.dateApplied || b.meta?.createdAt);
      case 'company':
        return (a.company || '').localeCompare(b.company || '');
      case 'status':
        const statusOrder = ['offer', 'interview', 'screening', 'applied', 'saved', 'rejected', 'withdrawn'];
        const aIdx = statusOrder.indexOf(a.status);
        const bIdx = statusOrder.indexOf(b.status);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      default:
        return 0;
    }
  });

  setFilteredApplications(filtered);
  render();
}

// Delete application
async function deleteApplication(id) {
  if (!confirm('Are you sure you want to delete this application?')) return;

  try {
    await chrome.runtime.sendMessage({
      type: MessageTypes.DELETE_APPLICATION,
      payload: { id }
    });

    if (getSelectedAppId() === id) {
      setSelectedAppId(null);
      elements.detailsPanel.classList.add('hidden');
      // Hide overlay
      const overlay = document.getElementById('details-overlay');
      if (overlay) overlay.classList.add('hidden');
    }

    await loadApplications();
    await updateStats();
  } catch (error) {
    console.log('Error deleting application:', error);
    const { showNotification } = await import('./utils.js');
    showNotification('Failed to delete application. Please try again.', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Filters
  elements.searchInput?.addEventListener('input', debounce(applyFilters, 300));
  elements.filterStatus?.addEventListener('change', applyFilters);
  elements.filterSort?.addEventListener('change', applyFilters);

  // Add buttons
  elements.addBtn?.addEventListener('click', () => openModal());
  elements.emptyAddBtn?.addEventListener('click', () => openModal());

  // View toggle
  elements.viewCardsBtn?.addEventListener('click', () => toggleView('cards'));
  elements.viewTableBtn?.addEventListener('click', () => toggleView('table'));

  // Export CSV
  elements.exportBtn?.addEventListener('click', exportToCSV);

  // Theme toggle
  elements.themeToggle?.addEventListener('click', async () => await ThemeManager.toggleTheme());

  // Mobile menu
  elements.mobileMenuBtn?.addEventListener('click', toggleMobileSidebar);
  elements.sidebarOverlay?.addEventListener('click', toggleMobileSidebar);

  // Modal listeners
  setupModalListeners(deleteApplication);

  // Details panel
  elements.closeDetails?.addEventListener('click', closeDetailsPanel);
}

// Initialize date range filter
function initDateRangeFilter() {
  const presetBtns = document.querySelectorAll('.preset-btn');

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;

      // Update active state
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Handle custom range
      if (range === 'custom') {
        elements.customRange?.classList.remove('hidden');
        // Set default dates
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (elements.dateEnd) elements.dateEnd.value = now.toISOString().split('T')[0];
        if (elements.dateStart) elements.dateStart.value = monthAgo.toISOString().split('T')[0];
      } else {
        elements.customRange?.classList.add('hidden');
        applyDateRange(range === 'all' ? null : parseInt(range));
      }
    });
  });

  // Apply custom range button
  elements.applyRangeBtn?.addEventListener('click', () => {
    const start = elements.dateStart?.value;
    const end = elements.dateEnd?.value;
    if (start && end) {
      applyDateRange({ start, end });
    }
  });
}

// Apply date range filter
async function applyDateRange(range) {
  setCurrentDateRange(range);
  await updateStats();
  // Refresh intelligence panel with new date range
  await loadIntelligencePanel();
}

// Make functions available globally for inline onclick handlers (backward compatibility)
window.openModal = openModal;
window.deleteApplication = deleteApplication;
window.openInterviewModal = openInterviewModal;
window.openTaskModal = openTaskModal;
// Use getter so it always returns the current applications array
Object.defineProperty(window, 'applications', {
  get: function() { return getApplications(); }
});

// Expose AI functions globally for modal integration
window.getSmartTags = getSmartTags;
window.parseJobText = parseJobText;
window.renderTagSuggestions = renderTagSuggestions;
window.matchResumeToJob = matchResumeToJob;
window.getAIStatus = getAIStatus;
window.isAIEnabled = isAIEnabled;
window.enableAI = enableAI;
window.disableAI = disableAI;
