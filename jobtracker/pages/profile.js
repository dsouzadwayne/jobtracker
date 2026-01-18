/**
 * JobTracker Profile Page Script
 */

// Theme Management
// Uses separate storage key to avoid conflict with data migration
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_ui_prefs',

  async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
    this.setupListeners();
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

    // Listen for storage changes from other extension pages
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[this.STORAGE_KEY]) {
        const newTheme = changes[this.STORAGE_KEY].newValue?.theme || 'system';
        this.applyTheme(newTheme);
        this.updateToggleButton(newTheme);
      }
    });
  }
};

// Message types
const MessageTypes = {
  GET_PROFILE: 'GET_PROFILE',
  SAVE_PROFILE: 'SAVE_PROFILE',
  EXPORT_DATA: 'EXPORT_DATA',
  IMPORT_DATA: 'IMPORT_DATA',
  CLEAR_ALL_DATA: 'CLEAR_ALL_DATA'
};

// Recommended soft skills
const RECOMMENDED_SOFT_SKILLS = [
  'Communication',
  'Leadership',
  'Teamwork',
  'Problem-Solving',
  'Time Management',
  'Adaptability'
];

// State
let profile = null;
let saveTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await ThemeManager.init();
  await loadProfile();
  setupTabs();
  setupEventListeners();
  setupMobileSidebar();
  setupThemeToggle();
  checkHashNavigation();
});

// Setup mobile sidebar
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

// Setup theme toggle button in sidebar
function setupThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', async () => {
      const current = await ThemeManager.getTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      ThemeManager.setTheme(next);
    });
  }
}

// Load profile data
async function loadProfile() {
  try {
    profile = await chrome.runtime.sendMessage({ type: MessageTypes.GET_PROFILE });
    populatePersonalFields();
    renderWorkHistory();
    renderEducation();
    renderSkills();
    renderQA();
    renderCoverLetters();
  } catch (error) {
    console.log('Error loading profile:', error);
  }
}

// Populate personal info fields
function populatePersonalFields() {
  const personal = profile?.personal || {};
  const address = personal.address || {};

  document.getElementById('firstName').value = personal.firstName || '';
  document.getElementById('middleName').value = personal.middleName || '';
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
  document.getElementById('ctcCurrency').value = personal.ctcCurrency || 'INR';
  document.getElementById('currentCtc').value = personal.currentCtc || '';
  document.getElementById('expectedCtc').value = personal.expectedCtc || '';

  updateFullName();
}

// Update full name field (auto-generated, trimmed)
function updateFullName() {
  const firstName = document.getElementById('firstName').value.trim();
  const middleName = document.getElementById('middleName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();

  const fullName = [firstName, middleName, lastName]
    .filter(name => name.length > 0)
    .join(' ');

  document.getElementById('fullName').value = fullName;
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
  const personalFields = ['firstName', 'middleName', 'lastName', 'email', 'phone', 'street', 'city', 'state', 'zipCode', 'country', 'linkedIn', 'github', 'portfolio', 'currentCtc', 'expectedCtc'];
  personalFields.forEach(field => {
    document.getElementById(field).addEventListener('input', () => debouncedSave());
  });
  // Currency select uses 'change' event
  document.getElementById('ctcCurrency').addEventListener('change', () => debouncedSave());

  // Update full name when name fields change
  const nameFields = ['firstName', 'middleName', 'lastName'];
  nameFields.forEach(field => {
    document.getElementById(field).addEventListener('input', updateFullName);
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

  // Cover Letters
  document.getElementById('add-cover-btn').addEventListener('click', () => openCoverModal());
  document.getElementById('cover-form').addEventListener('submit', handleCoverSubmit);

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

  // Resume Import
  document.getElementById('import-resume-btn').addEventListener('click', () => {
    document.getElementById('resume-file-input').click();
  });
  document.getElementById('resume-file-input').addEventListener('change', handleResumeUpload);
  document.getElementById('select-all-fields').addEventListener('click', selectAllFields);
  document.getElementById('deselect-all-fields').addEventListener('click', deselectAllFields);
  document.getElementById('import-selected-btn').addEventListener('click', handleImportSelected);

  // Resume Preview Tabs
  document.querySelectorAll('.preview-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.previewTab;
      switchPreviewTab(tabId);
    });
  });

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
  personal.middleName = document.getElementById('middleName').value.trim();
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
  personal.ctcCurrency = document.getElementById('ctcCurrency').value;
  personal.currentCtc = document.getElementById('currentCtc').value.trim();
  personal.expectedCtc = document.getElementById('expectedCtc').value.trim();

  profile.personal = personal;

  try {
    await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
    showSaveIndicator();
  } catch (error) {
    console.log('Error saving profile:', error);
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

  // Group by company (LinkedIn-style)
  const groupedByCompany = groupWorkByCompany(work);

  // Render each company group
  for (const [companyKey, positions] of Object.entries(groupedByCompany)) {
    list.appendChild(createCompanyGroup(companyKey, positions));
  }
}

function groupWorkByCompany(workHistory) {
  const groups = {};

  // Sort by most recent first
  const sorted = [...workHistory].sort((a, b) => {
    const dateA = a.current ? new Date() : new Date(a.endDate || a.startDate);
    const dateB = b.current ? new Date() : new Date(b.endDate || b.startDate);
    return dateB - dateA;
  });

  for (const entry of sorted) {
    const companyKey = (entry.company || 'Unknown Company').toLowerCase().trim();
    if (!groups[companyKey]) {
      groups[companyKey] = [];
    }
    groups[companyKey].push(entry);
  }

  return groups;
}

function createCompanyGroup(companyKey, positions) {
  const group = document.createElement('div');
  group.className = 'company-group';
  group.dataset.company = companyKey;

  // Use the first position's company name (preserves original casing)
  const companyName = positions[0].company || 'Unknown Company';
  const location = positions[0].location || '';

  // Calculate total duration at company
  const dateRange = getCompanyDateRange(positions);

  group.innerHTML = `
    <div class="company-group-header" data-expanded="true">
      <div class="company-info">
        <div class="company-name">${escapeHtml(companyName)}</div>
        <div class="company-meta">${escapeHtml(dateRange)}${location ? ' · ' + escapeHtml(location) : ''}</div>
      </div>
      <div class="company-actions">
        <button class="add-position-btn" type="button" title="Add position at ${escapeHtml(companyName)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="toggle-btn" type="button" title="Toggle positions">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
    </div>
    <div class="company-positions">
      <!-- Positions will be appended here -->
    </div>
  `;

  const positionsContainer = group.querySelector('.company-positions');
  positions.forEach(position => {
    positionsContainer.appendChild(createPositionCard(position));
  });

  // Event: Toggle expand/collapse
  group.querySelector('.toggle-btn').addEventListener('click', () => {
    const header = group.querySelector('.company-group-header');
    const isExpanded = header.dataset.expanded === 'true';
    header.dataset.expanded = !isExpanded;
    positionsContainer.classList.toggle('collapsed', isExpanded);
  });

  // Event: Add position to this company
  group.querySelector('.add-position-btn').addEventListener('click', () => {
    openWorkModal(null, companyName, location);
  });

  return group;
}

function getCompanyDateRange(positions) {
  let earliest = null;
  let latest = null;
  let hasCurrent = false;

  positions.forEach(p => {
    if (p.current) hasCurrent = true;

    const start = p.startDate ? new Date(p.startDate) : null;
    const end = p.current ? new Date() : (p.endDate ? new Date(p.endDate) : null);

    if (start && (!earliest || start < earliest)) earliest = start;
    if (end && (!latest || end > latest)) latest = end;
  });

  if (!earliest) return '';

  const formatDate = (d) => {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const startStr = formatDate(earliest);
  const endStr = hasCurrent ? 'Present' : (latest ? formatDate(latest) : 'Present');

  return `${startStr} - ${endStr}`;
}

function createPositionCard(entry) {
  const card = document.createElement('div');
  card.className = 'position-card';
  const dateRangeStr = escapeHtml(formatDateRange(entry.startDate, entry.endDate, entry.current));

  card.innerHTML = `
    <div class="position-header">
      <div class="position-info">
        <div class="position-title">${escapeHtml(entry.title)}</div>
        <div class="position-meta">${dateRangeStr}</div>
      </div>
      <div class="position-actions">
        <button class="edit" type="button" title="Edit" data-id="${escapeHtml(entry.id)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="delete" type="button" title="Delete" data-id="${escapeHtml(entry.id)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
    ${entry.description ? `<div class="position-description">${formatBulletText(entry.description)}</div>` : ''}
  `;

  card.querySelector('.edit').addEventListener('click', () => openWorkModal(entry));
  card.querySelector('.delete').addEventListener('click', () => deleteWork(entry.id));

  return card;
}

function openWorkModal(entry = null, prefillCompany = '', prefillLocation = '') {
  const modal = document.getElementById('work-modal');
  const title = document.getElementById('work-modal-title');
  const form = document.getElementById('work-form');

  title.textContent = entry ? 'Edit Position' : 'Add Position';
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
    // Pre-fill company and location if adding to existing company
    document.getElementById('work-company').value = prefillCompany;
    document.getElementById('work-location').value = prefillLocation;
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
  const eduDateRangeStr = escapeHtml(formatDateRange(entry.startDate, entry.endDate));
  card.innerHTML = `
    <div class="entry-header">
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(entry.school)}</div>
        <div class="entry-subtitle">${escapeHtml(degreeField)}</div>
        <div class="entry-meta">${eduDateRangeStr}${entry.gpa ? ' · GPA: ' + escapeHtml(entry.gpa) : ''}</div>
      </div>
      <div class="entry-actions">
        <button class="edit" title="Edit" data-id="${escapeHtml(entry.id)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="delete" title="Delete" data-id="${escapeHtml(entry.id)}">
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

  // Render soft skills recommendations
  renderSoftSkillsRecommendations();
}

function renderSoftSkillsRecommendations() {
  const container = document.getElementById('soft-skills-recommendations');
  const listContainer = document.getElementById('soft-skills-recommendations-list');
  if (!container || !listContainer) return;

  const existingSoftSkills = (profile?.skills?.soft || []).map(s => s.toLowerCase());

  // Filter out skills that are already added
  const availableRecommendations = RECOMMENDED_SOFT_SKILLS.filter(
    skill => !existingSoftSkills.includes(skill.toLowerCase())
  );

  listContainer.innerHTML = '';

  if (availableRecommendations.length === 0) {
    // Hide recommendations if all are added
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  availableRecommendations.forEach(skill => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'recommendation-chip';
    chip.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      ${escapeHtml(skill)}
    `;
    chip.addEventListener('click', () => {
      addSkill('soft', skill);
    });
    listContainer.appendChild(chip);
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
    <div class="entry-description">${formatBulletText(entry.answer)}</div>
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

// ==================== COVER LETTERS ====================

function renderCoverLetters() {
  const list = document.getElementById('cover-list');
  const empty = document.getElementById('cover-empty');
  const coverLetters = profile?.coverLetters || [];

  list.innerHTML = '';

  if (coverLetters.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  coverLetters.forEach(entry => {
    list.appendChild(createCoverCard(entry));
  });
}

function createCoverCard(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  if (entry.isDefault) {
    card.classList.add('default-cover');
  }

  const preview = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');

  card.innerHTML = `
    <div class="entry-header">
      <div class="entry-info">
        <div class="entry-title">
          ${escapeHtml(entry.name)}
          ${entry.isDefault ? '<span class="default-badge">Default</span>' : ''}
        </div>
        <div class="entry-description">${escapeHtml(preview)}</div>
      </div>
      <div class="entry-actions">
        ${!entry.isDefault ? `
          <button class="set-default" type="button" title="Set as default">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
          </button>
        ` : ''}
        <button class="edit" type="button" title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="delete" type="button" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;

  const setDefaultBtn = card.querySelector('.set-default');
  if (setDefaultBtn) {
    setDefaultBtn.addEventListener('click', () => setDefaultCoverLetter(entry.id));
  }
  card.querySelector('.edit').addEventListener('click', () => openCoverModal(entry));
  card.querySelector('.delete').addEventListener('click', () => deleteCoverLetter(entry.id));

  return card;
}

function openCoverModal(entry = null) {
  const modal = document.getElementById('cover-modal');
  const title = document.getElementById('cover-modal-title');
  const form = document.getElementById('cover-form');

  title.textContent = entry ? 'Edit Cover Letter' : 'Add Cover Letter';
  form.reset();

  if (entry) {
    document.getElementById('cover-id').value = entry.id;
    document.getElementById('cover-name').value = entry.name || '';
    document.getElementById('cover-content').value = entry.content || '';
    document.getElementById('cover-default').checked = entry.isDefault || false;
  } else {
    document.getElementById('cover-id').value = '';
    // First cover letter should be default
    document.getElementById('cover-default').checked = (profile?.coverLetters?.length || 0) === 0;
  }

  modal.classList.remove('hidden');
}

async function handleCoverSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('cover-id').value;
  const isDefault = document.getElementById('cover-default').checked;
  const entry = {
    id: id || generateId(),
    name: document.getElementById('cover-name').value.trim(),
    content: document.getElementById('cover-content').value.trim(),
    isDefault: isDefault,
    updatedAt: new Date().toISOString()
  };

  if (!id) {
    entry.createdAt = new Date().toISOString();
  }

  profile.coverLetters = profile.coverLetters || [];

  // If this is being set as default, unset others
  if (isDefault) {
    profile.coverLetters.forEach(cl => cl.isDefault = false);
  }

  if (id) {
    const index = profile.coverLetters.findIndex(c => c.id === id);
    if (index !== -1) profile.coverLetters[index] = entry;
  } else {
    profile.coverLetters.unshift(entry);
  }

  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  document.getElementById('cover-modal').classList.add('hidden');
  renderCoverLetters();
  showSaveIndicator();
}

async function deleteCoverLetter(id) {
  if (!confirm('Are you sure you want to delete this cover letter?')) return;

  const wasDefault = profile.coverLetters.find(c => c.id === id)?.isDefault;
  profile.coverLetters = profile.coverLetters.filter(c => c.id !== id);

  // If deleted the default, make first one default
  if (wasDefault && profile.coverLetters.length > 0) {
    profile.coverLetters[0].isDefault = true;
  }

  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  renderCoverLetters();
  showSaveIndicator();
}

async function setDefaultCoverLetter(id) {
  profile.coverLetters.forEach(cl => cl.isDefault = cl.id === id);

  await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });
  renderCoverLetters();
  showSaveIndicator();
}


// ==================== RESUME IMPORT ====================

// State for resume import
let resumeParseResult = null;
let resumeComparison = null;

async function handleResumeUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const modal = document.getElementById('resume-preview-modal');
  const loading = document.getElementById('preview-loading');
  const content = document.querySelector('.preview-content');
  const importBtn = document.getElementById('import-selected-btn');

  // Show modal with loading state
  modal.classList.remove('hidden');
  loading.classList.remove('hidden');
  content.style.display = 'none';
  importBtn.disabled = true;

  try {
    // Check if parser is available
    if (typeof ResumeParser === 'undefined') {
      throw new Error('Resume parser not loaded. Please refresh the page and try again.');
    }

    // Parse the resume
    resumeParseResult = await ResumeParser.parse(file);

    // Enhance with AI if available
    if (typeof window.aiService !== 'undefined') {
      try {
        // Initialize AI service if not already done
        if (typeof window.initAIService === 'function') {
          await window.initAIService();
        }

        // Enhance the parsed result with AI (NER for names, skills, etc.)
        console.log('[Profile] Enhancing resume with AI...');
        resumeParseResult = await ResumeParser.enhanceWithAI(resumeParseResult, window.aiService);
        console.log('[Profile] AI enhancement complete');
      } catch (aiError) {
        console.log('[Profile] AI enhancement failed, using regex results:', aiError.message);
        // Continue with regex-only results
      }
    }

    // Compare with existing profile
    resumeComparison = ResumeDataNormalizer.compareWithExisting(
      resumeParseResult.normalized,
      profile
    );

    // Render preview
    renderResumePreview();

    // Show content, hide loading
    loading.classList.add('hidden');
    content.style.display = 'block';
    importBtn.disabled = false;

    // Update selection count
    updateSelectionCount();

  } catch (error) {
    console.error('Error parsing resume:', error);
    loading.classList.add('hidden');
    content.style.display = 'block';
    content.innerHTML = `
      <div class="preview-empty">
        <p><strong>Error parsing resume</strong></p>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }

  // Reset file input
  e.target.value = '';
}

function switchPreviewTab(tabId) {
  document.querySelectorAll('.preview-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.preview-panel').forEach(p => p.classList.remove('active'));

  document.querySelector(`[data-preview-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`preview-${tabId}`).classList.add('active');
}

function renderResumePreview() {
  renderPersonalPreview();
  renderWorkPreview();
  renderEducationPreview();
  renderSkillsPreview();
}

function renderPersonalPreview() {
  const panel = document.getElementById('preview-personal');
  const personal = resumeComparison.personal;

  const fieldLabels = {
    firstName: 'First Name',
    middleName: 'Middle Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    linkedIn: 'LinkedIn',
    github: 'GitHub',
    portfolio: 'Portfolio',
    'address.street': 'Street Address',
    'address.city': 'City',
    'address.state': 'State',
    'address.zipCode': 'ZIP Code',
    'address.country': 'Country'
  };

  let html = '';

  for (const [field, label] of Object.entries(fieldLabels)) {
    const data = personal[field];
    if (!data) continue;

    const statusClass = getStatusClass(data.status);
    const statusBadge = getStatusBadge(data.status);
    const isChecked = data.selected ? 'checked' : '';
    const isDisabled = data.status === 'both_empty' ? 'disabled' : '';

    html += `
      <div class="preview-field-row ${statusClass}">
        <label class="preview-checkbox">
          <input type="checkbox" data-field="${escapeHtml(field)}" data-type="personal" ${isChecked} ${isDisabled}>
          <span class="field-name">${escapeHtml(label)}</span>
          ${statusBadge}
        </label>
        <div class="preview-comparison">
          <div class="preview-extracted">
            <span class="label">From Resume</span>
            <span class="value ${data.extracted ? '' : 'empty'}">${data.extracted ? escapeHtml(data.extracted) : '(empty)'}</span>
          </div>
          <span class="preview-arrow">→</span>
          <div class="preview-existing">
            <span class="label">Current</span>
            <span class="value ${data.existing ? '' : 'empty'}">${data.existing ? escapeHtml(data.existing) : '(empty)'}</span>
          </div>
        </div>
      </div>
    `;
  }

  panel.innerHTML = html || '<div class="preview-empty"><p>No personal information found in resume</p></div>';
}

function renderWorkPreview() {
  const panel = document.getElementById('preview-work');
  const work = resumeComparison.workHistory;

  if (!work.extracted || work.extracted.length === 0) {
    panel.innerHTML = '<div class="preview-empty"><p>No work history found in resume</p></div>';
    return;
  }

  let html = '';

  work.extracted.forEach((entry, index) => {
    const dateRange = formatDateRange(entry.startDate, entry.endDate, entry.current);

    html += `
      <div class="preview-entry-card">
        <div class="preview-entry-header">
          <input type="checkbox" data-type="work" data-index="${index}" checked>
          <div class="preview-entry-info">
            <div class="preview-entry-title">${escapeHtml(entry.title || 'Unknown Title')}</div>
            <div class="preview-entry-subtitle">${escapeHtml(entry.company || 'Unknown Company')}</div>
            <div class="preview-entry-meta">
              ${dateRange ? escapeHtml(dateRange) : ''}
              ${entry.location ? ' · ' + escapeHtml(entry.location) : ''}
            </div>
          </div>
        </div>
        ${entry.description ? `<div class="preview-entry-description">${escapeHtml(entry.description)}</div>` : ''}
      </div>
    `;
  });

  panel.innerHTML = html;
}

function renderEducationPreview() {
  const panel = document.getElementById('preview-education');
  const education = resumeComparison.education;

  if (!education.extracted || education.extracted.length === 0) {
    panel.innerHTML = '<div class="preview-empty"><p>No education found in resume</p></div>';
    return;
  }

  let html = '';

  education.extracted.forEach((entry, index) => {
    const degreeField = [entry.degree, entry.field].filter(Boolean).join(' in ');

    html += `
      <div class="preview-entry-card">
        <div class="preview-entry-header">
          <input type="checkbox" data-type="education" data-index="${index}" checked>
          <div class="preview-entry-info">
            <div class="preview-entry-title">${escapeHtml(entry.school || 'Unknown School')}</div>
            <div class="preview-entry-subtitle">${escapeHtml(degreeField || 'Degree not specified')}</div>
            <div class="preview-entry-meta">
              ${entry.endDate ? 'Graduated ' + escapeHtml(entry.endDate) : ''}
              ${entry.gpa ? ' · GPA: ' + escapeHtml(entry.gpa) : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  panel.innerHTML = html;
}

function renderSkillsPreview() {
  const panel = document.getElementById('preview-skills');
  const skills = resumeComparison.skills;

  const categoryLabels = {
    languages: 'Programming Languages',
    frameworks: 'Frameworks & Libraries',
    tools: 'Tools & Technologies',
    soft: 'Soft Skills'
  };

  let html = '';
  let hasSkills = false;

  for (const [category, label] of Object.entries(categoryLabels)) {
    const data = skills[category];
    if (!data || (data.extracted.length === 0 && data.existing.length === 0)) continue;

    hasSkills = true;
    const hasNewSkills = data.new && data.new.length > 0;

    html += `
      <div class="preview-skill-category">
        <h4>
          <input type="checkbox" data-type="skills" data-category="${category}" ${hasNewSkills ? 'checked' : ''} ${!hasNewSkills ? 'disabled' : ''}>
          ${escapeHtml(label)}
          ${hasNewSkills ? `<span class="status-badge new">${data.new.length} new</span>` : ''}
        </h4>
        <div class="preview-skills-list">
    `;

    // Show new skills first
    if (data.new) {
      data.new.forEach(skill => {
        html += `<span class="preview-skill-tag new">${escapeHtml(skill)}</span>`;
      });
    }

    // Show existing skills (dimmed)
    if (data.existing) {
      data.existing.forEach(skill => {
        html += `<span class="preview-skill-tag existing">${escapeHtml(skill)}</span>`;
      });
    }

    html += '</div></div>';
  }

  panel.innerHTML = html || '<div class="preview-empty"><p>No skills found in resume</p></div>';
}

function getStatusClass(status) {
  switch (status) {
    case 'new_data': return 'status-new';
    case 'conflict': return 'status-conflict';
    case 'both_empty': return 'status-empty';
    default: return '';
  }
}

function getStatusBadge(status) {
  switch (status) {
    case 'new_data': return '<span class="status-badge new">New</span>';
    case 'conflict': return '<span class="status-badge conflict">Different</span>';
    case 'same': return '<span class="status-badge same">Same</span>';
    default: return '';
  }
}

function selectAllFields() {
  const checkboxes = document.querySelectorAll('.preview-content input[type="checkbox"]:not(:disabled)');
  checkboxes.forEach(cb => cb.checked = true);
  updateSelectionCount();
}

function deselectAllFields() {
  const checkboxes = document.querySelectorAll('.preview-content input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = false);
  updateSelectionCount();
}

function updateSelectionCount() {
  const total = document.querySelectorAll('.preview-content input[type="checkbox"]:not(:disabled)');
  const selected = document.querySelectorAll('.preview-content input[type="checkbox"]:checked');
  document.getElementById('selection-count').textContent = `${selected.length} of ${total.length} selected`;

  // Enable/disable import button
  document.getElementById('import-selected-btn').disabled = selected.length === 0;
}

// Add change listener for checkboxes (delegated)
document.addEventListener('change', (e) => {
  if (e.target.matches('.preview-content input[type="checkbox"]')) {
    updateSelectionCount();
  }
});

async function handleImportSelected() {
  if (!resumeParseResult || !resumeComparison) return;

  // Gather selections
  const selections = {
    personal: {},
    workHistory: [],
    education: [],
    skills: {}
  };

  // Personal fields
  document.querySelectorAll('[data-type="personal"]:checked').forEach(cb => {
    selections.personal[cb.dataset.field] = true;
  });

  // Work history
  document.querySelectorAll('[data-type="work"]:checked').forEach(cb => {
    const index = parseInt(cb.dataset.index);
    const entry = resumeParseResult.normalized.workHistory[index];
    if (entry) {
      selections.workHistory.push({ ...entry, selected: true });
    }
  });

  // Education
  document.querySelectorAll('[data-type="education"]:checked').forEach(cb => {
    const index = parseInt(cb.dataset.index);
    const entry = resumeParseResult.normalized.education[index];
    if (entry) {
      selections.education.push({ ...entry, selected: true });
    }
  });

  // Skills
  document.querySelectorAll('[data-type="skills"]:checked').forEach(cb => {
    selections.skills[cb.dataset.category] = true;
  });

  // Merge profiles
  const merged = ResumeDataNormalizer.mergeProfiles(
    profile,
    resumeParseResult.normalized,
    selections
  );

  // Save
  try {
    profile = merged;
    await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_PROFILE, payload: profile });

    // Close modal and refresh UI
    document.getElementById('resume-preview-modal').classList.add('hidden');
    populatePersonalFields();
    renderWorkHistory();
    renderEducation();
    renderSkills();
    showSaveIndicator();

    // Clean up
    resumeParseResult = null;
    resumeComparison = null;

  } catch (error) {
    console.error('Error saving imported data:', error);
    alert('Error saving imported data. Please try again.');
  }
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

function formatBulletText(text) {
  if (!text) return '';
  let formatted = escapeHtml(text);
  // Convert bullet markers to list items
  formatted = formatted
    .replace(/^[\s]*[•\-\*\●\○\■\□\►\▸]\s*/gm, '<li>')
    .replace(/^[\s]*\d+[\.\)]\s+/gm, '<li>')
    .replace(/(<li>.*?)(?=(?:<li>|$))/gs, '$1</li>');
  formatted = formatted.replace(/((?:<li>.*?<\/li>\s*)+)/gs, '<ul class="bullet-list">$1</ul>');
  formatted = formatted.replace(/\n\n+/g, '</p><p>');
  formatted = formatted.replace(/\n/g, '<br>');
  if (formatted.trim()) formatted = '<p>' + formatted + '</p>';
  formatted = formatted.replace(/<p>\s*<\/p>/g, '');
  return formatted;
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
