/**
 * Dashboard State Management
 * Centralized state for the dashboard application
 */

// Message types for communication with background script
export const MessageTypes = {
  GET_APPLICATIONS: 'GET_APPLICATIONS',
  ADD_APPLICATION: 'ADD_APPLICATION',
  UPDATE_APPLICATION: 'UPDATE_APPLICATION',
  DELETE_APPLICATION: 'DELETE_APPLICATION',
  GET_APPLICATION_STATS: 'GET_APPLICATION_STATS',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  // Intelligence (Phase 4)
  GET_INSIGHTS: 'GET_INSIGHTS',
  GET_RECOMMENDATIONS: 'GET_RECOMMENDATIONS',
  GET_GOAL_PROGRESS: 'GET_GOAL_PROGRESS',
  SAVE_GOALS: 'SAVE_GOALS',
  // CRM Enhancement - Interviews
  GET_INTERVIEWS: 'GET_INTERVIEWS',
  GET_INTERVIEWS_BY_APP: 'GET_INTERVIEWS_BY_APP',
  GET_UPCOMING_INTERVIEWS: 'GET_UPCOMING_INTERVIEWS',
  ADD_INTERVIEW: 'ADD_INTERVIEW',
  UPDATE_INTERVIEW: 'UPDATE_INTERVIEW',
  DELETE_INTERVIEW: 'DELETE_INTERVIEW',
  // CRM Enhancement - Tasks
  GET_TASKS: 'GET_TASKS',
  GET_TASKS_BY_APP: 'GET_TASKS_BY_APP',
  GET_UPCOMING_TASKS: 'GET_UPCOMING_TASKS',
  ADD_TASK: 'ADD_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK',
  // CRM Enhancement - Activities
  GET_ACTIVITIES: 'GET_ACTIVITIES',
  GET_ACTIVITIES_BY_APP: 'GET_ACTIVITIES_BY_APP',
  ADD_ACTIVITY: 'ADD_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',
  // CRM Enhancement - Tags & Deadlines
  GET_ALL_TAGS: 'GET_ALL_TAGS',
  GET_EXPIRING_APPLICATIONS: 'GET_EXPIRING_APPLICATIONS'
};

// Status colors matching existing CSS
export const STATUS_COLORS = {
  saved: '#6b7280',
  applied: '#3b82f6',
  screening: '#f59e0b',
  interview: '#8b5cf6',
  offer: '#10b981',
  rejected: '#ef4444',
  withdrawn: '#9ca3af'
};

export const PLATFORM_COLORS = {
  linkedin: '#0077b5',
  indeed: '#2164f3',
  glassdoor: '#0caa41',
  greenhouse: '#3ab549',
  lever: '#1a1a1a',
  workday: '#0875e1',
  icims: '#00a0df',
  smartrecruiters: '#10b981',
  other: '#6b7280'
};

// Valid status values for sanitization
export const VALID_STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn', 'saved'];

// Application state
export const state = {
  // Core application data
  applications: [],
  filteredApplications: [],
  selectedAppId: null,

  // View state
  currentView: 'table', // 'cards' or 'table'
  currentPage: 'applications', // 'applications' or 'stats'

  // Settings cache
  cachedSettings: null,

  // Form state
  formIsDirty: false,
  isSubmitting: false,

  // CRM Enhancement state
  allTags: [],
  selectedTags: [],
  upcomingInterviews: [],
  upcomingTasks: [],

  // Phase 3: Date range state
  currentDateRange: null, // null = all time, number = days, or {start, end}

  // Phase 4: Goal display
  currentGoalType: 'weekly' // 'weekly' or 'monthly'
};

// DOM Elements - initialized after DOM is ready
export let elements = {};

export function initElements() {
  elements = {
    // Stats
    statTotal: document.getElementById('stat-total'),
    statWeek: document.getElementById('stat-week'),
    statInterviews: document.getElementById('stat-interviews'),
    statOffers: document.getElementById('stat-offers'),
    statInterviewRate: document.getElementById('stat-interview-rate'),
    statOfferRate: document.getElementById('stat-offer-rate'),
    statAvgDays: document.getElementById('stat-avg-days'),
    statWow: document.getElementById('stat-wow'),

    // List
    list: document.getElementById('applications-list'),
    emptyState: document.getElementById('empty-state'),
    appCount: document.getElementById('app-count'),

    // Filters
    searchInput: document.getElementById('search-input'),
    filterStatus: document.getElementById('filter-status'),
    filterSort: document.getElementById('filter-sort'),

    // Buttons
    addBtn: document.getElementById('add-btn'),
    emptyAddBtn: document.getElementById('empty-add-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    exportBtn: document.getElementById('export-btn'),

    // View Toggle
    viewCardsBtn: document.getElementById('view-cards'),
    viewTableBtn: document.getElementById('view-table'),
    tableContainer: document.getElementById('applications-table'),
    tableBody: document.getElementById('table-body'),

    // Modal
    modal: document.getElementById('app-modal'),
    modalTitle: document.getElementById('modal-title'),
    closeModal: document.getElementById('close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    appForm: document.getElementById('app-form'),

    // Details Panel
    detailsPanel: document.getElementById('details-panel'),
    detailsPosition: document.getElementById('details-position'),
    detailsContent: document.getElementById('details-content'),
    closeDetails: document.getElementById('close-details'),

    // Sidebar
    sidebar: document.querySelector('.dashboard-sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),

    // Navigation
    navItems: document.querySelectorAll('.nav-item[data-view]'),

    // Sections
    statsSection: document.getElementById('stats-section'),
    filtersSection: document.querySelector('.filters-section'),
    applicationsSection: document.querySelector('.applications-section'),
    headerTitle: document.querySelector('.header-left h1'),

    // Phase 3: Date range filter
    dateRangeFilter: document.getElementById('date-range-filter'),
    customRange: document.getElementById('custom-range'),
    dateStart: document.getElementById('date-start'),
    dateEnd: document.getElementById('date-end'),
    applyRangeBtn: document.getElementById('apply-range'),

    // Phase 3: New chart containers
    funnelConversions: document.getElementById('funnel-conversions'),

    // Phase 4: Intelligence panel
    intelligencePanel: document.getElementById('intelligence-panel'),
    goalCard: document.getElementById('goal-card'),
    goalProgressContainer: document.getElementById('goal-progress-container'),
    goalSettingsBtn: document.getElementById('goal-settings-btn'),
    goalSetupBtn: document.getElementById('goal-setup-btn'),
    insightsCard: document.getElementById('insights-card'),
    insightsList: document.getElementById('insights-list'),
    recommendationsCard: document.getElementById('recommendations-card'),
    recommendationsList: document.getElementById('recommendations-list'),

    // Phase 4: Goal modal
    goalModal: document.getElementById('goal-modal'),
    goalForm: document.getElementById('goal-form'),
    closeGoalModal: document.getElementById('close-goal-modal'),
    cancelGoalBtn: document.getElementById('cancel-goal-btn'),
    weeklyGoalEnabled: document.getElementById('weekly-goal-enabled'),
    weeklyGoal: document.getElementById('weekly-goal'),
    weeklyGoalInputRow: document.getElementById('weekly-goal-input-row'),
    monthlyGoalEnabled: document.getElementById('monthly-goal-enabled'),
    monthlyGoal: document.getElementById('monthly-goal'),
    monthlyGoalInputRow: document.getElementById('monthly-goal-input-row'),

    // CRM Enhancement elements
    tagFilter: document.getElementById('tag-filter'),
    tagFilterContainer: document.getElementById('tag-filter-container'),
    upcomingInterviewsWidget: document.getElementById('upcoming-interviews-widget'),
    upcomingInterviewsList: document.getElementById('upcoming-interviews-list'),
    tasksWidget: document.getElementById('tasks-widget'),
    tasksList: document.getElementById('tasks-list'),
    addTaskBtn: document.getElementById('add-task-btn'),

    // Interview Modal
    interviewModal: document.getElementById('interview-modal'),
    interviewForm: document.getElementById('interview-form'),
    closeInterviewModal: document.getElementById('close-interview-modal'),
    cancelInterviewBtn: document.getElementById('cancel-interview-btn'),

    // Task Modal
    taskModal: document.getElementById('task-modal'),
    taskForm: document.getElementById('task-form'),
    closeTaskModal: document.getElementById('close-task-modal'),
    cancelTaskBtn: document.getElementById('cancel-task-btn')
  };

  return elements;
}

// State accessor functions
export function getApplications() {
  return state.applications;
}

export function setApplications(apps) {
  state.applications = apps;
}

export function getFilteredApplications() {
  return state.filteredApplications;
}

export function setFilteredApplications(apps) {
  state.filteredApplications = apps;
}

export function getSelectedAppId() {
  return state.selectedAppId;
}

export function setSelectedAppId(id) {
  state.selectedAppId = id;
}

export function getCurrentView() {
  return state.currentView;
}

export function setCurrentView(view) {
  state.currentView = view;
}

export function getCurrentPage() {
  return state.currentPage;
}

export function setCurrentPage(page) {
  state.currentPage = page;
}

export function getCachedSettings() {
  return state.cachedSettings;
}

export function setCachedSettings(settings) {
  state.cachedSettings = settings;
}

export function isFormDirty() {
  return state.formIsDirty;
}

export function setFormDirty(dirty) {
  state.formIsDirty = dirty;
}

export function isSubmitting() {
  return state.isSubmitting;
}

export function setSubmitting(submitting) {
  state.isSubmitting = submitting;
}

export function getCurrentDateRange() {
  return state.currentDateRange;
}

export function setCurrentDateRange(range) {
  state.currentDateRange = range;
}

export function getAllTags() {
  return state.allTags;
}

export function setAllTags(tags) {
  state.allTags = tags;
}

export function getSelectedTags() {
  return state.selectedTags;
}

export function setSelectedTags(tags) {
  state.selectedTags = tags;
}

export function getUpcomingInterviews() {
  return state.upcomingInterviews;
}

export function setUpcomingInterviews(interviews) {
  state.upcomingInterviews = interviews;
}

export function getUpcomingTasks() {
  return state.upcomingTasks;
}

export function setUpcomingTasks(tasks) {
  state.upcomingTasks = tasks;
}

export function getCurrentGoalType() {
  return state.currentGoalType;
}

export function setCurrentGoalType(type) {
  state.currentGoalType = type;
}
