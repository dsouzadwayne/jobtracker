/**
 * AI Worker - Runs ML models in background thread
 * Optimized for low-memory systems (4GB RAM)
 *
 * Uses Transformers.js with quantized models
 */

// Model state
let featureExtractor = null;
let nerPipeline = null;
let isModelLoaded = false;
let lastUsedTime = 0;
const MODEL_UNLOAD_TIMEOUT = 5 * 60 * 1000; // Unload after 5 min of inactivity

// Model configuration - using bundled local models
// Get the extension's base URL for local model paths
const EXTENSION_URL = self.location.href.replace(/\/lib\/ai-worker\.js$/, '');
const LOCAL_MODELS_PATH = `${EXTENSION_URL}/lib/models/`;

const MODELS = {
  // 23MB quantized - for embeddings and similarity (bundled locally)
  embeddings: `${LOCAL_MODELS_PATH}all-MiniLM-L6-v2`,
  // 104MB quantized - for named entity recognition (bundled locally)
  ner: `${LOCAL_MODELS_PATH}bert-base-NER`
};

// Import Transformers.js dynamically to reduce initial load
let pipeline = null;
let env = null;
let transformersAvailable = false;

async function loadTransformers() {
  if (pipeline) return true;

  try {
    // Try to import local bundle first
    const transformers = await import('./vendor/transformers.min.js');
    pipeline = transformers.pipeline;
    env = transformers.env;

    // Configure for local bundled models (fully offline)
    env.allowLocalModels = true;
    env.allowRemoteModels = false;  // All models bundled locally
    env.useBrowserCache = true;     // Cache in IndexedDB for faster subsequent loads
    env.localModelPath = LOCAL_MODELS_PATH;

    // Configure ONNX runtime WASM paths
    const wasmPaths = `${EXTENSION_URL}/lib/vendor/onnxruntime-web/`;
    env.backends.onnx.wasm.wasmPaths = wasmPaths;

    transformersAvailable = true;
    console.log('[AI Worker] Transformers.js loaded');
    console.log('[AI Worker] Local models path:', LOCAL_MODELS_PATH);
    console.log('[AI Worker] WASM path:', wasmPaths);
    return true;
  } catch (error) {
    console.warn('[AI Worker] Transformers.js not available:', error.message);
    console.warn('[AI Worker] ML features disabled.');
    transformersAvailable = false;
    return false;
  }
}

// Load the embeddings model (lightweight)
async function loadEmbeddingsModel() {
  if (featureExtractor) return featureExtractor;

  const available = await loadTransformers();
  if (!available) {
    throw new Error('Transformers.js not available. Run setup-ai.sh to install.');
  }

  console.log('[AI Worker] Loading embeddings model...');
  const startTime = performance.now();

  featureExtractor = await pipeline('feature-extraction', MODELS.embeddings, {
    quantized: true, // Use INT8 quantized version (~4x smaller)
    progress_callback: (progress) => {
      if (progress.status === 'progress') {
        self.postMessage({
          type: 'MODEL_LOADING_PROGRESS',
          payload: {
            model: 'embeddings',
            progress: Math.round(progress.progress)
          }
        });
      }
    }
  });

  const loadTime = Math.round(performance.now() - startTime);
  console.log(`[AI Worker] Embeddings model loaded in ${loadTime}ms`);

  isModelLoaded = true;
  lastUsedTime = Date.now();
  scheduleUnload();

  return featureExtractor;
}

// Load NER model on demand (heavier, only when needed)
async function loadNERModel() {
  if (nerPipeline) return nerPipeline;

  const available = await loadTransformers();
  if (!available) {
    throw new Error('Transformers.js not available. Run setup-ai.sh to install.');
  }

  console.log('[AI Worker] Loading NER model...');

  nerPipeline = await pipeline('token-classification', MODELS.ner, {
    quantized: true,
    progress_callback: (progress) => {
      if (progress.status === 'progress') {
        self.postMessage({
          type: 'MODEL_LOADING_PROGRESS',
          payload: {
            model: 'ner',
            progress: Math.round(progress.progress)
          }
        });
      }
    }
  });

  console.log('[AI Worker] NER model loaded');
  lastUsedTime = Date.now();

  return nerPipeline;
}

// Unload models after inactivity to free memory
function scheduleUnload() {
  setTimeout(() => {
    const timeSinceUse = Date.now() - lastUsedTime;
    if (timeSinceUse >= MODEL_UNLOAD_TIMEOUT && isModelLoaded) {
      unloadModels();
    } else if (isModelLoaded) {
      scheduleUnload();
    }
  }, MODEL_UNLOAD_TIMEOUT);
}

function unloadModels() {
  console.log('[AI Worker] Unloading models to free memory');
  featureExtractor = null;
  nerPipeline = null;
  isModelLoaded = false;

  // Force garbage collection hint
  if (typeof gc !== 'undefined') gc();
}

// ============================================
// TEXT EXTRACTION (Regex-first, ML-enhanced)
// ============================================

// Regex patterns for common resume/job fields
const PATTERNS = {
  email: /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/gi,
  phone: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
  linkedin: /(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)[\w-]+/gi,
  github: /github\.com\/[\w-]+/gi,
  url: /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi,

  // Salary patterns
  salary: /\$[\d,]+(?:\s*[-–]\s*\$?[\d,]+)?(?:\s*(?:per\s+)?(?:year|yr|annually|per\s+annum|k|K))?/gi,
  salaryRange: /(?:salary|compensation|pay)[:\s]*\$?[\d,]+\s*[-–to]\s*\$?[\d,]+/gi,

  // Date patterns
  dateRange: /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*[-–to]+\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}|Present/gi,

  // Education
  degree: /(?:Bachelor|Master|PhD|Ph\.D|B\.S\.?|B\.A\.?|M\.S\.?|M\.A\.?|MBA|M\.B\.A\.?)(?:\s+(?:of|in)\s+[\w\s]+)?/gi,

  // Job types
  jobType: /\b(?:full[- ]?time|part[- ]?time|contract|freelance|internship|temporary|remote|hybrid|on[- ]?site)\b/gi
};

// Extract structured data using regex
function extractWithRegex(text) {
  const result = {
    emails: [...new Set((text.match(PATTERNS.email) || []))],
    phones: [...new Set((text.match(PATTERNS.phone) || []))],
    linkedin: (text.match(PATTERNS.linkedin) || [])[0] || null,
    github: (text.match(PATTERNS.github) || [])[0] || null,
    urls: [...new Set((text.match(PATTERNS.url) || []))],
    salary: (text.match(PATTERNS.salary) || text.match(PATTERNS.salaryRange) || [])[0] || null,
    degrees: [...new Set((text.match(PATTERNS.degree) || []))],
    jobType: (text.match(PATTERNS.jobType) || [])[0]?.toLowerCase().replace(/[- ]/g, '_') || null,
    dateRanges: [...new Set((text.match(PATTERNS.dateRange) || []))]
  };

  return result;
}

// Extract skills using keyword matching (fast, no ML)
const SKILL_KEYWORDS = {
  programming: ['javascript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'typescript', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab'],
  frontend: ['react', 'vue', 'angular', 'svelte', 'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap', 'jquery', 'webpack', 'vite'],
  backend: ['node', 'express', 'django', 'flask', 'spring', 'rails', 'laravel', 'fastapi', 'graphql', 'rest', 'api'],
  database: ['sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'oracle'],
  cloud: ['aws', 'azure', 'gcp', 'google cloud', 'heroku', 'vercel', 'netlify', 'docker', 'kubernetes', 'k8s', 'terraform'],
  tools: ['git', 'github', 'gitlab', 'jira', 'confluence', 'slack', 'figma', 'sketch', 'postman', 'jenkins', 'ci/cd'],
  data: ['machine learning', 'ml', 'ai', 'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'spark', 'hadoop'],
  soft: ['leadership', 'communication', 'teamwork', 'problem solving', 'agile', 'scrum', 'project management']
};

// Escape all regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
}

function extractSkills(text) {
  const textLower = text.toLowerCase();
  const foundSkills = {};

  for (const [category, skills] of Object.entries(SKILL_KEYWORDS)) {
    const found = skills.filter(skill => {
      // Word boundary check to avoid partial matches
      const regex = new RegExp(`\\b${escapeRegex(skill)}\\b`, 'i');
      return regex.test(textLower);
    });
    if (found.length > 0) {
      foundSkills[category] = found;
    }
  }

  return foundSkills;
}

// ============================================
// ML-ENHANCED FEATURES
// ============================================

// Extract named entities (people, organizations, locations)
async function extractEntities(text) {
  try {
    const ner = await loadNERModel();
    const entities = await ner(text);

    // Group by entity type
    const grouped = {
      persons: [],
      organizations: [],
      locations: [],
      misc: []
    };

    for (const entity of entities) {
      const type = entity.entity.replace('B-', '').replace('I-', '');
      const value = entity.word.replace('##', '');

      switch (type) {
        case 'PER':
          grouped.persons.push(value);
          break;
        case 'ORG':
          grouped.organizations.push(value);
          break;
        case 'LOC':
          grouped.locations.push(value);
          break;
        default:
          grouped.misc.push(value);
      }
    }

    // Clean up and deduplicate
    for (const key of Object.keys(grouped)) {
      grouped[key] = [...new Set(grouped[key])].filter(v => v.length > 1);
    }

    lastUsedTime = Date.now();
    return grouped;
  } catch (error) {
    console.error('[AI Worker] NER extraction failed:', error);
    return null;
  }
}

// Generate embeddings for text (for similarity matching)
async function generateEmbeddings(text) {
  try {
    const extractor = await loadEmbeddingsModel();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    lastUsedTime = Date.now();
    return Array.from(output.data);
  } catch (error) {
    console.error('[AI Worker] Embeddings generation failed:', error);
    return null;
  }
}

// Calculate cosine similarity between two embedding vectors
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Suggest tags based on text similarity to predefined categories
const TAG_DEFINITIONS = {
  'Remote Work': 'remote work from home telecommute distributed team virtual office',
  'Startup': 'startup early stage seed series a b fast-paced dynamic growth',
  'Enterprise': 'enterprise corporate fortune 500 large company established',
  'Tech': 'software engineering developer programming coding technology',
  'Finance': 'banking finance fintech investment trading stocks',
  'Healthcare': 'healthcare medical health hospital clinical pharma',
  'AI/ML': 'artificial intelligence machine learning deep learning neural network data science',
  'Frontend': 'frontend ui ux react vue angular web interface design',
  'Backend': 'backend server api database infrastructure systems',
  'Full Stack': 'full stack fullstack end to end frontend backend',
  'DevOps': 'devops sre infrastructure cloud deployment ci cd kubernetes docker',
  'Mobile': 'mobile ios android app react native flutter',
  'Management': 'manager lead director management team leadership',
  'Entry Level': 'entry level junior graduate intern new grad',
  'Senior': 'senior staff principal architect lead experienced'
};

let tagEmbeddings = null;
let tagEmbeddingsPromise = null;

async function initTagEmbeddings() {
  // Return cached embeddings if available
  if (tagEmbeddings) return tagEmbeddings;

  // Use promise lock to prevent concurrent initialization
  if (tagEmbeddingsPromise) return tagEmbeddingsPromise;

  tagEmbeddingsPromise = (async () => {
    tagEmbeddings = {};
    for (const [tag, description] of Object.entries(TAG_DEFINITIONS)) {
      tagEmbeddings[tag] = await generateEmbeddings(description);
    }
    return tagEmbeddings;
  })();

  return tagEmbeddingsPromise;
}

async function suggestTags(text, threshold = 0.3) {
  try {
    await initTagEmbeddings();
    const textEmbedding = await generateEmbeddings(text);

    if (!textEmbedding) return [];

    const suggestions = [];

    for (const [tag, tagEmbed] of Object.entries(tagEmbeddings)) {
      const similarity = cosineSimilarity(textEmbedding, tagEmbed);
      if (similarity >= threshold) {
        suggestions.push({ tag, confidence: similarity });
      }
    }

    // Sort by confidence and return top 5
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(s => s.tag);
  } catch (error) {
    console.error('[AI Worker] Tag suggestion failed:', error);
    return [];
  }
}

// ============================================
// RESUME PARSING (Combined approach)
// ============================================

async function parseResume(text, useML = true) {
  const result = {
    // Regex extractions (always fast)
    ...extractWithRegex(text),
    skills: extractSkills(text),

    // ML extractions (optional)
    entities: null,
    suggestedTags: []
  };

  if (useML) {
    try {
      // Run ML extractions in parallel
      const [entities, tags] = await Promise.all([
        extractEntities(text),
        suggestTags(text)
      ]);

      result.entities = entities;
      result.suggestedTags = tags;

      // Extract name from entities if found
      if (entities?.persons?.length > 0) {
        result.name = entities.persons[0];
      }

      // Extract company names from entities
      if (entities?.organizations?.length > 0) {
        result.companies = entities.organizations;
      }

      // Extract locations from entities
      if (entities?.locations?.length > 0) {
        result.locations = entities.locations;
      }
    } catch (error) {
      console.warn('[AI Worker] ML extraction failed, using regex only:', error);
    }
  }

  return result;
}

// ============================================
// JOB POSTING PARSING
// ============================================

async function parseJobPosting(text, useML = true) {
  const result = {
    ...extractWithRegex(text),
    skills: extractSkills(text),
    entities: null,
    suggestedTags: []
  };

  if (useML) {
    try {
      const [entities, tags] = await Promise.all([
        extractEntities(text),
        suggestTags(text)
      ]);

      result.entities = entities;
      result.suggestedTags = tags;

      // Extract company name (first organization mentioned)
      if (entities?.organizations?.length > 0) {
        result.company = entities.organizations[0];
      }

      // Extract location
      if (entities?.locations?.length > 0) {
        result.location = entities.locations.join(', ');
      }
    } catch (error) {
      console.warn('[AI Worker] ML extraction failed, using regex only:', error);
    }
  }

  return result;
}

// ============================================
// MESSAGE HANDLER
// ============================================

self.onmessage = async (event) => {
  const { type, payload, requestId } = event.data;

  try {
    let result;

    switch (type) {
      case 'PARSE_RESUME':
        result = await parseResume(payload.text, payload.useML !== false);
        break;

      case 'PARSE_JOB':
        result = await parseJobPosting(payload.text, payload.useML !== false);
        break;

      case 'EXTRACT_REGEX':
        result = extractWithRegex(payload.text);
        break;

      case 'EXTRACT_SKILLS':
        result = extractSkills(payload.text);
        break;

      case 'EXTRACT_ENTITIES':
        result = await extractEntities(payload.text);
        break;

      case 'SUGGEST_TAGS':
        result = await suggestTags(payload.text, payload.threshold);
        break;

      case 'GET_EMBEDDINGS':
        result = await generateEmbeddings(payload.text);
        break;

      case 'CALCULATE_SIMILARITY':
        result = cosineSimilarity(payload.embedding1, payload.embedding2);
        break;

      case 'PRELOAD_MODELS':
        await loadEmbeddingsModel();
        if (payload.includeNER) {
          await loadNERModel();
        }
        result = { success: true };
        break;

      case 'UNLOAD_MODELS':
        unloadModels();
        result = { success: true };
        break;

      case 'GET_STATUS':
        result = {
          isModelLoaded,
          transformersAvailable,
          lastUsedTime,
          memoryUsage: performance?.memory?.usedJSHeapSize || null
        };
        break;

      case 'CHECK_AVAILABILITY':
        await loadTransformers();
        result = { transformersAvailable };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ type: 'SUCCESS', requestId, result });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      requestId,
      error: error.message
    });
  }
};

console.log('[AI Worker] Initialized');
