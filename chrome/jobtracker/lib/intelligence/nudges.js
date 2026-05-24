/**
 * JobTracker Nudges Module
 * Produces per-application actionable nudges by joining applications,
 * interviews, tasks, and settings. Pure functions — no I/O.
 */

import { getDaysSince } from './utils.js';

// Priority constants — higher fires first in the Today panel.
const P = {
  INTERVIEW_IMMINENT: 100,
  DEADLINE_TODAY: 95,
  DEADLINE_SOON: 80,
  TASK_OVERDUE: 75,
  TASK_DUE_TODAY: 70,
  TASK_UPCOMING: 50,
  STALE_SCREENING: 45,
  STALE_APPLIED: 40,
  WEEKLY_VOLUME_OFF_PACE: 30,
  INACTIVITY: 20
};

const MS_DAY = 24 * 60 * 60 * 1000;

function ymd(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoWeekBucket(date) {
  // Year + ISO-ish week key for weekly-volume nudge stability.
  const d = new Date(date);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / MS_DAY + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function lastTouchDate(app) {
  const candidates = [];
  if (app.statusHistory?.length) {
    const last = app.statusHistory[app.statusHistory.length - 1];
    if (last?.date) candidates.push(new Date(last.date));
  }
  if (app.lastContacted) candidates.push(new Date(app.lastContacted));
  if (app.dateApplied) candidates.push(new Date(app.dateApplied));
  if (app.meta?.updatedAt) candidates.push(new Date(app.meta.updatedAt));
  if (app.meta?.createdAt) candidates.push(new Date(app.meta.createdAt));
  const valid = candidates.filter(d => !isNaN(d.getTime()));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map(d => d.getTime())));
}

function appLabel(app) {
  const co = app.company || 'Unknown company';
  const pos = app.position ? ` — ${app.position}` : '';
  return `${co}${pos}`;
}

function applyAcks(nudges, acknowledgements, now) {
  if (!acknowledgements || !acknowledgements.size) return nudges;
  return nudges.filter(n => {
    const ack = acknowledgements.get(n.id);
    if (!ack) return true;
    if (ack.state === 'dismissed' || ack.state === 'completed') return false;
    if (ack.state === 'snoozed') {
      if (!ack.until) return false;
      return new Date(ack.until).getTime() <= now.getTime();
    }
    return true;
  });
}

function interviewNudges({ applications, interviews, now }) {
  const out = [];
  const appsById = new Map(applications.map(a => [a.id, a]));
  for (const iv of interviews) {
    const outcome = (iv.outcome || '').toLowerCase();
    if (outcome && outcome !== 'pending') continue;
    if (!iv.scheduledDate) continue;
    const when = new Date(iv.scheduledDate);
    if (isNaN(when.getTime())) continue;
    const deltaMs = when.getTime() - now.getTime();
    if (deltaMs < -30 * 60 * 1000) continue;     // older than 30 min ago, ignore
    if (deltaMs > 3 * MS_DAY) continue;          // beyond 3 days, ignore
    const app = appsById.get(iv.applicationId);
    const hours = Math.round(deltaMs / (60 * 60 * 1000));
    const whenLabel =
      deltaMs < 0 ? 'in progress' :
      hours <= 1 ? 'within the hour' :
      hours <= 24 ? `in ${hours}h` :
      `on ${when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
    out.push({
      id: `interview_imminent:${iv.id}:${ymd(when)}`,
      priority: P.INTERVIEW_IMMINENT - Math.min(20, Math.max(0, hours)),
      kind: 'interview_imminent',
      applicationId: iv.applicationId || null,
      interviewId: iv.id,
      title: `Interview ${whenLabel}`,
      body: `${app ? appLabel(app) : 'Interview'} — ${iv.type || (iv.round ? `Round ${iv.round}` : 'Interview')} at ${when.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
      primaryAction: { type: 'open_interview', label: 'Open prep', interviewId: iv.id, applicationId: iv.applicationId },
      dueAt: when.toISOString(),
      expiresAt: new Date(when.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      notify: deltaMs >= 0 && deltaMs <= MS_DAY
    });
  }
  return out;
}

function deadlineNudges({ applications, now }) {
  const out = [];
  for (const app of applications) {
    if (!app.deadline) continue;
    if (['rejected', 'withdrawn', 'offer'].includes(app.status)) continue;
    const when = new Date(app.deadline);
    if (isNaN(when.getTime())) continue;
    const deltaMs = when.getTime() - now.getTime();
    if (deltaMs < 0) continue;
    if (deltaMs > 3 * MS_DAY) continue;
    const isToday = ymd(when) === ymd(now);
    out.push({
      id: `deadline_soon:${app.id}:${ymd(when)}`,
      priority: isToday ? P.DEADLINE_TODAY : P.DEADLINE_SOON,
      kind: 'deadline_soon',
      applicationId: app.id,
      title: isToday ? 'Deadline today' : `Deadline ${when.toLocaleDateString(undefined, { weekday: 'short' })}`,
      body: `${appLabel(app)} closes ${when.toLocaleDateString()}`,
      primaryAction: { type: 'open_application', label: 'Open', applicationId: app.id },
      dueAt: when.toISOString(),
      expiresAt: new Date(when.getTime() + MS_DAY).toISOString(),
      notify: isToday
    });
  }
  return out;
}

function taskNudges({ tasks, applications, now }) {
  const out = [];
  const appsById = new Map(applications.map(a => [a.id, a]));
  for (const t of tasks) {
    if (t.completed) continue;
    if (!t.dueDate && !t.reminderDate) continue;
    const dueRaw = t.dueDate || t.reminderDate;
    const when = new Date(dueRaw);
    if (isNaN(when.getTime())) continue;
    const deltaMs = when.getTime() - now.getTime();
    // Show: overdue (any), due today, or upcoming within 3 days.
    if (deltaMs > 3 * MS_DAY) continue;
    const overdue = deltaMs < -60 * 1000;
    const today = !overdue && ymd(when) === ymd(now);
    const app = t.applicationId ? appsById.get(t.applicationId) : null;
    const priority = overdue ? P.TASK_OVERDUE : (today ? P.TASK_DUE_TODAY : P.TASK_UPCOMING);
    const title = overdue
      ? `Task overdue: ${t.title}`
      : (today ? `Task due today: ${t.title}` : `Task due soon: ${t.title}`);
    out.push({
      id: `task_due:${t.id}:${ymd(when)}`,
      priority,
      kind: 'task_due',
      applicationId: t.applicationId || null,
      taskId: t.id,
      title,
      body: app ? appLabel(app) : (t.description || ''),
      primaryAction: { type: 'complete_task', label: 'Mark done', taskId: t.id },
      dueAt: when.toISOString(),
      expiresAt: new Date(when.getTime() + 7 * MS_DAY).toISOString(),
      notify: overdue || today
    });
  }
  return out;
}

function staleApplicationNudges({ applications, settings, now }) {
  const out = [];
  const followUpDays = Math.max(1, settings?.nudges?.followUpThresholdDays ?? 7);
  const cutoff = new Date(now.getTime() - followUpDays * MS_DAY);
  for (const app of applications) {
    if (app.status !== 'screening' && app.status !== 'applied') continue;
    const last = lastTouchDate(app);
    if (!last) continue;
    if (last > cutoff) continue;
    const days = getDaysSince(last);
    const isScreening = app.status === 'screening';
    out.push({
      id: `${isScreening ? 'stale_screening' : 'stale_applied'}:${app.id}:${isoWeekBucket(now)}`,
      priority: isScreening ? P.STALE_SCREENING : P.STALE_APPLIED,
      kind: isScreening ? 'stale_screening' : 'stale_applied',
      applicationId: app.id,
      title: isScreening ? 'Screening gone quiet' : 'No reply yet',
      body: `${appLabel(app)} — ${days} days since last update. Consider a follow-up.`,
      primaryAction: { type: 'open_application', label: 'Follow up', applicationId: app.id },
      dueAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3 * MS_DAY).toISOString(),
      notify: false
    });
  }
  return out;
}

function weeklyVolumeNudge({ applications, settings, now }) {
  const goals = settings?.goals;
  if (!goals?.weekly?.enabled || !goals.weekly.target || goals.weekly.target <= 0) return null;
  // ISO week start: Monday 00:00 local.
  const start = new Date(now);
  const day = start.getDay();
  const offsetToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - offsetToMonday);
  start.setHours(0, 0, 0, 0);
  const count = applications.filter(a => {
    const d = new Date(a.dateApplied || a.meta?.createdAt);
    return !isNaN(d.getTime()) && d >= start;
  }).length;
  const target = goals.weekly.target;
  if (count >= target) return null;
  const remaining = target - count;
  // Pace check: by end of (target days), should be on track. Trigger only mid-week onward.
  const dowMon0 = (now.getDay() + 6) % 7;
  if (dowMon0 < 2) return null; // before Wednesday, don't nag
  const expectedByNow = Math.ceil(target * ((dowMon0 + 1) / 7));
  if (count >= expectedByNow) return null;
  return {
    id: `weekly_volume_off_pace:${isoWeekBucket(now)}`,
    priority: P.WEEKLY_VOLUME_OFF_PACE,
    kind: 'weekly_volume_off_pace',
    applicationId: null,
    title: 'Behind on weekly goal',
    body: `${count}/${target} this week — ${remaining} to go to hit your target.`,
    primaryAction: { type: 'add_application', label: 'Add application' },
    dueAt: null,
    expiresAt: null,
    notify: false
  };
}

function inactivityNudge({ applications, settings, now }) {
  if (applications.length === 0) {
    return {
      id: `inactivity:empty:${isoWeekBucket(now)}`,
      priority: P.INACTIVITY,
      kind: 'inactivity',
      applicationId: null,
      title: 'Start your job search',
      body: 'Add your first application to begin tracking your progress.',
      primaryAction: { type: 'add_application', label: 'Add application' },
      dueAt: null,
      expiresAt: null,
      notify: false
    };
  }
  const threshold = Math.max(1, settings?.nudges?.inactivityThresholdDays ?? 3);
  let mostRecent = null;
  for (const a of applications) {
    const d = new Date(a.dateApplied || a.meta?.createdAt);
    if (isNaN(d.getTime())) continue;
    if (!mostRecent || d > mostRecent) mostRecent = d;
  }
  if (!mostRecent) return null;
  const days = getDaysSince(mostRecent);
  if (days < threshold) return null;
  return {
    id: `inactivity:${isoWeekBucket(now)}`,
    priority: P.INACTIVITY,
    kind: 'inactivity',
    applicationId: null,
    title: 'Keep the momentum',
    body: `It's been ${days} days since your last application.`,
    primaryAction: { type: 'add_application', label: 'Add application' },
    dueAt: null,
    expiresAt: null,
    notify: false
  };
}

/**
 * Build prioritized nudges. Pure of I/O — pass everything in.
 *
 * @param {Object} args
 * @param {Array} args.applications  - All applications
 * @param {Array} args.interviews    - All interviews
 * @param {Array} args.tasks         - All tasks
 * @param {Object} args.settings     - User settings (reads settings.nudges, settings.goals)
 * @param {Map} [args.acknowledgements] - Map<nudgeId, {state, until}>
 * @param {Date} [args.now]          - Override "now" for testability
 * @param {number} [args.maxItems]   - Truncate to top-N by priority
 * @returns {Array} Prioritized nudge objects
 */
export function generateNudges({
  applications = [],
  interviews = [],
  tasks = [],
  settings = {},
  acknowledgements = new Map(),
  now = new Date(),
  maxItems = null
} = {}) {
  if (settings?.nudges && settings.nudges.enabled === false) return [];

  const all = [
    ...interviewNudges({ applications, interviews, now }),
    ...deadlineNudges({ applications, now }),
    ...taskNudges({ tasks, applications, now }),
    ...staleApplicationNudges({ applications, settings, now })
  ];
  const weekly = weeklyVolumeNudge({ applications, settings, now });
  if (weekly) all.push(weekly);
  const inactivity = inactivityNudge({ applications, settings, now });
  if (inactivity) all.push(inactivity);

  // De-dup by id (defensive — IDs should already be unique).
  const seen = new Set();
  const deduped = all.filter(n => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  const live = applyAcks(deduped, acknowledgements, now);
  live.sort((a, b) => b.priority - a.priority);

  const limit = maxItems ?? settings?.nudges?.maxItemsShown ?? 7;
  return limit > 0 ? live.slice(0, limit) : live;
}

/**
 * Build a weekly summary (applied / interviews held / ghosted / goal status).
 * Pure of I/O.
 *
 * @param {Object} args
 * @param {Array} args.applications
 * @param {Array} args.interviews
 * @param {Object} args.goalProgress  - From JobTrackerDB.getGoalProgress
 * @param {Date} [args.now]
 * @returns {{appliedThisWeek:number, interviewsThisWeek:number, ghosted:number, goalHit:?boolean, goalTarget:?number, lines:string[]}}
 */
export function buildWeeklyDigest({ applications = [], interviews = [], goalProgress = null, now = new Date() } = {}) {
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const appliedThisWeek = applications.filter(a => {
    const d = new Date(a.dateApplied || a.meta?.createdAt);
    return !isNaN(d.getTime()) && d >= weekStart;
  }).length;

  const interviewsThisWeek = interviews.filter(iv => {
    if (!iv.scheduledDate) return false;
    const d = new Date(iv.scheduledDate);
    if (isNaN(d.getTime())) return false;
    return d >= weekStart && d <= now;
  }).length;

  const ghostedCutoff = new Date(now.getTime() - 12 * MS_DAY);
  const ghosted = applications.filter(a => {
    if (a.status !== 'applied' && a.status !== 'screening') return false;
    const last = lastTouchDate(a);
    return last && last < ghostedCutoff;
  }).length;

  const goalHit = goalProgress?.weekly?.enabled
    ? !!goalProgress.weekly.completed
    : null;
  const goalTarget = goalProgress?.weekly?.target ?? null;

  const lines = [
    `Applied: ${appliedThisWeek}${goalTarget ? ` / ${goalTarget}` : ''}`,
    `Interviews held: ${interviewsThisWeek}`,
    `Stale (12+ days): ${ghosted}`
  ];
  if (goalHit === true) lines.push('Weekly goal hit ✓');
  else if (goalHit === false) lines.push('Weekly goal not yet hit');

  return { appliedThisWeek, interviewsThisWeek, ghosted, goalHit, goalTarget, lines };
}
