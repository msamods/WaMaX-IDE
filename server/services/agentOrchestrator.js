// Agent Management and Orchestration Service
import fs from 'fs';
import path from 'path';

export const DEFAULT_AGENTS = [
  {
    id: 'agent-coding',
    name: 'Coding Agent',
    description: 'Specialized in writing clean, modular, and idiomatic code inside the authorized workspace.',
    role: 'coding',
    assignedBrainId: 'brain-coding',
    model: 'qwen2.5:1.5b',
    instructions: 'You are an elite software developer. Write robust code with proper typing, clear structure, and minimal diffs.',
    allowedTools: ['read_file', 'write_file', 'create_file', 'list_dir'],
    fileScope: ['*'],
    networkPermissions: false,
    maxExecutionTimeSec: 120,
    maxToolCalls: 10,
    requireApproval: true,
    status: 'idle',
    auditLog: []
  },
  {
    id: 'agent-debugging',
    name: 'Debugging Agent',
    description: 'Diagnoses errors, stack traces, and unexpected behaviors by pinpointing the root cause.',
    role: 'debugging',
    assignedBrainId: 'brain-debugging',
    model: 'qwen2.5:1.5b',
    instructions: 'Analyze the error logs and stack traces carefully. Identify the exact root cause first, then propose minimal fixes.',
    allowedTools: ['read_file', 'run_command', 'list_dir'],
    fileScope: ['*'],
    networkPermissions: false,
    maxExecutionTimeSec: 180,
    maxToolCalls: 15,
    requireApproval: true,
    status: 'idle',
    auditLog: []
  },
  {
    id: 'agent-review',
    name: 'Code Review Agent',
    description: 'Inspects proposed diffs for correctness, readability, edge cases, and performance.',
    role: 'review',
    assignedBrainId: 'brain-review',
    model: 'qwen2.5:1.5b',
    instructions: 'Review code objectively. Highlight bugs, antipatterns, missing error handling, and performance bottlenecks.',
    allowedTools: ['read_file'],
    fileScope: ['*'],
    networkPermissions: false,
    maxExecutionTimeSec: 90,
    maxToolCalls: 5,
    requireApproval: false,
    status: 'idle',
    auditLog: []
  },
  {
    id: 'agent-testing',
    name: 'Testing Agent',
    description: 'Generates unit tests, integration tests, and runs test suites to verify real outcomes.',
    role: 'testing',
    assignedBrainId: 'brain-coding',
    model: 'qwen2.5:1.5b',
    instructions: 'Write comprehensive test suites covering normal execution, edge cases, and failure modes. Never invent fake test results.',
    allowedTools: ['read_file', 'write_file', 'run_command'],
    fileScope: ['tests/*', '*.test.*', '*.spec.*'],
    networkPermissions: false,
    maxExecutionTimeSec: 150,
    maxToolCalls: 10,
    requireApproval: true,
    status: 'idle',
    auditLog: []
  },
  {
    id: 'agent-security',
    name: 'Security Review Agent',
    description: 'Detects OWASP vulnerabilities, hardcoded credentials, path traversals, and unsafe dependencies.',
    role: 'security',
    assignedBrainId: 'brain-security',
    model: 'qwen2.5:1.5b',
    instructions: 'Audit code rigorously for injection flaws, authentication bypasses, insecure data exposure, and untrusted input execution.',
    allowedTools: ['read_file', 'list_dir'],
    fileScope: ['*'],
    networkPermissions: false,
    maxExecutionTimeSec: 120,
    maxToolCalls: 8,
    requireApproval: false,
    status: 'idle',
    auditLog: []
  },
  {
    id: 'agent-docs',
    name: 'Documentation Agent',
    description: 'Generates clear README files, architecture diagrams, and API specifications.',
    role: 'docs',
    assignedBrainId: 'brain-docs',
    model: 'qwen2.5:1.5b',
    instructions: 'Produce clear, concise, and structured documentation in GitHub Markdown format.',
    allowedTools: ['read_file', 'write_file'],
    fileScope: ['*.md', 'docs/*'],
    networkPermissions: false,
    maxExecutionTimeSec: 90,
    maxToolCalls: 6,
    requireApproval: true,
    status: 'idle',
    auditLog: []
  },
  {
    id: 'agent-planner',
    name: 'Project Planner Agent',
    description: 'Deconstructs complex goals into atomic, verifiable checklists and milestones.',
    role: 'planner',
    assignedBrainId: 'brain-coding',
    model: 'qwen2.5:1.5b',
    instructions: 'Break down the requested task into actionable, phased steps. Track dependencies and verify readiness at each phase.',
    allowedTools: ['read_file', 'list_dir'],
    fileScope: ['*'],
    networkPermissions: false,
    maxExecutionTimeSec: 60,
    maxToolCalls: 5,
    requireApproval: false,
    status: 'idle',
    auditLog: []
  },
  {
    id: 'agent-research',
    name: 'Research Agent',
    description: 'Performs deep dives into local codebases, documentation, and architecture notes.',
    role: 'research',
    assignedBrainId: 'brain-coding',
    model: 'qwen2.5:1.5b',
    instructions: 'Explore the workspace to understand system boundaries, interfaces, and design decisions.',
    allowedTools: ['read_file', 'list_dir'],
    fileScope: ['*'],
    networkPermissions: false,
    maxExecutionTimeSec: 120,
    maxToolCalls: 12,
    requireApproval: false,
    status: 'idle',
    auditLog: []
  }
];

export class AgentOrchestrator {
  constructor(storagePath) {
    this.storagePath = storagePath || './data/agents.json';
    this.agents = this.loadAgents();
  }

  loadAgents() {
    try {
      if (fs.existsSync(this.storagePath)) {
        return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      }
    } catch (e) {
      console.error('Error loading agents:', e.message);
    }
    return DEFAULT_AGENTS;
  }

  save() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(this.agents, null, 2));
    } catch (e) {
      console.error('Error saving agents:', e.message);
    }
  }

  getAll() {
    return this.agents;
  }

  getById(id) {
    return this.agents.find(a => a.id === id);
  }

  update(id, updates) {
    const idx = this.agents.findIndex(a => a.id === id);
    if (idx === -1) return null;
    this.agents[idx] = { ...this.agents[idx], ...updates };
    this.save();
    return this.agents[idx];
  }

  recordAudit(agentId, action, details, approvedBy = 'user') {
    const agent = this.getById(agentId);
    if (agent) {
      if (!agent.auditLog) agent.auditLog = [];
      agent.auditLog.unshift({
        timestamp: Date.now(),
        action,
        details,
        approvedBy
      });
      if (agent.auditLog.length > 50) agent.auditLog.pop();
      this.save();
    }
  }
}
