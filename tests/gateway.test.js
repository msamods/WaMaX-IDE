import { test, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { GatewayService } from '../server/services/gatewayService.js';
import { GatewayServer } from '../server/services/gatewayServer.js';
import { OllamaClient } from '../server/services/ollamaClient.js';
import { RuleEngine } from '../server/services/ruleEngine.js';
import { BrainStore } from '../server/services/brainStore.js';
import { AgentOrchestrator } from '../server/services/agentOrchestrator.js';
import { MemoryStore } from '../server/services/memoryStore.js';
import { FileService } from '../server/services/fileService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDataDir = path.join(__dirname, 'sandbox_gateway_data');

let gatewayService;
let gatewayServer;
let mockOllama;
let brainStore;
let ruleEngine;
let agentOrchestrator;
let memoryStore;
let fileService;
let testPort = 8789;

before(async () => {
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDataDir, { recursive: true });

  gatewayService = new GatewayService(testDataDir);
  gatewayService.updateConfig({
    port: testPort,
    host: '127.0.0.1',
    lanEnabled: false,
    rateLimitRpmDefault: 5 // Low limit for testing
  });

  // Mock Ollama Client with fast deterministic response
  mockOllama = {
    isHealthy: async () => true,
    getSystemMetrics: () => ({ usedMemMB: 4000, totalMemMB: 8000, percentUsed: 50 }),
    listModels: async () => [
      { name: 'qwen2.5:1.5b', size: 1000000000, modified_at: new Date().toISOString() },
      { name: 'llama3:8b', size: 4500000000, modified_at: new Date().toISOString() }
    ],
    chat: async ({ model, messages, stream, onChunk }) => {
      const userMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
      if (stream && onChunk) {
        onChunk({ content: 'Hello ' });
        onChunk({ content: 'from ' });
        onChunk({ content: 'WaMaX!' });
        return { done: true };
      }
      return {
        message: { role: 'assistant', content: `Echo from ${model}: ${userMsg}` },
        prompt_eval_count: 12,
        eval_count: 8
      };
    }
  };

  ruleEngine = new RuleEngine(path.join(testDataDir, 'rules.json'));
  brainStore = new BrainStore(path.join(testDataDir, 'brains.json'));
  agentOrchestrator = new AgentOrchestrator(path.join(testDataDir, 'agents.json'));
  memoryStore = new MemoryStore(path.join(testDataDir, 'memories.json'));
  fileService = new FileService(path.resolve(__dirname, '..'));

  gatewayServer = new GatewayServer({
    gatewayService,
    ollamaClient: mockOllama,
    brainStore,
    ruleEngine,
    agentOrchestrator,
    memoryStore,
    fileService
  });

  await gatewayServer.start();
});

after(async () => {
  await gatewayServer.stop();
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});

test('1. Localhost server startup and listening address verification', async () => {
  const status = gatewayServer.getStatus();
  assert.strictEqual(status.status, 'running');
  assert.strictEqual(status.host, '127.0.0.1');
  assert.strictEqual(status.port, testPort);
  assert.strictEqual(status.lanEnabled, false);
});

test('2. Health endpoint responds publicly without secrets', async () => {
  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/health`);
  assert.strictEqual(resp.status, 200);
  const data = await resp.json();
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(data.version, 'v2');
  assert.strictEqual(data.service, 'WaMaX IDE API');
});

test('3. Missing API key rejection (401)', async () => {
  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/models`);
  assert.strictEqual(resp.status, 401);
  const data = await resp.json();
  assert.strictEqual(data.error.code, 'UNAUTHORIZED');
});

test('4. Invalid API key rejection (401)', async () => {
  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/models`, {
    headers: { Authorization: 'Bearer wmx_live_invalidkey1234567890abcdef' }
  });
  assert.strictEqual(resp.status, 401);
  const data = await resp.json();
  assert.strictEqual(data.error.code, 'INVALID_KEY');
});

test('5. API Key Creation with secure format and constant-time verification', async () => {
  const newKey = gatewayService.createKey({
    name: 'External Test App',
    permissions: ['models:read', 'chat:completions'],
    allowedModels: ['qwen2.5:1.5b', 'local-default'],
    rateLimitRpm: 5
  });

  assert.ok(newKey.rawSecret.startsWith('wmx_live_'));
  assert.strictEqual(newKey.rawSecret.length, 9 + 64); // wmx_live_ (9) + 64 hex chars
  assert.ok(newKey.hashedSecret);
  assert.notStrictEqual(newKey.hashedSecret, newKey.rawSecret);

  // Authenticate with the newly created key
  const verify = gatewayService.verifyApiKey(newKey.rawSecret);
  assert.strictEqual(verify.valid, true);
  assert.strictEqual(verify.key.id, newKey.id);
});

test('6. Model discovery with permissions and alias resolution', async () => {
  const key = gatewayService.createKey({
    name: 'Restricted Model Key',
    permissions: ['models:read'],
    allowedModels: ['qwen2.5:1.5b']
  });

  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/models`, {
    headers: { Authorization: `Bearer ${key.rawSecret}` }
  });
  assert.strictEqual(resp.status, 200);
  const body = await resp.json();
  assert.strictEqual(body.object, 'list');
  const ids = body.data.map((m) => m.id);
  assert.ok(ids.includes('local-default'));
  assert.ok(ids.includes('qwen2.5:1.5b'));
  assert.strictEqual(ids.includes('llama3:8b'), false); // Filtered out by allowedModels
});

test('7. OpenAI-compatible chat completions (non-streaming)', async () => {
  const key = gatewayService.createKey({
    name: 'Chat Completions Key',
    permissions: ['chat:completions'],
    allowedModels: ['*']
  });

  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key.rawSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'local-default',
      messages: [{ role: 'user', content: 'What is Docker?' }]
    })
  });

  assert.strictEqual(resp.status, 200);
  const data = await resp.json();
  assert.strictEqual(data.object, 'chat.completion');
  assert.ok(data.id.startsWith('chatcmpl-'));
  assert.ok(data.choices[0].message.content.includes('Echo from qwen2.5:1.5b'));
  assert.ok(data.usage.total_tokens > 0);
});

test('8. OpenAI-compatible streaming responses with SSE framing', async () => {
  const key = gatewayService.createKey({
    name: 'Streaming Key',
    permissions: ['chat:completions'],
    allowedModels: ['*']
  });

  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key.rawSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'local-default',
      messages: [{ role: 'user', content: 'Stream test' }],
      stream: true
    })
  });

  assert.strictEqual(resp.status, 200);
  assert.ok(resp.headers.get('content-type').includes('text/event-stream'));

  const text = await resp.text();
  assert.ok(text.includes('data: {"id":"chatcmpl-'));
  assert.ok(text.includes('data: [DONE]'));
});

test('9. Permission denial (403) when key lacks capability', async () => {
  const key = gatewayService.createKey({
    name: 'Readonly Key',
    permissions: ['models:read'] // No chat:completions
  });

  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key.rawSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'local-default',
      messages: [{ role: 'user', content: 'Hello' }]
    })
  });

  assert.strictEqual(resp.status, 403);
  const data = await resp.json();
  assert.strictEqual(data.error.code, 'PERMISSION_DENIED');
});

test('10. Revoked API Key rejection (401)', async () => {
  const key = gatewayService.createKey({
    name: 'To be revoked',
    permissions: ['*']
  });

  gatewayService.revokeKey(key.id);

  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/ready`, {
    headers: { Authorization: `Bearer ${key.rawSecret}` }
  });
  assert.strictEqual(resp.status, 401);
  const data = await resp.json();
  assert.strictEqual(data.error.code, 'KEY_REVOKED');
});

test('11. Key Rotation displays new secret and invalidates old one', async () => {
  const key = gatewayService.createKey({
    name: 'To be rotated',
    permissions: ['*']
  });
  const oldSecret = key.rawSecret;

  const rotated = gatewayService.rotateKey(key.id);
  assert.ok(rotated.rawSecret.startsWith('wmx_live_'));
  assert.notStrictEqual(rotated.rawSecret, oldSecret);

  // Old secret must be rejected
  const oldCheck = gatewayService.verifyApiKey(oldSecret);
  assert.strictEqual(oldCheck.valid, false);

  // New secret must pass
  const newCheck = gatewayService.verifyApiKey(rotated.rawSecret);
  assert.strictEqual(newCheck.valid, true);
});

test('12. Rate limiting enforcement (HTTP 429)', async () => {
  const key = gatewayService.createKey({
    name: 'Strict Rate Limited Key',
    permissions: ['*'],
    rateLimitRpm: 2 // Only 2 requests per minute allowed
  });

  // Req 1: OK
  const r1 = await fetch(`http://127.0.0.1:${testPort}/api/v2/ready`, {
    headers: { Authorization: `Bearer ${key.rawSecret}` }
  });
  assert.strictEqual(r1.status, 200);

  // Req 2: OK
  const r2 = await fetch(`http://127.0.0.1:${testPort}/api/v2/ready`, {
    headers: { Authorization: `Bearer ${key.rawSecret}` }
  });
  assert.strictEqual(r2.status, 200);

  // Req 3: Rate Limited (429)
  const r3 = await fetch(`http://127.0.0.1:${testPort}/api/v2/ready`, {
    headers: { Authorization: `Bearer ${key.rawSecret}` }
  });
  assert.strictEqual(r3.status, 429);
  const data = await r3.json();
  assert.strictEqual(data.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.ok(r3.headers.get('Retry-After'));
});

test('13. Secret Redaction: Logs never store raw keys', async () => {
  const logs = gatewayService.getLogs();
  assert.ok(logs.length > 0);
  for (const log of logs) {
    assert.strictEqual(typeof log.rawSecret, 'undefined');
    if (log.keyPrefix && log.keyPrefix !== 'none') {
      assert.ok(log.keyPrefix.includes('...')); // Redacted prefix format wmx_live_abc...1234
    }
  }
});

test('14. OpenAPI 3.0 specification endpoint validity', async () => {
  const resp = await fetch(`http://127.0.0.1:${testPort}/api/v2/openapi.json`);
  assert.strictEqual(resp.status, 200);
  const spec = await resp.json();
  assert.strictEqual(spec.openapi, '3.0.3');
  assert.strictEqual(spec.info.title, 'WaMaX IDE Developer API & Gateway');
  assert.ok(spec.paths['/chat/completions']);
  assert.ok(spec.paths['/models']);
  assert.ok(spec.paths['/health']);
});
