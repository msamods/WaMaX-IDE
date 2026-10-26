// Automated Test Suite for ComfyUI Integration in WaMaX IDE
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

import { ComfyService, CURATED_MODELS } from '../server/services/comfyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, 'sandbox_comfy');

test.beforeEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
});

test.afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('1. ComfyService initializes with default config and safe data paths', async () => {
  const service = new ComfyService({
    workspaceRoot: testDir,
    dataPath: path.join(testDir, 'data')
  });

  assert.equal(service.config.port, 8188);
  assert.equal(service.config.host, '127.0.0.1');
  assert.equal(service.config.serverUrl, 'http://127.0.0.1:8188');
  assert.equal(Array.isArray(service.history), true);
  assert.equal(Array.isArray(service.logs), true);
});

test('2. checkPrerequisites detects OS, Python, and Git presence', async () => {
  const service = new ComfyService({
    workspaceRoot: testDir,
    dataPath: path.join(testDir, 'data')
  });

  const prereqs = await service.checkPrerequisites();
  assert.ok(prereqs.os.platform);
  assert.ok(Number(prereqs.os.totalMemoryGB) > 0);
  assert.equal(typeof prereqs.python.available, 'boolean');
  assert.equal(typeof prereqs.git.available, 'boolean');
});

test('3. getStatus cleanly categorizes not_installed when main.py is absent', async () => {
  const service = new ComfyService({
    workspaceRoot: testDir,
    dataPath: path.join(testDir, 'data')
  });

  const status = await service.getStatus();
  // Server is not running and main.py does not exist in sandbox
  assert.equal(status.status, 'not_installed');
  assert.equal(status.isInstalled, false);
  assert.equal(status.serverOnline, false);
  assert.equal(status.managedProcessRunning, false);
});

test('4. getStatus recognizes installed_stopped when main.py is present', async () => {
  const installPath = path.join(testDir, 'comfy_mock');
  fs.mkdirSync(installPath, { recursive: true });
  fs.writeFileSync(path.join(installPath, 'main.py'), '# mock comfyui main');

  const service = new ComfyService({
    workspaceRoot: testDir,
    dataPath: path.join(testDir, 'data')
  });
  service.updateConfig({ installDir: installPath });

  const status = await service.getStatus();
  assert.equal(status.status, 'installed_stopped');
  assert.equal(status.isInstalled, true);
  assert.equal(status.serverOnline, false);
});

test('5. Safety: Overwriting an existing ComfyUI installation during clone is blocked', async () => {
  const installPath = path.join(testDir, 'existing_comfy');
  fs.mkdirSync(installPath, { recursive: true });
  fs.writeFileSync(path.join(installPath, 'main.py'), '# mock existing file');

  const service = new ComfyService({
    workspaceRoot: testDir,
    dataPath: path.join(testDir, 'data')
  });

  await assert.rejects(
    async () => {
      await service.cloneRepository(installPath);
    },
    {
      message: /already contains a ComfyUI installation. Overwriting is blocked/
    }
  );
});

test('6. Curated Models catalogue contains valid licenses and file metadata', async () => {
  assert.ok(CURATED_MODELS.length >= 3);
  for (const model of CURATED_MODELS) {
    assert.ok(model.id);
    assert.ok(model.name);
    assert.ok(model.filename.endsWith('.safetensors'));
    assert.ok(model.sizeBytes > 1000000000);
    assert.ok(model.license);
    assert.ok(model.url.startsWith('https://'));
  }
});

test('7. Log buffer records entries and respects maxLogs capacity', async () => {
  const service = new ComfyService({
    workspaceRoot: testDir,
    dataPath: path.join(testDir, 'data')
  });

  for (let i = 0; i < 50; i++) {
    service.appendLog(`Test log entry #${i}`);
  }

  const logs = service.getLogs(10);
  assert.equal(logs.length, 10);
  assert.match(logs[logs.length - 1], /Test log entry #49/);
});

test('8. Process Stop safely handles unmanaged or already stopped processes', async () => {
  const service = new ComfyService({
    workspaceRoot: testDir,
    dataPath: path.join(testDir, 'data')
  });

  const res = await service.stopServer();
  assert.equal(res.success, true);
  assert.equal(res.message, 'No managed process to stop');
});
