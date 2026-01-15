/**
 * Skills Extractor - Extracts skills from resume
 * Categorizes into languages, frameworks, tools, and soft skills
 */

const SkillsExtractor = {
  PATTERNS: {
    programmingLanguages: /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|C|Ruby|Go|Golang|Rust|PHP|Swift|Kotlin|Scala|R|MATLAB|Perl|Shell|Bash|PowerShell|SQL|HTML|CSS|SASS|SCSS|Less)\b/gi,
    frameworks: /\b(React(?:\.?js)?|Angular(?:\.?js)?|Vue(?:\.?js)?|Next(?:\.?js)?|Nuxt(?:\.?js)?|Svelte|Node(?:\.?js)?|Express(?:\.?js)?|NestJS|Django|Flask|FastAPI|Spring(?:\s*Boot)?|\.NET|ASP\.NET|Rails|Ruby\s+on\s+Rails|Laravel|Symfony|TensorFlow|PyTorch|Keras|Pandas|NumPy|Scikit-learn|jQuery|Bootstrap|Tailwind(?:\s*CSS)?|Material[\s-]?UI|Chakra[\s-]?UI)\b/gi,
    tools: /\b(Git|GitHub|GitLab|Bitbucket|Jira|Confluence|Slack|Trello|Asana|Notion|Figma|Sketch|Adobe\s*XD|Photoshop|Illustrator|VS\s*Code|Visual\s*Studio|IntelliJ|Eclipse|PyCharm|WebStorm|Postman|Insomnia|Docker|Kubernetes|K8s|Jenkins|CircleCI|Travis\s*CI|GitHub\s*Actions|AWS|Azure|GCP|Google\s*Cloud|Heroku|Vercel|Netlify|Firebase|MongoDB|PostgreSQL|MySQL|Redis|Elasticsearch|RabbitMQ|Kafka|Nginx|Apache|Linux|Unix|Windows\s*Server|Webpack|Vite|Rollup|Parcel|npm|yarn|pnpm)\b/gi,
    softSkills: /\b(Leadership|Communication|Teamwork|Team\s*Player|Problem[\s-]?Solving|Critical\s+Thinking|Time\s+Management|Project\s+Management|Agile|Scrum|Kanban|Collaboration|Adaptability|Creativity|Attention\s+to\s+Detail|Analytical|Strategic\s+(?:Thinking|Planning)|Decision[\s-]?Making|Mentoring|Coaching|Presentation|Public\s+Speaking|Negotiation|Conflict\s+Resolution)\b/gi
  },

  NORMALIZATIONS: {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'nodejs': 'Node.js',
    'node.js': 'Node.js',
    'reactjs': 'React',
    'react.js': 'React',
    'vuejs': 'Vue.js',
    'vue.js': 'Vue.js',
    'angularjs': 'Angular',
    'angular.js': 'Angular',
    'nextjs': 'Next.js',
    'next.js': 'Next.js',
    'expressjs': 'Express.js',
    'express.js': 'Express.js',
    'mongodb': 'MongoDB',
    'postgresql': 'PostgreSQL',
    'mysql': 'MySQL',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'vs code': 'VS Code',
    'vscode': 'VS Code'
  },

  extract(sections, fullText = '') {
    const lines = this.getSectionLines(sections, ['skill', 'competenc', 'expertise', 'technologies', 'technical']);
    const skillsText = lines.length > 0
      ? lines.map(line => line.map(item => item.text).join(' ')).join('\n')
      : '';

    const searchText = skillsText + '\n' + fullText;

    const skills = {
      languages: [],
      frameworks: [],
      tools: [],
      soft: []
    };

    // Extract programming languages
    const langMatches = searchText.match(this.PATTERNS.programmingLanguages) || [];
    skills.languages = [...new Set(langMatches.map(s => this.normalize(s)))];

    // Extract frameworks
    const frameworkMatches = searchText.match(this.PATTERNS.frameworks) || [];
    skills.frameworks = [...new Set(frameworkMatches.map(s => this.normalize(s)))];

    // Extract tools
    const toolMatches = searchText.match(this.PATTERNS.tools) || [];
    skills.tools = [...new Set(toolMatches.map(s => this.normalize(s)))];

    // Extract soft skills
    const softMatches = searchText.match(this.PATTERNS.softSkills) || [];
    skills.soft = [...new Set(softMatches.map(s => this.normalize(s)))];

    // Also return raw skills list
    const rawSkills = this.extractRawSkills(skillsText);

    return { categorized: skills, raw: rawSkills };
  },

  getSectionLines(sections, keywords) {
    for (const sectionName of Object.keys(sections)) {
      const hasKeyword = keywords.some(kw => sectionName.toLowerCase().includes(kw));
      if (hasKeyword) {
        return sections[sectionName];
      }
    }
    return [];
  },

  extractRawSkills(text) {
    if (!text) return [];

    // Split by common delimiters
    return text
      .split(/[•·|,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 50 && !/^\d+$/.test(s));
  },

  normalize(skill) {
    const lower = skill.toLowerCase().trim();
    return this.NORMALIZATIONS[lower] || skill.trim();
  }
};

if (typeof window !== 'undefined') {
  window.SkillsExtractor = SkillsExtractor;
}
