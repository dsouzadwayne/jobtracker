/**
 * JobTracker Profile Page Script
 */

// Theme Management
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_settings',

  async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
    this.setupListeners();
  },

  async getTheme() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY]?.ui?.theme || 'system';
    } catch {
      return 'system';
    }
  },

  async setTheme(theme) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const settings = result[this.STORAGE_KEY] || {};
      settings.ui = settings.ui || {};
      settings.ui.theme = theme;
      await chrome.storage.local.set({ [this.STORAGE_KEY]: settings });
      this.applyTheme(theme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  },

  applyTheme(theme) {
    const root = document.documentElement;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }

    this.updateToggleButton(theme);
  },

  updateToggleButton(theme) {
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  },

  setupListeners() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        const currentTheme = await this.getTheme();
        const isDark = currentTheme === 'dark' ||
          (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const newTheme = isDark ? 'light' : 'dark';
        await this.setTheme(newTheme);
      });
    }

    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTheme(btn.dataset.theme);
      });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const theme = await this.getTheme();
      if (theme === 'system') {
        this.applyTheme('system');
      }
    });
  }
};

// Message types
const MessageTypes = {
  GET_PROFILE: 'GET_PROFILE',
  SAVE_PROFILE: 'SAVE_PROFILE',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  EXPORT_DATA: 'EXPORT_DATA',
  IMPORT_DATA: 'IMPORT_DATA'
};

// State
let profile = null;
let settings = null;
let saveTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await ThemeManager.init();
  await loadProfile();
  await loadSettings();
  setupTabs();
  setupEventListeners();
  checkHashNavigation();
});

// Load profile data
async function loadProfile() {
  try {
    profile = await chrome.runtime.sendMessage({ type: MessageTypes.GET_PROFILE });
    populatePersonalFields();
    renderWorkHistory();
    renderEducation();
    renderSkills();
    renderQA();
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Load settings
async function loadSettings() {
  try {
    settings = await chrome.runtime.sendMessage({ type: MessageTypes.GET_SETTINGS });
    document.getElementById('setting-autofill-enabled').checked = settings.autofill?.enabled ?? true;
    document.getElementById('setting-floating-btn').checked = settings.autofill?.showFloatingButton ?? true;
    document.getElementById('setting-auto-track').checked = settings.detection?.autoTrackSubmissions ?? true;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Populate personal info fields
function populatePersonalFields() {
  const personal = profile?.personal || {};
  const address = personal.address || {};

  document.getElementById('firstName').value = personal.firstName || '';
  document.getElementById('lastName').value = personal.lastName || '';
  document.getElementById('email').value = personal.email || '';
  document.getElementById('phone').value = personal.phone || '';
  document.getElementById('street').value = address.street || '';
  document.getElementById('city').value = address.city || '';
  document.getElementById('state').value = address.state || '';
  document.getElementById('zipCode').value = address.zipCode || '';
  document.getElementById('country').value = address.country || '';
  document.getElementById('linkedIn').value = personal.linkedIn || '';
  document.getElementById('github').value = personal.github || '';
  document.getElementById('portfolio').value = personal.portfolio || '';
}

// Setup tab navigation
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');

  window.location.hash = tabId;
}

function checkHashNavigation() {
  const hash = window.location.hash.slice(1);
  if (hash && document.querySelector(`[data-tab="${hash}"]`)) {
    switchTab(hash);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Personal info auto-save
  const personalFields = ['firstName', 'lastName', 'email', 'phone', 'street', 'city', 'state', 'zipCode', 'country', 'linkedIn', 'github', 'portfolio'];
  personalFields.forEach(field => {
    document.getElementById(field).addEventListener('input', () => debouncedSave());
  });

  // Work History
  document.getElementById('add-work-btn').addEventListener('click', () => openWorkModal());
  document.getElementById('work-form').addEventListener('submit', handleWorkSubmit);
  document.getElementById('work-current').addEventListener('change', (e) => {
    document.getElementById('work-end').disabled = e.target.checked;
    if (e.target.checked) document.getElementById('work-end').value = '';
  });

  // Education
  document.getElementById('add-edu-btn').addEventListener('click', () => openEduModal());
  document.getElementById('edu-form').addEventListener('submit', handleEduSubmit);

  // Q&A
  document.getElementById('add-qa-btn').addEventListener('click', () => openQAModal());
  document.getElementById('qa-form').addEventListener('submit', handleQASubmit);

  // Skills
  ['languages', 'frameworks', 'tools', 'soft'].forEach(category => {
    const input = document.getElementById(`skill-${category}`);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSkill(category, input.value.trim());
        input.value = '';
      }
    });
  });

  // Settings
  document.getElementById('setting-autofill-enabled').addEventListener('change', saveSettings);
  document.getElementById('setting-floating-btn').addEventListener('change', saveSettings);
  document.getElementById('setting-auto-track').addEventListener('change', saveSettings);
  document.getElementById('clear-data-btn').addEventListener('click', handleClearData);

  // Import/Export
  document.getElementById('export-btn').addEventListener('click', handleExport);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', handleImport);

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.close;
      document.getElementById(modalId).classList.add('hidden');
    });
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });
}

// Debounced save
function debouncedSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveProfile, 500);
}

// Save profile
async function saveProfile() {
  const personal = profile.personal || {};
  personal.firstName = document.getElementById('firstName').value.trim();
  personal.lastName = document.getElementById('lastName').value.trim();
  personal.email = document.getElementById('email').value.trim();
  personal.phone = document.getElementById('phone').value.trim();
  personal.address = personal.address || {};
  personal.address.street = document.getElementById('street').value.trim();
  personal.address.city = document.getElementById('city').value.trim();
  personal.address.state = document.getElementById('state').value.trim();
  personal.address.zipCode = document.getElementById('zipCode').value.trim();
  personal.address.country = document.getElementById('country').value.trim();
  personal.linkedIn = document.getElementById('linkedIn').value.trim();
  personal.github = document.getElementById('github').value.trim();
  personal.portfolio = document.getElementById('portfolio').value.trim();

  profile.personal = personal;

  try {
    await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
    showSaveIndicator();
  } catch (error) {
    console.error('Error saving profile:', error);
  }
}

// Show save indicator
function showSaveIndicator() {
  const indicator = document.getElementById('save-indicator');
  indicator.classList.remove('hidden');
  setTimeout(() => indicator.classList.add('hidden'), 2000);
}

// ==================== WORK HISTORY ====================

function renderWorkHistory() {
  const list = document.getElementById('work-list');
  const empty = document.getElementById('work-empty');
  const work = profile?.workHistory || [];

  list.innerHTML = '';

  if (work.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  work.forEach(entry => {
    list.appendChild(createWorkCard(entry));
  });
}

function createWorkCard(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.innerHTML = `
    <div class="entry-header">
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(entry.title)}</div>
        <div class="entry-subtitle">${escapeHtml(entry.company)}</div>
        <div class="entry-meta">${formatDateRange(entry.startDate, entry.endDate, entry.current)}${entry.location ? ' · ' + escapeHtml(entry.location) : ''}</div>
      </div>
      <div class="entry-actions">
        <button class="edit" title="Edit" data-id="${entry.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="delete" title="Delete" data-id="${entry.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
    ${entry.description ? `<div class="entry-description">${escapeHtml(entry.description)}</div>` : ''}
  `;

  card.querySelector('.edit').addEventListener('click', () => openWorkModal(entry));
  card.querySelector('.delete').addEventListener('click', () => deleteWork(entry.id));

  return card;
}

function openWorkModal(entry = null) {
  const modal = document.getElementById('work-modal');
  const title = document.getElementById('work-modal-title');
  const form = document.getElementById('work-form');

  title.textContent = entry ? 'Edit Work Experience' : 'Add Work Experience';
  form.reset();

  if (entry) {
    document.getElementById('work-id').value = entry.id;
    document.getElementById('work-company').value = entry.company || '';
    document.getElementById('work-title').value = entry.title || '';
    document.getElementById('work-location').value = entry.location || '';
    document.getElementById('work-start').value = formatMonthInput(entry.startDate);
    document.getElementById('work-end').value = formatMonthInput(entry.endDate);
    document.getElementById('work-current').checked = entry.current || false;
    document.getElementById('work-description').value = entry.description || '';
    document.getElementById('work-end').disabled = entry.current || false;
  } else {
    document.getElementById('work-id').value = '';
  }

  modal.classList.remove('hidden');
}

async function handleWorkSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('work-id').value;
  const entry = {
    id: id || generateId(),
    company: document.getElementById('work-company').value.trim(),
    title: document.getElementById('work-title').value.trim(),
    location: document.getElementById('work-location').value.trim(),
    startDate: document.getElementById('work-start').value,
    endDate: document.getElementById('work-end').value,
    current: document.getElementById('work-current').checked,
    description: document.getElementById('work-description').value.trim()
  };

  if (id) {
    const index = profile.workHistory.findIndex(w => w.id === id);
    if (index !== -1) profile.workHistory[index] = entry;
  } else {
    profile.workHistory = profile.workHistory || [];
    profile.workHistory.unshift(entry);
  }

  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  document.getElementById('work-modal').classList.add('hidden');
  renderWorkHistory();
  showSaveIndicator();
}

async function deleteWork(id) {
  if (!confirm('Are you sure you want to delete this work experience?')) return;

  profile.workHistory = profile.workHistory.filter(w => w.id !== id);
  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  renderWorkHistory();
  showSaveIndicator();
}

// ==================== EDUCATION ====================

function renderEducation() {
  const list = document.getElementById('edu-list');
  const empty = document.getElementById('edu-empty');
  const education = profile?.education || [];

  list.innerHTML = '';

  if (education.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  education.forEach(entry => {
    list.appendChild(createEduCard(entry));
  });
}

function createEduCard(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  const degreeField = [entry.degree, entry.field].filter(Boolean).join(' in ');
  card.innerHTML = `
    <div class="entry-header">
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(entry.school)}</div>
        <div class="entry-subtitle">${escapeHtml(degreeField)}</div>
        <div class="entry-meta">${formatDateRange(entry.startDate, entry.endDate)}${entry.gpa ? ' · GPA: ' + escapeHtml(entry.gpa) : ''}</div>
      </div>
      <div class="entry-actions">
        <button class="edit" title="Edit" data-id="${entry.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="delete" title="Delete" data-id="${entry.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;

  card.querySelector('.edit').addEventListener('click', () => openEduModal(entry));
  card.querySelector('.delete').addEventListener('click', () => deleteEdu(entry.id));

  return card;
}

function openEduModal(entry = null) {
  const modal = document.getElementById('edu-modal');
  const title = document.getElementById('edu-modal-title');
  const form = document.getElementById('edu-form');

  title.textContent = entry ? 'Edit Education' : 'Add Education';
  form.reset();

  if (entry) {
    document.getElementById('edu-id').value = entry.id;
    document.getElementById('edu-school').value = entry.school || '';
    document.getElementById('edu-degree').value = entry.degree || '';
    document.getElementById('edu-field').value = entry.field || '';
    document.getElementById('edu-start').value = formatMonthInput(entry.startDate);
    document.getElementById('edu-end').value = formatMonthInput(entry.endDate);
    document.getElementById('edu-gpa').value = entry.gpa || '';
    document.getElementById('edu-location').value = entry.location || '';
  } else {
    document.getElementById('edu-id').value = '';
  }

  modal.classList.remove('hidden');
}

async function handleEduSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('edu-id').value;
  const entry = {
    id: id || generateId(),
    school: document.getElementById('edu-school').value.trim(),
    degree: document.getElementById('edu-degree').value.trim(),
    field: document.getElementById('edu-field').value.trim(),
    startDate: document.getElementById('edu-start').value,
    endDate: document.getElementById('edu-end').value,
    gpa: document.getElementById('edu-gpa').value.trim(),
    location: document.getElementById('edu-location').value.trim()
  };

  if (id) {
    const index = profile.education.findIndex(e => e.id === id);
    if (index !== -1) profile.education[index] = entry;
  } else {
    profile.education = profile.education || [];
    profile.education.unshift(entry);
  }

  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  document.getElementById('edu-modal').classList.add('hidden');
  renderEducation();
  showSaveIndicator();
}

async function deleteEdu(id) {
  if (!confirm('Are you sure you want to delete this education entry?')) return;

  profile.education = profile.education.filter(e => e.id !== id);
  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  renderEducation();
  showSaveIndicator();
}

// ==================== SKILLS ====================

function renderSkills() {
  ['languages', 'frameworks', 'tools', 'soft'].forEach(category => {
    const list = document.getElementById(`skills-${category}-list`);
    const skills = profile?.skills?.[category] || [];

    list.innerHTML = '';
    skills.forEach(skill => {
      list.appendChild(createSkillTag(skill, category));
    });
  });
}

function createSkillTag(skill, category) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.innerHTML = `
    ${escapeHtml(skill)}
    <button class="tag-remove" title="Remove">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  tag.querySelector('.tag-remove').addEventListener('click', () => removeSkill(category, skill));

  return tag;
}

async function addSkill(category, skill) {
  if (!skill) return;

  profile.skills = profile.skills || {};
  profile.skills[category] = profile.skills[category] || [];

  if (profile.skills[category].includes(skill)) return;

  profile.skills[category].push(skill);
  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  renderSkills();
  showSaveIndicator();
}

async function removeSkill(category, skill) {
  profile.skills[category] = profile.skills[category].filter(s => s !== skill);
  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  renderSkills();
  showSaveIndicator();
}

// ==================== Q&A ====================

function renderQA() {
  const list = document.getElementById('qa-list');
  const empty = document.getElementById('qa-empty');
  const qa = profile?.customQA || [];

  list.innerHTML = '';

  if (qa.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  qa.forEach(entry => {
    list.appendChild(createQACard(entry));
  });
}

function createQACard(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.innerHTML = `
    <div class="entry-header">
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(entry.question)}</div>
      </div>
      <div class="entry-actions">
        <button class="edit" title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="delete" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
    <div class="entry-description">${escapeHtml(entry.answer)}</div>
  `;

  card.querySelector('.edit').addEventListener('click', () => openQAModal(entry));
  card.querySelector('.delete').addEventListener('click', () => deleteQA(entry.id));

  return card;
}

function openQAModal(entry = null) {
  const modal = document.getElementById('qa-modal');
  const title = document.getElementById('qa-modal-title');
  const form = document.getElementById('qa-form');

  title.textContent = entry ? 'Edit Q&A' : 'Add Q&A';
  form.reset();

  if (entry) {
    document.getElementById('qa-id').value = entry.id;
    document.getElementById('qa-question').value = entry.question || '';
    document.getElementById('qa-answer').value = entry.answer || '';
  } else {
    document.getElementById('qa-id').value = '';
  }

  modal.classList.remove('hidden');
}

async function handleQASubmit(e) {
  e.preventDefault();

  const id = document.getElementById('qa-id').value;
  const entry = {
    id: id || generateId(),
    question: document.getElementById('qa-question').value.trim(),
    answer: document.getElementById('qa-answer').value.trim()
  };

  if (id) {
    const index = profile.customQA.findIndex(q => q.id === id);
    if (index !== -1) profile.customQA[index] = entry;
  } else {
    profile.customQA = profile.customQA || [];
    profile.customQA.unshift(entry);
  }

  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  document.getElementById('qa-modal').classList.add('hidden');
  renderQA();
  showSaveIndicator();
}

async function deleteQA(id) {
  if (!confirm('Are you sure you want to delete this Q&A?')) return;

  profile.customQA = profile.customQA.filter(q => q.id !== id);
  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  renderQA();
  showSaveIndicator();
}

// ==================== SETTINGS ====================

async function saveSettings() {
  settings.autofill = settings.autofill || {};
  settings.autofill.enabled = document.getElementById('setting-autofill-enabled').checked;
  settings.autofill.showFloatingButton = document.getElementById('setting-floating-btn').checked;
  settings.detection = settings.detection || {};
  settings.detection.autoTrackSubmissions = document.getElementById('setting-auto-track').checked;

  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_SETTINGS, payload: settings });
  showSaveIndicator();
}

async function handleClearData() {
  if (!confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) return;
  if (!confirm('This will delete your profile, all applications, and settings. Continue?')) return;

  await chrome.storage.local.clear();
  window.location.reload();
}

// ==================== IMPORT/EXPORT ====================

async function handleExport() {
  try {
    const data = await chrome.runtime.sendMessage({ type: MessageTypes.EXPORT_DATA });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobtracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Error exporting data. Please try again.');
  }
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version || !data.profile) {
      throw new Error('Invalid import file format');
    }

    const merge = confirm('Do you want to merge with existing data? Click Cancel to replace all data.');

    await chrome.runtime.sendMessage({
      type: MessageTypes.IMPORT_DATA,
      payload: { data, merge }
    });

    alert('Data imported successfully!');
    window.location.reload();
  } catch (error) {
    console.error('Error importing data:', error);
    alert('Error importing data. Please check the file format and try again.');
  }

  e.target.value = '';
}

// ==================== UTILITIES ====================

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatMonthInput(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatDateRange(startDate, endDate, current = false) {
  const formatDate = (d) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const start = formatDate(startDate);
  const end = current ? 'Present' : formatDate(endDate);

  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} - Present`;
  return '';
}
