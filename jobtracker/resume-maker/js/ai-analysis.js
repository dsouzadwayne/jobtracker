/**
 * Resume Maker - AI Analysis
 * Pattern-based skill extraction and matching with NLP enhancements
 * Uses Compromise.js for NLP and Fuse.js for fuzzy matching
 */

// Check for library availability
const nlpAvailable = typeof nlp !== 'undefined';
const fuseAvailable = typeof Fuse !== 'undefined';

// Initialize Fuse.js search instance (lazy initialized)
let skillFuseInstance = null;

/**
 * Get or create Fuse.js instance for skill matching
 */
function getSkillFuse() {
  if (!fuseAvailable) return null;

  if (!skillFuseInstance) {
    // Flatten all skills into searchable array
    const allSkillObjects = ALL_SKILLS.map(skill => ({ name: skill, lower: skill.toLowerCase() }));
    skillFuseInstance = new Fuse(allSkillObjects, {
      keys: ['name', 'lower'],
      threshold: 0.15, // Strict threshold to avoid false positives
      includeScore: true,
      minMatchCharLength: 2
    });
  }

  return skillFuseInstance;
}

// Comprehensive skill dictionary
const SKILL_DICTIONARY = {
  // Programming Languages
  languages: [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Golang',
    'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl',
    'Objective-C', 'Haskell', 'Elixir', 'Clojure', 'F#', 'Dart', 'Lua', 'Julia',
    'Assembly', 'COBOL', 'Fortran', 'Groovy', 'Visual Basic', 'VB.NET', 'Bash',
    'Shell', 'PowerShell', 'SQL', 'PL/SQL', 'T-SQL', 'GraphQL', 'HTML', 'CSS',
    'SASS', 'SCSS', 'Less', 'Solidity'
  ],

  // Frontend
  frontend: [
    'React', 'React.js', 'ReactJS', 'Vue', 'Vue.js', 'VueJS', 'Angular', 'AngularJS',
    'Svelte', 'SvelteKit', 'Next.js', 'NextJS', 'Nuxt', 'Nuxt.js', 'Gatsby',
    'jQuery', 'Bootstrap', 'Tailwind', 'TailwindCSS', 'Material UI', 'MUI',
    'Chakra UI', 'Ant Design', 'Styled Components', 'Emotion', 'Redux', 'MobX',
    'Zustand', 'Recoil', 'Vuex', 'Pinia', 'RxJS', 'Webpack', 'Vite', 'Rollup',
    'Parcel', 'Babel', 'ESLint', 'Prettier', 'Jest', 'Cypress', 'Playwright',
    'Storybook', 'Three.js', 'D3.js', 'Chart.js', 'WebGL', 'Canvas', 'SVG',
    'PWA', 'Service Workers', 'Web Components', 'Shadow DOM', 'Electron',
    'React Native', 'Expo', 'Flutter', 'Ionic'
  ],

  // Backend
  backend: [
    'Node.js', 'NodeJS', 'Express', 'Express.js', 'Fastify', 'Koa', 'NestJS',
    'Django', 'Flask', 'FastAPI', 'Pyramid', 'Tornado', 'Rails', 'Ruby on Rails',
    'Spring', 'Spring Boot', 'Hibernate', 'Jakarta EE', 'J2EE', 'JPA',
    'ASP.NET', '.NET', '.NET Core', 'Entity Framework', 'Laravel', 'Symfony',
    'CodeIgniter', 'CakePHP', 'Gin', 'Echo', 'Fiber', 'Phoenix', 'Actix',
    'Rocket', 'gRPC', 'REST', 'RESTful', 'SOAP', 'WebSocket', 'Socket.io',
    'Microservices', 'Serverless', 'Lambda', 'Azure Functions', 'Cloud Functions'
  ],

  // Databases
  databases: [
    'MySQL', 'PostgreSQL', 'Postgres', 'SQLite', 'MariaDB', 'Oracle', 'SQL Server',
    'MSSQL', 'MongoDB', 'Mongoose', 'Redis', 'Memcached', 'Cassandra', 'DynamoDB',
    'CouchDB', 'Firebase', 'Firestore', 'Supabase', 'Neo4j', 'Elasticsearch',
    'Solr', 'InfluxDB', 'TimescaleDB', 'Prisma', 'Sequelize', 'TypeORM',
    'Knex', 'Drizzle', 'SQLAlchemy', 'ActiveRecord'
  ],

  // Cloud & DevOps
  cloud: [
    'AWS', 'Amazon Web Services', 'Azure', 'Microsoft Azure', 'GCP', 'Google Cloud',
    'Google Cloud Platform', 'Heroku', 'DigitalOcean', 'Vercel', 'Netlify',
    'Cloudflare', 'EC2', 'S3', 'Lambda', 'ECS', 'EKS', 'RDS', 'CloudFront',
    'Route 53', 'SQS', 'SNS', 'Kinesis', 'Step Functions', 'CloudWatch',
    'IAM', 'VPC', 'CloudFormation', 'CDK', 'Terraform', 'Pulumi', 'Ansible',
    'Chef', 'Puppet', 'SaltStack', 'Docker', 'Kubernetes', 'K8s', 'Helm',
    'Istio', 'Envoy', 'OpenShift', 'Rancher', 'Jenkins', 'CircleCI', 'Travis CI',
    'GitHub Actions', 'GitLab CI', 'Azure DevOps', 'ArgoCD', 'Spinnaker',
    'Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Splunk', 'ELK', 'Logstash',
    'Kibana', 'Jaeger', 'Zipkin', 'Nginx', 'Apache', 'HAProxy', 'Kong', 'Traefik'
  ],

  // Data & ML
  data: [
    'Machine Learning', 'Deep Learning', 'AI', 'Artificial Intelligence',
    'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'NumPy', 'Pandas',
    'Matplotlib', 'Seaborn', 'Plotly', 'Jupyter', 'Spark', 'PySpark', 'Hadoop',
    'Hive', 'Kafka', 'Airflow', 'dbt', 'Snowflake', 'Redshift', 'BigQuery',
    'Databricks', 'MLflow', 'Kubeflow', 'SageMaker', 'Vertex AI', 'OpenCV',
    'NLP', 'Natural Language Processing', 'Computer Vision', 'LLM', 'GPT',
    'BERT', 'Transformers', 'Hugging Face', 'LangChain', 'Vector Databases',
    'Pinecone', 'Weaviate', 'RAG', 'ETL', 'Data Pipeline', 'Data Warehouse',
    'Data Lake', 'Business Intelligence', 'BI', 'Tableau', 'Power BI', 'Looker'
  ],

  // Mobile
  mobile: [
    'iOS', 'Android', 'React Native', 'Flutter', 'Swift', 'SwiftUI', 'UIKit',
    'Kotlin', 'Jetpack Compose', 'Xamarin', 'Cordova', 'PhoneGap', 'Ionic',
    'Capacitor', 'NativeScript', 'Mobile Development', 'App Development'
  ],

  // Testing
  testing: [
    'Unit Testing', 'Integration Testing', 'E2E Testing', 'End-to-End Testing',
    'TDD', 'BDD', 'Test-Driven Development', 'Jest', 'Mocha', 'Chai', 'Jasmine',
    'Cypress', 'Playwright', 'Selenium', 'WebDriver', 'Puppeteer', 'Testing Library',
    'RTL', 'Enzyme', 'pytest', 'unittest', 'JUnit', 'TestNG', 'Mockito',
    'RSpec', 'Capybara', 'QA', 'Quality Assurance', 'Manual Testing',
    'Automated Testing', 'Performance Testing', 'Load Testing', 'JMeter', 'Gatling',
    'k6', 'Locust', 'Postman', 'Insomnia', 'API Testing'
  ],

  // Version Control & Collaboration
  tools: [
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'SVN', 'Mercurial', 'Perforce',
    'Jira', 'Confluence', 'Trello', 'Asana', 'Monday.com', 'Linear', 'Notion',
    'Slack', 'Microsoft Teams', 'Zoom', 'Figma', 'Sketch', 'Adobe XD',
    'InVision', 'Zeplin', 'VS Code', 'Visual Studio', 'IntelliJ', 'PyCharm',
    'WebStorm', 'Eclipse', 'NetBeans', 'Xcode', 'Android Studio', 'Vim',
    'Neovim', 'Emacs', 'Sublime Text', 'Atom'
  ],

  // Soft Skills & Methodologies
  soft: [
    'Agile', 'Scrum', 'Kanban', 'Lean', 'XP', 'Extreme Programming',
    'SAFe', 'Waterfall', 'Sprint Planning', 'Code Review', 'Pair Programming',
    'Mob Programming', 'CI/CD', 'DevOps', 'SRE', 'Site Reliability Engineering',
    'Leadership', 'Team Lead', 'Tech Lead', 'Mentoring', 'Communication',
    'Problem Solving', 'Critical Thinking', 'Collaboration', 'Time Management',
    'Project Management', 'Product Management', 'Stakeholder Management',
    'Requirements Gathering', 'Technical Writing', 'Documentation',
    'Presentation Skills', 'Public Speaking'
  ],

  // Security
  security: [
    'Security', 'Cybersecurity', 'InfoSec', 'Information Security',
    'Penetration Testing', 'Pen Testing', 'Ethical Hacking', 'OWASP',
    'Vulnerability Assessment', 'Security Audit', 'Encryption', 'SSL', 'TLS',
    'HTTPS', 'OAuth', 'OAuth2', 'SAML', 'JWT', 'SSO', 'Single Sign-On',
    'RBAC', 'Role-Based Access Control', 'IAM', 'Identity Management',
    'Zero Trust', 'SOC', 'SIEM', 'Firewall', 'WAF', 'DDoS', 'Compliance',
    'GDPR', 'HIPAA', 'PCI-DSS', 'SOC 2', 'ISO 27001'
  ],

  // Architecture
  architecture: [
    'System Design', 'Software Architecture', 'Enterprise Architecture',
    'Solution Architecture', 'Microservices', 'Monolith', 'Event-Driven',
    'CQRS', 'Event Sourcing', 'Domain-Driven Design', 'DDD', 'Clean Architecture',
    'Hexagonal Architecture', 'MVC', 'MVVM', 'MVP', 'SOA', 'Service-Oriented',
    'API Design', 'API Gateway', 'Load Balancing', 'Caching', 'CDN',
    'High Availability', 'Scalability', 'Fault Tolerance', 'Disaster Recovery',
    'Performance Optimization', 'Database Design', 'Data Modeling'
  ]
};

// Flatten skill dictionary for quick lookup
const ALL_SKILLS = Object.values(SKILL_DICTIONARY).flat();
const SKILL_SET = new Set(ALL_SKILLS.map(s => s.toLowerCase()));

// Create variations map for fuzzy matching
const SKILL_VARIATIONS = new Map();
ALL_SKILLS.forEach(skill => {
  const lower = skill.toLowerCase();
  SKILL_VARIATIONS.set(lower, skill);

  // Add common variations
  const withoutDots = lower.replace(/\./g, '');
  if (withoutDots !== lower) SKILL_VARIATIONS.set(withoutDots, skill);

  const withoutSpaces = lower.replace(/\s+/g, '');
  if (withoutSpaces !== lower) SKILL_VARIATIONS.set(withoutSpaces, skill);

  // Handle "JS" suffix variations
  if (lower.endsWith('js')) {
    SKILL_VARIATIONS.set(lower.replace(/js$/, '.js'), skill);
    SKILL_VARIATIONS.set(lower.replace(/js$/, ' js'), skill);
  }
});

/**
 * Extract skills from text using pattern matching
 */
export function extractSkillsFromText(text) {
  if (!text) return [];

  const foundSkills = new Set();
  const normalizedText = text.toLowerCase();

  // Check for each known skill
  ALL_SKILLS.forEach(skill => {
    const skillLower = skill.toLowerCase();

    // Create word boundary regex for the skill
    const escapedSkill = skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');

    if (regex.test(normalizedText)) {
      foundSkills.add(skill);
    }
  });

  // Also look for capitalized tech terms that might not be in dictionary
  const capitalizedTerms = text.match(/\b[A-Z][a-zA-Z0-9]*(?:\.[a-zA-Z]+)*\b/g) || [];
  // Common words to exclude (not tech skills)
  const EXCLUDED_WORDS = new Set([
    'The', 'And', 'For', 'With', 'From', 'Your', 'Our', 'You', 'We', 'Are', 'Have',
    'This', 'That', 'Will', 'Can', 'May', 'Should', 'Must', 'Their', 'They', 'What',
    'When', 'Where', 'Why', 'How', 'Which', 'Who', 'Its', 'Been', 'Being', 'Was',
    'Were', 'Has', 'Had', 'Does', 'Did', 'Done', 'Make', 'Made', 'Take', 'Took',
    // Common job description words
    'Role', 'Title', 'Copy', 'Edit', 'Help', 'Ensure', 'Strong', 'Group', 'Team',
    'Work', 'Join', 'About', 'Lead', 'Senior', 'Junior', 'Staff', 'Manager',
    'Position', 'Job', 'Career', 'Apply', 'Submit', 'Send', 'Contact', 'Email',
    'Location', 'Office', 'Remote', 'Hybrid', 'Full', 'Part', 'Time', 'Year',
    'Years', 'Experience', 'Required', 'Preferred', 'Skills', 'Ability', 'Plus',
    'Company', 'Mission', 'Vision', 'Culture', 'Value', 'Values', 'Benefits',
    'Salary', 'Compensation', 'Equal', 'Opportunity', 'Employer', 'Legal', 'Entity',
    // Location words commonly capitalized
    'India', 'Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata',
    'Navi', 'Vashi', 'Street', 'Avenue', 'Road', 'City', 'State', 'Country'
  ]);
  capitalizedTerms.forEach(term => {
    if (term.length >= 2 && !EXCLUDED_WORDS.has(term)) {
      // Only add if it looks like a genuine tech term:
      // 1. CamelCase like JavaScript, TypeScript
      // 2. Contains numbers like ES6, H2O
      // 3. Has tech extension like Node.js
      // 4. Is an ALL-CAPS acronym of 2-4 chars like AWS, GCP, API
      const isCamelCase = /^[A-Z][a-z]+[A-Z]/.test(term);
      const hasNumbers = /\d/.test(term);
      const hasTechExtension = /\.js$|\.py$|\.io$/i.test(term);
      const isShortAcronym = /^[A-Z]{2,4}$/.test(term); // Only ALL-CAPS 2-4 chars

      if (isCamelCase || hasNumbers || hasTechExtension || isShortAcronym) {
        foundSkills.add(term);
      }
    }
  });

  return Array.from(foundSkills);
}

/**
 * Extract skills using NLP (Compromise.js)
 * Provides more intelligent extraction than pure pattern matching
 */
export function extractSkillsWithNLP(text) {
  if (!text) return [];

  // Fall back to basic extraction if NLP not available
  if (!nlpAvailable) {
    return extractSkillsFromText(text);
  }

  const foundSkills = new Set();

  try {
    const doc = nlp(text);

    // Extract acronyms (often technology names)
    const acronyms = doc.acronyms().out('array');
    acronyms.forEach(term => {
      // Check if acronym matches a known skill
      const normalized = normalizeSkillName(term);
      if (normalized) {
        foundSkills.add(normalized);
      } else if (/^[A-Z]{2,5}$/.test(term)) {
        // Only add unknown acronyms if they're ALL-CAPS and 2-5 characters
        // This avoids picking up things like "AP" (Associated Press) style guides
        // but allows legitimate tech acronyms
        foundSkills.add(term);
      }
    });

    // Extract nouns and noun phrases (potential skills/technologies)
    const nouns = doc.nouns().out('array');
    nouns.forEach(noun => {
      const normalized = normalizeSkillName(noun);
      if (normalized) {
        foundSkills.add(normalized);
      }
    });

    // Extract proper nouns (company names, technology names)
    const properNouns = doc.match('#ProperNoun+').out('array');
    properNouns.forEach(term => {
      const normalized = normalizeSkillName(term);
      if (normalized) {
        foundSkills.add(normalized);
      }
    });

    // Also run the basic pattern matching for comprehensive coverage
    const basicSkills = extractSkillsFromText(text);
    basicSkills.forEach(skill => foundSkills.add(skill));

  } catch (error) {
    console.log('[AI Analysis] NLP extraction error:', error);
    // Fall back to basic extraction
    return extractSkillsFromText(text);
  }

  return Array.from(foundSkills);
}

/**
 * Normalize skill name to canonical form using dictionary lookup
 */
function normalizeSkillName(term) {
  if (!term) return null;

  const termLower = term.toLowerCase().trim();

  // Direct lookup in variations map
  if (SKILL_VARIATIONS.has(termLower)) {
    return SKILL_VARIATIONS.get(termLower);
  }

  // Try fuzzy matching if Fuse.js is available
  // Use a very strict threshold to avoid false positives
  // (e.g., "Edit" matching to "Redis", "Legal" matching to "Elixir")
  const fuse = getSkillFuse();
  if (fuse) {
    const results = fuse.search(termLower);
    // Only accept very close matches (score < 0.1 means nearly exact)
    if (results.length > 0 && results[0].score < 0.1) {
      return results[0].item.name;
    }
  }

  return null;
}

/**
 * Fuzzy match skills using Fuse.js
 * Matches similar skill names (e.g., "React" matches "ReactJS")
 */
export function fuzzyMatchSkills(extractedSkills, userSkills) {
  if (!extractedSkills || !userSkills || userSkills.length === 0) {
    return { matched: [], unmatched: extractedSkills || [] };
  }

  // If Fuse.js not available, fall back to exact matching
  if (!fuseAvailable) {
    return exactMatchSkills(extractedSkills, userSkills);
  }

  const matched = [];
  const unmatched = [];

  // Create Fuse instance for user skills
  const userSkillObjects = userSkills.map(s => ({ name: s, lower: s.toLowerCase() }));

  // Handle empty array edge case
  if (userSkillObjects.length === 0) {
    return { matched: [], unmatched: extractedSkills };
  }

  const fuse = new Fuse(userSkillObjects, {
    keys: ['name', 'lower'],
    threshold: 0.25, // Stricter threshold for matching
    includeScore: true
  });

  extractedSkills.forEach(skill => {
    const results = fuse.search(skill);
    if (results.length > 0 && results[0].score < 0.25) {
      matched.push({
        extracted: skill,
        userSkill: results[0].item.name,
        score: results[0].score
      });
    } else {
      unmatched.push(skill);
    }
  });

  return { matched, unmatched };
}

/**
 * Exact match skills (fallback when Fuse.js unavailable)
 */
function exactMatchSkills(extractedSkills, userSkills) {
  const userSkillsLower = new Set(userSkills.map(s => s.toLowerCase()));
  const matched = [];
  const unmatched = [];

  extractedSkills.forEach(skill => {
    if (userSkillsLower.has(skill.toLowerCase())) {
      matched.push({ extracted: skill, userSkill: skill, score: 0 });
    } else {
      unmatched.push(skill);
    }
  });

  return { matched, unmatched };
}

/**
 * Extract keywords from job description
 */
export function extractKeywordsFromText(text) {
  if (!text) return [];

  const keywords = new Set();

  // Extract years of experience patterns
  const yearsMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)/gi);
  if (yearsMatch) {
    yearsMatch.forEach(match => keywords.add(match.trim()));
  }

  // Extract degree requirements
  const degreeMatch = text.match(/(?:bachelor'?s?|master'?s?|phd|doctorate|bs|ba|ms|ma|mba)\s+(?:degree|in\s+\w+)?/gi);
  if (degreeMatch) {
    degreeMatch.forEach(match => keywords.add(match.trim()));
  }

  // Extract common job-related terms
  const jobTerms = [
    'remote', 'hybrid', 'on-site', 'onsite', 'full-time', 'full time', 'part-time', 'part time',
    'contract', 'permanent', 'temporary', 'freelance', 'senior', 'junior', 'mid-level',
    'lead', 'principal', 'staff', 'manager', 'director', 'vp', 'cto', 'ceo',
    'startup', 'enterprise', 'b2b', 'b2c', 'saas', 'fintech', 'healthcare', 'e-commerce'
  ];

  jobTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    if (regex.test(text)) {
      keywords.add(term);
    }
  });

  return Array.from(keywords);
}

/**
 * Extract job title and company from job description
 * Uses NLP when available for better entity extraction
 */
export function extractJobInfo(text) {
  const result = {
    title: '',
    company: ''
  };

  if (!text) return result;

  // Try NLP extraction first if available
  if (nlpAvailable) {
    try {
      const doc = nlp(text);

      // Extract organizations (potential company names)
      const orgs = doc.organizations().out('array');
      if (orgs.length > 0) {
        // Filter out common non-company terms
        const filteredOrgs = orgs.filter(org =>
          !/(university|college|school|institute)/i.test(org) &&
          org.length > 1
        );
        if (filteredOrgs.length > 0) {
          result.company = filteredOrgs[0];
        }
      }

      // Try to extract job title patterns
      const titlePatterns = doc.match('(senior|junior|lead|staff|principal)? #Noun+ (engineer|developer|manager|designer|analyst|architect|specialist|coordinator|director|consultant)').out('array');
      if (titlePatterns.length > 0) {
        result.title = titlePatterns[0];
      }
    } catch (error) {
      console.log('[AI Analysis] NLP job info extraction error:', error);
    }
  }

  // Fall back to pattern matching for any missing info
  const lines = text.split('\n').filter(line => line.trim());

  // First non-empty line is often the title
  if (!result.title && lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length < 100 && !firstLine.includes('.')) {
      result.title = firstLine;
    }
  }

  // Look for "at Company" or "Company is hiring" patterns if company not found
  if (!result.company) {
    const companyPatterns = [
      /(?:at|@)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s+is|\s+we|\.|$)/i,
      /([A-Z][A-Za-z0-9\s&]+?)\s+is\s+(?:hiring|looking|seeking)/i,
      /(?:about|join)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\.|,|!|\n)/i
    ];

    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        result.company = match[1].trim();
        break;
      }
    }
  }

  return result;
}

/**
 * Match user skills against job description skills
 * Uses fuzzy matching for better results when Fuse.js is available
 */
export function matchSkills(userSkills, jdSkills) {
  const matchingSkills = [];
  const missingSkills = [];

  if (!userSkills || !jdSkills) {
    return { matchingSkills, missingSkills };
  }

  // Try fuzzy matching first if available
  if (fuseAvailable) {
    const fuzzyResult = fuzzyMatchSkills(jdSkills, userSkills);

    fuzzyResult.matched.forEach(match => {
      matchingSkills.push(match.extracted);
    });

    fuzzyResult.unmatched.forEach(skill => {
      missingSkills.push(skill);
    });

    return { matchingSkills, missingSkills };
  }

  // Fallback to original logic
  const userSkillsLower = new Set(userSkills.map(s => s.toLowerCase()));

  jdSkills.forEach(jdSkill => {
    const jdSkillLower = jdSkill.toLowerCase();

    // Check for exact match
    if (userSkillsLower.has(jdSkillLower)) {
      matchingSkills.push(jdSkill);
      return;
    }

    // Check for variations
    const variation = SKILL_VARIATIONS.get(jdSkillLower);
    if (variation && userSkillsLower.has(variation.toLowerCase())) {
      matchingSkills.push(jdSkill);
      return;
    }

    // Check for partial matches (e.g., "React" matches "React.js")
    const isPartialMatch = userSkills.some(userSkill => {
      const userLower = userSkill.toLowerCase();
      return userLower.includes(jdSkillLower) || jdSkillLower.includes(userLower);
    });

    if (isPartialMatch) {
      matchingSkills.push(jdSkill);
    } else {
      missingSkills.push(jdSkill);
    }
  });

  return { matchingSkills, missingSkills };
}

/**
 * Score experience items based on keyword density
 */
export function scoreExperience(experiences, jdText) {
  if (!experiences || !jdText) return {};

  const scores = {};
  const jdLower = jdText.toLowerCase();
  const jdSkills = extractSkillsFromText(jdText);
  const jdSkillsLower = new Set(jdSkills.map(s => s.toLowerCase()));

  experiences.forEach(exp => {
    let score = 0;

    // Combine all text from experience
    const expText = [
      exp.title || '',
      exp.company || '',
      exp.description || ''
    ].join(' ').toLowerCase();

    // Score based on skill matches
    jdSkillsLower.forEach(skill => {
      if (expText.includes(skill)) {
        score += 10;
      }
    });

    // Score based on keyword matches
    const keywords = extractKeywordsFromText(jdText);
    keywords.forEach(keyword => {
      if (expText.includes(keyword.toLowerCase())) {
        score += 5;
      }
    });

    scores[exp.id] = score;
  });

  return scores;
}

/**
 * Analyze job description and return tailoring suggestions
 * Uses NLP-enhanced extraction when available
 */
export function analyzeJobDescription(jdText, baseResume) {
  // Use NLP-enhanced extraction if available, otherwise fall back to basic
  const extractedSkills = nlpAvailable
    ? extractSkillsWithNLP(jdText)
    : extractSkillsFromText(jdText);

  const extractedKeywords = extractKeywordsFromText(jdText);
  const jobInfo = extractJobInfo(jdText);

  const userSkills = baseResume?.skills?.items || [];
  const { matchingSkills, missingSkills } = matchSkills(userSkills, extractedSkills);

  // Skills that are in JD and user has - should be highlighted
  const highlightSkills = matchingSkills;

  // Score experiences
  const experiences = baseResume?.experience?.items || [];
  const experienceScores = scoreExperience(experiences, jdText);

  // Order experiences by score
  const experienceOrder = Object.entries(experienceScores)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);

  return {
    jobDescription: {
      rawText: jdText,
      title: jobInfo.title,
      company: jobInfo.company,
      extractedSkills,
      extractedKeywords
    },
    tailoring: {
      matchingSkills,
      missingSkills,
      highlightSkills,
      experienceOrder,
      experienceScores
    },
    // Include metadata about which features were used
    meta: {
      nlpUsed: nlpAvailable,
      fuzzyMatchUsed: fuseAvailable
    }
  };
}

/**
 * Get skill category for a skill
 */
export function getSkillCategory(skill) {
  const skillLower = skill.toLowerCase();

  for (const [category, skills] of Object.entries(SKILL_DICTIONARY)) {
    if (skills.some(s => s.toLowerCase() === skillLower)) {
      return category;
    }
  }

  return 'other';
}

/**
 * Suggest skills based on existing skills
 */
export function suggestRelatedSkills(existingSkills, limit = 5) {
  if (!existingSkills || existingSkills.length === 0) return [];

  const existingLower = new Set(existingSkills.map(s => s.toLowerCase()));
  const categories = new Set();

  // Find categories of existing skills
  existingSkills.forEach(skill => {
    categories.add(getSkillCategory(skill));
  });

  // Suggest skills from same categories
  const suggestions = [];

  for (const category of categories) {
    if (category === 'other') continue;

    const categorySkills = SKILL_DICTIONARY[category] || [];
    categorySkills.forEach(skill => {
      if (!existingLower.has(skill.toLowerCase()) && suggestions.length < limit) {
        suggestions.push(skill);
      }
    });
  }

  return suggestions.slice(0, limit);
}

/**
 * Search skills with fuzzy matching
 * Used for autocomplete/search functionality
 */
export function searchSkills(query, limit = 10) {
  if (!query || query.length < 2) return [];

  const fuse = getSkillFuse();
  if (fuse) {
    const results = fuse.search(query, { limit });
    return results.map(r => r.item.name);
  }

  // Fallback to simple prefix matching
  const queryLower = query.toLowerCase();
  return ALL_SKILLS
    .filter(skill => skill.toLowerCase().includes(queryLower))
    .slice(0, limit);
}

/**
 * Check if NLP features are available
 */
export function isNLPAvailable() {
  return nlpAvailable;
}

/**
 * Check if fuzzy matching is available
 */
export function isFuzzyMatchAvailable() {
  return fuseAvailable;
}

/**
 * Get analysis capabilities based on loaded libraries
 */
export function getAnalysisCapabilities() {
  return {
    nlp: nlpAvailable,
    fuzzyMatch: fuseAvailable,
    basicExtraction: true,
    skillDictionary: ALL_SKILLS.length
  };
}
