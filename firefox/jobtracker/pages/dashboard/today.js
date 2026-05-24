/**
 * Today Panel
 * Renders the prioritized list of nudges and wires their actions.
 */

import { elements, MessageTypes } from './state.js';
import { escapeHtml } from './utils.js';

// Callbacks injected by index.js so we don't tangle imports.
let callbacks = {
  selectApp: null,
  openModal: null,
  switchPage: null
};

export function setTodayCallbacks(cbs) {
  callbacks = { ...callbacks, ...cbs };
}

// Lightweight inline SVG icons. Matches the visual language used by
// the existing intelligence panel (Phosphor / Feather style).
const ICONS = {
  interview_imminent: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  deadline_soon:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  task_due:           '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
  stale_screening:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
  stale_applied:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
  weekly_volume_off_pace: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
  inactivity:         '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'
};

function iconFor(kind) {
  return ICONS[kind] || ICONS.inactivity;
}

function priorityClass(priority) {
  if (priority >= 75) return 'priority-high';
  if (priority >= 40) return 'priority-medium';
  return 'priority-low';
}

const MS_DAY = 24 * 60 * 60 * 1000;

function snoozeUntil(days) {
  return new Date(Date.now() + days * MS_DAY).toISOString();
}

// Guard so re-entering setupTodayPanel() doesn't stack document-level listeners.
let docListenerAttached = false;

export function setupTodayPanel() {
  const list = document.getElementById('today-list');
  if (!list) return;

  // Delegated click handler for actions, overflow menus, snooze, dismiss, and rows.
  list.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-today-action]');
    if (!target) {
      // Click on row body (not on a button) — open associated application detail.
      const row = e.target.closest('.today-item');
      if (row && row.dataset.applicationId) {
        callbacks.selectApp?.(row.dataset.applicationId);
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const action = target.dataset.todayAction;
    const row = target.closest('.today-item');
    const nudgeId = row?.dataset.nudgeId;

    switch (action) {
      case 'primary': {
        const primaryType = target.dataset.primaryType;
        const applicationId = target.dataset.applicationId;
        const taskId = target.dataset.taskId;
        if (primaryType === 'add_application') {
          callbacks.openModal?.();
        } else if (primaryType === 'open_application' && applicationId) {
          callbacks.selectApp?.(applicationId);
        } else if (primaryType === 'open_interview' && applicationId) {
          callbacks.selectApp?.(applicationId);
        } else if (primaryType === 'complete_task' && taskId) {
          try {
            await browser.runtime.sendMessage({
              type: MessageTypes.UPDATE_TASK,
              payload: { id: taskId, completed: true }
            });
            if (nudgeId) {
              await browser.runtime.sendMessage({
                type: MessageTypes.SET_NUDGE_STATE,
                payload: { id: nudgeId, state: 'completed' }
              });
            }
            await loadTodayPanel();
          } catch (err) {
            console.log('JobTracker: failed to complete task', err?.message || err);
          }
        }
        break;
      }
      case 'toggle-overflow': {
        const overflow = target.parentElement;
        // Close any other open overflow menus first
        document.querySelectorAll('.today-overflow.open').forEach(el => {
          if (el !== overflow) el.classList.remove('open');
        });
        overflow?.classList.toggle('open');
        break;
      }
      case 'snooze': {
        const days = parseInt(target.dataset.days, 10) || 1;
        if (!nudgeId) return;
        try {
          await browser.runtime.sendMessage({
            type: MessageTypes.SET_NUDGE_STATE,
            payload: { id: nudgeId, state: 'snoozed', until: snoozeUntil(days) }
          });
          await loadTodayPanel();
        } catch (err) {
          console.log('JobTracker: snooze failed', err?.message || err);
        }
        break;
      }
      case 'dismiss': {
        if (!nudgeId) return;
        try {
          await browser.runtime.sendMessage({
            type: MessageTypes.SET_NUDGE_STATE,
            payload: { id: nudgeId, state: 'dismissed' }
          });
          await loadTodayPanel();
        } catch (err) {
          console.log('JobTracker: dismiss failed', err?.message || err);
        }
        break;
      }
    }
  });

  // Close overflow menus when clicking outside. Guard against re-entry so we
  // never attach more than one document-level handler in the lifetime of the
  // dashboard tab.
  if (!docListenerAttached) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.today-overflow')) return;
      document.querySelectorAll('.today-overflow.open').forEach(el => el.classList.remove('open'));
    });
    docListenerAttached = true;
  }
}

export async function loadTodayPanel() {
  const panel = document.getElementById('today-panel');
  const list = document.getElementById('today-list');
  const badge = document.getElementById('today-count-badge');
  if (!panel || !list) return;

  let nudges = [];
  try {
    nudges = await browser.runtime.sendMessage({ type: MessageTypes.GET_NUDGES });
  } catch (err) {
    console.log('JobTracker: failed to load nudges', err?.message || err);
    nudges = [];
  }

  if (!Array.isArray(nudges) || nudges.length === 0) {
    panel.hidden = true;
    if (badge) badge.textContent = '0';
    list.innerHTML = '';
    return;
  }

  panel.hidden = false;
  if (badge) badge.textContent = String(nudges.length);

  list.innerHTML = nudges.map(n => renderRow(n)).join('');
}

function renderRow(n) {
  const cls = priorityClass(n.priority);
  const primary = n.primaryAction || {};
  const primaryLabel = escapeHtml(primary.label || 'Open');
  const dataAttrs = [
    `data-nudge-id="${escapeHtml(n.id)}"`,
    n.applicationId ? `data-application-id="${escapeHtml(n.applicationId)}"` : ''
  ].filter(Boolean).join(' ');

  const primaryAttrs = [
    'data-today-action="primary"',
    `data-primary-type="${escapeHtml(primary.type || '')}"`,
    primary.applicationId ? `data-application-id="${escapeHtml(primary.applicationId)}"` : '',
    primary.taskId ? `data-task-id="${escapeHtml(primary.taskId)}"` : '',
    primary.interviewId ? `data-interview-id="${escapeHtml(primary.interviewId)}"` : ''
  ].filter(Boolean).join(' ');

  return `
    <li class="today-item ${cls}" ${dataAttrs} role="listitem">
      <span class="today-item-icon" aria-hidden="true">${iconFor(n.kind)}</span>
      <div class="today-item-body">
        <div class="today-item-title">${escapeHtml(n.title || '')}</div>
        <div class="today-item-text">${escapeHtml(n.body || '')}</div>
      </div>
      <div class="today-item-actions">
        <button class="today-action-btn primary" ${primaryAttrs}>
          <span>${primaryLabel}</span>
        </button>
        <div class="today-overflow">
          <button class="today-overflow-btn" data-today-action="toggle-overflow" aria-label="More actions" aria-haspopup="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
          </button>
          <div class="today-overflow-menu" role="menu">
            <button class="today-overflow-item" data-today-action="snooze" data-days="1" role="menuitem">Snooze 1 day</button>
            <button class="today-overflow-item" data-today-action="snooze" data-days="3" role="menuitem">Snooze 3 days</button>
            <button class="today-overflow-item" data-today-action="snooze" data-days="7" role="menuitem">Snooze 1 week</button>
            <button class="today-overflow-item danger" data-today-action="dismiss" role="menuitem">Dismiss</button>
          </div>
        </div>
      </div>
    </li>
  `;
}
