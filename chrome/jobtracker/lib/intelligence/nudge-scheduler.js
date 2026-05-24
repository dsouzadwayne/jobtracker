/**
 * Nudge Scheduler
 * Runs in the background service worker (or event page on Firefox).
 * Composes data from JobTrackerDB, calls the pure nudges module, and
 * fires browser notifications for time-critical items.
 *
 * Notification anti-spam: a per-nudge `lastNotifiedAt` is stored in the
 * nudge_state store (state: 'notified') so we don't ping more than once
 * per 24h for the same nudge.
 */

import { JobTrackerDB } from '../database.js';
import { generateNudges, buildWeeklyDigest } from './nudges.js';

const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function notify(title, message) {
  // Service workers don't have window — use chrome.notifications directly.
  // Firefox event pages have `browser` as the global; chrome.notifications
  // is polyfilled in both contexts via the existing browser-polyfill if loaded.
  const api = (typeof chrome !== 'undefined' && chrome.notifications)
    ? chrome.notifications
    : (typeof browser !== 'undefined' && browser.notifications)
      ? browser.notifications
      : null;
  if (!api) return;
  const runtimeApi = (typeof chrome !== 'undefined' && chrome.runtime)
    ? chrome.runtime
    : (typeof browser !== 'undefined' && browser.runtime)
      ? browser.runtime
      : null;
  const iconUrl = runtimeApi?.getURL ? runtimeApi.getURL('icons/icon-48.png') : 'icons/icon-48.png';
  try {
    api.create({
      type: 'basic',
      iconUrl,
      title,
      message
    });
  } catch (err) {
    console.log('JobTracker: notification failed', err?.message || err);
  }
}

async function loadAcknowledgementsMap() {
  const states = await JobTrackerDB.getNudgeStates();
  const map = new Map();
  for (const s of states) {
    map.set(s.id, { state: s.state, until: s.until, lastNotifiedAt: s.lastNotifiedAt });
  }
  return map;
}

/**
 * Compute current nudges and fire notifications for any with `notify: true`
 * that haven't been notified within the cooldown window.
 */
export async function runScheduledNudgeCheck() {
  const settings = await JobTrackerDB.getSettings();
  if (settings?.nudges?.enabled === false) return { fired: 0, total: 0 };
  if (settings?.nudges?.notificationsEnabled === false) return { fired: 0, total: 0 };

  const [applications, interviews, tasks, acknowledgements] = await Promise.all([
    JobTrackerDB.getAllApplications(),
    JobTrackerDB.getAllInterviews(),
    JobTrackerDB.getAllTasks(),
    loadAcknowledgementsMap()
  ]);

  const now = new Date();
  const nudges = generateNudges({
    applications, interviews, tasks, settings, acknowledgements, now,
    // Allow notifications to scan beyond the visible cap — use a larger window here.
    maxItems: 50
  });

  let fired = 0;
  for (const n of nudges) {
    if (!n.notify) continue;
    const ack = acknowledgements.get(n.id);
    const last = ack?.lastNotifiedAt ? new Date(ack.lastNotifiedAt).getTime() : 0;
    if (now.getTime() - last < NOTIFICATION_COOLDOWN_MS) continue;
    notify(n.title, n.body || '');
    try {
      // Firing consumes any prior snooze — store a clean 'notified' marker
      // with the cooldown timestamp. Dismissals are written by the UI path
      // and are independent of this code.
      await JobTrackerDB.setNudgeState(n.id, {
        state: 'notified',
        until: null,
        lastNotifiedAt: now.toISOString()
      });
    } catch (err) {
      console.log('JobTracker: failed to persist notify state', err?.message || err);
    }
    fired++;
  }

  // Best-effort housekeeping.
  try { await JobTrackerDB.pruneExpiredNudgeStates(); } catch {}

  return { fired, total: nudges.length };
}

/**
 * Build and fire the weekly digest notification.
 * Returns the computed digest so callers (e.g. "Send digest now" debug button)
 * can echo it.
 */
export async function runWeeklyDigest() {
  const settings = await JobTrackerDB.getSettings();
  if (settings?.nudges?.weeklyDigestEnabled === false) return null;
  if (settings?.nudges?.notificationsEnabled === false) return null;

  const [applications, interviews, goalProgress] = await Promise.all([
    JobTrackerDB.getAllApplications(),
    JobTrackerDB.getAllInterviews(),
    JobTrackerDB.getGoalProgress()
  ]);

  const digest = buildWeeklyDigest({ applications, interviews, goalProgress, now: new Date() });
  const message = digest.lines.join(' • ');
  notify('JobTracker — weekly summary', message);
  return digest;
}
