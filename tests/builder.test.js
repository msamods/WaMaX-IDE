import { test, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { AiContextImporter } from '../server/services/aiContextImporter.js';
import { AutonomousBuilder } from '../server/services/autonomousBuilder.js';
import { RuleEngine } from '../server/services/ruleEngine.js';
import { MemoryStore } from '../server/services/memoryStore.js';
import { FileService } from '../server/services/fileService.js';
import { TerminalService } from '../server/services/terminalService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sandboxDir = path.join(__dirname, 'sandbox_builder_test');

let importer;
let builder;
let ruleEngine;
let memoryStore;
let fileService;
let terminalService;

before(() => {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  // Create mock project rule file with a secret inside to test redaction
  fs.writeFileSync(
    path.join(sandboxDir, 'CLAUDE.md'),
    '# Project Guidelines\nAlways write tests with node:test.\nSecret key: ghp_1234567890abcdef1234567890abcdef1234\n',
    'utf8'
  );

  // Create a sensitive file that must be strictly skipped
  fs.writeFileSync(path.join(sandboxDir, 'oauth_creds.json'), '{"token": "super-secret"}', 'utf8');

  importer = new AiContextImporter(sandboxDir);
  ruleEngine = new RuleEngine(path.join(sandboxDir, 'rules.json'));
  memoryStore = new MemoryStore(path.join(sandboxDir, 'memories.json'));
  fileService = new FileService(sandboxDir);
  terminalService = new TerminalService(sandboxDir);

  builder = new AutonomousBuilder({
    workspaceRoot: sandboxDir,
    fileService,
    terminalService,
    ruleEngine,
    memoryStore,
    ollamaClient: { isHealthy: async () => true }
  });
});

after(() => {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
});

test('1. Scan detects project-level AI rules', async () => {
  const scan = await importer.scanAvailableContext();
  assert.strictEqual(scan.projectRules.detected, true);
  assert.ok(scan.projectRules.files.includes('CLAUDE.md'));
  // Sensitive files must not be listed in importable files
  assert.strictEqual(scan.projectRules.files.includes('oauth_creds.json'), false);
});

test('2. Secret Redaction: Tokens in preview are redacted', async () => {
  const previews = await importer.previewSource('projectRules');
  assert.ok(previews.length > 0);
  const claudePreview = previews.find((p) => p.title === 'CLAUDE.md');
  assert.ok(claudePreview);
  assert.strictEqual(claudePreview.contentSample.includes('ghp_1234567890abcdef'), false);
  assert.ok(claudePreview.contentSample.includes('[REDACTED_SECRET]'));
});

test('3. Import into RuleEngine preserves source attribution', async () => {
  const result = await importer.importItems({
    selectedSources: ['projectRules'],
    ruleEngine,
    memoryStore,
    brainStore: null
  });

  assert.ok(result.rulesAdded > 0);
  const rules = ruleEngine.getAll();
  const imported = rules.find((r) => r.sourceAttribution === 'Project Workspace');
  assert.ok(imported);
  assert.ok(imported.name.includes('CLAUDE.md'));
  assert.strictEqual(imported.content.includes('ghp_'), false);
});

test('4. Autonomous Builder in Plan Only mode does not write files', async () => {
  const session = await builder.createSession({
    taskPrompt: 'Build a Node.js REST API',
    autonomyLevel: 'plan_only'
  });

  assert.strictEqual(session.autonomyLevel, 'plan_only');
  assert.ok(session.plan.length > 0);
  assert.strictEqual(session.appliedFiles.length, 0);
});

test('5. Autonomous Builder in Autonomous mode scaffolds files and executes', async () => {
  const session = await builder.createSession({
    taskPrompt: 'Build a high-performance helper module',
    autonomyLevel: 'autonomous'
  });

  assert.ok(session.id.startsWith('build_'));
  assert.strictEqual(session.steps.length, 10);
  assert.ok(session.appliedFiles.length > 0);
  assert.ok(fs.existsSync(path.join(sandboxDir, session.appliedFiles[0])));
  assert.ok(session.report);
  assert.strictEqual(session.report.testsPassed, true);
});
