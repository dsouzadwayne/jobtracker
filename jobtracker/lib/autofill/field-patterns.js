/**
 * JobTracker Field Patterns
 * All field pattern definitions for form field identification
 * Includes certainty levels, attribute priority, and international support
 */

/**
 * Certainty levels for multi-stage matching
 * Higher values indicate more reliable matches
 *
 * Uses centralized config if available, with local fallbacks for backward compatibility
 */
const CERTAINTY_LEVELS = (() => {
  // If config is available, create a proxy to read from it
  if (typeof window !== 'undefined' && window.JobTrackerConfig?.CERTAINTY) {
    return window.JobTrackerConfig.CERTAINTY;
  }
  // Fallback for backward compatibility
  return {
    EXACT_ATTRIBUTE: 1.0,
    CUSTOM_RULE: 0.95,
    INPUT_TYPE: 0.9,
    DIRECT_PATTERN: 0.7,
    LABEL_MATCH: 0.5,
    PARENT_LABEL: 0.3,
    PLACEHOLDER: 0.25,
    POSITION_FALLBACK: 0.15
  };
})();

/**
 * Attribute priority for identification (modern frameworks first)
 * Uses centralized config if available
 */
const ATTRIBUTE_PRIORITY = (() => {
  if (typeof window !== 'undefined' && window.JobTrackerConfig?.ATTRIBUTE_PRIORITY) {
    return window.JobTrackerConfig.ATTRIBUTE_PRIORITY;
  }
  return [
    'data-automation-id',
    'data-testid',
    'data-field',
    'name',
    'id',
    'autocomplete'
  ];
})();

/**
 * Expanded field patterns with international support
 * Each field type has:
 * - patterns: Array of regex patterns to match
 * - autocomplete: HTML5 autocomplete values that map to this field
 * - inputType: HTML input type that indicates this field
 * - profilePath: Path to value in user profile
 * - combineFields: Array of paths to combine for composite values
 * - formatter: Special formatting function name
 * - requiresSelection: Whether field needs user interaction (e.g., cover letter picker)
 * - textarea: Whether this is typically a textarea field
 * - autoCheck: Whether to auto-check (for checkbox fields like terms)
 */
const FIELD_PATTERNS = {
  // ============ Personal Info ============

  // First Name
  firstName: {
    patterns: [
      /first.?name/i, /given.?name/i, /fname/i, /f_name/i,
      /vorname/i, /prenom/i, /nombre/i, /nome/i,           // German, French, Spanish, Portuguese
      /first$/i, /^given$/i
    ],
    autocomplete: ['given-name'],
    profilePath: 'personal.firstName'
  },

  // Middle Name
  middleName: {
    patterns: [
      /middle.?name/i, /mname/i, /m_name/i, /middle.?initial/i,
      /zweiter.?vorname/i, /segundo.?nombre/i               // German, Spanish
    ],
    autocomplete: ['additional-name'],
    profilePath: 'personal.middleName'
  },

  // Last Name
  lastName: {
    patterns: [
      /last.?name/i, /family.?name/i, /surname/i, /lname/i, /l_name/i,
      /nachname/i, /nom.?de.?famille/i, /apellido/i, /sobrenome/i,  // German, French, Spanish, Portuguese
      /last$/i, /^family$/i
    ],
    autocomplete: ['family-name'],
    profilePath: 'personal.lastName'
  },

  // Full Name
  fullName: {
    patterns: [
      /full.?name/i, /^name$/i, /your.?name/i, /candidate.?name/i,
      /applicant.?name/i, /legal.?name/i, /complete.?name/i,
      /vollst.?ndiger.?name/i, /nom.?complet/i, /nombre.?completo/i  // German, French, Spanish
    ],
    autocomplete: ['name'],
    combineFields: ['personal.firstName', 'personal.middleName', 'personal.lastName']
  },

  // Email
  email: {
    patterns: [
      /e?.?mail/i, /email.?address/i, /e.?mail.?addr/i,
      /correo/i, /courriel/i,                               // Spanish, French
      /(?:^|[^k])mail(?!ing)/i                              // "mail" but not "mailing"
    ],
    autocomplete: ['email'],
    inputType: 'email',
    profilePath: 'personal.email'
  },

  // Phone
  phone: {
    patterns: [
      /phone/i, /mobile/i, /tel(?:ephone)?/i, /cell/i, /contact.?number/i,
      /telefon/i, /telefono/i, /numero/i,                   // German, Spanish
      /phon/i, /handynummer/i, /rufnummer/i                 // Variations
    ],
    autocomplete: ['tel', 'tel-national', 'tel-local'],
    inputType: 'tel',
    profilePath: 'personal.phone'
  },

  // ============ Address ============

  street: {
    patterns: [
      /street/i, /address.?line/i, /^address$/i, /address.?1/i,
      /street.?address/i, /mailing.?address/i,
      /strasse/i, /stra.e/i, /direcci.n/i, /adresse/i       // German, Spanish, French
    ],
    autocomplete: ['street-address', 'address-line1'],
    profilePath: 'personal.address.street'
  },

  addressLine2: {
    patterns: [
      /address.?2/i, /address.?line.?2/i, /apt/i, /suite/i, /unit/i,
      /apartment/i, /building/i
    ],
    autocomplete: ['address-line2'],
    profilePath: 'personal.address.addressLine2'
  },

  city: {
    patterns: [
      /city/i, /town/i, /locality/i, /municipality/i,
      /stadt/i, /ville/i, /ciudad/i, /cidade/i              // German, French, Spanish, Portuguese
    ],
    autocomplete: ['address-level2'],
    profilePath: 'personal.address.city'
  },

  state: {
    patterns: [
      /state/i, /province/i, /region/i, /prefecture/i,
      /bundesland/i, /provincia/i, /estado/i                // German, Spanish
    ],
    autocomplete: ['address-level1'],
    profilePath: 'personal.address.state'
  },

  zipCode: {
    patterns: [
      /zip/i, /postal/i, /post.?code/i, /pin.?code/i,
      /postleitzahl/i, /plz/i, /codigo.?postal/i, /cep/i    // German, Spanish, Portuguese
    ],
    autocomplete: ['postal-code'],
    profilePath: 'personal.address.zipCode'
  },

  country: {
    patterns: [
      /country/i, /nation/i, /country.?code/i,
      /land/i, /pa.s/i, /pais/i                             // German, French, Spanish
    ],
    autocomplete: ['country-name', 'country'],
    profilePath: 'personal.address.country'
  },

  // ============ Social/Professional Links ============

  linkedIn: {
    patterns: [
      /linkedin/i, /linked.?in/i, /linked_in/i,
      /linkedin.?url/i, /linkedin.?profile/i
    ],
    profilePath: 'personal.linkedIn'
  },

  github: {
    patterns: [/github/i, /git.?hub/i, /github.?url/i, /github.?profile/i],
    profilePath: 'personal.github'
  },

  portfolio: {
    patterns: [
      /portfolio/i, /website/i, /personal.?site/i, /personal.?url/i,
      /homepage/i, /^url$/i, /^web$/i, /personal.?website/i
    ],
    autocomplete: ['url'],
    profilePath: 'personal.portfolio'
  },

  twitter: {
    patterns: [/twitter/i, /^x$/i, /x.?handle/i, /twitter.?handle/i],
    profilePath: 'personal.twitter'
  },

  // ============ Work Experience ============

  currentCompany: {
    patterns: [
      /current.?company/i, /current.?employer/i, /employer/i,
      /company.?name/i, /organization/i, /firm/i,
      /most.?recent.?company/i, /present.?company/i,
      /arbeitgeber/i, /entreprise/i, /empresa/i             // German, French, Spanish
    ],
    autocomplete: ['organization'],
    profilePath: 'workHistory[0].company'
  },

  currentTitle: {
    patterns: [
      /current.?title/i, /job.?title/i, /current.?position/i,
      /position/i, /role/i, /designation/i,
      /most.?recent.?title/i, /present.?position/i,
      /jobtitel/i, /puesto/i, /poste/i                      // German, Spanish, French
    ],
    autocomplete: ['organization-title'],
    profilePath: 'workHistory[0].title'
  },

  workLocation: {
    patterns: [
      /work.?location/i, /job.?location/i, /employer.?location/i,
      /company.?location/i, /office.?location/i,
      /where.?do.?you.?work/i, /current.?location/i
    ],
    profilePath: 'workHistory[0].location'
  },

  workStartDate: {
    patterns: [
      /start.?date/i, /date.?started/i, /joined.?date/i,
      /employment.?start/i, /from.?date/i, /starting.?date/i,
      /when.?did.?you.?start/i, /hire.?date/i
    ],
    profilePath: 'workHistory[0].startDate'
  },

  workEndDate: {
    patterns: [
      /end.?date/i, /date.?ended/i, /left.?date/i,
      /employment.?end/i, /to.?date/i, /ending.?date/i,
      /when.?did.?you.?leave/i, /termination.?date/i
    ],
    profilePath: 'workHistory[0].endDate'
  },

  workDescription: {
    patterns: [
      /job.?description/i, /role.?description/i, /responsibilities/i,
      /duties/i, /job.?duties/i, /work.?description/i,
      /describe.?your.?role/i, /describe.?your.?work/i,
      /what.?did.?you.?do/i, /job.?summary/i
    ],
    profilePath: 'workHistory[0].description',
    textarea: true
  },

  previousCompany: {
    patterns: [
      /previous.?company/i, /previous.?employer/i, /past.?employer/i,
      /former.?company/i, /last.?company/i, /prior.?employer/i
    ],
    profilePath: 'workHistory[1].company'
  },

  previousTitle: {
    patterns: [
      /previous.?title/i, /previous.?position/i, /past.?position/i,
      /former.?title/i, /last.?position/i, /prior.?title/i
    ],
    profilePath: 'workHistory[1].title'
  },

  yearsExperience: {
    patterns: [
      /years?.?(?:of)?.?experience/i, /experience.?years/i,
      /total.?experience/i, /work.?experience/i,
      /berufserfahrung/i, /experiencia/i                    // German, Spanish
    ],
    profilePath: 'personal.yearsExperience'
  },

  // ============ Education ============

  school: {
    patterns: [
      /school/i, /university/i, /college/i, /institution/i,
      /alma.?mater/i, /educational.?institution/i,
      /universit.t/i, /hochschule/i, /universidad/i         // German, Spanish
    ],
    profilePath: 'education[0].school'
  },

  degree: {
    patterns: [
      /degree/i, /qualification/i, /diploma/i,
      /abschluss/i, /diplom/i, /titulo/i, /grado/i          // German, Spanish
    ],
    profilePath: 'education[0].degree'
  },

  fieldOfStudy: {
    patterns: [
      /field.?of.?study/i, /major/i, /specialization/i,
      /concentration/i, /course/i, /program/i,
      /fachrichtung/i, /especialidad/i, /sp.cialit/i        // German, Spanish, French
    ],
    profilePath: 'education[0].field'
  },

  graduationYear: {
    patterns: [
      /graduation.?year/i, /grad.?year/i, /year.?graduated/i,
      /completion.?year/i, /year.?of.?graduation/i
    ],
    profilePath: 'education[0].graduationYear'
  },

  gpa: {
    patterns: [/gpa/i, /grade.?point/i, /cgpa/i, /grades/i],
    profilePath: 'education[0].gpa'
  },

  // ============ Compensation ============

  currentCtc: {
    patterns: [
      /current.?ctc/i, /current.?salary/i, /present.?salary/i,
      /current.?compensation/i, /current.?package/i,
      /ctc.?\(?fixed\)?/i, /fixed.?ctc/i, /base.?salary/i,
      /existing.?salary/i, /current.?annual/i,
      /aktuelles.?gehalt/i, /salario.?actual/i              // German, Spanish
    ],
    profilePath: 'personal.currentCtc',
    format: 'ctc'
  },

  expectedCtc: {
    patterns: [
      /expected.?ctc/i, /expected.?salary/i, /desired.?salary/i,
      /expected.?compensation/i, /expected.?package/i,
      /salary.?expectation/i, /asking.?salary/i,
      /target.?salary/i, /preferred.?salary/i,
      /gehaltsvorstellung/i, /salario.?esperado/i           // German, Spanish
    ],
    profilePath: 'personal.expectedCtc',
    format: 'ctc'
  },

  noticePeriod: {
    patterns: [
      /notice.?period/i, /notice/i, /availability/i,
      /joining.?time/i, /start.?date/i, /available.?from/i,
      /k.ndigungsfrist/i, /periodo.?de.?aviso/i             // German, Spanish
    ],
    profilePath: 'personal.noticePeriod'
  },

  // ============ Date of Birth ============

  birthDay: {
    patterns: [
      /(?:dd)|(?:bday)|(?:birth.?day)|(?:dob.?day)|(?:birth.?1)/i,
      /day.?of.?birth/i, /^day$/i
    ],
    autocomplete: ['bday-day'],
    profilePath: 'personal.birthDay'
  },

  birthMonth: {
    patterns: [
      /(?:mm)|(?:bmon)|(?:birth.?mon)|(?:dob.?mon)|(?:birth.?2)/i,
      /month.?of.?birth/i, /^month$/i
    ],
    autocomplete: ['bday-month'],
    profilePath: 'personal.birthMonth'
  },

  birthYear: {
    patterns: [
      /(?:yy)|(?:byear)|(?:birth.?year)|(?:dob.?year)|(?:birth.?3)/i,
      /year.?of.?birth/i
    ],
    autocomplete: ['bday-year'],
    profilePath: 'personal.birthYear'
  },

  dateOfBirth: {
    patterns: [
      /date.?of.?birth/i, /dob/i, /birth.?date/i, /birthday/i,
      /geburtsdatum/i, /fecha.?de.?nacimiento/i             // German, Spanish
    ],
    autocomplete: ['bday'],
    profilePath: 'personal.dateOfBirth'
  },

  // ============ Additional Personal Fields ============

  gender: {
    patterns: [
      /gender/i, /sex/i, /geschlecht/i, /genero/i, /sexe/i  // German, Spanish, French
    ],
    autocomplete: ['sex'],
    profilePath: 'personal.gender'
  },

  nationality: {
    patterns: [
      /nationality/i, /citizenship/i, /citizen/i,
      /staatsangeh.rigkeit/i, /nacionalidad/i               // German, Spanish
    ],
    profilePath: 'personal.nationality'
  },

  veteranStatus: {
    patterns: [/veteran/i, /military/i, /armed.?forces/i, /service.?member/i],
    profilePath: 'personal.veteranStatus'
  },

  disability: {
    patterns: [/disability/i, /disabled/i, /handicap/i, /special.?needs/i],
    profilePath: 'personal.disability'
  },

  authorizedToWork: {
    patterns: [
      /authorized.?to.?work/i, /work.?authorization/i,
      /legally.?authorized/i, /right.?to.?work/i, /work.?permit/i,
      /visa.?status/i, /employment.?eligibility/i
    ],
    profilePath: 'personal.authorizedToWork'
  },

  requireSponsorship: {
    patterns: [
      /sponsor/i, /visa.?sponsor/i, /require.?sponsor/i,
      /need.?sponsor/i, /immigration.?sponsor/i
    ],
    profilePath: 'personal.requireSponsorship'
  },

  // Username (excluding password fields)
  username: {
    patterns: [
      /(?:username|login|user_id|membername)(?!.*pass)/i,
      /^user$/i, /^login$/i
    ],
    autocomplete: ['username'],
    profilePath: 'personal.username'
  },

  // ============ Cover Letter ============

  coverLetter: {
    patterns: [
      /cover.?letter/i, /covering.?letter/i,
      /motivation.?letter/i, /letter.?of.?motivation/i,
      /intro.?letter/i, /introduction.?letter/i,
      /anschreiben/i, /lettre.?de.?motivation/i, /carta.?de.?presentacion/i  // German, French, Spanish
    ],
    profilePath: 'coverLetters.default',
    requiresSelection: true,
    textarea: true
  },

  // ============ Skills ============

  skills: {
    patterns: [/\bskills?\b/i, /competenc/i, /expertise/i, /proficienc/i],
    profilePath: 'skills',
    formatter: 'skillsAll'
  },

  technicalSkills: {
    patterns: [/technical.?skills?/i, /programming/i, /technologies/i, /tech.?stack/i, /coding/i],
    profilePath: 'skills.languages',
    formatter: 'arrayJoin'
  },

  frameworks: {
    patterns: [/frameworks?/i, /libraries/i],
    profilePath: 'skills.frameworks',
    formatter: 'arrayJoin'
  },

  tools: {
    patterns: [/tools?/i, /software/i, /platforms?/i],
    profilePath: 'skills.tools',
    formatter: 'arrayJoin'
  },

  softSkills: {
    patterns: [/soft.?skills?/i, /interpersonal/i, /leadership.?skills/i],
    profilePath: 'skills.soft',
    formatter: 'arrayJoin'
  },

  // ============ Q&A ============

  customQA: {
    patterns: [/question|answer|screening|additional.?info/i],
    profilePath: 'customQA',
    matcher: 'keywordQA'
  },

  // ============ Terms & Conditions (NEW) ============

  agreeTerms: {
    patterns: [
      /agree/i, /terms/i, /conditions/i, /accept/i, /consent/i,
      /acknowledge/i, /privacy.?policy/i, /\btos\b/i,
      /i.?have.?read/i, /i.?accept/i, /i.?agree/i
    ],
    autoCheck: true,
    profilePath: null  // No profile path - always auto-check
  }
};

/**
 * Patterns for detecting confirmation fields (email confirm, password confirm, etc.)
 * Uses centralized config if available
 */
const CONFIRM_PATTERNS = (() => {
  if (typeof window !== 'undefined' && window.JobTrackerConfig?.CONFIRM_PATTERNS) {
    return window.JobTrackerConfig.CONFIRM_PATTERNS;
  }
  return [
    /confirm/i,
    /re-?enter/i,
    /re-?type/i,
    /repeat/i,
    /secondary/i,
    /verify/i,
    /validation/i
  ];
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerFieldPatterns = {
    CERTAINTY_LEVELS,
    ATTRIBUTE_PRIORITY,
    FIELD_PATTERNS,
    CONFIRM_PATTERNS,

    // Provide accessor methods for registry integration
    getPattern(fieldType) {
      // First try registry if available
      if (window.JobTrackerFieldRegistry) {
        const config = window.JobTrackerFieldRegistry.getFieldConfig(fieldType);
        if (config) return config;
      }
      // Fall back to local FIELD_PATTERNS
      return FIELD_PATTERNS[fieldType] || null;
    },

    getAllPatterns(fieldType) {
      if (window.JobTrackerFieldRegistry) {
        return window.JobTrackerFieldRegistry.getAllPatterns(fieldType);
      }
      const pattern = FIELD_PATTERNS[fieldType];
      return pattern ? pattern.patterns : [];
    }
  };

  // Register with namespace if available
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('field-patterns');
  }
}
