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
      // Address can be either a string (legacy) or an object (current)
      address: z.union([
        z.string(),
        z.object({
          street: z.string().optional(),
          addressLine2: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zipCode: z.string().optional(),
          country: z.string().optional()
        })
      ]).optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zip: z.string().optional(),
      linkedIn: z.string().url().optional().or(z.literal('')),
      linkedin: z.string().url().optional().or(z.literal('')),
      github: z.string().url().optional().or(z.literal('')),
      portfolio: z.string().url().optional().or(z.literal('')),
      website: z.string().url().optional().or(z.literal(''))
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
 * Perform basic type validation when Zod is unavailable
 * @param {string} schemaName - Schema name
 * @param {any} data - Data to validate
 * @returns {{ valid: boolean, errors: Array }}
 */
function performBasicValidation(schemaName, data) {
  const errors = [];

  if (data === null || data === undefined) {
    errors.push({ path: '', message: 'Data is null or undefined', code: 'invalid_type' });
    return { valid: false, errors };
  }

  switch (schemaName) {
    case 'Application':
      if (typeof data !== 'object') {
        errors.push({ path: '', message: 'Application must be an object', code: 'invalid_type' });
      } else {
        if (data.status && !APPLICATION_STATUSES.includes(data.status)) {
          errors.push({ path: 'status', message: `Invalid status: ${data.status}`, code: 'invalid_enum' });
        }
        if (data.platform && !PLATFORMS.includes(data.platform)) {
          errors.push({ path: 'platform', message: `Invalid platform: ${data.platform}`, code: 'invalid_enum' });
        }
      }
      break;

    case 'Profile':
      if (typeof data !== 'object') {
        errors.push({ path: '', message: 'Profile must be an object', code: 'invalid_type' });
      }
      break;

    case 'Settings':
      if (typeof data !== 'object') {
        errors.push({ path: '', message: 'Settings must be an object', code: 'invalid_type' });
      }
      break;

    case 'Interview':
      if (typeof data !== 'object') {
        errors.push({ path: '', message: 'Interview must be an object', code: 'invalid_type' });
      } else if (data.outcome && !INTERVIEW_OUTCOMES.includes(data.outcome.toLowerCase())) {
        errors.push({ path: 'outcome', message: `Invalid outcome: ${data.outcome}`, code: 'invalid_enum' });
      }
      break;

    case 'Task':
      if (typeof data !== 'object') {
        errors.push({ path: '', message: 'Task must be an object', code: 'invalid_type' });
      } else if (data.priority && !TASK_PRIORITIES.includes(data.priority)) {
        errors.push({ path: 'priority', message: `Invalid priority: ${data.priority}`, code: 'invalid_enum' });
      }
      break;

    default:
      // For unknown schemas, just verify it's an object
      if (typeof data !== 'object') {
        errors.push({ path: '', message: 'Data must be an object', code: 'invalid_type' });
      }
  }

  return { valid: errors.length === 0, errors };
}

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
 * @param {boolean} strictMode - If true, throws error when validation library unavailable (default: true)
 * @returns {ValidationResult}
 */
function validate(schemaName, data, strictMode = true) {
  if (!zodAvailable || !schemas) {
    const errorMsg = 'Validation library (Zod) is not available. Data cannot be validated.';
    console.error('JobTracker Validation:', errorMsg);
    if (strictMode) {
      return ValidationResult.fail([{ path: '', message: errorMsg, code: 'validation_unavailable' }]);
    }
    // Non-strict mode: perform basic type validation as fallback
    console.warn('JobTracker Validation: Using basic validation fallback');
    const basicValidation = performBasicValidation(schemaName, data);
    if (!basicValidation.valid) {
      return ValidationResult.fail(basicValidation.errors);
    }
    return ValidationResult.ok(data);
  }

  if (!schemas[schemaName]) {
    const errorMsg = `Unknown schema: ${schemaName}`;
    console.error('JobTracker Validation:', errorMsg);
    return ValidationResult.fail([{ path: '', message: errorMsg, code: 'unknown_schema' }]);
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

// ==================== SANITIZATION ====================

/**
 * Sanitize a string to prevent XSS attacks
 * Removes or escapes dangerous HTML/JS content
 * @param {string} str - Input string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return str;

  // Escape HTML entities
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove any javascript: or data: URLs that might have slipped through
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    // Remove event handlers that might be embedded
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Sanitize a URL to prevent XSS via javascript: or data: URLs
 * @param {string} url - Input URL to sanitize
 * @returns {string} - Sanitized URL or empty string if invalid
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim().toLowerCase();

  // Block javascript: and data: URLs
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    console.warn('JobTracker: Blocked potentially malicious URL:', url.substring(0, 50));
    return '';
  }

  // Only allow http, https, and mailto protocols
  if (!trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('mailto:') &&
      !trimmed.startsWith('/') &&
      trimmed.includes(':')) {
    console.warn('JobTracker: Blocked URL with unknown protocol:', url.substring(0, 50));
    return '';
  }

  return url;
}

/**
 * Sanitize an application object to prevent XSS
 * @param {object} app - Application data
 * @returns {object} - Sanitized application
 */
function sanitizeApplication(app) {
  if (!app || typeof app !== 'object') return app;

  const sanitized = { ...app };

  // Sanitize text fields
  const textFields = ['company', 'position', 'location', 'salary', 'notes', 'jobDescription'];
  for (const field of textFields) {
    if (sanitized[field]) {
      sanitized[field] = sanitizeString(sanitized[field]);
    }
  }

  // Sanitize URL field
  if (sanitized.jobUrl) {
    sanitized.jobUrl = sanitizeUrl(sanitized.jobUrl);
  }

  // Sanitize tags array
  if (Array.isArray(sanitized.tags)) {
    sanitized.tags = sanitized.tags.map(tag => sanitizeString(tag));
  }

  return sanitized;
}

/**
 * Validate string length constraints
 * @param {string} str - String to check
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} - Whether string is within limits
 */
function isWithinLengthLimit(str, maxLength = 10000) {
  return !str || typeof str !== 'string' || str.length <= maxLength;
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
  // Sanitization functions
  sanitizeString,
  sanitizeUrl,
  sanitizeApplication,
  isWithinLengthLimit,
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
