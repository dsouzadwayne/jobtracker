/**
 * JobTracker Validation Module
 * Schema validation powered by Zod
 */

// Check if Zod is available (loaded from vendor/zod.min.js)
const zodAvailable = typeof Zod !== 'undefined';

// Use Zod if available, otherwise create no-op validators
const z = zodAvailable ? Zod : null;

/**
 * Application status enum
 */
const APPLICATION_STATUSES = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];

/**
 * Job type enum
 */
const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship', ''];

/**
 * Remote type enum
 */
const REMOTE_TYPES = ['onsite', 'remote', 'hybrid', ''];

/**
 * Platform enum
 */
const PLATFORMS = ['linkedin', 'indeed', 'glassdoor', 'greenhouse', 'lever', 'workday', 'icims', 'smartrecruiters', 'other'];

/**
 * Task priority enum
 */
const TASK_PRIORITIES = ['low', 'medium', 'high'];

/**
 * Interview outcome enum
 */
const INTERVIEW_OUTCOMES = ['pending', 'passed', 'failed', 'cancelled'];

// ==================== SCHEMAS ====================

/**
 * Create schemas if Zod is available
 */
let schemas = null;

if (z) {
  // Status history entry schema
  const StatusHistoryEntrySchema = z.object({
    status: z.enum(APPLICATION_STATUSES),
    date: z.string(),
    notes: z.string().optional()
  });

  // Application schema
  const ApplicationSchema = z.object({
    id: z.string().uuid().optional(),
    company: z.string().min(1, 'Company name is required'),
    position: z.string().min(1, 'Position is required'),
    status: z.enum(APPLICATION_STATUSES).default('applied'),
    dateApplied: z.string().datetime().optional(),
    jobUrl: z.string().url().optional().or(z.literal('')),
    location: z.string().optional(),
    salary: z.string().optional(),
    jobType: z.enum(JOB_TYPES).optional(),
    remote: z.enum(REMOTE_TYPES).optional(),
    jobDescription: z.string().optional(),
    notes: z.string().optional(),
    platform: z.enum(PLATFORMS).optional(),
    tags: z.array(z.string()).optional(),
    deadline: z.string().datetime().optional(),
    statusHistory: z.array(StatusHistoryEntrySchema).optional(),
    autoDetected: z.boolean().optional(),
    meta: z.object({
      createdAt: z.string().datetime().optional(),
      updatedAt: z.string().datetime().optional()
    }).optional()
  });

  // Profile schema
  const ProfileSchema = z.object({
    id: z.string().optional(),
    personal: z.object({
      firstName: z.string().optional(),
      middleName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zip: z.string().optional(),
      linkedin: z.string().url().optional().or(z.literal('')),
      github: z.string().url().optional().or(z.literal('')),
      portfolio: z.string().url().optional().or(z.literal(''))
    }).optional(),
    professional: z.object({
      currentTitle: z.string().optional(),
      currentCompany: z.string().optional(),
      yearsExperience: z.string().optional(),
      desiredTitle: z.string().optional(),
      desiredSalary: z.string().optional(),
      currency: z.string().optional(),
      skills: z.string().optional(),
      summary: z.string().optional()
    }).optional(),
    education: z.array(z.object({
      degree: z.string().optional(),
      school: z.string().optional(),
      year: z.string().optional(),
      major: z.string().optional()
    })).optional(),
    experience: z.array(z.object({
      title: z.string().optional(),
      company: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      current: z.boolean().optional(),
      description: z.string().optional()
    })).optional()
  });

  // Settings schema
  const SettingsSchema = z.object({
    id: z.string().optional(),
    autofill: z.object({
      enabled: z.boolean().optional(),
      showFloatingButton: z.boolean().optional(),
      delay: z.number().optional()
    }).optional(),
    ai: z.object({
      enabled: z.boolean().optional(),
      autoSuggestTags: z.boolean().optional(),
      enhanceResumeParsing: z.boolean().optional(),
      resumeFields: z.object({
        personal: z.object({
          name: z.boolean().optional(),
          email: z.boolean().optional(),
          phone: z.boolean().optional(),
          location: z.boolean().optional(),
          links: z.boolean().optional()
        }).optional(),
        work: z.object({
          companies: z.boolean().optional(),
          titles: z.boolean().optional(),
          locations: z.boolean().optional(),
          dates: z.boolean().optional(),
          descriptions: z.boolean().optional()
        }).optional(),
        education: z.object({
          schools: z.boolean().optional(),
          degrees: z.boolean().optional(),
          fields: z.boolean().optional(),
          dates: z.boolean().optional(),
          gpa: z.boolean().optional()
        }).optional(),
        skills: z.object({
          languages: z.boolean().optional(),
          frameworks: z.boolean().optional(),
          tools: z.boolean().optional(),
          soft: z.boolean().optional()
        }).optional(),
        suggestedTags: z.boolean().optional()
      }).optional()
    }).optional(),
    ui: z.object({
      dashboardView: z.enum(['cards', 'table']).optional()
    }).optional(),
    customRules: z.array(z.object({
      id: z.string().optional(),
      pattern: z.string(),
      field: z.string(),
      value: z.string()
    })).optional(),
    goals: z.object({
      weekly: z.object({
        enabled: z.boolean().optional(),
        target: z.number().optional()
      }).optional(),
      monthly: z.object({
        enabled: z.boolean().optional(),
        target: z.number().optional()
      }).optional()
    }).optional()
  });

  // Interview schema
  const InterviewSchema = z.object({
    id: z.string().uuid().optional(),
    applicationId: z.string().uuid(),
    type: z.string().min(1),
    scheduledDate: z.string().datetime(),
    duration: z.number().optional(),
    location: z.string().optional(),
    interviewerName: z.string().optional(),
    interviewerRole: z.string().optional(),
    notes: z.string().optional(),
    outcome: z.enum(INTERVIEW_OUTCOMES).default('pending'),
    feedback: z.string().optional()
  });

  // Task schema
  const TaskSchema = z.object({
    id: z.string().uuid().optional(),
    applicationId: z.string().uuid().optional(),
    title: z.string().min(1, 'Task title is required'),
    description: z.string().optional(),
    dueDate: z.string().datetime().optional(),
    priority: z.enum(TASK_PRIORITIES).default('medium'),
    completed: z.boolean().default(false),
    completedAt: z.string().datetime().optional(),
    reminderDate: z.string().datetime().optional()
  });

  // Activity schema
  const ActivitySchema = z.object({
    id: z.string().uuid().optional(),
    applicationId: z.string().uuid(),
    type: z.string(),
    timestamp: z.string().datetime(),
    description: z.string().optional(),
    metadata: z.record(z.any()).optional()
  });

  // Import data schema (for validating imported JSON)
  const ImportDataSchema = z.object({
    version: z.string(),
    exportDate: z.string().datetime().optional(),
    profile: ProfileSchema.optional(),
    applications: z.array(ApplicationSchema).optional(),
    settings: SettingsSchema.optional(),
    interviews: z.array(InterviewSchema).optional(),
    tasks: z.array(TaskSchema).optional(),
    activities: z.array(ActivitySchema).optional()
  });

  schemas = {
    Application: ApplicationSchema,
    Profile: ProfileSchema,
    Settings: SettingsSchema,
    Interview: InterviewSchema,
    Task: TaskSchema,
    Activity: ActivitySchema,
    ImportData: ImportDataSchema,
    StatusHistoryEntry: StatusHistoryEntrySchema
  };
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validation result class
 */
class ValidationResult {
  constructor(success, data = null, errors = []) {
    this.success = success;
    this.data = data;
    this.errors = errors;
  }

  static ok(data) {
    return new ValidationResult(true, data, []);
  }

  static fail(errors) {
    return new ValidationResult(false, null, errors);
  }
}

/**
 * Validate data against a schema
 * @param {string} schemaName - Name of the schema to use
 * @param {any} data - Data to validate
 * @returns {ValidationResult}
 */
function validate(schemaName, data) {
  if (!zodAvailable || !schemas || !schemas[schemaName]) {
    // If Zod is not available, pass through (no validation)
    return ValidationResult.ok(data);
  }

  const schema = schemas[schemaName];
  const result = schema.safeParse(data);

  if (result.success) {
    return ValidationResult.ok(result.data);
  }

  const errors = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }));

  return ValidationResult.fail(errors);
}

/**
 * Validate an application
 * @param {any} application
 * @returns {ValidationResult}
 */
function validateApplication(application) {
  return validate('Application', application);
}

/**
 * Validate a profile
 * @param {any} profile
 * @returns {ValidationResult}
 */
function validateProfile(profile) {
  return validate('Profile', profile);
}

/**
 * Validate settings
 * @param {any} settings
 * @returns {ValidationResult}
 */
function validateSettings(settings) {
  return validate('Settings', settings);
}

/**
 * Validate import data
 * @param {any} data
 * @returns {ValidationResult}
 */
function validateImportData(data) {
  return validate('ImportData', data);
}

/**
 * Validate an interview
 * @param {any} interview
 * @returns {ValidationResult}
 */
function validateInterview(interview) {
  return validate('Interview', interview);
}

/**
 * Validate a task
 * @param {any} task
 * @returns {ValidationResult}
 */
function validateTask(task) {
  return validate('Task', task);
}

/**
 * Check if Zod is available
 * @returns {boolean}
 */
function isValidationAvailable() {
  return zodAvailable;
}

/**
 * Format validation errors for display
 * @param {Array} errors
 * @returns {string}
 */
function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'Unknown validation error';
  }

  return errors.map(err => {
    const path = err.path ? `${err.path}: ` : '';
    return `${path}${err.message}`;
  }).join('\n');
}

// ==================== EXPORTS ====================

const JobTrackerValidation = {
  validate,
  validateApplication,
  validateProfile,
  validateSettings,
  validateImportData,
  validateInterview,
  validateTask,
  isAvailable: isValidationAvailable,
  formatErrors: formatValidationErrors,
  ValidationResult,
  schemas,
  // Constants
  APPLICATION_STATUSES,
  JOB_TYPES,
  REMOTE_TYPES,
  PLATFORMS,
  TASK_PRIORITIES,
  INTERVIEW_OUTCOMES
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JobTrackerValidation;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerValidation = JobTrackerValidation;
}
