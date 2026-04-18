/**
 * Dashboard Keyboard Module
 * Keyboard shortcuts and navigation
 */

import {
  elements, getFilteredApplications, getSelectedAppId, getApplications
} from './state.js';

// Event handler references for cleanup
let keyboardShortcutHandler = null;
let escapeKeyHandler = null;

// References to external functions (set during initialization)
let openModalCallback = null;
let selectAppCallback = null;
let closeModalWithConfirmCallback = null;
let closeDetailsPanelCallback = null;

export function setKeyboardCallbacks(callbacks) {
  openModalCallback = callbacks.openModal;
  selectAppCallback = callbacks.selectApp;
  closeModalWithConfirmCallback = callbacks.closeModalWithConfirm;
  closeDetailsPanelCallback = callbacks.closeDetailsPanel;
}

// Setup keyboard shortcuts
export function setupKeyboardShortcuts() {
  // Remove old handler if exists to prevent accumulation
  if (keyboardShortcutHandler) {
    document.removeEventListener('keydown', keyboardShortcutHandler);
  }

  keyboardShortcutHandler = (e) => {
    // Don't handle if in input/textarea (except for Escape)
    if (e.target.matches('input, textarea, select') && e.key !== 'Escape') return;

    // Skip if modal is open (except for Escape which is handled elsewhere)
    if (!elements.modal.classList.contains('hidden') && e.key !== 'Escape') return;

    // Skip J/K navigation if details panel is open on mobile (overlay mode)
    const isDetailsPanelOverlay = !elements.detailsPanel.classList.contains('hidden') && window.innerWidth < 1200;

    switch (e.key) {
      case 'n':
        // Require Ctrl/Cmd modifier to avoid conflicts with typing
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          openModalCallback?.();
        }
        break;
      case 'j':
        if (!isDetailsPanelOverlay) {
          e.preventDefault();
          navigateList(1);
        }
        break;
      case 'k':
        if (!isDetailsPanelOverlay) {
          e.preventDefault();
          navigateList(-1);
        }
        break;
      case 'Enter':
        if (getSelectedAppId() && !isDetailsPanelOverlay) {
          const applications = getApplications();
          const app = applications.find(a => a.id === getSelectedAppId());
          if (app) openModalCallback?.(app);
        }
        break;
      case '?':
        e.preventDefault();
        showKeyboardShortcutsHelp();
        break;
    }
  };

  document.addEventListener('keydown', keyboardShortcutHandler);
}

// Setup escape key handler
export function setupEscapeHandler() {
  // Remove old escape handler if exists, then add new one
  if (escapeKeyHandler) {
    document.removeEventListener('keydown', escapeKeyHandler);
  }
  escapeKeyHandler = (e) => {
    if (e.key === 'Escape') {
      if (!elements.modal.classList.contains('hidden')) closeModalWithConfirmCallback?.();
      else if (!elements.detailsPanel.classList.contains('hidden')) closeDetailsPanelCallback?.();
    }
  };
  document.addEventListener('keydown', escapeKeyHandler);
}

// Navigate list with keyboard
function navigateList(direction) {
  const filteredApplications = getFilteredApplications();
  const selectedAppId = getSelectedAppId();

  if (filteredApplications.length === 0) return;

  const currentIndex = selectedAppId
    ? filteredApplications.findIndex(a => a.id === selectedAppId)
    : -1;

  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= filteredApplications.length) newIndex = filteredApplications.length - 1;

  selectAppCallback?.(filteredApplications[newIndex].id);

  // Scroll into view
  const card = document.querySelector(`[data-id="${filteredApplications[newIndex].id}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Show keyboard shortcuts help modal
function showKeyboardShortcutsHelp() {
  // Check if help modal already exists
  let helpModal = document.getElementById('keyboard-help-modal');
  if (helpModal) {
    helpModal.classList.remove('hidden');
    helpModal.focus();
    return;
  }

  // Create help modal
  helpModal = document.createElement('div');
  helpModal.id = 'keyboard-help-modal';
  helpModal.className = 'modal';
  helpModal.setAttribute('role', 'dialog');
  helpModal.setAttribute('aria-modal', 'true');
  helpModal.setAttribute('aria-labelledby', 'keyboard-help-title');
  helpModal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3 id="keyboard-help-title">Keyboard Shortcuts</h3>
        <button class="close-btn" aria-label="Close help">&times;</button>
      </div>
      <div style="padding: var(--space-lg);">
        <dl style="margin: 0; display: grid; gap: var(--space-md);">
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Ctrl/Cmd + N</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">New application</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">J</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Next application</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">K</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Previous application</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Enter</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Open selected</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Esc</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Close modal/panel</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">?</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Show this help</dd>
          </div>
        </dl>
      </div>
    </div>
  `;

  document.body.appendChild(helpModal);

  // Event listeners
  const closeBtn = helpModal.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => helpModal.classList.add('hidden'));
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.add('hidden');
  });
  helpModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') helpModal.classList.add('hidden');
  });

  helpModal.focus();
}
