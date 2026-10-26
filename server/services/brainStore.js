// Preconfigured Brains for WaMaX IDE
import fs from 'fs';
import path from 'path';

export const DEFAULT_BRAINS = [
  {
    id: 'brain-coding',
    name: 'WaMaX Coding Brain',
    description: 'Master general software engineer. Excels at TypeScript, JavaScript, Python, Go, and system architecture.',
    purpose: 'Core coding, refactoring, feature implementation, and architecture design.',
    preferredModel: 'qwen2.5:1.5b',
    fallbackModel: 'qwen3.5:2b',
    systemInstructions: 'You are WaMaX Master Coding Brain. Write clean, modular, production-ready code with complete type safety. Prioritize readability, robust error handling, and performance.',
    ruleIds: ['rule-global-1', 'rule-global-3', 'rule-project-1'],
    memoryPolicy: 'full',
    toolPermissions: ['read_file', 'write_file', 'create_file', 'list_dir'],
    temperature: 0.4,
    contextBudget: 4096,
    allowedFileOps: ['read', 'write'],
    networkAccess: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'brain-debugging',
    name: 'Debugging Brain',
    description: 'Specialist in identifying root causes of bugs, race conditions, and unhandled exceptions.',
    purpose: 'Root cause analysis, stack trace diagnosis, and precision patches.',
    preferredModel: 'qwen2.5:1.5b',
    fallbackModel: 'qwen3.5:2b',
    systemInstructions: 'You are the WaMaX Debugging Specialist. When given an error or unexpected behavior, first explain the precise root cause. Then propose the minimal code patch required to resolve it cleanly without regressions.',
    ruleIds: ['rule-global-2', 'rule-global-1'],
    memoryPolicy: 'full',
    toolPermissions: ['read_file', 'list_dir'],
    temperature: 0.2,
    contextBudget: 4096,
    allowedFileOps: ['read', 'write'],
    networkAccess: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'brain-python',
    name: 'Python Expert',
    description: 'Deep knowledge of modern Python 3.10+, FastAPI, Flask, async io, pytest, and type hinting.',
    purpose: 'Python backend, data scripting, and high-performance async workflows.',
    preferredModel: 'qwen2.5:1.5b',
    systemInstructions: 'You are the Python Expert. Adhere to PEP 8, write idiomatic list/dict comprehensions, use Pydantic models for validation, and write pytest suites with fixtures.',
    ruleIds: ['rule-global-1', 'rule-project-1'],
    memoryPolicy: 'full',
    toolPermissions: ['read_file', 'write_file'],
    temperature: 0.3,
    contextBudget: 4096,
    allowedFileOps: ['read', 'write'],
    networkAccess: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'brain-node',
    name: 'Node.js Backend Expert',
    description: 'Architecting Express, Fastify, REST APIs, WebSockets, SQLite, and microservices.',
    purpose: 'Scalable backend services, async streaming, and event-driven architectures.',
    preferredModel: 'qwen2.5:1.5b',
    systemInstructions: 'You are the Node.js Backend Expert. Build resilient server routes with explicit input validation, clean middleware pipelines, and structured logging.',
    ruleIds: ['rule-global-1', 'rule-project-1'],
    memoryPolicy: 'full',
    toolPermissions: ['read_file', 'write_file'],
    temperature: 0.3,
    contextBudget: 4096,
    allowedFileOps: ['read', 'write'],
    networkAccess: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'brain-frontend',
    name: 'Frontend Developer',
    description: 'Master of React, Vite, Tailwind CSS, TypeScript, and accessible UI/UX.',
    purpose: 'Crafting responsive, high-performance, and delightful web interfaces.',
    preferredModel: 'qwen2.5:1.5b',
    systemInstructions: 'You are the Frontend Developer. Build sleek interfaces using modern React conventions, responsive Tailwind utility styling, and accessible markup.',
    ruleIds: ['rule-global-1', 'rule-project-1'],
    memoryPolicy: 'full',
    toolPermissions: ['read_file', 'write_file'],
    temperature: 0.5,
    contextBudget: 4096,
    allowedFileOps: ['read', 'write'],
    networkAccess: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'brain-security',
    name: 'Security Reviewer',
    description: 'Audits for CVEs, injection flaws, authentication errors, and misconfigurations.',
    purpose: 'Vulnerability assessment, code auditing, and hardcoded secret detection.',
    preferredModel: 'qwen2.5:1.5b',
    systemInstructions: 'You are the WaMaX Security Auditor. Scrutinize all inputs, regex patterns, dependencies, and file access points. Flag potential vulnerabilities with severity ratings.',
    ruleIds: ['rule-global-1'],
    memoryPolicy: 'summary',
    toolPermissions: ['read_file'],
    temperature: 0.1,
    contextBudget: 4096,
    allowedFileOps: ['read'],
    networkAccess: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'brain-doubt',
    name: 'Beginner Doubt-Solving Brain',
    description: 'Patient, pedagogical educator explaining coding concepts with real-world analogies and zero jargon.',
    purpose: 'Explaining concepts, answering doubts, and teaching best practices.',
    preferredModel: 'qwen2.5:1.5b',
    systemInstructions: 'You are a warm, supportive coding mentor. Explain concepts step by step with clear analogies, minimal jargon, and simple interactive examples.',
    ruleIds: [],
    memoryPolicy: 'full',
    toolPermissions: [],
    temperature: 0.7,
    contextBudget: 4096,
    allowedFileOps: [],
    networkAccess: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

export class BrainStore {
  constructor(storagePath) {
    this.storagePath = storagePath || './data/brains.json';
    this.brains = this.loadBrains();
  }

  loadBrains() {
    try {
      if (fs.existsSync(this.storagePath)) {
        return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      }
    } catch (e) {
      console.error('Error loading brains:', e.message);
    }
    return DEFAULT_BRAINS;
  }

  save() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(this.brains, null, 2));
    } catch (e) {
      console.error('Error saving brains:', e.message);
    }
  }

  getAll() {
    return this.brains;
  }

  getById(id) {
    return this.brains.find(b => b.id === id) || this.brains[0];
  }

  add(brain) {
    const item = {
      ...brain,
      id: brain.id || `brain-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.brains.push(item);
    this.save();
    return item;
  }

  update(id, updates) {
    const idx = this.brains.findIndex(b => b.id === id);
    if (idx === -1) return null;
    this.brains[idx] = { ...this.brains[idx], ...updates, updatedAt: Date.now() };
    this.save();
    return this.brains[idx];
  }

  delete(id) {
    if (this.brains.length <= 1) return false; // Keep at least one
    const before = this.brains.length;
    this.brains = this.brains.filter(b => b.id !== id);
    this.save();
    return this.brains.length < before;
  }
}
