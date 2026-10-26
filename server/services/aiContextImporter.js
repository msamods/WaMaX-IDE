import fs from 'fs';
import path from 'path';
import os from 'os';

export class AiContextImporter {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot || process.cwd();
    this.homeDir = os.homedir();
  }

  // Common secret patterns to redact / exclude
  static SENSITIVE_PATTERNS = [
    /ghp_[a-zA-Z0-9]{36}/g,
    /sk-[a-zA-Z0-9]{20,}/g,
    /AIza[0-9A-Za-z-_]{35}/g,
    /bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
    /password\s*[:=]\s*['"][^'"]+['"]/gi,
    /secret\s*[:=]\s*['"][^'"]+['"]/gi,
    /token\s*[:=]\s*['"][^'"]+['"]/gi,
    /private_key\s*[:=]/gi
  ];

  static EXCLUDED_FILE_NAMES = [
    'oauth_creds.json',
    'google_accounts.json',
    'credentials.json',
    'id_rsa',
    'id_ed25519',
    '.env',
    'token.json',
    'session.json'
  ];

  isSensitiveFileName(filename) {
    const lower = filename.toLowerCase();
    if (AiContextImporter.EXCLUDED_FILE_NAMES.includes(lower)) return true;
    if (lower.endsWith('.key') || lower.endsWith('.pem') || lower.endsWith('.p12')) return true;
    if (lower.includes('secret') || lower.includes('credential') || lower.includes('token')) return true;
    return false;
  }

  sanitizeContent(text) {
    if (!text || typeof text !== 'string') return '';
    let sanitized = text;
    for (const pat of AiContextImporter.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pat, '[REDACTED_SECRET]');
    }
    return sanitized;
  }

  /**
   * Scan for installed AI tools without reading sensitive payloads
   */
  async scanAvailableContext() {
    const results = {
      claudeCode: {
        installed: false,
        path: path.join(this.homeDir, '.claude'),
        files: [],
        categories: ['global_rules', 'instructions']
      },
      geminiCli: {
        installed: false,
        path: path.join(this.homeDir, '.gemini'),
        files: [],
        categories: ['global_rules', 'skills']
      },
      antigravity: {
        installed: false,
        path: path.join(this.homeDir, '.gemini', 'antigravity-ide'),
        files: [],
        categories: ['skills', 'agent_memory', 'rules']
      },
      projectRules: {
        detected: false,
        path: this.workspaceRoot,
        files: [],
        categories: ['project_rules', 'coding_standards']
      }
    };

    // 1. Claude Code (~/.claude)
    if (fs.existsSync(results.claudeCode.path)) {
      results.claudeCode.installed = true;
      try {
        const files = fs.readdirSync(results.claudeCode.path);
        for (const f of files) {
          if (!this.isSensitiveFileName(f) && (f.endsWith('.md') || f.endsWith('.json') || f.endsWith('.txt'))) {
            results.claudeCode.files.push(f);
          }
        }
      } catch {}
    }

    // 2. Gemini CLI (~/.gemini)
    if (fs.existsSync(results.geminiCli.path)) {
      results.geminiCli.installed = true;
      try {
        const geminiMd = path.join(results.geminiCli.path, 'GEMINI.md');
        if (fs.existsSync(geminiMd)) {
          results.geminiCli.files.push('GEMINI.md');
        }
        const skillsDir = path.join(results.geminiCli.path, 'config', 'skills');
        if (fs.existsSync(skillsDir)) {
          const skills = fs.readdirSync(skillsDir);
          results.geminiCli.files.push(`config/skills/ (${skills.length} skills)`);
        }
      } catch {}
    }

    // 3. Antigravity IDE & Agents
    const agDir = path.join(this.homeDir, '.gemini', 'antigravity-ide');
    const localAgentsDir = path.join(this.workspaceRoot, '.agents');
    if (fs.existsSync(agDir) || fs.existsSync(localAgentsDir)) {
      results.antigravity.installed = true;
      if (fs.existsSync(agDir)) {
        results.antigravity.files.push('antigravity-ide/knowledge');
      }
      if (fs.existsSync(localAgentsDir)) {
        results.antigravity.files.push('.agents/');
      }
    }

    // 4. Project-Level AI Rules in Workspace
    const commonRuleFiles = [
      'CLAUDE.md',
      'GEMINI.md',
      'AGENTS.md',
      '.cursorrules',
      '.windsurfrules',
      'ARCHITECTURE.md'
    ];
    for (const rf of commonRuleFiles) {
      const full = path.join(this.workspaceRoot, rf);
      if (fs.existsSync(full)) {
        results.projectRules.detected = true;
        results.projectRules.files.push(rf);
      }
    }

    return results;
  }

  /**
   * Preview content for selected source before importing
   */
  async previewSource(sourceKey) {
    const items = [];

    // Helper to read and sanitize safe files
    const safeRead = (filePath, category, sourceName) => {
      if (!fs.existsSync(filePath)) return;
      const stat = fs.statSync(filePath);
      if (stat.size > 200 * 1024) return; // Skip giant binaries
      const base = path.basename(filePath);
      if (this.isSensitiveFileName(base)) return;

      const raw = fs.readFileSync(filePath, 'utf8');
      const sanitized = this.sanitizeContent(raw);
      items.push({
        id: `prev_${category}_${base}`,
        source: sourceName,
        category,
        title: base,
        filePath,
        contentSample: sanitized.slice(0, 1200),
        fullContent: sanitized
      });
    };

    if (sourceKey === 'projectRules') {
      const candidates = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', '.cursorrules', 'ARCHITECTURE.md'];
      for (const f of candidates) {
        const full = path.join(this.workspaceRoot, f);
        safeRead(full, 'project_rules', 'Project Workspace');
      }
    } else if (sourceKey === 'geminiCli') {
      const geminiMd = path.join(this.homeDir, '.gemini', 'GEMINI.md');
      safeRead(geminiMd, 'global_rules', 'Gemini CLI');
    } else if (sourceKey === 'claudeCode') {
      const claudeMd = path.join(this.homeDir, '.claude', 'CLAUDE.md');
      safeRead(claudeMd, 'global_rules', 'Claude Code');
      const settingsFile = path.join(this.homeDir, '.claude', 'settings.json');
      if (fs.existsSync(settingsFile)) {
        try {
          const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
          delete raw.apiKey;
          delete raw.token;
          items.push({
            id: 'prev_claude_settings',
            source: 'Claude Code',
            category: 'instructions',
            title: 'settings.json',
            contentSample: JSON.stringify(raw, null, 2).slice(0, 800),
            fullContent: JSON.stringify(raw, null, 2)
          });
        } catch {}
      }
    } else if (sourceKey === 'antigravity') {
      const skillsDir = path.join(this.homeDir, '.gemini', 'config', 'skills');
      if (fs.existsSync(skillsDir)) {
        const dirs = fs.readdirSync(skillsDir).slice(0, 10);
        for (const d of dirs) {
          const skillFile = path.join(skillsDir, d, 'SKILL.md');
          safeRead(skillFile, 'skills', `Antigravity Skill: ${d}`);
        }
      }
    }

    return items;
  }

  /**
   * Import approved items into WaMaX stores
   */
  async importItems({ selectedSources = [], ruleEngine, memoryStore, brainStore }) {
    const importedSummary = {
      rulesAdded: 0,
      skillsAdded: 0,
      memoriesAdded: 0,
      brainsAdded: 0,
      details: []
    };

    for (const src of selectedSources) {
      const previews = await this.previewSource(src);
      for (const item of previews) {
        // 1. If it's a rule
        if (item.category === 'project_rules' || item.category === 'global_rules') {
          const newRule = ruleEngine.add({
            name: `${item.title} (${item.source})`,
            description: `Imported from ${item.source} (${item.title})`,
            content: item.fullContent,
            scope: item.category === 'project_rules' ? 'project' : 'global',
            priority: item.category === 'project_rules' ? 80 : 90,
            enabled: true,
            sourceAttribution: item.source
          });
          importedSummary.rulesAdded++;
          importedSummary.details.push(`Added Rule: ${newRule.name}`);
        }

        // 2. If it's a skill / reusable workflow
        else if (item.category === 'skills') {
          // Add as specialized brain persona or skill memory
          const mem = memoryStore.add({
            content: `[REUSABLE SKILL: ${item.title}]\n${item.fullContent}`,
            category: 'skill',
            tags: ['imported', 'skill', item.source.toLowerCase()]
          });
          importedSummary.skillsAdded++;
          importedSummary.details.push(`Imported Skill: ${item.title}`);
        }

        // 3. If it's instructions or memory
        else {
          const mem = memoryStore.add({
            content: `[IMPORTED CONTEXT - ${item.source}]\n${item.fullContent}`,
            category: 'imported_context',
            tags: ['imported', item.source.toLowerCase()]
          });
          importedSummary.memoriesAdded++;
          importedSummary.details.push(`Imported Memory: ${item.title}`);
        }
      }
    }

    return importedSummary;
  }
}
