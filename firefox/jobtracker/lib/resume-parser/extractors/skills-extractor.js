/**
 * Skills Extractor - Extracts skills from resume
 * Categorizes into languages, frameworks, tools, and soft skills
 */

const SkillsExtractor = {
  PATTERNS: {
    programmingLanguages: /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|C|Ruby|Go|Golang|Rust|PHP|Swift|Kotlin|Scala|R|MATLAB|Perl|Shell|Bash|Zsh|PowerShell|SQL|PL\/SQL|T-SQL|HTML5?|CSS3?|SASS|SCSS|Less|Lua|Haskell|Erlang|Elixir|Clojure|F#|OCaml|Julia|Dart|Groovy|VBA|COBOL|Fortran|Assembly|Objective-C|Solidity|WebAssembly|WASM)\b/gi,

    frameworks: /\b(React(?:\.?js)?|React\s*Native|Angular(?:\.?js)?|Vue(?:\.?js)?|Next(?:\.?js)?|Nuxt(?:\.?js)?|Svelte|SvelteKit|Solid(?:\.?js)?|Astro|Remix|Gatsby|Node(?:\.?js)?|Express(?:\.?js)?|NestJS|Fastify|Koa|Hono|Deno|Bun|Django|Flask|FastAPI|Pyramid|Tornado|Spring(?:\s*Boot)?|Quarkus|Micronaut|\.NET(?:\s*Core)?|ASP\.NET|Blazor|Rails|Ruby\s+on\s+Rails|Laravel|Symfony|CodeIgniter|Yii|Phoenix|Gin|Echo|Fiber|Actix|Rocket|TensorFlow|PyTorch|Keras|JAX|Hugging\s*Face|LangChain|LlamaIndex|OpenCV|Pandas|NumPy|SciPy|Scikit-learn|XGBoost|LightGBM|spaCy|NLTK|Matplotlib|Seaborn|Plotly|D3(?:\.?js)?|Three(?:\.?js)?|jQuery|Bootstrap|Tailwind(?:\s*CSS)?|Material[\s-]?UI|MUI|Chakra[\s-]?UI|Ant\s*Design|Styled[\s-]?Components|Emotion|Framer\s*Motion|GSAP|Electron|Tauri|Flutter|SwiftUI|Jetpack\s*Compose|Unity|Unreal\s*Engine|Godot)\b/gi,

    tools: /\b(Git|GitHub|GitLab|Bitbucket|Jira|Confluence|Slack|Discord|Trello|Asana|Notion|Linear|Monday|ClickUp|Figma|Sketch|Adobe\s*XD|Photoshop|Illustrator|InDesign|Premiere|After\s*Effects|Canva|VS\s*Code|Visual\s*Studio|IntelliJ|Eclipse|PyCharm|WebStorm|Rider|Xcode|Android\s*Studio|Vim|Neovim|Emacs|Sublime|Postman|Insomnia|curl|HTTPie|Docker|Podman|Kubernetes|K8s|Helm|Istio|Terraform|Pulumi|Ansible|Chef|Puppet|Vagrant|Jenkins|CircleCI|Travis\s*CI|GitHub\s*Actions|GitLab\s*CI|ArgoCD|Spinnaker|AWS|Amazon\s*Web\s*Services|EC2|S3|Lambda|ECS|EKS|RDS|DynamoDB|SQS|SNS|CloudFormation|CDK|Azure|Azure\s*DevOps|GCP|Google\s*Cloud|BigQuery|Cloud\s*Run|Cloud\s*Functions|Heroku|Vercel|Netlify|Cloudflare|DigitalOcean|Linode|Firebase|Supabase|PlanetScale|Neon|MongoDB|PostgreSQL|MySQL|MariaDB|SQLite|Oracle|SQL\s*Server|Redis|Memcached|Elasticsearch|OpenSearch|Cassandra|DynamoDB|CockroachDB|Neo4j|InfluxDB|TimescaleDB|Pinecone|Weaviate|Milvus|RabbitMQ|Kafka|Apache\s*Kafka|Pulsar|NATS|ActiveMQ|Celery|Airflow|Prefect|Dagster|dbt|Spark|Hadoop|Flink|Databricks|Snowflake|Redshift|Nginx|Apache|Caddy|Traefik|HAProxy|Linux|Ubuntu|Debian|CentOS|RHEL|Alpine|macOS|Windows\s*Server|Webpack|Vite|Rollup|Parcel|esbuild|SWC|Turbopack|Babel|ESLint|Prettier|Jest|Mocha|Chai|Cypress|Playwright|Selenium|Puppeteer|Testing\s*Library|Vitest|pytest|JUnit|TestNG|Mockito|npm|yarn|pnpm|pip|Poetry|Conda|Maven|Gradle|Cargo|NuGet|Homebrew|apt|Datadog|New\s*Relic|Grafana|Prometheus|Splunk|ELK|Sentry|PagerDuty|Looker|Tableau|Power\s*BI|Metabase|Amplitude|Mixpanel|Segment|LaunchDarkly|Stripe|Twilio|SendGrid|Auth0|Okta|Keycloak|OpenAI|Anthropic|Claude|GPT|ChatGPT|Copilot|Cursor|Ollama|LocalLLM)\b/gi,

    softSkills: /\b(Leadership|Communication|Teamwork|Team\s*Player|Cross[- ]?functional|Problem[\s-]?Solving|Critical\s+Thinking|Time\s+Management|Project\s+Management|Product\s+Management|Agile|Scrum|Kanban|SAFe|Waterfall|Lean|Six\s*Sigma|Collaboration|Adaptability|Flexibility|Creativity|Innovation|Attention\s+to\s+Detail|Detail[- ]?Oriented|Analytical|Strategic\s+(?:Thinking|Planning)|Decision[\s-]?Making|Mentoring|Coaching|Training|Presentation|Public\s+Speaking|Negotiation|Conflict\s+Resolution|Stakeholder\s+Management|Client\s+Relations|Customer\s+Service|Technical\s+Writing|Documentation|Research|Data\s+Analysis|Business\s+Analysis|Requirements\s+Gathering|Process\s+Improvement|Change\s+Management|Risk\s+Management|Budget\s+Management|Vendor\s+Management|Remote\s+Work|Self[- ]?Motivated|Self[- ]?Starter|Fast\s+Learner|Quick\s+Learner|Multitasking|Prioritization|Organization|Planning|Execution|Results[- ]?Driven|Goal[- ]?Oriented)\b/gi
  },

  NORMALIZATIONS: {
    // Languages
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'golang': 'Go',
    'c++': 'C++',
    'c#': 'C#',
    'html5': 'HTML',
    'css3': 'CSS',
    'pl/sql': 'PL/SQL',
    't-sql': 'T-SQL',

    // Frameworks
    'nodejs': 'Node.js',
    'node.js': 'Node.js',
    'node': 'Node.js',
    'reactjs': 'React',
    'react.js': 'React',
    'react native': 'React Native',
    'vuejs': 'Vue.js',
    'vue.js': 'Vue.js',
    'vue': 'Vue.js',
    'angularjs': 'Angular',
    'angular.js': 'Angular',
    'nextjs': 'Next.js',
    'next.js': 'Next.js',
    'nuxtjs': 'Nuxt.js',
    'nuxt.js': 'Nuxt.js',
    'expressjs': 'Express.js',
    'express.js': 'Express.js',
    'express': 'Express.js',
    'nestjs': 'NestJS',
    'fastapi': 'FastAPI',
    'spring boot': 'Spring Boot',
    '.net core': '.NET Core',
    'asp.net': 'ASP.NET',
    'ruby on rails': 'Rails',
    'scikit-learn': 'Scikit-learn',
    'hugging face': 'Hugging Face',
    'tailwind css': 'Tailwind CSS',
    'tailwindcss': 'Tailwind CSS',
    'material-ui': 'Material UI',
    'material ui': 'Material UI',
    'mui': 'Material UI',
    'chakra-ui': 'Chakra UI',
    'chakra ui': 'Chakra UI',
    'd3.js': 'D3.js',
    'd3': 'D3.js',
    'three.js': 'Three.js',
    'threejs': 'Three.js',
    'solid.js': 'Solid.js',
    'solidjs': 'Solid.js',

    // Tools & Platforms
    'mongodb': 'MongoDB',
    'postgresql': 'PostgreSQL',
    'postgres': 'PostgreSQL',
    'mysql': 'MySQL',
    'sql server': 'SQL Server',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'bitbucket': 'Bitbucket',
    'vs code': 'VS Code',
    'vscode': 'VS Code',
    'visual studio code': 'VS Code',
    'intellij': 'IntelliJ IDEA',
    'intellij idea': 'IntelliJ IDEA',
    'k8s': 'Kubernetes',
    'aws': 'AWS',
    'amazon web services': 'AWS',
    'gcp': 'Google Cloud',
    'google cloud': 'Google Cloud',
    'google cloud platform': 'Google Cloud',
    'azure devops': 'Azure DevOps',
    'github actions': 'GitHub Actions',
    'gitlab ci': 'GitLab CI',
    'circleci': 'CircleCI',
    'travisci': 'Travis CI',
    'travis ci': 'Travis CI',
    'apache kafka': 'Kafka',
    'elasticsearch': 'Elasticsearch',
    'opensearch': 'OpenSearch',
    'dynamodb': 'DynamoDB',
    'rabbitmq': 'RabbitMQ',
    'power bi': 'Power BI',
    'powerbi': 'Power BI',
    'chatgpt': 'ChatGPT',
    'openai': 'OpenAI'
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
