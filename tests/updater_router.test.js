// Tests for Model Auto-Switcher and Zero-Data-Loss GitHub Auto-Updater
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { ModelRouter } from '../server/services/modelRouter.js';
import { UpdateService } from '../server/services/updateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sandbox = path.join(__dirname, 'sandbox_update_router');

test.beforeEach(() => {
  if (fs.existsSync(sandbox)) fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandbox, { recursive: true });
});

test.afterEach(() => {
  if (fs.existsSync(sandbox)) fs.rmSync(sandbox, { recursive: true, force: true });
});

test('1. ModelRouter task classification accurately identifies coding and reasoning', () => {
  const router = new ModelRouter({});
  assert.equal(router.classifyTask('Can you fix this bug in my python function?'), 'coding');
  assert.equal(router.classifyTask('Write a REST api in express with tests'), 'coding');
  assert.equal(router.classifyTask('Explain why quicksort is faster than bubblesort'), 'reasoning');
  assert.equal(router.classifyTask('Hello, how are you today?'), 'chat');
});

test('2. ModelRouter low-memory guard selects smaller model when free RAM < 1200MB', async () => {
  const mockOllama = {
    listModels: async () => [
      { name: 'deepseek-r1:7b' },
      { name: 'qwen2.5:1.5b' },
      { name: 'qwen2.5-coder:7b' }
    ]
  };

  const router = new ModelRouter({ ollamaClient: mockOllama });
  const selected = await router.selectModel({
    prompt: 'Fix this code',
    freeMemMB: 800 // Low RAM
  });

  assert.equal(selected.reason, 'low_memory_guard');
  assert.equal(selected.model, 'qwen2.5:1.5b');
});

test('3. ModelRouter task-based switching picks coder model for code queries', async () => {
  const mockOllama = {
    listModels: async () => [
      { name: 'qwen2.5:1.5b' },
      { name: 'qwen2.5-coder:1.5b' },
      { name: 'deepseek-r1:1.5b' }
    ]
  };

  const router = new ModelRouter({ ollamaClient: mockOllama });
  const selected = await router.selectModel({
    prompt: 'Create a typescript interface for user profile',
    freeMemMB: 4000
  });

  assert.equal(selected.reason, 'task_coding');
  assert.equal(selected.model, 'qwen2.5-coder:1.5b');
});

test('4. UpdateService creates pre-update backup preserving memory and rules', async () => {
  const dataDir = path.join(sandbox, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'memories.json'), JSON.stringify([{ id: 'm1', text: 'Important memory' }]));
  fs.writeFileSync(path.join(dataDir, 'rules.json'), JSON.stringify([{ id: 'r1', name: 'Coding rule' }]));

  const updater = new UpdateService({
    workspaceRoot: sandbox,
    currentVersion: '1.0.0'
  });
  updater.dataPath = dataDir;

  const backup = await updater.createPreUpdateBackup();
  assert.equal(backup.success, true);
  assert.equal(backup.backedUpFiles, 2);

  // Verify backup exists on disk
  const backedUpMemory = JSON.parse(fs.readFileSync(path.join(backup.backupDir, 'memories.json'), 'utf-8'));
  assert.equal(backedUpMemory[0].text, 'Important memory');
});
