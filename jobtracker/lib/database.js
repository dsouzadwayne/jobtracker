/**
 * JobTracker IndexedDB Database Module
 * Provides a proper database for storing applications, profile, and settings
 */

// Valid application statuses
const APPLICATION_STATUSES = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];

const JobTrackerDB = {
  DB_NAME: 'JobTrackerDB',
  DB_VERSION: 4,
  db: null,
  loadingPromise: null,

  // Object store names
  STORES: {
    APPLICATIONS: 'applications',
    PROFILE: 'profile',
    SETTINGS: 'settings',
    META: 'meta',
    INTERVIEWS: 'interviews',
    TASKS: 'tasks',
    ACTIVITIES: 'activities',
    MODELS_METADATA: 'models_metadata',
    EXTRACTION_FEEDBACK: 'extraction_feedback'
  },

  /**
   * Initialize the database
   */
  async init() {
    if (this.db) return this.db;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.log('JobTracker: Failed to open database', request.error);
        this.loadingPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('JobTracker: Database initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Applications store with indexes
        if (!db.objectStoreNames.contains(this.STORES.APPLICATIONS)) {
          const appStore = db.createObjectStore(this.STORES.APPLICATIONS, { keyPath: 'id' });
          appStore.createIndex('company', 'company', { unique: false });
          appStore.createIndex('status', 'status', { unique: false });
          appStore.createIndex('dateApplied', 'dateApplied', { unique: false });
          appStore.createIndex('platform', 'platform', { unique: false });
          appStore.createIndex('deadline', 'deadline', { unique: false });
        } else if (oldVersion < 2) {
          // Add deadline index to existing applications store
          const transaction = event.target.transaction;
          const appStore = transaction.objectStore(this.STORES.APPLICATIONS);
          if (!appStore.indexNames.contains('deadline')) {
            appStore.createIndex('deadline', 'deadline', { unique: false });
          }
        }

        // Profile store (single record)
        if (!db.objectStoreNames.contains(this.STORES.PROFILE)) {
          db.createObjectStore(this.STORES.PROFILE, { keyPath: 'id' });
        }

        // Settings store (single record)
        if (!db.objectStoreNames.contains(this.STORES.SETTINGS)) {
          db.createObjectStore(this.STORES.SETTINGS, { keyPath: 'id' });
        }

        // Meta store for migration flags etc.
        if (!db.objectStoreNames.contains(this.STORES.META)) {
          db.createObjectStore(this.STORES.META, { keyPath: 'id' });
        }

        // Interviews store (CRM Enhancement - Phase B)
        if (!db.objectStoreNames.contains(this.STORES.INTERVIEWS)) {
          const interviewStore = db.createObjectStore(this.STORES.INTERVIEWS, { keyPath: 'id' });
          interviewStore.createIndex('applicationId', 'applicationId', { unique: false });
          interviewStore.createIndex('scheduledDate', 'scheduledDate', { unique: false });
          interviewStore.createIndex('outcome', 'outcome', { unique: false });
        }

        // Tasks store (CRM Enhancement - Phase C)
        if (!db.objectStoreNames.contains(this.STORES.TASKS)) {
          const taskStore = db.createObjectStore(this.STORES.TASKS, { keyPath: 'id' });
          taskStore.createIndex('applicationId', 'applicationId', { unique: false });
          taskStore.createIndex('dueDate', 'dueDate', { unique: false });
          taskStore.createIndex('completed', 'completed', { unique: false });
          taskStore.createIndex('reminderDate', 'reminderDate', { unique: false });
        }

        // Activities store (CRM Enhancement - Phase C)
        if (!db.objectStoreNames.contains(this.STORES.ACTIVITIES)) {
          const activityStore = db.createObjectStore(this.STORES.ACTIVITIES, { keyPath: 'id' });
          activityStore.createIndex('applicationId', 'applicationId', { unique: false });
          activityStore.createIndex('type', 'type', { unique: false });
          activityStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Models metadata store (for tracking AI model downloads)
        if (!db.objectStoreNames.contains(this.STORES.MODELS_METADATA)) {
          const modelsStore = db.createObjectStore(this.STORES.MODELS_METADATA, { keyPath: 'modelId' });
          modelsStore.createIndex('downloadStatus', 'downloadStatus', { unique: false });
          modelsStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }

        // Extraction feedback store (for tracking extraction corrections)
        if (!db.objectStoreNames.contains(this.STORES.EXTRACTION_FEEDBACK)) {
          const feedbackStore = db.createObjectStore(this.STORES.EXTRACTION_FEEDBACK, { keyPath: 'id' });
          feedbackStore.createIndex('applicationId', 'applicationId', { unique: false });
          feedbackStore.createIndex('domain', 'domain', { unique: false });
          feedbackStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        console.log('JobTracker: Database schema created/upgraded');
      };
    });

    return this.loadingPromise;
  },

  /**
   * Generate UUID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // ==================== APPLICATIONS ====================

  /**
   * Get all applications
   */
  async getAllApplications() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readonly');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by dateApplied descending (newest first)
        const apps = request.result.sort((a, b) => {
          const dateA = new Date(a.dateApplied || a.meta?.createdAt);
          const dateB = new Date(b.dateApplied || b.meta?.createdAt);
          return dateB - dateA;
        });
        resolve(apps);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get application by ID
   */
  async getApplication(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readonly');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Find duplicate application by URL or company+position
   */
  async findDuplicate(application) {
    const applications = await this.getAllApplications();

    // Normalize strings for comparison
    const normalize = (str) => (str || '').toLowerCase().trim();

    const newUrl = normalize(application.jobUrl);
    const newCompany = normalize(application.company);
    const newPosition = normalize(application.position);

    for (const app of applications) {
      // Check by job URL (most reliable)
      if (newUrl && normalize(app.jobUrl) === newUrl) {
        return app;
      }

      // Check by company + position combination
      if (newCompany && newPosition) {
        const existingCompany = normalize(app.company);
        const existingPosition = normalize(app.position);

        if (existingCompany === newCompany && existingPosition === newPosition) {
          return app;
        }
      }
    }

    return null;
  },

  /**
   * Add new application (with duplicate check)
   */
  async addApplication(application) {
    await this.init();

    // Check for duplicates first
    const duplicate = await this.findDuplicate(application);
    if (duplicate) {
      return {
        success: false,
        duplicate: true,
        existing: duplicate,
        message: `This job already exists: ${duplicate.position} at ${duplicate.company}`
      };
    }

    const app = {
      ...application,
      id: application.id || this.generateId(),
      // CRM Enhancement: Initialize tags and deadline
      tags: application.tags || [],
      deadline: application.deadline || null,
      deadlineAlert: application.deadlineAlert !== false,
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      },
      statusHistory: application.statusHistory || [{
        status: application.status || 'applied',
        date: new Date().toISOString(),
        notes: ''
      }]
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.add(app);

      request.onsuccess = () => {
        // Create initial activity entry (fire and forget - uses separate transaction)
        this.addActivity({
          applicationId: app.id,
          type: 'application_created',
          title: `Application added`,
          description: `Applied to ${app.position} at ${app.company}`,
          metadata: { status: app.status }
        }).catch(err => console.warn('JobTracker: Failed to add activity:', err));
        resolve({ success: true, application: app });
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Update existing application
   */
  async updateApplication(application) {
    await this.init();

    // Get existing app first
    const existing = await this.getApplication(application.id);
    if (!existing) {
      throw new Error('Application not found');
    }

    const oldStatus = existing.status;
    const updated = {
      ...existing,
      ...application,
      // Ensure tags is always an array
      tags: application.tags || existing.tags || [],
      meta: {
        ...existing.meta,
        updatedAt: new Date().toISOString()
      }
    };

    // Track status change (validate against allowed statuses)
    if (application.status && application.status !== oldStatus) {
      if (!APPLICATION_STATUSES.includes(application.status)) {
        throw new Error(`Invalid status: ${application.status}. Must be one of: ${APPLICATION_STATUSES.join(', ')}`);
      }
      updated.statusHistory = updated.statusHistory || [];
      updated.statusHistory.push({
        status: application.status,
        date: new Date().toISOString(),
        notes: application.statusNote || ''
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.put(updated);

      request.onsuccess = () => {
        // Create activity for status change (fire and forget - uses separate transaction)
        if (application.status && application.status !== oldStatus) {
          this.addActivity({
            applicationId: updated.id,
            type: 'status_change',
            title: `Status changed to ${application.status}`,
            description: application.statusNote || `Changed from ${oldStatus} to ${application.status}`,
            metadata: { oldStatus, newStatus: application.status }
          }).catch(err => console.warn('JobTracker: Failed to add activity:', err));
        }
        resolve({ success: true, application: updated });
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete application
   */
  async deleteApplication(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.delete(id);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get application statistics
   * @param {Object} options - Optional filtering options
   * @param {number|Object} options.dateRange - Date range filter (number of days or {start, end})
   */
  async getApplicationStats(options = {}) {
    let applications = await this.getAllApplications();

    // Apply date range filter if provided
    if (options.dateRange) {
      applications = this.filterByDateRange(applications, options.dateRange);
    }

    const stats = {
      total: applications.length,
      byStatus: {},
      byPlatform: {},
      weeklyTrend: [],
      thisWeek: 0,
      thisMonth: 0,
      interviewRate: 0,
      offerRate: 0,
      avgDaysToInterview: null,
      weekOverWeekChange: 0,
      // Phase 3 additions
      funnelData: null,
      dailyCounts: {},
      timeInStatus: null
    };

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Initialize weekly buckets for last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
      stats.weeklyTrend.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: 0
      });
    }

    applications.forEach(app => {
      // Skip null/undefined applications
      if (!app) return;

      // Status counts (default to 'applied' if missing)
      const status = app.status || 'applied';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Platform counts
      const platform = app.platform || 'other';
      stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;

      // Parse date with null checks
      const dateSource = app.dateApplied || app.meta?.createdAt;
      if (!dateSource) return; // Skip if no date available

      const appliedDate = new Date(dateSource);
      if (isNaN(appliedDate.getTime())) return; // Skip invalid dates

      if (appliedDate >= weekAgo) stats.thisWeek++;
      if (appliedDate >= monthAgo) stats.thisMonth++;

      // Weekly trend
      const weeksAgo = Math.floor((now - appliedDate) / (7 * 24 * 60 * 60 * 1000));
      if (weeksAgo >= 0 && weeksAgo <= 7) {
        stats.weeklyTrend[7 - weeksAgo].count++;
      }
    });

    // Calculate interview and offer rates
    if (stats.total > 0) {
      stats.interviewRate = Math.round(((stats.byStatus.interview || 0) / stats.total) * 100);
      stats.offerRate = Math.round(((stats.byStatus.offer || 0) / stats.total) * 100);
    }

    // Calculate week-over-week change from weeklyTrend
    const thisWeekCount = stats.weeklyTrend[7]?.count || 0;
    const lastWeekCount = stats.weeklyTrend[6]?.count || 0;
    stats.weekOverWeekChange = thisWeekCount - lastWeekCount;

    // Calculate average days to interview
    stats.avgDaysToInterview = this.calculateAvgDaysToInterview(applications);

    // Phase 3: Calculate funnel data
    stats.funnelData = this.calculateFunnelData(applications);

    // Phase 3: Calculate daily counts for heatmap
    stats.dailyCounts = this.calculateDailyCounts(applications);

    // Phase 3: Calculate time in status
    stats.timeInStatus = this.calculateTimeInStatus(applications);

    return stats;
  },

  /**
   * Calculate average days from application to interview
   */
  calculateAvgDaysToInterview(applications) {
    const daysArray = [];

    applications.forEach(app => {
      if (!app.statusHistory || app.statusHistory.length < 2) return;

      const appliedEntry = app.statusHistory.find(h => h.status === 'applied');
      const interviewEntry = app.statusHistory.find(h => h.status === 'interview');

      if (appliedEntry && interviewEntry) {
        const appliedDate = new Date(appliedEntry.date);
        const interviewDate = new Date(interviewEntry.date);
        const days = Math.floor((interviewDate - appliedDate) / (1000 * 60 * 60 * 24));
        if (days >= 0) daysArray.push(days);
      }
    });

    if (daysArray.length === 0) return null;
    return Math.round(daysArray.reduce((a, b) => a + b, 0) / daysArray.length);
  },

  /**
   * Calculate funnel data - count apps reaching each stage
   */
  calculateFunnelData(applications) {
    const funnel = {
      saved: 0,
      applied: 0,
      screening: 0,
      interview: 0,
      offer: 0,
      appliedToScreening: 0,
      screeningToInterview: 0,
      interviewToOffer: 0
    };

    // Status progression order (for determining "reached" status)
    const statusOrder = ['saved', 'applied', 'screening', 'interview', 'offer'];

    applications.forEach(app => {
      // Get highest status reached from statusHistory or current status
      let highestStatusIndex = 0;

      if (app.statusHistory && app.statusHistory.length > 0) {
        app.statusHistory.forEach(entry => {
          const idx = statusOrder.indexOf(entry.status);
          if (idx > highestStatusIndex) highestStatusIndex = idx;
        });
      } else {
        // Fall back to current status
        const idx = statusOrder.indexOf(app.status);
        if (idx >= 0) highestStatusIndex = idx;
      }

      // Count apps that reached each stage
      for (let i = 0; i <= highestStatusIndex; i++) {
        const status = statusOrder[i];
        if (funnel[status] !== undefined) {
          funnel[status]++;
        }
      }
    });

    // Calculate conversion rates
    if (funnel.applied > 0) {
      funnel.appliedToScreening = Math.round((funnel.screening / funnel.applied) * 100);
    }
    if (funnel.screening > 0) {
      funnel.screeningToInterview = Math.round((funnel.interview / funnel.screening) * 100);
    }
    if (funnel.interview > 0) {
      funnel.interviewToOffer = Math.round((funnel.offer / funnel.interview) * 100);
    }

    return funnel;
  },

  /**
   * Convert a date to a local date key string (YYYY-MM-DD)
   * This ensures consistent date keys regardless of timezone
   * @param {Date|string} dateValue - The date to convert
   * @param {boolean} useUTC - If true, use UTC methods; if false (default), use local time
   * @returns {string|null} - Date key in YYYY-MM-DD format or null if invalid
   */
  getLocalDateKey(dateValue, useUTC = false) {
    if (!dateValue) return null;

    // Parse the date value
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return null;

    // Use the appropriate methods based on useUTC flag
    // By default, use local time to match user's perspective
    const year = useUTC ? date.getUTCFullYear() : date.getFullYear();
    const month = String((useUTC ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
    const day = String(useUTC ? date.getUTCDate() : date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  },

  /**
   * Get the start of day in local timezone
   * @param {Date} date - The date
   * @returns {Date} - Date set to 00:00:00.000 in local timezone
   */
  getStartOfLocalDay(date = new Date()) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  },

  /**
   * Get the end of day in local timezone
   * @param {Date} date - The date
   * @returns {Date} - Date set to 23:59:59.999 in local timezone
   */
  getEndOfLocalDay(date = new Date()) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  },

  /**
   * Calculate daily counts for heatmap (last 365 days)
   * Note: Uses local timezone for date keys to match user's perspective
   * Dates are displayed relative to user's local timezone
   */
  calculateDailyCounts(applications, startDate = null, endDate = null) {
    const dailyCounts = {};
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    // Set end to end of today (local time) to include all applications dated "today"
    // This handles timezone differences when dates are stored as UTC midnight
    const end = endDate || this.getEndOfLocalDay(now);

    // Helper to extract date key - uses instance method for consistency
    const getDateKey = (dateValue) => this.getLocalDateKey(dateValue, false);

    applications.forEach(app => {
      const dateSource = app.dateApplied || app.meta?.createdAt;
      const dateKey = getDateKey(dateSource);
      if (!dateKey) return;

      // Check if date is within range
      const appDate = new Date(dateSource);
      if (appDate >= start && appDate <= end) {
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
      }
    });

    return dailyCounts;
  },

  /**
   * Calculate average time spent in each status
   */
  calculateTimeInStatus(applications) {
    const timeInStatus = {
      saved: null,
      applied: null,
      screening: null,
      interview: null
    };

    const daysAccumulator = {
      saved: [],
      applied: [],
      screening: [],
      interview: []
    };

    const statusOrder = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];

    applications.forEach(app => {
      if (!app.statusHistory || app.statusHistory.length < 2) return;

      // Sort status history by date
      const sortedHistory = [...app.statusHistory].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
      );

      for (let i = 0; i < sortedHistory.length - 1; i++) {
        const current = sortedHistory[i];
        const next = sortedHistory[i + 1];
        const status = current.status;

        if (daysAccumulator[status] !== undefined) {
          const days = Math.floor(
            (new Date(next.date) - new Date(current.date)) / (1000 * 60 * 60 * 24)
          );
          if (days >= 0) {
            daysAccumulator[status].push(days);
          }
        }
      }
    });

    // Calculate averages
    for (const status of Object.keys(timeInStatus)) {
      const days = daysAccumulator[status];
      if (days.length > 0) {
        timeInStatus[status] = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      }
    }

    return timeInStatus;
  },

  /**
   * Filter applications by date range
   */
  filterByDateRange(applications, dateRange) {
    if (!dateRange || dateRange === 'all') return applications;

    const now = new Date();
    let startDate;

    if (typeof dateRange === 'number') {
      // Preset: number of days
      startDate = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000);
    } else if (dateRange.start && dateRange.end) {
      // Custom range
      startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      return applications.filter(app => {
        const dateSource = app.dateApplied || app.meta?.createdAt;
        if (!dateSource) return false;
        const appDate = new Date(dateSource);
        if (isNaN(appDate.getTime())) return false;
        return appDate >= startDate && appDate <= endDate;
      });
    }

    if (!startDate) return applications;

    return applications.filter(app => {
      const dateSource = app.dateApplied || app.meta?.createdAt;
      if (!dateSource) return false;
      const appDate = new Date(dateSource);
      if (isNaN(appDate.getTime())) return false;
      return appDate >= startDate;
    });
  },

  // ==================== INTERVIEWS (CRM Phase B) ====================

  /**
   * Get all interviews
   */
  async getAllInterviews() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.INTERVIEWS], 'readonly');
      const store = transaction.objectStore(this.STORES.INTERVIEWS);
      const request = store.getAll();

      request.onsuccess = () => {
        const interviews = request.result.sort((a, b) => {
          const dateA = new Date(a.scheduledDate);
          const dateB = new Date(b.scheduledDate);
          return dateA - dateB;
        });
        resolve(interviews);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get interviews for a specific application
   */
  async getInterviewsByApplication(applicationId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.INTERVIEWS], 'readonly');
      const store = transaction.objectStore(this.STORES.INTERVIEWS);
      const index = store.index('applicationId');
      const request = index.getAll(applicationId);

      request.onsuccess = () => {
        const interviews = request.result.sort((a, b) => a.round - b.round);
        resolve(interviews);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get upcoming interviews (future scheduled dates)
   */
  async getUpcomingInterviews(limit = 10) {
    const interviews = await this.getAllInterviews();
    const now = new Date();
    return interviews
      .filter(i => new Date(i.scheduledDate) >= now && i.outcome === 'Pending')
      .slice(0, limit);
  },

  /**
   * Add interview
   */
  async addInterview(interview) {
    await this.init();

    const interviewData = {
      ...interview,
      id: interview.id || this.generateId(),
      outcome: interview.outcome || 'Pending',
      createdAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.INTERVIEWS], 'readwrite');
      const store = transaction.objectStore(this.STORES.INTERVIEWS);
      const request = store.add(interviewData);

      request.onsuccess = () => {
        // Also create an activity entry (fire and forget - uses separate transaction)
        this.addActivity({
          applicationId: interviewData.applicationId,
          type: 'interview_scheduled',
          title: `Interview scheduled: ${interviewData.type || 'Round ' + interviewData.round}`,
          description: `Scheduled for ${new Date(interviewData.scheduledDate).toLocaleDateString()}`,
          metadata: { interviewId: interviewData.id }
        }).catch(err => console.warn('JobTracker: Failed to add activity:', err));
        resolve({ success: true, interview: interviewData });
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Update interview
   */
  async updateInterview(interview) {
    await this.init();

    const existing = await this.getInterview(interview.id);
    if (!existing) {
      throw new Error('Interview not found');
    }

    const updated = {
      ...existing,
      ...interview,
      updatedAt: new Date().toISOString()
    };

    // Check if outcome changed
    const outcomeChanged = existing.outcome !== updated.outcome;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.INTERVIEWS], 'readwrite');
      const store = transaction.objectStore(this.STORES.INTERVIEWS);
      const request = store.put(updated);

      request.onsuccess = () => {
        if (outcomeChanged) {
          this.addActivity({
            applicationId: updated.applicationId,
            type: 'interview_outcome',
            title: `Interview outcome: ${updated.outcome}`,
            description: `${updated.type || 'Round ' + updated.round} - ${updated.outcome}`,
            metadata: { interviewId: updated.id, outcome: updated.outcome }
          }).catch(err => console.warn('JobTracker: Failed to add activity:', err));
        }
        resolve({ success: true, interview: updated });
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get single interview
   */
  async getInterview(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.INTERVIEWS], 'readonly');
      const store = transaction.objectStore(this.STORES.INTERVIEWS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete interview
   */
  async deleteInterview(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.INTERVIEWS], 'readwrite');
      const store = transaction.objectStore(this.STORES.INTERVIEWS);
      const request = store.delete(id);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== TASKS (CRM Phase C) ====================

  /**
   * Get all tasks
   */
  async getAllTasks() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.TASKS], 'readonly');
      const store = transaction.objectStore(this.STORES.TASKS);
      const request = store.getAll();

      request.onsuccess = () => {
        const tasks = request.result.sort((a, b) => {
          const dateA = new Date(a.dueDate || '9999-12-31');
          const dateB = new Date(b.dueDate || '9999-12-31');
          return dateA - dateB;
        });
        resolve(tasks);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get tasks for a specific application
   */
  async getTasksByApplication(applicationId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.TASKS], 'readonly');
      const store = transaction.objectStore(this.STORES.TASKS);
      const index = store.index('applicationId');
      const request = index.getAll(applicationId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get upcoming/overdue tasks
   */
  async getUpcomingTasks(limit = 10) {
    const tasks = await this.getAllTasks();
    return tasks
      .filter(t => !t.completed)
      .slice(0, limit);
  },

  /**
   * Get tasks due for reminder
   */
  async getTasksForReminder() {
    const tasks = await this.getAllTasks();
    const now = new Date();
    return tasks.filter(t => {
      if (t.completed) return false;
      if (!t.reminderDate) return false;
      const reminderDate = new Date(t.reminderDate);
      return reminderDate <= now;
    });
  },

  /**
   * Add task
   */
  async addTask(task) {
    await this.init();

    const taskData = {
      ...task,
      id: task.id || this.generateId(),
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.TASKS], 'readwrite');
      const store = transaction.objectStore(this.STORES.TASKS);
      const request = store.add(taskData);

      request.onsuccess = () => {
        // Create activity if linked to application (fire and forget - uses separate transaction)
        if (taskData.applicationId) {
          this.addActivity({
            applicationId: taskData.applicationId,
            type: 'task_created',
            title: `Task created: ${taskData.title}`,
            description: taskData.dueDate ? `Due: ${new Date(taskData.dueDate).toLocaleDateString()}` : '',
            metadata: { taskId: taskData.id }
          }).catch(err => console.warn('JobTracker: Failed to add activity:', err));
        }
        resolve({ success: true, task: taskData });
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Update task
   */
  async updateTask(task) {
    await this.init();

    const existing = await this.getTask(task.id);
    if (!existing) {
      throw new Error('Task not found');
    }

    const wasCompleted = existing.completed;
    const updated = {
      ...existing,
      ...task,
      updatedAt: new Date().toISOString()
    };

    // If task just completed, set completedAt
    if (task.completed && !wasCompleted) {
      updated.completedAt = new Date().toISOString();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.TASKS], 'readwrite');
      const store = transaction.objectStore(this.STORES.TASKS);
      const request = store.put(updated);

      request.onsuccess = () => {
        if (task.completed && !wasCompleted && updated.applicationId) {
          this.addActivity({
            applicationId: updated.applicationId,
            type: 'task_completed',
            title: `Task completed: ${updated.title}`,
            description: '',
            metadata: { taskId: updated.id }
          }).catch(err => console.warn('JobTracker: Failed to add activity:', err));
        }
        resolve({ success: true, task: updated });
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get single task
   */
  async getTask(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.TASKS], 'readonly');
      const store = transaction.objectStore(this.STORES.TASKS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete task
   */
  async deleteTask(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.TASKS], 'readwrite');
      const store = transaction.objectStore(this.STORES.TASKS);
      const request = store.delete(id);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== ACTIVITIES (CRM Phase C) ====================

  /**
   * Get all activities
   */
  async getAllActivities() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.ACTIVITIES], 'readonly');
      const store = transaction.objectStore(this.STORES.ACTIVITIES);
      const request = store.getAll();

      request.onsuccess = () => {
        const activities = request.result.sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        resolve(activities);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get activities for a specific application
   */
  async getActivitiesByApplication(applicationId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.ACTIVITIES], 'readonly');
      const store = transaction.objectStore(this.STORES.ACTIVITIES);
      const index = store.index('applicationId');
      const request = index.getAll(applicationId);

      request.onsuccess = () => {
        const activities = request.result.sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        resolve(activities);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Add activity
   */
  async addActivity(activity) {
    await this.init();

    const activityData = {
      ...activity,
      id: activity.id || this.generateId(),
      timestamp: activity.timestamp || new Date().toISOString(),
      metadata: activity.metadata || {}
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.ACTIVITIES], 'readwrite');
      const store = transaction.objectStore(this.STORES.ACTIVITIES);
      const request = store.add(activityData);

      request.onsuccess = () => resolve({ success: true, activity: activityData });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete activity
   */
  async deleteActivity(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.ACTIVITIES], 'readwrite');
      const store = transaction.objectStore(this.STORES.ACTIVITIES);
      const request = store.delete(id);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== CRM HELPERS ====================

  /**
   * Get applications with deadlines expiring soon (within days)
   */
  async getExpiringApplications(days = 3) {
    const applications = await this.getAllApplications();
    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return applications.filter(app => {
      if (!app.deadline) return false;
      const deadline = new Date(app.deadline);
      return deadline >= now && deadline <= threshold;
    });
  },

  /**
   * Get all unique tags from applications
   */
  async getAllTags() {
    const applications = await this.getAllApplications();
    const tagSet = new Set();
    applications.forEach(app => {
      if (app.tags && Array.isArray(app.tags)) {
        app.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  },

  // ==================== PROFILE ====================

  /**
   * Get profile
   */
  async getProfile() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.PROFILE], 'readonly');
      const store = transaction.objectStore(this.STORES.PROFILE);
      const request = store.get('main');

      request.onsuccess = () => resolve(request.result || this.getDefaultProfile());
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save profile
   */
  async saveProfile(profile) {
    await this.init();
    const data = {
      ...profile,
      id: 'main',
      meta: {
        ...profile.meta,
        updatedAt: new Date().toISOString()
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.PROFILE], 'readwrite');
      const store = transaction.objectStore(this.STORES.PROFILE);
      const request = store.put(data);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get default profile structure
   */
  getDefaultProfile() {
    return {
      id: 'main',
      personal: {
        firstName: '', middleName: '', lastName: '', email: '', phone: '',
        address: { street: '', city: '', state: '', zipCode: '', country: '' },
        linkedIn: '', github: '', portfolio: '', website: ''
      },
      workHistory: [],
      education: [],
      skills: { languages: [], frameworks: [], tools: [], soft: [], other: [] },
      certifications: [],
      links: [],
      customQA: [],
      coverLetters: [],
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 }
    };
  },

  // ==================== SETTINGS ====================

  /**
   * Get settings
   */
  async getSettings() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(this.STORES.SETTINGS);
      const request = store.get('main');

      request.onsuccess = () => resolve({ ...this.getDefaultSettings(), ...request.result });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save settings
   */
  async saveSettings(settings) {
    await this.init();
    const data = {
      ...settings,
      id: 'main'
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(this.STORES.SETTINGS);
      const request = store.put(data);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get default settings structure
   */
  getDefaultSettings() {
    return {
      id: 'main',
      autofill: { enabled: true, showFloatingButton: true, autoDetectForms: true, confirmBeforeFill: false, delay: 0 },
      detection: {
        autoTrackSubmissions: true, notifyOnDetection: true,
        enabledPlatforms: ['linkedin', 'indeed', 'glassdoor', 'workday', 'greenhouse', 'lever', 'icims', 'smartrecruiters', 'naukri'],
        enableGenericDetection: true
      },
      ui: { theme: 'system', floatingButtonPosition: 'bottom-right', dashboardView: 'cards' },
      data: { autoBackup: false, backupInterval: 7 },
      customFieldRules: [],
      goals: {
        weekly: { target: 0, enabled: false },
        monthly: { target: 0, enabled: false },
        updatedAt: null
      },
      ai: {
        enabled: false,           // Disabled by default - user must opt-in
        autoSuggestTags: true,    // When AI enabled, auto-suggest tags
        enhanceResumeParsing: true // When AI enabled, enhance resume parsing
      }
    };
  },

  // ==================== MIGRATION ====================

  /**
   * Check if migration is needed and perform it
   */
  async migrateFromChromeStorage() {
    await this.init();

    // Check if already migrated
    const meta = await this.getMeta('migration');
    if (meta?.completed) {
      console.log('JobTracker: Migration already completed');
      return false;
    }

    // Check if Chrome storage has data
    const chromeData = await new Promise(resolve => {
      chrome.storage.local.get(['jobtracker_profile', 'jobtracker_applications', 'jobtracker_settings'], resolve);
    });

    const hasData = chromeData.jobtracker_profile ||
                    chromeData.jobtracker_applications?.length > 0 ||
                    chromeData.jobtracker_settings;

    if (!hasData) {
      console.log('JobTracker: No Chrome storage data to migrate');
      await this.setMeta('migration', { completed: true, date: new Date().toISOString(), hadData: false });
      return false;
    }

    console.log('JobTracker: Starting migration from Chrome storage...');

    try {
      // Migrate profile
      if (chromeData.jobtracker_profile) {
        await this.saveProfile(chromeData.jobtracker_profile);
        console.log('JobTracker: Profile migrated');
      }

      // Migrate applications
      if (chromeData.jobtracker_applications?.length > 0) {
        for (const app of chromeData.jobtracker_applications) {
          await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
            const store = transaction.objectStore(this.STORES.APPLICATIONS);
            const request = store.put(app);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
        console.log(`JobTracker: ${chromeData.jobtracker_applications.length} applications migrated`);
      }

      // Migrate settings
      if (chromeData.jobtracker_settings) {
        await this.saveSettings(chromeData.jobtracker_settings);
        console.log('JobTracker: Settings migrated');

        // Also migrate theme to the new UI prefs key (separate from settings to avoid conflicts)
        if (chromeData.jobtracker_settings.ui?.theme) {
          await new Promise(resolve => {
            chrome.storage.local.set({
              'jobtracker_ui_prefs': { theme: chromeData.jobtracker_settings.ui.theme }
            }, resolve);
          });
          console.log('JobTracker: Theme preference migrated to jobtracker_ui_prefs');
        }
      }

      // Mark migration as complete
      await this.setMeta('migration', {
        completed: true,
        date: new Date().toISOString(),
        hadData: true,
        applicationCount: chromeData.jobtracker_applications?.length || 0
      });

      // Clear Chrome storage after successful migration (but keep jobtracker_ui_prefs)
      await new Promise(resolve => {
        chrome.storage.local.remove(['jobtracker_profile', 'jobtracker_applications', 'jobtracker_settings'], resolve);
      });

      console.log('JobTracker: Migration completed successfully');
      return true;
    } catch (error) {
      console.log('JobTracker: Migration failed', error);
      throw error;
    }
  },

  /**
   * Get meta value
   */
  async getMeta(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.META], 'readonly');
      const store = transaction.objectStore(this.STORES.META);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Set meta value
   */
  async setMeta(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.META], 'readwrite');
      const store = transaction.objectStore(this.STORES.META);
      const request = store.put({ id: key, ...value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== EXPORT/IMPORT ====================

  /**
   * Export all data
   */
  async exportAllData() {
    const [profile, applications, settings] = await Promise.all([
      this.getProfile(),
      this.getAllApplications(),
      this.getSettings()
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      applications,
      settings
    };
  },

  /**
   * Validate import data structure
   * @param {Object} data - Data to validate
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateImportData(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Import data must be an object'] };
    }

    // Validate applications array if present
    if (data.applications !== undefined) {
      if (!Array.isArray(data.applications)) {
        errors.push('applications must be an array');
      } else {
        data.applications.forEach((app, index) => {
          if (!app || typeof app !== 'object') {
            errors.push(`applications[${index}] must be an object`);
          } else {
            if (!app.id || typeof app.id !== 'string') {
              errors.push(`applications[${index}].id must be a non-empty string`);
            }
            // At least company or position should exist
            if (!app.company && !app.position) {
              errors.push(`applications[${index}] must have company or position`);
            }
          }
        });
      }
    }

    // Validate profile if present
    if (data.profile !== undefined) {
      if (!data.profile || typeof data.profile !== 'object') {
        errors.push('profile must be an object');
      }
    }

    // Validate settings if present
    if (data.settings !== undefined) {
      if (!data.settings || typeof data.settings !== 'object') {
        errors.push('settings must be an object');
      }
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Import data
   */
  async importData(data, merge = false) {
    // Validate data structure before importing
    const validation = this.validateImportData(data);
    if (!validation.valid) {
      throw new Error(`Invalid import data: ${validation.errors.join(', ')}`);
    }

    if (merge) {
      // Merge logic
      if (data.applications) {
        const existingApps = await this.getAllApplications();
        const existingIds = new Set(existingApps.map(a => a.id));

        for (const app of data.applications) {
          if (!existingIds.has(app.id)) {
            await new Promise((resolve, reject) => {
              const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
              const store = transaction.objectStore(this.STORES.APPLICATIONS);
              const request = store.add(app);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          }
        }
      }

      if (data.profile) {
        const existingProfile = await this.getProfile();
        await this.saveProfile({ ...existingProfile, ...data.profile });
      }
    } else {
      // Replace all data
      if (data.profile) {
        await this.saveProfile(data.profile);
      }

      if (data.applications) {
        // Clear existing applications
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
          const store = transaction.objectStore(this.STORES.APPLICATIONS);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // Add new applications
        for (const app of data.applications) {
          await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
            const store = transaction.objectStore(this.STORES.APPLICATIONS);
            const request = store.add(app);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
      }

      if (data.settings) {
        await this.saveSettings(data.settings);
      }
    }

    return { success: true };
  },

  /**
   * Clear all data (for debugging/reset)
   */
  async clearAllData() {
    await this.init();

    const stores = [this.STORES.APPLICATIONS, this.STORES.PROFILE, this.STORES.SETTINGS, this.STORES.META];

    for (const storeName of stores) {
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    return { success: true };
  },

  // ==================== PHASE 4: INTELLIGENCE LAYER ====================

  /**
   * Get goal progress for weekly/monthly targets
   */
  async getGoalProgress() {
    const settings = await this.getSettings();
    const goals = settings.goals || this.getDefaultSettings().goals;
    const applications = await this.getAllApplications();

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count applications this week and month
    let weeklyCount = 0;
    let monthlyCount = 0;

    applications.forEach(app => {
      const appDate = new Date(app.dateApplied || app.meta?.createdAt);
      if (isNaN(appDate.getTime())) return;

      if (appDate >= weekStart) {
        weeklyCount++;
      }
      if (appDate >= monthStart) {
        monthlyCount++;
      }
    });

    return {
      weekly: {
        current: weeklyCount,
        target: goals.weekly.target,
        enabled: goals.weekly.enabled,
        percentage: goals.weekly.target > 0
          ? Math.min(100, Math.round((weeklyCount / goals.weekly.target) * 100))
          : 0,
        completed: goals.weekly.target > 0 && weeklyCount >= goals.weekly.target
      },
      monthly: {
        current: monthlyCount,
        target: goals.monthly.target,
        enabled: goals.monthly.enabled,
        percentage: goals.monthly.target > 0
          ? Math.min(100, Math.round((monthlyCount / goals.monthly.target) * 100))
          : 0,
        completed: goals.monthly.target > 0 && monthlyCount >= goals.monthly.target
      }
    };
  },

  /**
   * Save goal settings
   */
  async saveGoals(goals) {
    const settings = await this.getSettings();
    settings.goals = {
      ...settings.goals,
      ...goals,
      updatedAt: new Date().toISOString()
    };
    await this.saveSettings(settings);
    return { success: true };
  },

  /**
   * Get goals from settings
   */
  async getGoals() {
    const settings = await this.getSettings();
    return settings.goals || this.getDefaultSettings().goals;
  },

  // ==================== MODELS METADATA ====================

  /**
   * Get model metadata by ID
   */
  async getModelMetadata(modelId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.MODELS_METADATA], 'readonly');
      const store = transaction.objectStore(this.STORES.MODELS_METADATA);
      const request = store.get(modelId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Set model metadata
   */
  async setModelMetadata(modelId, metadata) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.MODELS_METADATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.MODELS_METADATA);
      const data = { modelId, ...metadata };
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all models download status
   */
  async getModelsDownloadStatus() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.MODELS_METADATA], 'readonly');
      const store = transaction.objectStore(this.STORES.MODELS_METADATA);
      const request = store.getAll();

      request.onsuccess = () => {
        const models = request.result || [];
        const status = {
          embeddings: models.find(m => m.modelId === 'embeddings') || { downloadStatus: 'not_started' },
          ner: models.find(m => m.modelId === 'ner') || { downloadStatus: 'not_started' }
        };
        resolve(status);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear models metadata
   */
  async clearModelsMetadata() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.MODELS_METADATA], 'readwrite');
      const store = transaction.objectStore(this.STORES.MODELS_METADATA);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('JobTracker: Models metadata cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== DATA CLEARING METHODS ====================

  /**
   * Delete profile
   */
  async deleteProfile() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.PROFILE], 'readwrite');
      const store = transaction.objectStore(this.STORES.PROFILE);
      const request = store.delete('main');

      request.onsuccess = () => {
        console.log('JobTracker: Profile deleted');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all applications
   */
  async clearAllApplications() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('JobTracker: All applications cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all interviews
   */
  async clearAllInterviews() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.INTERVIEWS], 'readwrite');
      const store = transaction.objectStore(this.STORES.INTERVIEWS);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('JobTracker: All interviews cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all tasks
   */
  async clearAllTasks() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.TASKS], 'readwrite');
      const store = transaction.objectStore(this.STORES.TASKS);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('JobTracker: All tasks cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all activities
   */
  async clearAllActivities() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.ACTIVITIES], 'readwrite');
      const store = transaction.objectStore(this.STORES.ACTIVITIES);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('JobTracker: All activities cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== EXTRACTION FEEDBACK ====================

  /**
   * Add extraction feedback (when user corrects extraction)
   * @param {Object} feedback - Feedback data with extracted, corrected, url, domain
   * @returns {Promise<Object>} Result with success status
   */
  async addExtractionFeedback(feedback) {
    await this.init();

    const data = {
      ...feedback,
      id: feedback.id || this.generateId(),
      timestamp: feedback.timestamp || new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.EXTRACTION_FEEDBACK], 'readwrite');
      const store = transaction.objectStore(this.STORES.EXTRACTION_FEEDBACK);
      const request = store.add(data);

      request.onsuccess = () => {
        console.log('JobTracker: Extraction feedback recorded');
        resolve({ success: true, feedback: data });
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get extraction feedback by domain
   * @param {string} domain - Domain to filter by
   * @returns {Promise<Array>} Array of feedback records
   */
  async getExtractionFeedbackByDomain(domain) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.EXTRACTION_FEEDBACK], 'readonly');
      const store = transaction.objectStore(this.STORES.EXTRACTION_FEEDBACK);
      const index = store.index('domain');
      const request = index.getAll(domain);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all extraction feedback
   * @returns {Promise<Array>} All feedback records
   */
  async getAllExtractionFeedback() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.EXTRACTION_FEEDBACK], 'readonly');
      const store = transaction.objectStore(this.STORES.EXTRACTION_FEEDBACK);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by timestamp descending
        const feedback = request.result.sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        resolve(feedback);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get extraction feedback statistics by domain
   * @returns {Promise<Object>} Stats grouped by domain
   */
  async getExtractionFeedbackStats() {
    const feedback = await this.getAllExtractionFeedback();

    const stats = {};
    for (const item of feedback) {
      const domain = item.domain || 'unknown';
      if (!stats[domain]) {
        stats[domain] = {
          total: 0,
          fields: {
            position: { corrected: 0 },
            company: { corrected: 0 },
            location: { corrected: 0 },
            salary: { corrected: 0 }
          }
        };
      }
      stats[domain].total++;

      // Count corrections per field
      if (item.corrections) {
        for (const field of ['position', 'company', 'location', 'salary']) {
          if (item.corrections[field]) {
            stats[domain].fields[field].corrected++;
          }
        }
      }
    }

    return stats;
  },

  /**
   * Clear all extraction feedback
   */
  async clearExtractionFeedback() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.EXTRACTION_FEEDBACK], 'readwrite');
      const store = transaction.objectStore(this.STORES.EXTRACTION_FEEDBACK);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('JobTracker: Extraction feedback cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
};

// Export for ES modules
export { JobTrackerDB };
