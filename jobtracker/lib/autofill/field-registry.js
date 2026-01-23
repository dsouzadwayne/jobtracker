/**
 * JobTracker Field Registry
 * Unified field definitions with consolidated patterns, i18n support,
 * autocomplete mappings, and semantic phrases
 */

const JobTrackerFieldRegistry = {
  /**
   * All field definitions
   * Each field has:
   * - patterns: { exact: [], partial: [], label: [] } - Regex patterns for matching
   * - i18n: { de: [], fr: [], es: [], pt: [], hi: [] } - International patterns
   * - negativePatterns: [] - Patterns that indicate this is NOT the field
   * - autocomplete: [] - HTML5 autocomplete values
   * - semanticPhrases: [] - Natural language phrases for NLP matching
   * - profilePath: string - Path in user profile
   * - weight: number - Field importance weight (default 1.0)
   * - inputType: string - Expected HTML input type
   * - options: {} - Additional options (textarea, autoCheck, combineFields, etc.)
   */
  FIELDS: {
    // ============ Personal Info ============
    firstName: {
      patterns: {
        exact: [/^first[-_]?name$/i, /^fname$/i, /^given[-_]?name$/i, /^first$/i],
        partial: [/first[-_]?name/i, /fname/i, /given[-_]?name/i],
        label: [/first\s*name/i, /given\s*name/i, /^first$/i]
      },
      i18n: {
        de: [/vorname/i],
        fr: [/pr[ée]nom/i],
        es: [/nombre(?!\s*completo)/i],
        pt: [/nome(?!\s*completo)/i, /primeiro\s*nome/i],
        hi: [/\u092a\u0939\u0932\u093e\s*\u0928\u093e\u092e/i]  // पहला नाम
      },
      negativePatterns: [/middle/i, /last/i, /surname/i, /company/i, /full/i],
      autocomplete: ['given-name'],
      semanticPhrases: ['first name', 'given name', 'forename'],
      profilePath: 'personal.firstName',
      weight: 1.0,
      inputType: 'text'
    },

    middleName: {
      patterns: {
        exact: [/^middle[-_]?name$/i, /^mname$/i, /^middle[-_]?initial$/i],
        partial: [/middle[-_]?name/i, /mname/i, /middle[-_]?initial/i],
        label: [/middle\s*name/i, /middle\s*initial/i]
      },
      i18n: {
        de: [/zweiter\s*vorname/i],
        es: [/segundo\s*nombre/i],
        pt: [/nome\s*do\s*meio/i]
      },
      negativePatterns: [],
      autocomplete: ['additional-name'],
      semanticPhrases: ['middle name', 'middle initial'],
      profilePath: 'personal.middleName',
      weight: 0.8,
      inputType: 'text'
    },

    lastName: {
      patterns: {
        exact: [/^last[-_]?name$/i, /^lname$/i, /^surname$/i, /^family[-_]?name$/i],
        partial: [/last[-_]?name/i, /lname/i, /surname/i, /family[-_]?name/i],
        label: [/last\s*name/i, /family\s*name/i, /surname/i, /^last$/i]
      },
      i18n: {
        de: [/nachname/i, /familienname/i],
        fr: [/nom\s*de\s*famille/i, /nom$/i],
        es: [/apellido/i],
        pt: [/sobrenome/i, /apelido/i],
        hi: [/\u0909\u092a\u0928\u093e\u092e/i]  // उपनाम
      },
      negativePatterns: [/first/i, /middle/i, /given/i, /company/i],
      autocomplete: ['family-name'],
      semanticPhrases: ['last name', 'family name', 'surname'],
      profilePath: 'personal.lastName',
      weight: 1.0,
      inputType: 'text'
    },

    fullName: {
      patterns: {
        exact: [/^full[-_]?name$/i, /^name$/i, /^your[-_]?name$/i],
        partial: [/full[-_]?name/i, /complete[-_]?name/i, /legal[-_]?name/i],
        label: [/full\s*name/i, /your\s*name/i, /complete\s*name/i, /^name$/i]
      },
      i18n: {
        de: [/vollst[aä]ndiger\s*name/i],
        fr: [/nom\s*complet/i],
        es: [/nombre\s*completo/i],
        pt: [/nome\s*completo/i]
      },
      negativePatterns: [/company/i, /employer/i, /school/i],
      autocomplete: ['name'],
      semanticPhrases: ['full name', 'complete name', 'your name', 'legal name', 'candidate name', 'applicant name'],
      profilePath: null,  // Uses combineFields
      weight: 1.0,
      inputType: 'text',
      options: {
        combineFields: ['personal.firstName', 'personal.middleName', 'personal.lastName']
      }
    },

    email: {
      patterns: {
        exact: [/^e?-?mail$/i, /^email[-_]?address$/i, /^user[-_]?email$/i],
        partial: [/e?-?mail/i, /email[-_]?address/i],
        label: [/e[-]?mail/i, /email\s*address/i]
      },
      i18n: {
        de: [/e-?mail/i],
        fr: [/courriel/i, /adresse\s*[ée]lectronique/i],
        es: [/correo/i, /correo\s*electr[oó]nico/i],
        pt: [/email/i, /correio\s*electr[oô]nico/i]
      },
      negativePatterns: [/confirm/i, /verify/i, /repeat/i, /re[-_]?enter/i],
      autocomplete: ['email'],
      semanticPhrases: ['email address', 'e-mail address', 'your email', 'contact email'],
      profilePath: 'personal.email',
      weight: 1.2,
      inputType: 'email'
    },

    phone: {
      patterns: {
        exact: [/^phone$/i, /^mobile$/i, /^tel$/i, /^phone[-_]?number$/i, /^cell$/i],
        partial: [/phone/i, /mobile/i, /tel(?:ephone)?/i, /cell/i, /contact[-_]?number/i],
        label: [/phone/i, /mobile/i, /telephone/i, /cell/i, /contact\s*number/i]
      },
      i18n: {
        de: [/telefon/i, /handynummer/i, /rufnummer/i],
        fr: [/t[ée]l[ée]phone/i, /num[ée]ro/i],
        es: [/tel[ée]fono/i, /m[oó]vil/i, /celular/i],
        pt: [/telefone/i, /telem[oó]vel/i, /celular/i],
        hi: [/\u092b\u093c\u094b\u0928/i]  // फ़ोन
      },
      negativePatterns: [/fax/i, /work[-_]?phone/i, /office/i, /alternate/i],
      autocomplete: ['tel', 'tel-national', 'tel-local'],
      semanticPhrases: ['phone number', 'telephone number', 'mobile number', 'cell number', 'contact number', 'your phone'],
      profilePath: 'personal.phone',
      weight: 1.1,
      inputType: 'tel'
    },

    // ============ Address ============
    street: {
      patterns: {
        exact: [/^street$/i, /^address[-_]?1$/i, /^address[-_]?line$/i, /^address$/i],
        partial: [/street/i, /address[-_]?line/i, /mailing[-_]?address/i],
        label: [/street/i, /address\s*(line)?\s*1?$/i, /mailing\s*address/i]
      },
      i18n: {
        de: [/stra[sß]e/i, /adresse/i],
        fr: [/rue/i, /adresse/i],
        es: [/calle/i, /direcci[oó]n/i],
        pt: [/rua/i, /endere[cç]o/i, /morada/i]
      },
      negativePatterns: [/email/i, /web/i, /url/i, /city/i, /state/i, /zip/i, /country/i],
      autocomplete: ['street-address', 'address-line1'],
      semanticPhrases: ['street address', 'address line 1', 'mailing address'],
      profilePath: 'personal.address.street',
      weight: 0.8,
      inputType: 'text'
    },

    addressLine2: {
      patterns: {
        exact: [/^address[-_]?2$/i, /^address[-_]?line[-_]?2$/i, /^apt$/i],
        partial: [/address[-_]?2/i, /address[-_]?line[-_]?2/i, /apt/i, /suite/i, /unit/i],
        label: [/address\s*2/i, /address\s*line\s*2/i, /apt/i, /suite/i, /unit/i, /apartment/i]
      },
      i18n: {
        de: [/adresszeile\s*2/i],
        es: [/l[ií]nea\s*2/i, /apartamento/i],
        pt: [/linha\s*2/i, /apartamento/i]
      },
      negativePatterns: [],
      autocomplete: ['address-line2'],
      semanticPhrases: ['address line 2', 'apartment number', 'suite number', 'unit number'],
      profilePath: 'personal.address.addressLine2',
      weight: 0.7,
      inputType: 'text'
    },

    city: {
      patterns: {
        exact: [/^city$/i, /^town$/i, /^locality$/i],
        partial: [/city/i, /town/i, /locality/i, /municipality/i],
        label: [/city/i, /town/i, /locality/i]
      },
      i18n: {
        de: [/stadt/i, /ort/i],
        fr: [/ville/i, /cit[ée]/i],
        es: [/ciudad/i, /localidad/i],
        pt: [/cidade/i, /localidade/i]
      },
      negativePatterns: [/job[-_]?location/i, /work[-_]?location/i, /country/i, /state/i, /zip/i],
      autocomplete: ['address-level2'],
      semanticPhrases: ['city name', 'your city'],
      profilePath: 'personal.address.city',
      weight: 0.9,
      inputType: 'text'
    },

    state: {
      patterns: {
        exact: [/^state$/i, /^province$/i, /^region$/i],
        partial: [/state/i, /province/i, /region/i, /prefecture/i],
        label: [/state/i, /province/i, /region/i, /county/i]
      },
      i18n: {
        de: [/bundesland/i, /kanton/i],
        fr: [/r[ée]gion/i, /province/i, /d[ée]partement/i],
        es: [/provincia/i, /estado/i, /regi[oó]n/i],
        pt: [/estado/i, /prov[ií]ncia/i, /regi[aã]o/i]
      },
      negativePatterns: [/country/i, /city/i, /zip/i],
      autocomplete: ['address-level1'],
      semanticPhrases: ['state province', 'state region', 'your state'],
      profilePath: 'personal.address.state',
      weight: 0.9,
      inputType: 'text'
    },

    zipCode: {
      patterns: {
        exact: [/^zip$/i, /^postal$/i, /^postcode$/i, /^pin[-_]?code$/i],
        partial: [/zip/i, /postal/i, /postcode/i, /pin[-_]?code/i],
        label: [/zip/i, /postal/i, /post\s*code/i, /pin\s*code/i]
      },
      i18n: {
        de: [/postleitzahl/i, /plz/i],
        fr: [/code\s*postal/i],
        es: [/c[oó]digo\s*postal/i],
        pt: [/c[oó]digo\s*postal/i, /cep/i]
      },
      negativePatterns: [/city/i, /state/i, /country/i],
      autocomplete: ['postal-code'],
      semanticPhrases: ['zip code', 'postal code', 'pin code'],
      profilePath: 'personal.address.zipCode',
      weight: 0.9,
      inputType: 'text'
    },

    country: {
      patterns: {
        exact: [/^country$/i, /^nation$/i],
        partial: [/country/i, /nation/i, /country[-_]?code/i],
        label: [/country/i, /nation/i]
      },
      i18n: {
        de: [/land/i],
        fr: [/pays/i],
        es: [/pa[ií]s/i],
        pt: [/pa[ií]s/i]
      },
      negativePatterns: [/city/i, /state/i, /zip/i, /code/i],
      autocomplete: ['country-name', 'country'],
      semanticPhrases: ['country name', 'your country'],
      profilePath: 'personal.address.country',
      weight: 0.9,
      inputType: 'text'
    },

    // ============ Social/Professional Links ============
    linkedIn: {
      patterns: {
        exact: [/^linkedin$/i, /^linked[-_]?in$/i],
        partial: [/linkedin/i, /linked[-_]?in/i],
        label: [/linkedin/i, /linked\s*in/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['linkedin profile', 'linkedin url', 'linkedin profile url', 'linkedin address', 'your linkedin'],
      profilePath: 'personal.linkedIn',
      weight: 1.0,
      inputType: 'url'
    },

    github: {
      patterns: {
        exact: [/^github$/i, /^git[-_]?hub$/i],
        partial: [/github/i, /git[-_]?hub/i],
        label: [/github/i, /git\s*hub/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['github profile', 'github url', 'github username'],
      profilePath: 'personal.github',
      weight: 1.0,
      inputType: 'url'
    },

    portfolio: {
      patterns: {
        exact: [/^portfolio$/i, /^website$/i, /^homepage$/i, /^url$/i],
        partial: [/portfolio/i, /website/i, /personal[-_]?site/i, /personal[-_]?url/i, /homepage/i],
        label: [/portfolio/i, /website/i, /personal\s*site/i, /homepage/i, /your\s*url/i]
      },
      i18n: {
        de: [/webseite/i, /portfolio/i],
        fr: [/site\s*web/i, /portfolio/i],
        es: [/sitio\s*web/i, /portfolio/i],
        pt: [/site/i, /portfolio/i]
      },
      negativePatterns: [/linkedin/i, /github/i, /twitter/i, /facebook/i, /company/i],
      autocomplete: ['url'],
      semanticPhrases: ['portfolio url', 'portfolio website', 'personal website', 'personal site', 'your website'],
      profilePath: 'personal.portfolio',
      weight: 0.9,
      inputType: 'url'
    },

    twitter: {
      patterns: {
        exact: [/^twitter$/i, /^x$/i],
        partial: [/twitter/i],
        label: [/twitter/i, /x\s*\(.*twitter\)/i, /^x$/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['twitter handle', 'twitter profile', 'x handle'],
      profilePath: 'personal.twitter',
      weight: 1.0,
      inputType: 'url'
    },

    username: {
      patterns: {
        exact: [/^username$/i, /^user[-_]?name$/i, /^login$/i, /^user[-_]?id$/i],
        partial: [/username/i, /user[-_]?name/i, /login[-_]?name/i, /user[-_]?id/i],
        label: [/username/i, /user\s*name/i, /login/i, /user\s*id/i]
      },
      i18n: {
        de: [/benutzername/i],
        fr: [/nom\s*d['']utilisateur/i],
        es: [/nombre\s*de\s*usuario/i],
        pt: [/nome\s*de\s*usu[áa]rio/i]
      },
      negativePatterns: [/password/i, /email/i],
      autocomplete: ['username'],
      semanticPhrases: ['username', 'user name', 'login name', 'user id'],
      profilePath: 'personal.username',
      weight: 0.8,
      inputType: 'text'
    },

    // ============ Work Experience ============
    currentCompany: {
      patterns: {
        exact: [/^current[-_]?company$/i, /^employer$/i, /^company[-_]?name$/i],
        partial: [/current[-_]?company/i, /current[-_]?employer/i, /employer/i, /company[-_]?name/i],
        label: [/current\s*company/i, /current\s*employer/i, /company\s*name/i, /employer/i, /organization/i]
      },
      i18n: {
        de: [/arbeitgeber/i, /unternehmen/i, /firma/i],
        fr: [/entreprise/i, /employeur/i, /soci[ée]t[ée]/i],
        es: [/empresa/i, /empleador/i, /compa[nñ][ií]a/i],
        pt: [/empresa/i, /empregador/i]
      },
      negativePatterns: [/previous/i, /past/i, /former/i],
      autocomplete: ['organization'],
      semanticPhrases: ['current company', 'current employer', 'company name', 'employer name', 'present employer'],
      profilePath: 'workHistory[0].company',
      weight: 0.8,
      inputType: 'text'
    },

    currentTitle: {
      patterns: {
        exact: [/^current[-_]?title$/i, /^job[-_]?title$/i, /^position$/i, /^role$/i],
        partial: [/current[-_]?title/i, /job[-_]?title/i, /position/i, /role/i, /designation/i],
        label: [/current\s*title/i, /job\s*title/i, /position/i, /role/i, /designation/i]
      },
      i18n: {
        de: [/jobtitel/i, /position/i, /stelle/i],
        fr: [/poste/i, /titre/i, /fonction/i],
        es: [/puesto/i, /t[ií]tulo/i, /cargo/i],
        pt: [/cargo/i, /posi[cç][aã]o/i, /fun[cç][aã]o/i]
      },
      negativePatterns: [/previous/i, /past/i, /former/i, /mr\./i, /mrs\./i, /ms\./i, /dr\./i],
      autocomplete: ['organization-title'],
      semanticPhrases: ['current title', 'job title', 'current position', 'current role', 'position title'],
      profilePath: 'workHistory[0].title',
      weight: 0.8,
      inputType: 'text'
    },

    previousCompany: {
      patterns: {
        exact: [/^previous[-_]?company$/i, /^past[-_]?employer$/i, /^former[-_]?company$/i],
        partial: [/previous[-_]?company/i, /past[-_]?employer/i, /former[-_]?company/i, /prior[-_]?employer/i],
        label: [/previous\s*company/i, /past\s*employer/i, /former\s*company/i, /prior\s*employer/i]
      },
      i18n: {
        de: [/vorheriger\s*arbeitgeber/i, /fr[üu]herer\s*arbeitgeber/i],
        es: [/empresa\s*anterior/i, /empleador\s*anterior/i],
        pt: [/empresa\s*anterior/i, /empregador\s*anterior/i]
      },
      negativePatterns: [/current/i, /present/i],
      autocomplete: [],
      semanticPhrases: ['previous company', 'past employer', 'former company', 'prior employer'],
      profilePath: 'workHistory[1].company',
      weight: 0.7,
      inputType: 'text'
    },

    previousTitle: {
      patterns: {
        exact: [/^previous[-_]?title$/i, /^past[-_]?title$/i, /^former[-_]?title$/i],
        partial: [/previous[-_]?title/i, /past[-_]?title/i, /former[-_]?title/i, /prior[-_]?title/i],
        label: [/previous\s*title/i, /past\s*title/i, /former\s*title/i, /prior\s*position/i]
      },
      i18n: {
        de: [/vorherige\s*position/i, /fr[üu]here\s*stelle/i],
        es: [/puesto\s*anterior/i, /t[ií]tulo\s*anterior/i],
        pt: [/cargo\s*anterior/i, /posi[cç][aã]o\s*anterior/i]
      },
      negativePatterns: [/current/i, /present/i],
      autocomplete: [],
      semanticPhrases: ['previous title', 'past title', 'former title', 'prior position'],
      profilePath: 'workHistory[1].title',
      weight: 0.7,
      inputType: 'text'
    },

    workLocation: {
      patterns: {
        exact: [/^work[-_]?location$/i, /^job[-_]?location$/i],
        partial: [/work[-_]?location/i, /job[-_]?location/i, /employer[-_]?location/i],
        label: [/work\s*location/i, /job\s*location/i, /company\s*location/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['work location', 'job location', 'employer location', 'company location'],
      profilePath: 'workHistory[0].location',
      weight: 0.7,
      inputType: 'text'
    },

    workStartDate: {
      patterns: {
        exact: [/^start[-_]?date$/i, /^date[-_]?started$/i],
        partial: [/start[-_]?date/i, /date[-_]?started/i, /joined[-_]?date/i, /employment[-_]?start/i],
        label: [/start\s*date/i, /date\s*started/i, /joined\s*date/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['start date', 'date started', 'joined date', 'hire date'],
      profilePath: 'workHistory[0].startDate',
      weight: 0.7,
      inputType: 'date'
    },

    workEndDate: {
      patterns: {
        exact: [/^end[-_]?date$/i, /^date[-_]?ended$/i],
        partial: [/end[-_]?date/i, /date[-_]?ended/i, /left[-_]?date/i, /employment[-_]?end/i],
        label: [/end\s*date/i, /date\s*ended/i, /left\s*date/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['end date', 'date ended', 'left date', 'termination date'],
      profilePath: 'workHistory[0].endDate',
      weight: 0.7,
      inputType: 'date'
    },

    workDescription: {
      patterns: {
        exact: [/^job[-_]?description$/i, /^role[-_]?description$/i],
        partial: [/job[-_]?description/i, /role[-_]?description/i, /responsibilities/i, /duties/i],
        label: [/job\s*description/i, /role\s*description/i, /responsibilities/i, /duties/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['job description', 'role description', 'responsibilities', 'duties'],
      profilePath: 'workHistory[0].description',
      weight: 0.7,
      inputType: 'text',
      options: { textarea: true }
    },

    yearsExperience: {
      patterns: {
        exact: [/^years[-_]?experience$/i, /^experience[-_]?years$/i],
        partial: [/years?[-_]?(?:of[-_]?)?experience/i, /experience[-_]?years/i, /total[-_]?experience/i],
        label: [/years?\s*(?:of)?\s*experience/i, /total\s*experience/i, /work\s*experience/i]
      },
      i18n: {
        de: [/berufserfahrung/i, /jahre\s*erfahrung/i],
        es: [/experiencia/i, /a[nñ]os\s*de\s*experiencia/i],
        pt: [/experi[eê]ncia/i, /anos\s*de\s*experi[eê]ncia/i]
      },
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['years of experience', 'total experience', 'work experience', 'professional experience'],
      profilePath: 'personal.yearsExperience',
      weight: 0.8,
      inputType: 'text'
    },

    // ============ Education ============
    school: {
      patterns: {
        exact: [/^school$/i, /^university$/i, /^college$/i, /^institution$/i],
        partial: [/school/i, /university/i, /college/i, /institution/i, /alma[-_]?mater/i],
        label: [/school/i, /university/i, /college/i, /institution/i, /alma\s*mater/i]
      },
      i18n: {
        de: [/universit[aä]t/i, /hochschule/i, /schule/i],
        fr: [/universit[ée]/i, /[ée]cole/i],
        es: [/universidad/i, /escuela/i, /instituci[oó]n/i],
        pt: [/universidade/i, /escola/i, /institui[cç][aã]o/i]
      },
      negativePatterns: [/high\s*school/i],
      autocomplete: [],
      semanticPhrases: ['school name', 'university name', 'college name', 'institution name'],
      profilePath: 'education[0].school',
      weight: 0.8,
      inputType: 'text'
    },

    degree: {
      patterns: {
        exact: [/^degree$/i, /^qualification$/i, /^diploma$/i],
        partial: [/degree/i, /qualification/i, /diploma/i],
        label: [/degree/i, /qualification/i, /diploma/i, /level\s*education/i]
      },
      i18n: {
        de: [/abschluss/i, /diplom/i],
        es: [/t[ií]tulo/i, /grado/i, /diploma/i],
        pt: [/grau/i, /diploma/i, /forma[cç][aã]o/i]
      },
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['degree name', 'qualification', 'educational qualification'],
      profilePath: 'education[0].degree',
      weight: 0.8,
      inputType: 'text'
    },

    fieldOfStudy: {
      patterns: {
        exact: [/^field[-_]?of[-_]?study$/i, /^major$/i, /^specialization$/i],
        partial: [/field[-_]?of[-_]?study/i, /major/i, /specialization/i, /concentration/i],
        label: [/field\s*of\s*study/i, /major/i, /specialization/i, /course/i, /subject/i]
      },
      i18n: {
        de: [/fachrichtung/i, /studiengang/i],
        fr: [/sp[ée]cialit[ée]/i, /fili[eè]re/i],
        es: [/especialidad/i, /carrera/i],
        pt: [/especialidade/i, /curso/i, /[áa]rea/i]
      },
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['field of study', 'major subject', 'specialization'],
      profilePath: 'education[0].field',
      weight: 0.8,
      inputType: 'text'
    },

    graduationYear: {
      patterns: {
        exact: [/^graduation[-_]?year$/i, /^grad[-_]?year$/i],
        partial: [/graduation[-_]?year/i, /grad[-_]?year/i, /year[-_]?graduated/i],
        label: [/graduation\s*year/i, /year\s*of\s*graduation/i, /grad\s*year/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['graduation year', 'year of graduation'],
      profilePath: 'education[0].graduationYear',
      weight: 0.8,
      inputType: 'text'
    },

    gpa: {
      patterns: {
        exact: [/^gpa$/i, /^cgpa$/i],
        partial: [/gpa/i, /cgpa/i, /grade[-_]?point/i, /grades/i],
        label: [/gpa/i, /cgpa/i, /grade\s*point/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['gpa', 'grade point average'],
      profilePath: 'education[0].gpa',
      weight: 0.7,
      inputType: 'text'
    },

    // ============ Compensation ============
    currentCtc: {
      patterns: {
        exact: [/^current[-_]?ctc$/i, /^current[-_]?salary$/i],
        partial: [/current[-_]?ctc/i, /current[-_]?salary/i, /present[-_]?salary/i, /existing[-_]?salary/i],
        label: [/current\s*ctc/i, /current\s*salary/i, /present\s*salary/i, /existing\s*salary/i]
      },
      i18n: {
        de: [/aktuelles\s*gehalt/i, /derzeitiges\s*gehalt/i],
        es: [/salario\s*actual/i],
        pt: [/sal[áa]rio\s*atual/i]
      },
      negativePatterns: [/expected/i, /desired/i],
      autocomplete: [],
      semanticPhrases: ['current salary', 'current ctc', 'present salary', 'existing salary', 'current compensation', 'current annual salary'],
      profilePath: 'personal.currentCtc',
      weight: 0.7,
      inputType: 'text',
      options: { format: 'ctc' }
    },

    expectedCtc: {
      patterns: {
        exact: [/^expected[-_]?ctc$/i, /^expected[-_]?salary$/i, /^desired[-_]?salary$/i],
        partial: [/expected[-_]?ctc/i, /expected[-_]?salary/i, /desired[-_]?salary/i, /salary[-_]?expectation/i],
        label: [/expected\s*ctc/i, /expected\s*salary/i, /desired\s*salary/i, /salary\s*expectation/i]
      },
      i18n: {
        de: [/gehaltsvorstellung/i, /gewünschtes\s*gehalt/i],
        es: [/salario\s*esperado/i, /expectativa\s*salarial/i],
        pt: [/sal[áa]rio\s*esperado/i, /pretens[aã]o\s*salarial/i]
      },
      negativePatterns: [/current/i, /present/i],
      autocomplete: [],
      semanticPhrases: ['expected salary', 'expected ctc', 'desired salary', 'salary expectation', 'expected compensation', 'target salary', 'preferred salary', 'asking salary'],
      profilePath: 'personal.expectedCtc',
      weight: 0.7,
      inputType: 'text',
      options: { format: 'ctc' }
    },

    noticePeriod: {
      patterns: {
        exact: [/^notice[-_]?period$/i, /^notice$/i, /^availability$/i],
        partial: [/notice[-_]?period/i, /notice/i, /availability/i, /joining[-_]?time/i],
        label: [/notice\s*period/i, /availability/i, /when\s*can\s*you\s*join/i]
      },
      i18n: {
        de: [/k[üu]ndigungsfrist/i],
        es: [/periodo\s*de\s*aviso/i, /preaviso/i],
        pt: [/per[íi]odo\s*de\s*aviso/i, /prazo\s*de\s*aviso/i]
      },
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['notice period', 'joining time', 'availability'],
      profilePath: 'personal.noticePeriod',
      weight: 0.7,
      inputType: 'text'
    },

    // ============ Date of Birth ============
    dateOfBirth: {
      patterns: {
        exact: [/^date[-_]?of[-_]?birth$/i, /^dob$/i, /^birthday$/i],
        partial: [/date[-_]?of[-_]?birth/i, /dob/i, /birth[-_]?date/i, /birthday/i],
        label: [/date\s*of\s*birth/i, /birth\s*date/i, /birthday/i]
      },
      i18n: {
        de: [/geburtsdatum/i],
        fr: [/date\s*de\s*naissance/i],
        es: [/fecha\s*de\s*nacimiento/i],
        pt: [/data\s*de\s*nascimento/i]
      },
      negativePatterns: [],
      autocomplete: ['bday'],
      semanticPhrases: ['date of birth', 'birth date', 'birthday'],
      profilePath: 'personal.dateOfBirth',
      weight: 0.8,
      inputType: 'date'
    },

    birthDay: {
      patterns: {
        exact: [/^birth[-_]?day$/i, /^bday[-_]?day$/i, /^day[-_]?of[-_]?birth$/i],
        partial: [/birth[-_]?day/i, /bday[-_]?day/i],
        label: [/birth\s*day/i, /day\s*of\s*birth/i, /^day$/i]
      },
      i18n: {
        de: [/geburtstag/i],
        fr: [/jour\s*de\s*naissance/i],
        es: [/d[ií]a\s*de\s*nacimiento/i],
        pt: [/dia\s*de\s*nascimento/i]
      },
      negativePatterns: [],
      autocomplete: ['bday-day'],
      semanticPhrases: ['birth day', 'day of birth'],
      profilePath: 'personal.birthDay',
      weight: 0.7,
      inputType: 'text'
    },

    birthMonth: {
      patterns: {
        exact: [/^birth[-_]?month$/i, /^bday[-_]?month$/i, /^month[-_]?of[-_]?birth$/i],
        partial: [/birth[-_]?month/i, /bday[-_]?month/i],
        label: [/birth\s*month/i, /month\s*of\s*birth/i, /^month$/i]
      },
      i18n: {
        de: [/geburtsmonat/i],
        fr: [/mois\s*de\s*naissance/i],
        es: [/mes\s*de\s*nacimiento/i],
        pt: [/m[êe]s\s*de\s*nascimento/i]
      },
      negativePatterns: [],
      autocomplete: ['bday-month'],
      semanticPhrases: ['birth month', 'month of birth'],
      profilePath: 'personal.birthMonth',
      weight: 0.7,
      inputType: 'text'
    },

    birthYear: {
      patterns: {
        exact: [/^birth[-_]?year$/i, /^bday[-_]?year$/i, /^year[-_]?of[-_]?birth$/i],
        partial: [/birth[-_]?year/i, /bday[-_]?year/i],
        label: [/birth\s*year/i, /year\s*of\s*birth/i, /^year$/i]
      },
      i18n: {
        de: [/geburtsjahr/i],
        fr: [/ann[ée]e\s*de\s*naissance/i],
        es: [/a[nñ]o\s*de\s*nacimiento/i],
        pt: [/ano\s*de\s*nascimento/i]
      },
      negativePatterns: [],
      autocomplete: ['bday-year'],
      semanticPhrases: ['birth year', 'year of birth'],
      profilePath: 'personal.birthYear',
      weight: 0.7,
      inputType: 'text'
    },

    // ============ Additional Personal Fields ============
    gender: {
      patterns: {
        exact: [/^gender$/i, /^sex$/i],
        partial: [/gender/i, /sex/i],
        label: [/gender/i, /sex/i]
      },
      i18n: {
        de: [/geschlecht/i],
        fr: [/sexe/i, /genre/i],
        es: [/g[ée]nero/i, /sexo/i],
        pt: [/g[êe]nero/i, /sexo/i]
      },
      negativePatterns: [],
      autocomplete: ['sex'],
      semanticPhrases: ['gender', 'sex'],
      profilePath: 'personal.gender',
      weight: 0.7,
      inputType: 'text'
    },

    nationality: {
      patterns: {
        exact: [/^nationality$/i, /^citizenship$/i],
        partial: [/nationality/i, /citizenship/i, /citizen/i],
        label: [/nationality/i, /citizenship/i]
      },
      i18n: {
        de: [/staatsangeh[öo]rigkeit/i, /nationalit[äa]t/i],
        es: [/nacionalidad/i, /ciudadan[ií]a/i],
        pt: [/nacionalidade/i, /cidadania/i]
      },
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['nationality', 'citizenship'],
      profilePath: 'personal.nationality',
      weight: 0.7,
      inputType: 'text'
    },

    veteranStatus: {
      patterns: {
        exact: [/^veteran$/i, /^military$/i],
        partial: [/veteran/i, /military/i, /armed[-_]?forces/i, /service[-_]?member/i],
        label: [/veteran/i, /military/i, /armed\s*forces/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['veteran status', 'military service'],
      profilePath: 'personal.veteranStatus',
      weight: 0.6,
      inputType: 'text'
    },

    disability: {
      patterns: {
        exact: [/^disability$/i, /^disabled$/i],
        partial: [/disability/i, /disabled/i, /handicap/i, /special[-_]?needs/i],
        label: [/disability/i, /disabled/i, /special\s*needs/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['disability status', 'disabled'],
      profilePath: 'personal.disability',
      weight: 0.6,
      inputType: 'text'
    },

    authorizedToWork: {
      patterns: {
        exact: [/^authorized[-_]?to[-_]?work$/i, /^work[-_]?authorization$/i],
        partial: [/authorized[-_]?to[-_]?work/i, /work[-_]?authorization/i, /legally[-_]?authorized/i],
        label: [/authorized\s*to\s*work/i, /work\s*authorization/i, /legally\s*authorized/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['authorized to work', 'work authorization', 'legally authorized'],
      profilePath: 'personal.authorizedToWork',
      weight: 0.7,
      inputType: 'text'
    },

    requireSponsorship: {
      patterns: {
        exact: [/^sponsor$/i, /^sponsorship$/i],
        partial: [/sponsor/i, /visa[-_]?sponsor/i, /require[-_]?sponsor/i, /need[-_]?sponsor/i],
        label: [/sponsor/i, /visa\s*sponsor/i, /require\s*sponsor/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['require sponsorship', 'need sponsorship', 'visa sponsorship'],
      profilePath: 'personal.requireSponsorship',
      weight: 0.7,
      inputType: 'text'
    },

    // ============ Cover Letter ============
    coverLetter: {
      patterns: {
        exact: [/^cover[-_]?letter$/i, /^covering[-_]?letter$/i],
        partial: [/cover[-_]?letter/i, /covering[-_]?letter/i, /motivation[-_]?letter/i],
        label: [/cover\s*letter/i, /motivation\s*letter/i]
      },
      i18n: {
        de: [/anschreiben/i, /motivationsschreiben/i],
        fr: [/lettre\s*de\s*motivation/i],
        es: [/carta\s*de\s*presentaci[oó]n/i, /carta\s*de\s*motivaci[oó]n/i],
        pt: [/carta\s*de\s*apresenta[cç][aã]o/i, /carta\s*de\s*motiva[cç][aã]o/i]
      },
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['cover letter', 'motivation letter', 'introduction letter'],
      profilePath: 'coverLetters.default',
      weight: 0.8,
      inputType: 'text',
      options: { textarea: true, requiresSelection: true }
    },

    // ============ Skills ============
    skills: {
      patterns: {
        exact: [/^skills$/i],
        partial: [/skills?/i, /competenc/i, /expertise/i, /proficienc/i],
        label: [/skills/i, /competencies/i, /expertise/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['skills', 'competencies', 'expertise'],
      profilePath: 'skills',
      weight: 0.8,
      inputType: 'text',
      options: { formatter: 'skillsAll' }
    },

    technicalSkills: {
      patterns: {
        exact: [/^technical[-_]?skills$/i],
        partial: [/technical[-_]?skills?/i, /programming/i, /technologies/i, /tech[-_]?stack/i],
        label: [/technical\s*skills/i, /programming/i, /technologies/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['technical skills', 'programming languages', 'coding skills'],
      profilePath: 'skills.languages',
      weight: 0.8,
      inputType: 'text',
      options: { formatter: 'arrayJoin' }
    },

    softSkills: {
      patterns: {
        exact: [/^soft[-_]?skills$/i],
        partial: [/soft[-_]?skills?/i, /interpersonal/i, /people[-_]?skills/i],
        label: [/soft\s*skills/i, /interpersonal\s*skills/i, /people\s*skills/i]
      },
      i18n: {
        de: [/soziale\s*kompetenz/i, /soft\s*skills/i],
        es: [/habilidades\s*blandas/i, /habilidades\s*interpersonales/i],
        pt: [/habilidades\s*interpessoais/i, /soft\s*skills/i]
      },
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['soft skills', 'interpersonal skills', 'people skills', 'communication skills'],
      profilePath: 'skills.softSkills',
      weight: 0.7,
      inputType: 'text',
      options: { formatter: 'arrayJoin' }
    },

    tools: {
      patterns: {
        exact: [/^tools$/i],
        partial: [/tools?/i, /software[-_]?tools?/i, /dev[-_]?tools?/i],
        label: [/tools/i, /software\s*tools/i, /development\s*tools/i]
      },
      i18n: {
        de: [/werkzeuge/i, /tools/i],
        es: [/herramientas/i],
        pt: [/ferramentas/i]
      },
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['tools', 'software tools', 'development tools', 'dev tools'],
      profilePath: 'skills.tools',
      weight: 0.7,
      inputType: 'text',
      options: { formatter: 'arrayJoin' }
    },

    frameworks: {
      patterns: {
        exact: [/^frameworks$/i],
        partial: [/frameworks?/i, /libraries/i],
        label: [/frameworks/i, /libraries/i, /frameworks\s*and\s*libraries/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['frameworks', 'libraries', 'frameworks and libraries'],
      profilePath: 'skills.frameworks',
      weight: 0.7,
      inputType: 'text',
      options: { formatter: 'arrayJoin' }
    },

    // ============ Terms & Conditions ============
    agreeTerms: {
      patterns: {
        exact: [/^agree$/i, /^terms$/i, /^consent$/i],
        partial: [/agree/i, /terms/i, /conditions/i, /accept/i, /consent/i, /acknowledge/i, /privacy[-_]?policy/i],
        label: [/agree/i, /terms/i, /accept/i, /consent/i, /i\s*have\s*read/i]
      },
      i18n: {},
      negativePatterns: [],
      autocomplete: [],
      semanticPhrases: ['agree to terms', 'accept terms', 'consent'],
      profilePath: null,
      weight: 0.5,
      inputType: 'checkbox',
      options: { autoCheck: true }
    }
  },

  /**
   * Get patterns for a field type, optionally with locale-specific patterns
   * @param {string} fieldType - Field type name
   * @param {string|null} locale - Locale code (e.g., 'de', 'fr')
   * @returns {RegExp[]} Array of patterns
   */
  getPatterns(fieldType, locale = null) {
    const field = this.FIELDS[fieldType];
    if (!field) return [];

    const patterns = [
      ...(field.patterns.exact || []),
      ...(field.patterns.partial || []),
      ...(field.patterns.label || [])
    ];

    // Add locale-specific patterns if available
    if (locale && field.i18n && field.i18n[locale]) {
      patterns.push(...field.i18n[locale]);
    }

    return patterns;
  },

  /**
   * Get all patterns for a field (all locales combined)
   * @param {string} fieldType - Field type name
   * @returns {RegExp[]} Array of all patterns
   */
  getAllPatterns(fieldType) {
    const field = this.FIELDS[fieldType];
    if (!field) return [];

    const patterns = [
      ...(field.patterns.exact || []),
      ...(field.patterns.partial || []),
      ...(field.patterns.label || [])
    ];

    // Add all i18n patterns
    if (field.i18n) {
      for (const localePatterns of Object.values(field.i18n)) {
        patterns.push(...localePatterns);
      }
    }

    return patterns;
  },

  /**
   * Get autocomplete mapping from HTML5 values to field types
   * @returns {Object} Map of autocomplete values to field types
   */
  getAutocompleteMapping() {
    const mapping = {};
    for (const [fieldType, field] of Object.entries(this.FIELDS)) {
      for (const autocomplete of field.autocomplete || []) {
        mapping[autocomplete] = fieldType;
      }
    }
    return mapping;
  },

  /**
   * Get semantic mapping from phrases to field types
   * @returns {Object} Map of phrases to field types
   */
  getSemanticMapping() {
    const mapping = {};
    for (const [fieldType, field] of Object.entries(this.FIELDS)) {
      for (const phrase of field.semanticPhrases || []) {
        mapping[phrase] = fieldType;
      }
    }
    return mapping;
  },

  /**
   * Get field type by autocomplete value
   * @param {string} autocomplete - HTML5 autocomplete value
   * @returns {string|null} Field type or null
   */
  getFieldTypeByAutocomplete(autocomplete) {
    if (!autocomplete) return null;

    // Handle section prefixes
    const parts = autocomplete.toLowerCase().trim().split(/\s+/);
    const fieldPart = parts[parts.length - 1];

    for (const [fieldType, field] of Object.entries(this.FIELDS)) {
      if (field.autocomplete && field.autocomplete.includes(fieldPart)) {
        return fieldType;
      }
    }
    return null;
  },

  /**
   * Get field configuration
   * @param {string} fieldType - Field type name
   * @returns {Object|null} Field configuration or null
   */
  getFieldConfig(fieldType) {
    return this.FIELDS[fieldType] || null;
  },

  /**
   * Get all field types
   * @returns {string[]} Array of field type names
   */
  getFieldTypes() {
    return Object.keys(this.FIELDS);
  }
};

// Register with namespace if available
if (typeof window !== 'undefined') {
  window.JobTrackerFieldRegistry = JobTrackerFieldRegistry;

  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('field-registry');
  }
}
