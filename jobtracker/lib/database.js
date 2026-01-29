/**
 * JobTracker IndexedDB Database Module
 * Provides a proper database for storing applications, profile, and settings
 */

// ==================== CONFIGURATION CONSTANTS ====================

// Timeouts and intervals (in milliseconds)
const CONFIG = {
  MIGRATION_TIMEOUT_MS: 10000,      // 10 seconds for migration operations
  AI_REQUEST_TIMEOUT_MS: 120000,    // 2 minutes for AI requests
  STALE_REQUEST_CLEANUP_MS: 60000,  // 1 minute interval for cleanup

  // Date range presets (in days)
  DATE_RANGE_WEEK: 7,
  DATE_RANGE_MONTH: 30,
  DATE_RANGE_YEAR: 365,

  // Pagination defaults
  DEFAULT_UPCOMING_LIMIT: 10,
  DEFAULT_EXPIRING_DAYS: 3,
  DEFAULT_FOLLOWUP_DAYS: 7,

  // Application limits
  MAX_STRING_LENGTH: 50000,
  MAX_TAG_LENGTH: 100,
};

// Valid application statuses
const APPLICATION_STATUSES = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];

// Rejection reason options
const REJECTION_REASONS = [
  'no_response',        // Never heard back
  'rejected_resume',    // Rejected at resume screen
  'rejected_phone',     // Rejected after phone screen
  'rejected_interview', // Rejected after interview
  'position_filled',    // Position filled by another candidate
  'position_cancelled', // Position cancelled/closed
  'salary_mismatch',    // Salary expectations didn't match
  'withdrew',           // I withdrew my application
  'other'               // Other reason
];

// Priority levels
const PRIORITY_LEVELS = ['high', 'medium', 'low'];

// Contact types
const CONTACT_TYPES = ['recruiter', 'hiring_manager', 'referral', 'networking', 'other'];

// Contact sources
const CONTACT_SOURCES = ['linkedin', 'email', 'referral', 'job_board', 'event', 'other'];

// Communication types
const COMMUNICATION_TYPES = ['email', 'call', 'linkedin', 'meeting', 'other'];

const JobTrackerDB = {
  DB_NAME: 'JobTrackerDB',
  DB_VERSION: 7,
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
    EXTRACTION_FEEDBACK: 'extraction_feedback',
    CONTACTS: 'contacts',
    COMMUNICATIONS: 'communications',
    BASE_RESUME: 'baseResume',
    GENERATED_RESUMES: 'generatedResumes',
    UPLOADED_RESUMES: 'uploadedResumes'
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

      request.onblocked = () => {
        console.warn('JobTracker: Database upgrade blocked - close other tabs using this extension');
        this.loadingPromise = null;
        reject(new Error('Database upgrade blocked by other tabs. Please close other tabs and try again.'));
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

        // Contacts store (CRM Enhancement - Phase 2)
        if (!db.objectStoreNames.contains(this.STORES.CONTACTS)) {
          const contactStore = db.createObjectStore(this.STORES.CONTACTS, { keyPath: 'id' });
          contactStore.createIndex('company', 'company', { unique: false });
          contactStore.createIndex('type', 'type', { unique: false });
          contactStore.createIndex('email', 'email', { unique: false });
          contactStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Communications store (CRM Enhancement - Phase 2)
        if (!db.objectStoreNames.contains(this.STORES.COMMUNICATIONS)) {
          const commStore = db.createObjectStore(this.STORES.COMMUNICATIONS, { keyPath: 'id' });
          commStore.createIndex('contactId', 'contactId', { unique: false });
          commStore.createIndex('applicationId', 'applicationId', { unique: false });
          commStore.createIndex('type', 'type', { unique: false });
          commStore.createIndex('date', 'date', { unique: false });
          commStore.createIndex('followUpDate', 'followUpDate', { unique: false });
        }

        // Add priority index to applications (CRM Enhancement - Phase 1)
        if (oldVersion < 5) {
          const appTransaction = event.target.transaction;
          const appStore = appTransaction.objectStore(this.STORES.APPLICATIONS);
          if (!appStore.indexNames.contains('priority')) {
            appStore.createIndex('priority', 'priority', { unique: false });
          }
          if (!appStore.indexNames.contains('lastContacted')) {
            appStore.createIndex('lastContacted', 'lastContacted', { unique: false });
          }
        }

        // Resume Maker stores (v6)
        if (!db.objectStoreNames.contains(this.STORES.BASE_RESUME)) {
          db.createObjectStore(this.STORES.BASE_RESUME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.STORES.GENERATED_RESUMES)) {
          const genResumeStore = db.createObjectStore(this.STORES.GENERATED_RESUMES, { keyPath: 'id' });
          genResumeStore.createIndex('createdAt', 'createdAt', { unique: false });
          genResumeStore.createIndex('jobTitle', 'jobDescription.title', { unique: false });
          genResumeStore.createIndex('company', 'jobDescription.company', { unique: false });
        }

        // Uploaded Resumes store (v7) - for linking PDFs to applications
        if (!db.objectStoreNames.contains(this.STORES.UPLOADED_RESUMES)) {
          const uploadedResumeStore = db.createObjectStore(this.STORES.UPLOADED_RESUMES, { keyPath: 'id' });
          uploadedResumeStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }

        console.log('JobTracker: Database schema created/upgraded');
      };
    });

    return this.loadingPromise;
  },

  /**
   * Generate cryptographically secure UUID v4
   */
  generateId() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    // Set version to 4 (0100xxxx)
    arr[6] = (arr[6] & 0x0f) | 0x40;
    // Set variant to RFC 4122 (10xxxxxx)
    arr[8] = (arr[8] & 0x3f) | 0x80;
    return [...arr].map((b, i) =>
      (i === 4 || i === 6 || i === 8 || i === 10 ? '-' : '') +
      b.toString(16).padStart(2, '0')
    ).join('');
  },

  /**
   * Helper: Check if an error is a QuotaExceededError
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isQuotaExceededError(error) {
    return error?.name === 'QuotaExceededError' ||
           error?.message?.includes('quota') ||
           error?.message?.includes('storage');
  },

  /**
   * Helper: Create a user-friendly error for quota exceeded
   * @returns {Error}
   */
  createQuotaExceededError() {
    const error = new Error('Storage quota exceeded. Please free up space by deleting old applications or clearing browser data.');
    error.name = 'QuotaExceededError';
    error.isQuotaExceeded = true;
    return error;
  },

  /**
   * Helper: Execute a write operation with proper transaction completion handling
   * Resolves only after transaction.oncomplete to ensure data durability
   * Also handles QuotaExceededError with user-friendly messages
   * @param {string} storeName - The object store name
   * @param {string} mode - Transaction mode ('readwrite')
   * @param {Function} operation - Function that receives (store, transaction) and performs the operation
   * @param {any} resultData - Data to include in the result on success
   * @returns {Promise<any>}
   */
  executeWriteOperation(storeName, operation, resultData = null) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      let requestError = null;

      // Execute the operation and capture any request-level error
      operation(store, transaction, (error) => {
        requestError = error;
      });

      transaction.oncomplete = () => {
        resolve(resultData !== null ? resultData : { success: true });
      };

      transaction.onerror = () => {
        const error = requestError || transaction.error;
        if (this.isQuotaExceededError(error)) {
          reject(this.createQuotaExceededError());
        } else {
          reject(error);
        }
      };

      transaction.onabort = () => {
        const error = requestError || transaction.error;
        if (this.isQuotaExceededError(error)) {
          reject(this.createQuotaExceededError());
        } else {
          reject(error || new Error('Transaction aborted'));
        }
      };
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
          // Use null sentinel for missing dates (will become NaN)
          const dateSourceA = a.dateApplied || a.meta?.createdAt || null;
          const dateSourceB = b.dateApplied || b.meta?.createdAt || null;
          const dateA = dateSourceA ? new Date(dateSourceA) : new Date(NaN);
          const dateB = dateSourceB ? new Date(dateSourceB) : new Date(NaN);
          // Handle Invalid Date - push to end of list
          const timeA = dateA.getTime();
          const timeB = dateB.getTime();
          if (isNaN(timeA) && isNaN(timeB)) return 0;
          if (isNaN(timeA)) return 1;  // Push invalid to end
          if (isNaN(timeB)) return -1; // Push invalid to end
          return timeB - timeA;
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
      // CRM Enhancement Phase 1: New fields
      priority: application.priority || 'medium',
      referredBy: application.referredBy || '',
      rejectionReason: application.rejectionReason || null,
      resumeVersion: application.resumeVersion || '',
      lastContacted: application.lastContacted || null,
      companyNotes: application.companyNotes || '',
      contacts: application.contacts || [],  // Array of contact IDs
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

    return new Promise(async (resolve, reject) => {
      try {
        // First, save the application with proper transaction handling
        await this.executeWriteOperation(
          this.STORES.APPLICATIONS,
          (store, transaction, setError) => {
            const request = store.add(app);
            request.onerror = () => setError(request.error);
          }
        );

        // After application is saved, create activity entry
        // Activity is non-critical, so we log errors but don't reject
        try {
          await this.addActivity({
            applicationId: app.id,
            type: 'application_created',
            title: `Application added`,
            description: `Applied to ${app.position} at ${app.company}`,
            metadata: { status: app.status }
          });
        } catch (activityErr) {
          console.warn('JobTracker: Failed to add activity for new application:', activityErr);
        }

        resolve({ success: true, application: app });
      } catch (error) {
        reject(error);
      }
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

    return new Promise(async (resolve, reject) => {
      try {
        // First, save the updated application with proper transaction handling
        await this.executeWriteOperation(
          this.STORES.APPLICATIONS,
          (store, transaction, setError) => {
            const request = store.put(updated);
            request.onerror = () => setError(request.error);
          }
        );

        // After application is saved, create activity entry for status change
        if (application.status && application.status !== oldStatus) {
          try {
            await this.addActivity({
              applicationId: updated.id,
              type: 'status_change',
              title: `Status changed to ${application.status}`,
              description: application.statusNote || `Changed from ${oldStatus} to ${application.status}`,
              metadata: { oldStatus, newStatus: application.status }
            });
          } catch (activityErr) {
            console.warn('JobTracker: Failed to add status change activity:', activityErr);
          }
        }

        resolve({ success: true, application: updated });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Delete application and all related data (cascading delete)
   * Deletes: interviews, tasks, activities, communications linked to this application
   */
  async deleteApplication(id) {
    await this.init();

    // Delete the application with proper transaction handling
    await this.executeWriteOperation(
      this.STORES.APPLICATIONS,
      (store, transaction, setError) => {
        const request = store.delete(id);
        request.onerror = () => setError(request.error);
      }
    );

    // Cascade delete related data (non-critical, log errors but don't fail)
    const cascadeDeletes = [
      { store: this.STORES.INTERVIEWS, index: 'applicationId', name: 'interviews' },
      { store: this.STORES.TASKS, index: 'applicationId', name: 'tasks' },
      { store: this.STORES.ACTIVITIES, index: 'applicationId', name: 'activities' },
      { store: this.STORES.COMMUNICATIONS, index: 'applicationId', name: 'communications' }
    ];

    for (const { store: storeName, index, name } of cascadeDeletes) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const idx = store.index(index);
          const request = idx.getAllKeys(id);

          request.onsuccess = () => {
            const keys = request.result || [];
            keys.forEach(key => store.delete(key));
          };

          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(new Error('Transaction aborted'));
        });
      } catch (err) {
        console.warn(`JobTracker: Failed to cascade delete ${name} for application ${id}:`, err);
      }
    }

    return { success: true };
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

        // Validate dates are valid
        if (isNaN(appliedDate.getTime()) || isNaN(interviewDate.getTime())) {
          console.log(`[JobTracker] Invalid date in status history for application ${app.id}`);
          return;
        }

        const days = Math.floor((interviewDate - appliedDate) / (1000 * 60 * 60 * 24));
        if (days >= 0) {
          daysArray.push(days);
        } else {
          // Log negative days for debugging (interview before application)
          console.log(`[JobTracker] Negative days to interview (${days}) for application ${app.id} - data entry error?`);
        }
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
          const currentTime = new Date(current.date).getTime();
          const nextTime = new Date(next.date).getTime();
          const diffMs = nextTime - currentTime;

          // Handle same-timestamp transitions: treat as 0 days but still count
          // This prevents division issues and provides accurate "instant" transition data
          if (diffMs >= 0) {
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            daysAccumulator[status].push(days);
          } else {
            // Log warning for backward-moving transitions (negative time difference)
            // This can happen due to data entry errors or timezone issues
            console.log(`[JobTracker] Backward status transition detected in application: ${status} -> ${next.status} (${diffMs}ms difference)`);
            // Still count as 0 days to not lose the data point
            daysAccumulator[status].push(0);
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

      // Validate date range - if inverted, log and return empty
      if (startDate > endDate) {
        console.log('[JobTracker] Invalid date range: start date is after end date');
        return [];
      }

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
        // Sort interviews by scheduled date ascending (soonest first)
        // This is intentionally different from applications (newest first)
        // because upcoming interviews are more time-sensitive
        const interviews = request.result.sort((a, b) => {
          const dateA = new Date(a.scheduledDate || 0);
          const dateB = new Date(b.scheduledDate || 0);
          // Handle Invalid Date - push to end of list
          const timeA = dateA.getTime();
          const timeB = dateB.getTime();
          if (isNaN(timeA) && isNaN(timeB)) return 0;
          if (isNaN(timeA)) return 1;  // Push invalid to end
          if (isNaN(timeB)) return -1; // Push invalid to end
          return dateA - dateB; // Ascending: soonest first
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
      .filter(i => {
        // Use case-insensitive comparison for backwards compatibility
        const outcome = (i.outcome || '').toLowerCase();
        return new Date(i.scheduledDate) >= now && outcome === 'pending';
      })
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
      // Use lowercase 'pending' for consistency with validation in background.js
      outcome: interview.outcome || 'pending',
      createdAt: new Date().toISOString()
    };

    return new Promise(async (resolve, reject) => {
      try {
        // First, save the interview with proper transaction handling
        await this.executeWriteOperation(
          this.STORES.INTERVIEWS,
          (store, transaction, setError) => {
            const request = store.add(interviewData);
            request.onerror = () => setError(request.error);
          }
        );

        // After interview is saved, create activity entry
        try {
          await this.addActivity({
            applicationId: interviewData.applicationId,
            type: 'interview_scheduled',
            title: `Interview scheduled: ${interviewData.type || 'Round ' + interviewData.round}`,
            description: `Scheduled for ${new Date(interviewData.scheduledDate).toLocaleDateString()}`,
            metadata: { interviewId: interviewData.id }
          });
        } catch (activityErr) {
          console.warn('JobTracker: Failed to add activity for scheduled interview:', activityErr);
        }

        resolve({ success: true, interview: interviewData });
      } catch (error) {
        reject(error);
      }
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

    return new Promise(async (resolve, reject) => {
      try {
        // First, save the updated interview with proper transaction handling
        await this.executeWriteOperation(
          this.STORES.INTERVIEWS,
          (store, transaction, setError) => {
            const request = store.put(updated);
            request.onerror = () => setError(request.error);
          }
        );

        // After interview is saved, create activity entry for outcome change
        if (outcomeChanged) {
          try {
            await this.addActivity({
              applicationId: updated.applicationId,
              type: 'interview_outcome',
              title: `Interview outcome: ${updated.outcome}`,
              description: `${updated.type || 'Round ' + updated.round} - ${updated.outcome}`,
              metadata: { interviewId: updated.id, outcome: updated.outcome }
            });
          } catch (activityErr) {
            console.warn('JobTracker: Failed to add interview outcome activity:', activityErr);
          }
        }

        resolve({ success: true, interview: updated });
      } catch (error) {
        reject(error);
      }
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
    return this.executeWriteOperation(
      this.STORES.INTERVIEWS,
      (store, transaction, setError) => {
        const request = store.delete(id);
        request.onerror = () => setError(request.error);
      },
      { success: true }
    );
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
        // Sort tasks by due date ascending (soonest first)
        // Tasks without due dates are pushed to the end
        const tasks = request.result.sort((a, b) => {
          const dateA = a.dueDate ? new Date(a.dueDate) : null;
          const dateB = b.dueDate ? new Date(b.dueDate) : null;

          // Handle missing/invalid dates - push to end
          const timeA = dateA ? dateA.getTime() : NaN;
          const timeB = dateB ? dateB.getTime() : NaN;

          if (isNaN(timeA) && isNaN(timeB)) return 0;
          if (isNaN(timeA)) return 1;  // Push tasks without due date to end
          if (isNaN(timeB)) return -1; // Push tasks without due date to end

          return timeA - timeB; // Ascending: soonest first
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

    return new Promise(async (resolve, reject) => {
      try {
        // First, save the task with proper transaction handling
        await this.executeWriteOperation(
          this.STORES.TASKS,
          (store, transaction, setError) => {
            const request = store.add(taskData);
            request.onerror = () => setError(request.error);
          }
        );

        // After task is saved, create activity entry if linked to application
        if (taskData.applicationId) {
          try {
            await this.addActivity({
              applicationId: taskData.applicationId,
              type: 'task_created',
              title: `Task created: ${taskData.title}`,
              description: taskData.dueDate ? `Due: ${new Date(taskData.dueDate).toLocaleDateString()}` : '',
              metadata: { taskId: taskData.id }
            });
          } catch (activityErr) {
            console.warn('JobTracker: Failed to add task created activity:', activityErr);
          }
        }

        resolve({ success: true, task: taskData });
      } catch (error) {
        reject(error);
      }
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

    return new Promise(async (resolve, reject) => {
      try {
        // First, save the updated task with proper transaction handling
        await this.executeWriteOperation(
          this.STORES.TASKS,
          (store, transaction, setError) => {
            const request = store.put(updated);
            request.onerror = () => setError(request.error);
          }
        );

        // After task is saved, create activity entry for task completion
        if (task.completed && !wasCompleted && updated.applicationId) {
          try {
            await this.addActivity({
              applicationId: updated.applicationId,
              type: 'task_completed',
              title: `Task completed: ${updated.title}`,
              description: '',
              metadata: { taskId: updated.id }
            });
          } catch (activityErr) {
            console.warn('JobTracker: Failed to add task completed activity:', activityErr);
          }
        }

        resolve({ success: true, task: updated });
      } catch (error) {
        reject(error);
      }
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
    return this.executeWriteOperation(
      this.STORES.TASKS,
      (store, transaction, setError) => {
        const request = store.delete(id);
        request.onerror = () => setError(request.error);
      },
      { success: true }
    );
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

    await this.executeWriteOperation(
      this.STORES.ACTIVITIES,
      (store, transaction, setError) => {
        const request = store.add(activityData);
        request.onerror = () => setError(request.error);
      }
    );

    return { success: true, activity: activityData };
  },

  /**
   * Delete activity
   */
  async deleteActivity(id) {
    await this.init();
    return this.executeWriteOperation(
      this.STORES.ACTIVITIES,
      (store, transaction, setError) => {
        const request = store.delete(id);
        request.onerror = () => setError(request.error);
      },
      { success: true }
    );
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

    return this.executeWriteOperation(
      this.STORES.PROFILE,
      (store, transaction, setError) => {
        const request = store.put(data);
        request.onerror = () => setError(request.error);
      },
      { success: true, profile: data }
    );
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
   * Deep merge utility for nested objects
   * Recursively merges source into target, preserving nested structure
   */
  deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (target[key] !== null && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          // Deep copy via recursive merge to preserve nested structure
          result[key] = this.deepMerge({}, source[key]);
        }
      } else {
        result[key] = source[key];
      }
    }
    return result;
  },

  /**
   * Get settings (with deep merge to preserve nested structure)
   */
  async getSettings() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(this.STORES.SETTINGS);
      const request = store.get('main');

      request.onsuccess = () => {
        const defaults = this.getDefaultSettings();
        const stored = request.result || {};
        // Deep merge to ensure nested objects (autofill, detection, ui) are fully merged
        resolve(this.deepMerge(defaults, stored));
      };
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

    return this.executeWriteOperation(
      this.STORES.SETTINGS,
      (store, transaction, setError) => {
        const request = store.put(data);
        request.onerror = () => setError(request.error);
      },
      { success: true }
    );
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
      },
      customJobSites: []  // User-added job sites for quick access
    };
  },

  // ==================== MIGRATION ====================

  /**
   * Check if migration is needed and perform it
   * Returns migration result with errors for UI notification (Bug #22)
   * Uses proper transaction handling to prevent race conditions (Bug #12)
   * @returns {Promise<{migrated: boolean, errors: Array, errorCount: number, migratedCount: number}>}
   */
  async migrateFromChromeStorage() {
    await this.init();

    const result = {
      migrated: false,
      errors: [],
      errorCount: 0,
      migratedCount: 0,
      totalCount: 0
    };

    // Check if already migrated
    const meta = await this.getMeta('migration');
    if (meta?.completed) {
      console.log('JobTracker: Migration already completed');
      return result;
    }

    // Check if Chrome storage has data (with timeout to prevent indefinite hangs)
    // Uses CONFIG.MIGRATION_TIMEOUT_MS constant for consistency
    const chromeData = await Promise.race([
      new Promise(resolve => {
        chrome.storage.local.get(['jobtracker_profile', 'jobtracker_applications', 'jobtracker_settings'], resolve);
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Chrome storage access timed out after ${CONFIG.MIGRATION_TIMEOUT_MS}ms`)), CONFIG.MIGRATION_TIMEOUT_MS)
      )
    ]);

    const hasData = chromeData.jobtracker_profile ||
                    chromeData.jobtracker_applications?.length > 0 ||
                    chromeData.jobtracker_settings;

    if (!hasData) {
      console.log('JobTracker: No Chrome storage data to migrate');
      await this.setMeta('migration', { completed: true, date: new Date().toISOString(), hadData: false });
      return result;
    }

    console.log('JobTracker: Starting migration from Chrome storage...');

    const migrationErrors = [];

    try {
      // Migrate profile first (most critical)
      if (chromeData.jobtracker_profile) {
        try {
          await this.saveProfile(chromeData.jobtracker_profile);
          console.log('JobTracker: Profile migrated');
        } catch (err) {
          const errorMsg = 'Failed to migrate profile';
          console.error('JobTracker:', errorMsg, err);
          migrationErrors.push({ type: 'profile', error: err?.message || 'Unknown error' });
        }
      }

      // Migrate applications (continue on individual errors, use proper transaction handling)
      if (chromeData.jobtracker_applications?.length > 0) {
        result.totalCount = chromeData.jobtracker_applications.length;

        for (const app of chromeData.jobtracker_applications) {
          try {
            // Use executeWriteOperation for proper transaction handling (Bug #12)
            await this.executeWriteOperation(
              this.STORES.APPLICATIONS,
              (store, transaction, setError) => {
                const request = store.put(app);
                request.onerror = () => setError(request.error);
              }
            );
            result.migratedCount++;
          } catch (err) {
            const errorMsg = `Failed to migrate application: ${app?.company || 'unknown'} - ${app?.position || 'unknown'}`;
            console.warn('JobTracker:', errorMsg, err?.message || err);
            migrationErrors.push({
              type: 'application',
              id: app?.id,
              company: app?.company,
              position: app?.position,
              error: err?.message || 'Unknown error'
            });
          }
        }

        console.log(`JobTracker: ${result.migratedCount}/${result.totalCount} applications migrated`);
      }

      // Migrate settings
      if (chromeData.jobtracker_settings) {
        try {
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
        } catch (err) {
          const errorMsg = 'Failed to migrate settings';
          console.error('JobTracker:', errorMsg, err);
          migrationErrors.push({ type: 'settings', error: err?.message || 'Unknown error' });
        }
      }

      // Mark migration as complete (even with partial errors)
      // Store error info so we can show user what failed (Bug #22)
      await this.setMeta('migration', {
        completed: true,
        date: new Date().toISOString(),
        hadData: true,
        applicationCount: result.totalCount,
        migratedCount: result.migratedCount,
        errorCount: migrationErrors.length,
        errors: migrationErrors.slice(0, 10) // Store first 10 errors for reference
      });

      // Only clear Chrome storage if ALL data migrated successfully (Bug #12)
      if (migrationErrors.length === 0) {
        await new Promise(resolve => {
          chrome.storage.local.remove(['jobtracker_profile', 'jobtracker_applications', 'jobtracker_settings'], resolve);
        });
        console.log('JobTracker: Chrome storage cleared after successful migration');
      } else {
        console.warn('JobTracker: Chrome storage NOT cleared due to migration errors - data preserved for retry');
      }

      result.migrated = true;
      result.errors = migrationErrors;
      result.errorCount = migrationErrors.length;

      if (migrationErrors.length > 0) {
        console.warn(`JobTracker: Migration completed with ${migrationErrors.length} error(s)`);
      } else {
        console.log('JobTracker: Migration completed successfully');
      }

      return result;
    } catch (error) {
      console.error('JobTracker: Migration failed completely', error);
      result.errors = [{ type: 'fatal', error: error?.message || 'Unknown error' }];
      result.errorCount = 1;
      return result;
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
    const data = { id: key, ...value };
    return this.executeWriteOperation(
      this.STORES.META,
      (store, transaction, setError) => {
        const request = store.put(data);
        request.onerror = () => setError(request.error);
      },
      { success: true, data }
    );
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

        // Add new applications (continue on individual errors)
        const importErrors = [];
        for (const app of data.applications) {
          try {
            await new Promise((resolve, reject) => {
              const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
              const store = transaction.objectStore(this.STORES.APPLICATIONS);
              const request = store.add(app);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          } catch (err) {
            // Log but continue with remaining applications
            console.log('JobTracker: Failed to import application:', app?.id || 'unknown', err?.message || err);
            importErrors.push({ id: app?.id, error: err?.message || 'Unknown error' });
          }
        }
        if (importErrors.length > 0) {
          console.log(`JobTracker: ${importErrors.length} application(s) failed to import`);
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
    await this.executeWriteOperation(
      this.STORES.MODELS_METADATA,
      (store, transaction, setError) => {
        const request = store.clear();
        request.onerror = () => setError(request.error);
      }
    );
    console.log('JobTracker: Models metadata cleared');
  },

  // ==================== DATA CLEARING METHODS ====================

  /**
   * Delete profile
   */
  async deleteProfile() {
    await this.init();
    await this.executeWriteOperation(
      this.STORES.PROFILE,
      (store, transaction, setError) => {
        const request = store.delete('main');
        request.onerror = () => setError(request.error);
      }
    );
    console.log('JobTracker: Profile deleted');
  },

  /**
   * Clear all applications
   */
  async clearAllApplications() {
    await this.init();
    await this.executeWriteOperation(
      this.STORES.APPLICATIONS,
      (store, transaction, setError) => {
        const request = store.clear();
        request.onerror = () => setError(request.error);
      }
    );
    console.log('JobTracker: All applications cleared');
  },

  /**
   * Clear all interviews
   */
  async clearAllInterviews() {
    await this.init();
    await this.executeWriteOperation(
      this.STORES.INTERVIEWS,
      (store, transaction, setError) => {
        const request = store.clear();
        request.onerror = () => setError(request.error);
      }
    );
    console.log('JobTracker: All interviews cleared');
  },

  /**
   * Clear all tasks
   */
  async clearAllTasks() {
    await this.init();
    await this.executeWriteOperation(
      this.STORES.TASKS,
      (store, transaction, setError) => {
        const request = store.clear();
        request.onerror = () => setError(request.error);
      }
    );
    console.log('JobTracker: All tasks cleared');
  },

  /**
   * Clear all activities
   */
  async clearAllActivities() {
    await this.init();
    await this.executeWriteOperation(
      this.STORES.ACTIVITIES,
      (store, transaction, setError) => {
        const request = store.clear();
        request.onerror = () => setError(request.error);
      }
    );
    console.log('JobTracker: All activities cleared');
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

    await this.executeWriteOperation(
      this.STORES.EXTRACTION_FEEDBACK,
      (store, transaction, setError) => {
        const request = store.add(data);
        request.onerror = () => setError(request.error);
      }
    );

    console.log('JobTracker: Extraction feedback recorded');
    return { success: true, feedback: data };
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
    await this.executeWriteOperation(
      this.STORES.EXTRACTION_FEEDBACK,
      (store, transaction, setError) => {
        const request = store.clear();
        request.onerror = () => setError(request.error);
      }
    );
    console.log('JobTracker: Extraction feedback cleared');
  },

  // ==================== CONTACTS (CRM Phase 2) ====================

  /**
   * Get all contacts
   */
  async getAllContacts() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.CONTACTS], 'readonly');
      const store = transaction.objectStore(this.STORES.CONTACTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const contacts = request.result.sort((a, b) => {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        resolve(contacts);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get contact by ID
   */
  async getContact(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.CONTACTS], 'readonly');
      const store = transaction.objectStore(this.STORES.CONTACTS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get contacts by company
   */
  async getContactsByCompany(company) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.CONTACTS], 'readonly');
      const store = transaction.objectStore(this.STORES.CONTACTS);
      const index = store.index('company');
      const request = index.getAll(company);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Add contact
   */
  async addContact(contact) {
    await this.init();

    const contactData = {
      ...contact,
      id: contact.id || this.generateId(),
      tags: contact.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.executeWriteOperation(
      this.STORES.CONTACTS,
      (store, transaction, setError) => {
        const request = store.add(contactData);
        request.onerror = () => setError(request.error);
      }
    );

    return { success: true, contact: contactData };
  },

  /**
   * Update contact
   */
  async updateContact(contact) {
    await this.init();

    const existing = await this.getContact(contact.id);
    if (!existing) {
      throw new Error('Contact not found');
    }

    const updated = {
      ...existing,
      ...contact,
      updatedAt: new Date().toISOString()
    };

    await this.executeWriteOperation(
      this.STORES.CONTACTS,
      (store, transaction, setError) => {
        const request = store.put(updated);
        request.onerror = () => setError(request.error);
      }
    );

    return { success: true, contact: updated };
  },

  /**
   * Delete contact
   */
  async deleteContact(id) {
    await this.init();
    return this.executeWriteOperation(
      this.STORES.CONTACTS,
      (store, transaction, setError) => {
        const request = store.delete(id);
        request.onerror = () => setError(request.error);
      },
      { success: true }
    );
  },

  /**
   * Search contacts
   */
  async searchContacts(query) {
    const contacts = await this.getAllContacts();
    if (!query) return contacts;

    const lowerQuery = query.toLowerCase();
    return contacts.filter(c => {
      return (c.name || '').toLowerCase().includes(lowerQuery) ||
             (c.email || '').toLowerCase().includes(lowerQuery) ||
             (c.company || '').toLowerCase().includes(lowerQuery) ||
             (c.title || '').toLowerCase().includes(lowerQuery);
    });
  },

  // ==================== COMMUNICATIONS (CRM Phase 2) ====================

  /**
   * Get all communications
   */
  async getAllCommunications() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.COMMUNICATIONS], 'readonly');
      const store = transaction.objectStore(this.STORES.COMMUNICATIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        const comms = request.result.sort((a, b) => {
          return new Date(b.date || 0) - new Date(a.date || 0);
        });
        resolve(comms);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get communications by contact ID
   */
  async getCommunicationsByContact(contactId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.COMMUNICATIONS], 'readonly');
      const store = transaction.objectStore(this.STORES.COMMUNICATIONS);
      const index = store.index('contactId');
      const request = index.getAll(contactId);

      request.onsuccess = () => {
        const comms = request.result.sort((a, b) => {
          return new Date(b.date || 0) - new Date(a.date || 0);
        });
        resolve(comms);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get communication by ID
   */
  async getCommunication(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.COMMUNICATIONS], 'readonly');
      const store = transaction.objectStore(this.STORES.COMMUNICATIONS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get communications by application ID
   */
  async getCommunicationsByApplication(applicationId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.COMMUNICATIONS], 'readonly');
      const store = transaction.objectStore(this.STORES.COMMUNICATIONS);
      const index = store.index('applicationId');
      const request = index.getAll(applicationId);

      request.onsuccess = () => {
        const comms = request.result.sort((a, b) => {
          return new Date(b.date || 0) - new Date(a.date || 0);
        });
        resolve(comms);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get communications needing follow-up
   */
  async getCommunicationsNeedingFollowUp() {
    const comms = await this.getAllCommunications();
    const now = new Date();
    return comms.filter(c => {
      if (!c.followUpDate) return false;
      const followUpDate = new Date(c.followUpDate);
      return followUpDate <= now;
    });
  },

  /**
   * Add communication
   */
  async addCommunication(communication) {
    await this.init();

    const commData = {
      ...communication,
      id: communication.id || this.generateId(),
      createdAt: new Date().toISOString()
    };

    await this.executeWriteOperation(
      this.STORES.COMMUNICATIONS,
      (store, transaction, setError) => {
        const request = store.add(commData);
        request.onerror = () => setError(request.error);
      }
    );

    return { success: true, communication: commData };
  },

  /**
   * Update communication
   */
  async updateCommunication(communication) {
    await this.init();

    // Add existence check
    const existing = await this.getCommunication(communication.id);
    if (!existing) {
      throw new Error('Communication not found');
    }

    const updated = {
      ...existing,
      ...communication,
      updatedAt: new Date().toISOString()
    };

    await this.executeWriteOperation(
      this.STORES.COMMUNICATIONS,
      (store, transaction, setError) => {
        const request = store.put(updated);
        request.onerror = () => setError(request.error);
      }
    );

    return { success: true, communication: updated };
  },

  /**
   * Delete communication
   */
  async deleteCommunication(id) {
    await this.init();
    return this.executeWriteOperation(
      this.STORES.COMMUNICATIONS,
      (store, transaction, setError) => {
        const request = store.delete(id);
        request.onerror = () => setError(request.error);
      },
      { success: true }
    );
  },

  // ==================== REJECTION ANALYTICS (CRM Phase 4) ====================

  /**
   * Get rejection distribution
   */
  async getRejectionDistribution() {
    const applications = await this.getAllApplications();
    const rejected = applications.filter(app => app.status === 'rejected');

    return rejected.reduce((acc, app) => {
      const reason = app.rejectionReason || 'unknown';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
  },

  /**
   * Get applications by priority
   */
  async getApplicationsByPriority(priority) {
    const applications = await this.getAllApplications();
    return applications.filter(app => app.priority === priority);
  },

  /**
   * Get applications needing follow-up (no contact in X days)
   */
  async getApplicationsNeedingFollowUp(daysSinceContact = 7) {
    const applications = await this.getAllApplications();
    const now = new Date();
    const threshold = new Date(now.getTime() - daysSinceContact * 24 * 60 * 60 * 1000);

    return applications.filter(app => {
      // Skip rejected, withdrawn, or offer applications
      if (['rejected', 'withdrawn', 'offer'].includes(app.status)) return false;

      const lastContact = app.lastContacted ? new Date(app.lastContacted) : null;
      const lastUpdate = app.meta?.updatedAt ? new Date(app.meta.updatedAt) : null;
      const lastActivity = lastContact || lastUpdate;

      if (!lastActivity) return true; // No activity recorded
      return lastActivity < threshold;
    });
  },

  // ==================== RESUME MAKER ====================

  /**
   * Get the base resume
   */
  async getBaseResume() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.BASE_RESUME], 'readonly');
      const store = transaction.objectStore(this.STORES.BASE_RESUME);
      const request = store.get('base');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save the base resume
   */
  async saveBaseResume(resume) {
    await this.init();
    const data = {
      ...resume,
      id: 'base',
      updatedAt: Date.now()
    };

    await this.executeWriteOperation(
      this.STORES.BASE_RESUME,
      (store, transaction, setError) => {
        const request = store.put(data);
        request.onerror = () => setError(request.error);
      }
    );

    // Return the saved data, not just the key (fixes Bug #16)
    return { success: true, data };
  },

  /**
   * Get default/empty base resume template
   */
  getDefaultBaseResume() {
    return {
      id: 'base',
      profile: {
        name: '',
        headline: '',
        email: '',
        phone: '',
        location: '',
        website: '',
        summary: ''
      },
      experience: {
        title: 'Experience',
        items: []
      },
      education: {
        title: 'Education',
        items: []
      },
      projects: {
        title: 'Projects',
        items: []
      },
      skills: {
        title: 'Skills',
        items: []
      },
      custom: {
        title: 'Certifications',
        items: []
      },
      updatedAt: Date.now()
    };
  },

  /**
   * Get all generated resumes
   */
  async getAllGeneratedResumes() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.GENERATED_RESUMES], 'readonly');
      const store = transaction.objectStore(this.STORES.GENERATED_RESUMES);
      const request = store.getAll();

      request.onsuccess = () => {
        const resumes = request.result || [];
        // Sort by createdAt descending
        resumes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(resumes);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get a specific generated resume
   */
  async getGeneratedResume(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.GENERATED_RESUMES], 'readonly');
      const store = transaction.objectStore(this.STORES.GENERATED_RESUMES);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save a generated resume
   */
  async saveGeneratedResume(resume) {
    await this.init();
    const data = {
      ...resume,
      id: resume.id || this.generateId(),
      createdAt: resume.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    await this.executeWriteOperation(
      this.STORES.GENERATED_RESUMES,
      (store, transaction, setError) => {
        const request = store.put(data);
        request.onerror = () => setError(request.error);
      }
    );

    return { success: true, data };
  },

  /**
   * Delete a generated resume
   */
  async deleteGeneratedResume(id) {
    await this.init();
    return this.executeWriteOperation(
      this.STORES.GENERATED_RESUMES,
      (store, transaction, setError) => {
        const request = store.delete(id);
        request.onerror = () => setError(request.error);
      },
      { success: true }
    );
  },

  /**
   * Create a new generated resume template from base resume and job description
   */
  createGeneratedResume(baseResume, jobDescription, tailoring) {
    return {
      id: this.generateId(),
      name: '',
      baseResumeId: 'base',
      baseResume: { ...baseResume },
      jobDescription: {
        rawText: jobDescription.rawText || '',
        title: jobDescription.title || '',
        company: jobDescription.company || '',
        extractedSkills: jobDescription.extractedSkills || [],
        extractedKeywords: jobDescription.extractedKeywords || []
      },
      tailoring: {
        matchingSkills: tailoring.matchingSkills || [],
        missingSkills: tailoring.missingSkills || [],
        highlightSkills: tailoring.highlightSkills || [],
        experienceOrder: tailoring.experienceOrder || [],
        experienceScores: tailoring.experienceScores || {}
      },
      edits: {
        summary: null,
        experience: {}
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      exported: false
    };
  },

  // ==================== UPLOADED RESUMES (Resume-Application Linking) ====================

  /**
   * Upload a resume PDF
   * @param {Object} resumeInfo - Resume info with base64 data
   * @param {string} resumeInfo.name - File name
   * @param {string} resumeInfo.type - MIME type
   * @param {string} resumeInfo.data - Base64-encoded file data
   * @param {number} resumeInfo.size - File size in bytes
   * @returns {Promise<{success: boolean, resume: Object}>}
   */
  async uploadResume(resumeInfo) {
    await this.init();

    const resumeData = {
      id: this.generateId(),
      name: resumeInfo.name,
      type: resumeInfo.type,
      data: resumeInfo.data,  // Already base64 string
      size: resumeInfo.size,
      uploadedAt: Date.now()
    };

    await this.executeWriteOperation(
      this.STORES.UPLOADED_RESUMES,
      (store, transaction, setError) => {
        const request = store.add(resumeData);
        request.onerror = () => setError(request.error);
      }
    );

    return { success: true, resume: resumeData };
  },

  /**
   * Get an uploaded resume by ID
   * @param {string} id - The resume ID
   * @returns {Promise<Object|null>}
   */
  async getUploadedResume(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.UPLOADED_RESUMES], 'readonly');
      const store = transaction.objectStore(this.STORES.UPLOADED_RESUMES);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all uploaded resumes (metadata only, without blob data for listing)
   * @returns {Promise<Array>}
   */
  async getAllUploadedResumes() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.UPLOADED_RESUMES], 'readonly');
      const store = transaction.objectStore(this.STORES.UPLOADED_RESUMES);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by uploadedAt descending (newest first)
        const resumes = request.result.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
        // Return metadata without blob data for listing performance
        resolve(resumes.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          size: r.size,
          uploadedAt: r.uploadedAt
        })));
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete an uploaded resume
   * @param {string} id - The resume ID to delete
   * @returns {Promise<{success: boolean}>}
   */
  async deleteUploadedResume(id) {
    await this.init();
    return this.executeWriteOperation(
      this.STORES.UPLOADED_RESUMES,
      (store, transaction, setError) => {
        const request = store.delete(id);
        request.onerror = () => setError(request.error);
      },
      { success: true }
    );
  },

  /**
   * Get applications that use a specific resume
   * @param {string} resumeId - The resume ID
   * @param {string} resumeType - 'generated' or 'uploaded'
   * @returns {Promise<Array>}
   */
  async getApplicationsByResumeId(resumeId, resumeType) {
    const applications = await this.getAllApplications();
    return applications.filter(app =>
      app.resume &&
      app.resume.id === resumeId &&
      app.resume.type === resumeType
    );
  },

  /**
   * Get usage counts for all resumes (both generated and uploaded)
   * Returns a map of resumeId -> count
   * @returns {Promise<{generated: Object, uploaded: Object}>}
   */
  async getResumeUsageCounts() {
    const applications = await this.getAllApplications();
    const counts = {
      generated: {},
      uploaded: {}
    };

    applications.forEach(app => {
      if (app.resume && app.resume.id && app.resume.type) {
        const type = app.resume.type;
        const id = app.resume.id;
        if (counts[type]) {
          counts[type][id] = (counts[type][id] || 0) + 1;
        }
      }
    });

    return counts;
  }
};

// Export for ES modules
export { JobTrackerDB, REJECTION_REASONS, PRIORITY_LEVELS, CONTACT_TYPES, CONTACT_SOURCES, COMMUNICATION_TYPES };
