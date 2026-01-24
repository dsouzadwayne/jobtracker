/**
 * JobTracker Contacts Page
 * CRM Phase 2: Contact Management System
 */

import { JobTrackerDB, CONTACT_TYPES, CONTACT_SOURCES, COMMUNICATION_TYPES } from '../lib/database.js';

// State
let contacts = [];
let communications = [];
let applications = [];
let selectedContactId = null;
let filters = {
  search: '',
  type: '',
  source: ''
};

// DOM Elements
const elements = {
  contactsList: document.getElementById('contacts-list'),
  contactsCount: document.getElementById('contacts-count'),
  emptyState: document.getElementById('empty-state'),
  searchInput: document.getElementById('contact-search'),
  filterType: document.getElementById('filter-type'),
  filterSource: document.getElementById('filter-source'),
  addContactBtn: document.getElementById('add-contact-btn'),
  emptyAddBtn: document.getElementById('empty-add-btn'),

  // Contact Modal
  contactModal: document.getElementById('contact-modal'),
  contactForm: document.getElementById('contact-form'),
  contactModalTitle: document.getElementById('contact-modal-title'),
  closeContactModal: document.getElementById('close-contact-modal'),
  cancelContactBtn: document.getElementById('cancel-contact-btn'),
  deleteContactBtn: document.getElementById('delete-contact-btn'),

  // Communication Modal
  commModal: document.getElementById('comm-modal'),
  commForm: document.getElementById('comm-form'),
  closeCommModal: document.getElementById('close-comm-modal'),
  cancelCommBtn: document.getElementById('cancel-comm-btn'),
  commApplication: document.getElementById('comm-application'),

  // Detail Panel
  detailPanel: document.getElementById('contact-detail-panel'),
  panelContent: document.getElementById('panel-content'),
  closeDetailPanel: document.getElementById('close-detail-panel'),
  editContactBtn: document.getElementById('edit-contact-btn'),
  addCommBtn: document.getElementById('add-comm-btn'),

  // Mobile
  mobileMenuBtn: document.getElementById('mobile-menu-btn'),
  sidebar: document.getElementById('dashboard-sidebar'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  themeToggle: document.getElementById('theme-toggle')
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupTheme();
  setupMobileMenu();
  setupEventListeners();
  await loadData();
  render();
}

// Data Loading
async function loadData() {
  try {
    contacts = await JobTrackerDB.getAllContacts();
    communications = await JobTrackerDB.getAllCommunications();
    applications = await JobTrackerDB.getAllApplications();
    populateApplicationDropdown();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function populateApplicationDropdown() {
  const select = elements.commApplication;
  if (!select) return;

  const activeApps = applications.filter(app =>
    !['rejected', 'withdrawn'].includes(app.status)
  );

  select.innerHTML = '<option value="">No specific application</option>';
  activeApps.forEach(app => {
    const option = document.createElement('option');
    option.value = app.id;
    option.textContent = `${app.company} - ${app.position}`;
    select.appendChild(option);
  });
}

// Filtering
function getFilteredContacts() {
  return contacts.filter(contact => {
    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      const searchable = [
        contact.name,
        contact.email,
        contact.company,
        contact.title,
        ...(contact.tags || [])
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchable.includes(query)) return false;
    }

    // Type filter
    if (filters.type && contact.type !== filters.type) return false;

    // Source filter
    if (filters.source && contact.source !== filters.source) return false;

    return true;
  });
}

// Rendering
function render() {
  const filteredContacts = getFilteredContacts();

  elements.contactsCount.textContent = `${filteredContacts.length} contact${filteredContacts.length !== 1 ? 's' : ''}`;

  if (filteredContacts.length === 0) {
    elements.contactsList.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.contactsList.innerHTML = filteredContacts.map(contact => createContactCard(contact)).join('');
}

function createContactCard(contact) {
  const initial = (contact.name || 'U')[0].toUpperCase();
  const commsCount = communications.filter(c => c.contactId === contact.id).length;
  const linkedApps = applications.filter(app =>
    (app.contacts || []).includes(contact.id)
  ).length;

  const typeLabel = getTypeLabel(contact.type);
  const typeClass = `type-${contact.type || 'other'}`;

  return `
    <div class="contact-card" data-id="${escapeHtml(contact.id)}">
      <div class="contact-avatar">${initial}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(contact.name || 'Unknown')}</div>
        <div class="contact-title">${escapeHtml(contact.title || '')}${contact.company ? ` at ${escapeHtml(contact.company)}` : ''}</div>
        <div class="contact-meta">
          <span class="contact-type-badge ${typeClass}">${typeLabel}</span>
          ${commsCount > 0 ? `<span class="contact-comm-count">${commsCount} communication${commsCount !== 1 ? 's' : ''}</span>` : ''}
          ${linkedApps > 0 ? `<span class="contact-app-count">${linkedApps} application${linkedApps !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="contact-actions">
        ${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}" class="contact-action-btn" title="Send Email"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></a>` : ''}
        ${contact.linkedin ? `<a href="${escapeHtml(contact.linkedin)}" target="_blank" class="contact-action-btn" title="View LinkedIn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></a>` : ''}
      </div>
    </div>
  `;
}

function getTypeLabel(type) {
  const labels = {
    recruiter: 'Recruiter',
    hiring_manager: 'Hiring Manager',
    referral: 'Referral',
    networking: 'Networking',
    other: 'Other'
  };
  return labels[type] || 'Other';
}

function getSourceLabel(source) {
  const labels = {
    linkedin: 'LinkedIn',
    email: 'Email',
    referral: 'Referral',
    job_board: 'Job Board',
    event: 'Event',
    other: 'Other'
  };
  return labels[source] || 'Other';
}

function getCommTypeLabel(type) {
  const labels = {
    email: 'Email',
    call: 'Phone Call',
    linkedin: 'LinkedIn',
    meeting: 'Meeting',
    other: 'Other'
  };
  return labels[type] || 'Other';
}

// Detail Panel
function openDetailPanel(contactId) {
  selectedContactId = contactId;
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return;

  const contactComms = communications.filter(c => c.contactId === contactId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const linkedApps = applications.filter(app =>
    (app.contacts || []).includes(contactId)
  );

  elements.panelContent.innerHTML = `
    <div class="panel-profile">
      <div class="panel-avatar">${(contact.name || 'U')[0].toUpperCase()}</div>
      <h2 class="panel-name">${escapeHtml(contact.name || 'Unknown')}</h2>
      <p class="panel-title">${escapeHtml(contact.title || '')}${contact.company ? ` at ${escapeHtml(contact.company)}` : ''}</p>
      <span class="contact-type-badge type-${contact.type || 'other'}">${getTypeLabel(contact.type)}</span>
    </div>

    <div class="panel-details">
      ${contact.email ? `
        <div class="detail-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>
        </div>
      ` : ''}
      ${contact.phone ? `
        <div class="detail-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone)}</a>
        </div>
      ` : ''}
      ${contact.linkedin ? `
        <div class="detail-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
            <rect x="2" y="9" width="4" height="12"></rect>
            <circle cx="4" cy="4" r="2"></circle>
          </svg>
          <a href="${escapeHtml(contact.linkedin)}" target="_blank">LinkedIn Profile</a>
        </div>
      ` : ''}
      ${contact.agency ? `
        <div class="detail-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>${escapeHtml(contact.agency)}</span>
        </div>
      ` : ''}
      <div class="detail-row">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span>Source: ${getSourceLabel(contact.source)}</span>
      </div>
    </div>

    ${contact.tags && contact.tags.length > 0 ? `
      <div class="panel-tags">
        ${contact.tags.map(tag => `<span class="tag-chip-small">${escapeHtml(tag)}</span>`).join('')}
      </div>
    ` : ''}

    ${contact.notes ? `
      <div class="panel-section">
        <h4>Notes</h4>
        <p class="panel-notes">${escapeHtml(contact.notes)}</p>
      </div>
    ` : ''}

    ${linkedApps.length > 0 ? `
      <div class="panel-section">
        <h4>Related Applications (${linkedApps.length})</h4>
        <div class="panel-apps-list">
          ${linkedApps.map(app => `
            <a href="dashboard.html?app=${app.id}" class="panel-app-item">
              <span class="panel-app-company">${escapeHtml(app.company)}</span>
              <span class="panel-app-position">${escapeHtml(app.position)}</span>
              <span class="status-badge status-${app.status}">${capitalizeFirst(app.status)}</span>
            </a>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="panel-section">
      <div class="panel-section-header">
        <h4>Communication History (${contactComms.length})</h4>
        <button class="btn-sm btn-secondary" id="panel-add-comm-btn">+ Add</button>
      </div>
      ${contactComms.length > 0 ? `
        <div class="panel-comms-list">
          ${contactComms.map(comm => `
            <div class="comm-item">
              <div class="comm-icon comm-${comm.type}">
                ${getCommIcon(comm.type)}
              </div>
              <div class="comm-details">
                <div class="comm-header">
                  <span class="comm-type">${getCommTypeLabel(comm.type)}</span>
                  <span class="comm-direction comm-${comm.direction}">${comm.direction === 'inbound' ? 'Inbound' : 'Outbound'}</span>
                </div>
                ${comm.subject ? `<div class="comm-subject">${escapeHtml(comm.subject)}</div>` : ''}
                ${comm.notes ? `<div class="comm-notes">${escapeHtml(comm.notes)}</div>` : ''}
                <div class="comm-meta">
                  <span class="comm-date">${formatDate(comm.date)}</span>
                  ${comm.followUpDate ? `<span class="comm-followup">Follow-up: ${formatDate(comm.followUpDate)}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="panel-empty">No communications logged yet</div>
      `}
    </div>
  `;

  // Use onclick to avoid duplicate listeners when panel is reopened
  const panelAddCommBtn = document.getElementById('panel-add-comm-btn');
  if (panelAddCommBtn) {
    panelAddCommBtn.onclick = () => openCommModal(contactId);
  }

  elements.detailPanel.classList.remove('hidden');
}

function closeDetailPanel() {
  elements.detailPanel.classList.add('hidden');
  selectedContactId = null;
}

function getCommIcon(type) {
  const icons = {
    email: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    call: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    linkedin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>',
    meeting: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    other: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
  };
  return icons[type] || icons.other;
}

// Contact Modal
function openContactModal(contact = null) {
  const isEdit = !!contact;
  elements.contactModalTitle.textContent = isEdit ? 'Edit Contact' : 'Add Contact';
  elements.deleteContactBtn.classList.toggle('hidden', !isEdit);

  // Reset form
  elements.contactForm.reset();
  document.getElementById('contact-id').value = contact?.id || '';

  if (contact) {
    document.getElementById('contact-name').value = contact.name || '';
    document.getElementById('contact-email').value = contact.email || '';
    document.getElementById('contact-phone').value = contact.phone || '';
    document.getElementById('contact-company').value = contact.company || '';
    document.getElementById('contact-title').value = contact.title || '';
    document.getElementById('contact-linkedin').value = contact.linkedin || '';
    document.getElementById('contact-type').value = contact.type || 'other';
    document.getElementById('contact-source').value = contact.source || 'other';
    document.getElementById('contact-agency').value = contact.agency || '';
    document.getElementById('contact-tags').value = (contact.tags || []).join(', ');
    document.getElementById('contact-notes').value = contact.notes || '';
  }

  elements.contactModal.classList.remove('hidden');
  document.getElementById('contact-name').focus();
}

function closeContactModal() {
  elements.contactModal.classList.add('hidden');
}

async function handleContactSubmit(e) {
  e.preventDefault();

  // Validate required name field
  const name = document.getElementById('contact-name').value.trim();
  if (!name) {
    alert('Contact name is required');
    document.getElementById('contact-name').focus();
    return;
  }

  const id = document.getElementById('contact-id').value;
  const tagsInput = document.getElementById('contact-tags').value;
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

  const contactData = {
    name: document.getElementById('contact-name').value.trim(),
    email: document.getElementById('contact-email').value.trim(),
    phone: document.getElementById('contact-phone').value.trim(),
    company: document.getElementById('contact-company').value.trim(),
    title: document.getElementById('contact-title').value.trim(),
    linkedin: document.getElementById('contact-linkedin').value.trim(),
    type: document.getElementById('contact-type').value,
    source: document.getElementById('contact-source').value,
    agency: document.getElementById('contact-agency').value.trim() || null,
    tags,
    notes: document.getElementById('contact-notes').value.trim()
  };

  try {
    if (id) {
      contactData.id = id;
      await JobTrackerDB.updateContact(contactData);
    } else {
      await JobTrackerDB.addContact(contactData);
    }

    closeContactModal();
    await loadData();
    render();

    // Refresh detail panel if open
    if (selectedContactId === id) {
      openDetailPanel(id);
    }
  } catch (error) {
    console.error('Error saving contact:', error);
    alert('Failed to save contact. Please try again.');
  }
}

async function handleDeleteContact() {
  const id = document.getElementById('contact-id').value;
  if (!id) return;

  if (!confirm('Are you sure you want to delete this contact? This will also remove all associated communications.')) {
    return;
  }

  try {
    // Delete associated communications
    const contactComms = communications.filter(c => c.contactId === id);
    for (const comm of contactComms) {
      await JobTrackerDB.deleteCommunication(comm.id);
    }

    // Delete contact
    await JobTrackerDB.deleteContact(id);

    closeContactModal();
    closeDetailPanel();
    await loadData();
    render();
  } catch (error) {
    console.error('Error deleting contact:', error);
    alert('Failed to delete contact. Please try again.');
  }
}

// Communication Modal
function openCommModal(contactId) {
  document.getElementById('comm-contact-id').value = contactId;
  elements.commForm.reset();

  // Set default date to now
  const now = new Date();
  const dateInput = document.getElementById('comm-date');
  dateInput.value = now.toISOString().slice(0, 16);

  elements.commModal.classList.remove('hidden');
}

function closeCommModal() {
  elements.commModal.classList.add('hidden');
}

async function handleCommSubmit(e) {
  e.preventDefault();

  const contactId = document.getElementById('comm-contact-id').value;
  const applicationId = document.getElementById('comm-application').value || null;

  // Validate date
  const dateValue = document.getElementById('comm-date').value;
  const date = new Date(dateValue);
  if (!dateValue || isNaN(date.getTime())) {
    alert('Please enter a valid date');
    document.getElementById('comm-date').focus();
    return;
  }

  const commData = {
    contactId,
    applicationId,
    type: document.getElementById('comm-type').value,
    direction: document.getElementById('comm-direction').value,
    date: date.toISOString(),
    followUpDate: document.getElementById('comm-followup').value
      ? new Date(document.getElementById('comm-followup').value).toISOString()
      : null,
    subject: document.getElementById('comm-subject').value.trim(),
    notes: document.getElementById('comm-notes').value.trim()
  };

  try {
    await JobTrackerDB.addCommunication(commData);
    closeCommModal();
    await loadData();

    // Refresh detail panel
    if (selectedContactId === contactId) {
      openDetailPanel(contactId);
    }
  } catch (error) {
    console.error('Error saving communication:', error);
    alert('Failed to save communication. Please try again.');
  }
}

// Event Listeners
function setupEventListeners() {
  // Event delegation for contact card clicks (avoids memory leak from per-card listeners)
  elements.contactsList?.addEventListener('click', (e) => {
    const card = e.target.closest('.contact-card');
    if (card && !e.target.closest('.contact-action-btn')) {
      openDetailPanel(card.dataset.id);
    }
  });

  // Search and filters
  elements.searchInput?.addEventListener('input', (e) => {
    filters.search = e.target.value;
    render();
  });

  elements.filterType?.addEventListener('change', (e) => {
    filters.type = e.target.value;
    render();
  });

  elements.filterSource?.addEventListener('change', (e) => {
    filters.source = e.target.value;
    render();
  });

  // Add contact buttons
  elements.addContactBtn?.addEventListener('click', () => openContactModal());
  elements.emptyAddBtn?.addEventListener('click', () => openContactModal());

  // Contact modal
  elements.closeContactModal?.addEventListener('click', closeContactModal);
  elements.cancelContactBtn?.addEventListener('click', closeContactModal);
  elements.contactForm?.addEventListener('submit', handleContactSubmit);
  elements.deleteContactBtn?.addEventListener('click', handleDeleteContact);
  elements.contactModal?.addEventListener('click', (e) => {
    if (e.target === elements.contactModal) closeContactModal();
  });

  // Communication modal
  elements.closeCommModal?.addEventListener('click', closeCommModal);
  elements.cancelCommBtn?.addEventListener('click', closeCommModal);
  elements.commForm?.addEventListener('submit', handleCommSubmit);
  elements.commModal?.addEventListener('click', (e) => {
    if (e.target === elements.commModal) closeCommModal();
  });

  // Detail panel
  elements.closeDetailPanel?.addEventListener('click', closeDetailPanel);
  elements.editContactBtn?.addEventListener('click', () => {
    if (selectedContactId) {
      const contact = contacts.find(c => c.id === selectedContactId);
      openContactModal(contact);
    }
  });
  elements.addCommBtn?.addEventListener('click', () => {
    if (selectedContactId) {
      openCommModal(selectedContactId);
    }
  });

  // Escape key to close modals/panels
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!elements.contactModal.classList.contains('hidden')) {
        closeContactModal();
      } else if (!elements.commModal.classList.contains('hidden')) {
        closeCommModal();
      } else if (!elements.detailPanel.classList.contains('hidden')) {
        closeDetailPanel();
      }
    }
  });
}

// Theme
function setupTheme() {
  const savedTheme = localStorage.getItem('jobtracker-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  elements.themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('jobtracker-theme', newTheme);
  });
}

// Mobile Menu
function setupMobileMenu() {
  elements.mobileMenuBtn?.addEventListener('click', () => {
    elements.sidebar?.classList.toggle('open');
    elements.sidebarOverlay?.classList.toggle('hidden');
  });

  elements.sidebarOverlay?.addEventListener('click', () => {
    elements.sidebar?.classList.remove('open');
    elements.sidebarOverlay?.classList.add('hidden');
  });
}

// Utilities
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
