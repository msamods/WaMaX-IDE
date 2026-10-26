// Deterministic Rule Engine for WaMaX IDE
import fs from 'fs';
import path from 'path';

export const MANDATORY_SAFETY_RULES = [
  {
    id: 'safety-001',
    name: 'Path Traversal Prevention',
    content: 'Never access, read, modify, or delete files outside the authorized workspace directory.',
    scope: 'safety',
    priority: 1000
  },
  {
    id: 'safety-002',
    name: 'Secret & Credential Protection',
    content: 'Never log, print, output, or expose API keys, passwords, private keys, or .env secrets in chat responses.',
    scope: 'safety',
    priority: 999
  },
  {
    id: 'safety-003',
    name: 'Destructive Action Approval',
    content: 'Always require explicit user approval before executing destructive file deletions, database drops, or system package modifications.',
    scope: 'safety',
    priority: 998
  },
  {
    id: 'safety-004',
    name: 'Truthful Grounding',
    content: 'Do not invent fake APIs, fabricate test results, or claim code ran successfully unless verified by actual execution.',
    scope: 'safety',
    priority: 997
  }
];

export class RuleEngine {
  constructor(storagePath) {
    this.storagePath = storagePath || './data/rules.json';
    this.rules = this.loadRules();
  }

  loadRules() {
    try {
      if (fs.existsSync(this.storagePath)) {
        return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      }
    } catch (e) {
      console.error('Error loading rules:', e.message);
    }
    // Return sensible defaults
    return [
      {
        id: 'rule-global-1',
        name: 'Targeted Code Edits',
        description: 'Prefer small, precise diffs over rewriting entire files.',
        content: 'When proposing code changes, make minimal and targeted modifications. Do not rewrite working files from scratch when a small patch suffices.',
        scope: 'global',
        priority: 100,
        enabled: true,
        createdAt: Date.now()
      },
      {
        id: 'rule-global-2',
        name: 'Root Cause First',
        description: 'Explain the root cause of an error before jumping to code.',
        content: 'When debugging or fixing errors, first explain the exact technical root cause in clear terms, then provide the targeted solution.',
        scope: 'global',
        priority: 90,
        enabled: true,
        createdAt: Date.now()
      },
      {
        id: 'rule-global-3',
        name: 'Preserve Functionality',
        description: 'Never break existing working features or remove comments.',
        content: 'Preserve all existing working functionality, docstrings, and non-trivial comments unless explicitly instructed otherwise.',
        scope: 'global',
        priority: 85,
        enabled: true,
        createdAt: Date.now()
      },
      {
        id: 'rule-project-1',
        name: 'Clean Code Standards',
        description: 'Follow clean architecture and typed interfaces.',
        content: 'Use TypeScript types where available, adhere to idiomatic patterns, avoid any types, and write modular maintainable code.',
        scope: 'workspace',
        priority: 70,
        enabled: true,
        createdAt: Date.now()
      }
    ];
  }

  saveRules() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(this.rules, null, 2));
    } catch (e) {
      console.error('Failed to save rules:', e.message);
    }
  }

  getAll() {
    return this.rules;
  }

  getById(id) {
    return this.rules.find(r => r.id === id);
  }

  add(rule) {
    const newRule = {
      ...rule,
      id: rule.id || `rule-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.rules.push(newRule);
    this.saveRules();
    return newRule;
  }

  update(id, updates) {
    const idx = this.rules.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.rules[idx] = { ...this.rules[idx], ...updates, updatedAt: Date.now() };
    this.saveRules();
    return this.rules[idx];
  }

  delete(id) {
    const before = this.rules.length;
    this.rules = this.rules.filter(r => r.id !== id);
    this.saveRules();
    return this.rules.length < before;
  }

  /**
   * Deterministic Rule Resolution with Precedence:
   * 1. Mandatory Safety & Security Rules (Highest - 1000+)
   * 2. Global User Rules (scope: global, priority: 90-200)
   * 3. Workspace / Project Rules (scope: workspace/project, priority: 50-89)
   * 4. Directory & File Rules (scope: file, priority: 30-49)
   * 5. Brain & Agent Instructions (priority: 20-29)
   * 6. Task Instructions (priority: 1-19)
   */
  resolve({ activeBrain, activeAgent, targetFile, taskInstruction }) {
    const applied = [];
    const overridden = [];

    // 1. Mandatory Safety
    MANDATORY_SAFETY_RULES.forEach(r => applied.push({ ...r, source: 'System Safety Constraint' }));

    // 2. Active enabled rules sorted by priority descending
    const enabledUserRules = this.rules
      .filter(r => r.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of enabledUserRules) {
      // Check file pattern matching if rule is file-scoped
      if (rule.scope === 'file' && rule.filePatterns && rule.filePatterns.length && targetFile) {
        const matches = rule.filePatterns.some(p => targetFile.endsWith(p) || targetFile.includes(p));
        if (!matches) continue;
      }

      // Check brain scope
      if (rule.applicableBrains && rule.applicableBrains.length && activeBrain) {
        if (!rule.applicableBrains.includes(activeBrain.id)) continue;
      }

      // Check agent scope
      if (rule.applicableAgents && rule.applicableAgents.length && activeAgent) {
        if (!rule.applicableAgents.includes(activeAgent.id)) continue;
      }

      applied.push({
        id: rule.id,
        name: rule.name,
        content: rule.content,
        scope: rule.scope,
        priority: rule.priority,
        source: `${rule.scope.toUpperCase()} Rule`
      });
    }

    // Combine into final structured prompt instructions
    const systemPromptParts = [
      '# MANDATORY SYSTEM CONSTRAINTS (INVIOLABLE):',
      ...MANDATORY_SAFETY_RULES.map(r => `- [${r.name}] ${r.content}`),
      '',
      '# ACTIVE USER & PROJECT RULES (DETERMINISTIC PRECEDENCE):',
      ...applied.filter(r => r.scope !== 'safety').map(r => `- [${r.name}] (${r.source}) ${r.content}`)
    ];

    if (activeBrain) {
      systemPromptParts.push('', `# ACTIVE AI BRAIN: ${activeBrain.name}`, activeBrain.systemInstructions || '');
    }

    if (activeAgent) {
      systemPromptParts.push('', `# ACTIVE AGENT: ${activeAgent.name} (${activeAgent.role})`, activeAgent.instructions || '');
    }

    if (taskInstruction) {
      systemPromptParts.push('', '# CURRENT TASK INSTRUCTIONS:', taskInstruction);
    }

    return {
      resolvedPrompt: systemPromptParts.join('\n'),
      appliedRules: applied,
      overriddenRules: overridden
    };
  }
}
