// WaMaX IDE Backend API Server
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { OllamaClient } from './services/ollamaClient.js';
import { RuleEngine } from './services/ruleEngine.js';
import { MemoryStore } from './services/memoryStore.js';
import { BrainStore } from './services/brainStore.js';
import { AgentOrchestrator } from './services/agentOrchestrator.js';
import { FileService } from './services/fileService.js';
import { GitService } from './services/gitService.js';
import { TerminalService } from './services/terminalService.js';
import { GatewayService } from './services/gatewayService.js';
import { GatewayServer } from './services/gatewayServer.js';
import { createV2Router } from './routes/v2.js';
import { AiContextImporter } from './services/aiContextImporter.js';
import { AutonomousBuilder } from './services/autonomousBuilder.js';
import { ComfyService } from './services/comfyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Workspace root: defaults to the project parent or current working directory
const defaultWorkspace = path.resolve(__dirname, '..');

// Initialize Services
const ollama = new OllamaClient(process.env.OLLAMA_URL || 'http://127.0.0.1:11434');
const ruleEngine = new RuleEngine(path.join(__dirname, 'data', 'rules.json'));
const memoryStore = new MemoryStore(path.join(__dirname, 'data', 'memories.json'));
const brainStore = new BrainStore(path.join(__dirname, 'data', 'brains.json'));
const agentOrchestrator = new AgentOrchestrator(path.join(__dirname, 'data', 'agents.json'));
const fileService = new FileService(defaultWorkspace);
const gitService = new GitService(defaultWorkspace);
const terminalService = new TerminalService(defaultWorkspace);
const gatewayService = new GatewayService(path.join(__dirname, 'data'));
const aiContextImporter = new AiContextImporter(defaultWorkspace);
const autonomousBuilder = new AutonomousBuilder({
  workspaceRoot: defaultWorkspace,
  fileService,
  terminalService,
  ruleEngine,
  memoryStore,
  ollamaClient: ollama
});
const gatewayServer = new GatewayServer({
  gatewayService,
  ollamaClient: ollama,
  brainStore,
  ruleEngine,
  agentOrchestrator,
  memoryStore,
  fileService
});
const comfyService = new ComfyService({
  workspaceRoot: defaultWorkspace,
  dataPath: path.join(__dirname, 'data')
});

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// 1. Health & System Metrics
app.get('/api/health', async (req, res) => {
  const isOllamaUp = await ollama.isHealthy();
  const sys = ollama.getSystemMetrics();
  res.json({
    status: 'ok',
    ollama: isOllamaUp,
    system: sys,
    workspace: fileService.getWorkspace(),
    defaultModel: 'qwen2.5:1.5b'
  });
});

// 2. Local Models
app.get('/api/models', async (req, res) => {
  const models = await ollama.listModels();
  res.json(models);
});

app.post('/api/models/pull', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Model name required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    await ollama.pullModel(name, (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ status: 'success', done: true })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message, done: true })}\n\n`);
    res.end();
  }
});

// 3. AI Brain Studio
app.get('/api/brains', (req, res) => res.json(brainStore.getAll()));
app.get('/api/brains/:id', (req, res) => res.json(brainStore.getById(req.params.id)));
app.post('/api/brains', (req, res) => res.json(brainStore.add(req.body)));
app.put('/api/brains/:id', (req, res) => res.json(brainStore.update(req.params.id, req.body)));
app.delete('/api/brains/:id', (req, res) => res.json({ success: brainStore.delete(req.params.id) }));

// 4. Agent Manager
app.get('/api/agents', (req, res) => res.json(agentOrchestrator.getAll()));
app.get('/api/agents/:id', (req, res) => res.json(agentOrchestrator.getById(req.params.id)));
app.put('/api/agents/:id', (req, res) => res.json(agentOrchestrator.update(req.params.id, req.body)));

// 5. Global & Project Rules
app.get('/api/rules', (req, res) => res.json(ruleEngine.getAll()));
app.post('/api/rules', (req, res) => res.json(ruleEngine.add(req.body)));
app.put('/api/rules/:id', (req, res) => res.json(ruleEngine.update(req.params.id, req.body)));
app.delete('/api/rules/:id', (req, res) => res.json({ success: ruleEngine.delete(req.params.id) }));

// Rule Resolution & Conflict Inspection
app.post('/api/rules/resolve', (req, res) => {
  const { brainId, agentId, targetFile, taskInstruction } = req.body;
  const brain = brainId ? brainStore.getById(brainId) : null;
  const agent = agentId ? agentOrchestrator.getById(agentId) : null;
  const result = ruleEngine.resolve({
    activeBrain: brain,
    activeAgent: agent,
    targetFile,
    taskInstruction
  });
  res.json(result);
});

// 6. AI Memory System
app.get('/api/memory', (req, res) => res.json(memoryStore.getAll()));
app.post('/api/memory', (req, res) => res.json(memoryStore.add(req.body)));
app.delete('/api/memory/:id', (req, res) => res.json({ success: memoryStore.delete(req.params.id) }));

// 7. Workspace & Files
app.get('/api/files/tree', (req, res) => {
  try {
    const tree = fileService.getTree(req.query.path || '');
    res.json({ workspace: fileService.getWorkspace(), tree });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files/read', (req, res) => {
  try {
    const content = fileService.readFile(req.query.path);
    res.json({ path: req.query.path, content });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post('/api/files/write', (req, res) => {
  const { path: filePath, content } = req.body;
  try {
    const result = fileService.writeFile(filePath, content);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/files/delete', (req, res) => {
  try {
    const result = fileService.deleteItem(req.body.path);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workspace', (req, res) => {
  const { path: newPath } = req.body;
  try {
    fileService.setWorkspace(newPath);
    gitService.setWorkspace(newPath);
    terminalService.setWorkspace(newPath);
    res.json({ success: true, workspace: fileService.getWorkspace() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 8. AI Chat & Doubt Solving with Streaming
app.post('/api/ai/chat', async (req, res) => {
  const {
    messages = [],
    brainId,
    agentId,
    model = 'qwen2.5:1.5b',
    attachedContext = '',
    targetFile = ''
  } = req.body;

  const brain = brainId ? brainStore.getById(brainId) : brainStore.getAll()[0];
  const agent = agentId ? agentOrchestrator.getById(agentId) : null;

  // Retrieve relevant memories
  const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
  const memoryContext = memoryStore.retrieve({ query: `${lastUserMsg} ${targetFile}`, maxTokens: 400 });

  // Resolve rules
  const ruleContext = ruleEngine.resolve({
    activeBrain: brain,
    activeAgent: agent,
    targetFile,
    taskInstruction: attachedContext
  });

  const systemInstructions = [
    ruleContext.resolvedPrompt,
    memoryContext.text,
    attachedContext ? `\n# ATTACHED WORKSPACE CONTEXT / CODE SNIPPET:\n${attachedContext}` : ''
  ].filter(Boolean).join('\n\n');

  const fullMessages = [
    { role: 'system', content: systemInstructions },
    ...messages
  ];

  try {
    const result = await ollama.chat({
      model: model || brain?.preferredModel || 'qwen2.5:1.5b',
      messages: fullMessages,
      temperature: brain?.temperature || 0.4,
      keepAlive: '0s', // Free RAM immediately after generation!
      stream: false
    });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Streaming AI Chat via SSE
app.post('/api/ai/chat/stream', async (req, res) => {
  const {
    messages = [],
    brainId,
    agentId,
    model = 'qwen2.5:1.5b',
    attachedContext = '',
    targetFile = ''
  } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const brain = brainId ? brainStore.getById(brainId) : brainStore.getAll()[0];
  const agent = agentId ? agentOrchestrator.getById(agentId) : null;

  const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
  const memoryContext = memoryStore.retrieve({ query: `${lastUserMsg} ${targetFile}`, maxTokens: 400 });

  const ruleContext = ruleEngine.resolve({
    activeBrain: brain,
    activeAgent: agent,
    targetFile,
    taskInstruction: attachedContext
  });

  const systemInstructions = [
    ruleContext.resolvedPrompt,
    memoryContext.text,
    attachedContext ? `\n# ATTACHED WORKSPACE CONTEXT / CODE SNIPPET:\n${attachedContext}` : ''
  ].filter(Boolean).join('\n\n');

  const fullMessages = [
    { role: 'system', content: systemInstructions },
    ...messages
  ];

  try {
    await ollama.chat({
      model: model || brain?.preferredModel || 'qwen2.5:1.5b',
      messages: fullMessages,
      temperature: brain?.temperature || 0.4,
      keepAlive: '0s', // Keep alive 0s = free RAM immediately as requested!
      stream: true,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message, done: true })}\n\n`);
    res.end();
  }
});

// 9. Git Service
app.get('/api/git/status', async (req, res) => res.json(await gitService.getStatus()));
app.get('/api/git/diff', async (req, res) => res.json({ diff: await gitService.getDiff(req.query.file) }));
app.post('/api/git/commit', async (req, res) => {
  try {
    await gitService.stage();
    const result = await gitService.commit(req.body.message);
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 10. Terminal & Commands
app.post('/api/terminal/execute', async (req, res) => {
  const { command, requireApproval, approved } = req.body;
  const result = await terminalService.executeCommand({
    command,
    requireApproval,
    approved
  });
  res.json(result);
});
app.get('/api/terminal/history', (req, res) => res.json(terminalService.getHistory()));

// 11. ComfyUI Image Studio & Lifecycle Management
app.get('/api/comfy/status', async (req, res) => {
  try {
    const status = await comfyService.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comfy/prerequisites', async (req, res) => {
  try {
    const prereqs = await comfyService.checkPrerequisites();
    res.json(prereqs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comfy/setup/clone', async (req, res) => {
  try {
    const result = await comfyService.cloneRepository(req.body.targetDir);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comfy/setup/requirements', async (req, res) => {
  try {
    const result = await comfyService.installRequirements();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comfy/start', async (req, res) => {
  try {
    const result = await comfyService.startServer();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comfy/stop', async (req, res) => {
  try {
    const result = await comfyService.stopServer();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comfy/restart', async (req, res) => {
  try {
    const result = await comfyService.restartServer();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comfy/logs', (req, res) => {
  res.json({ logs: comfyService.getLogs(Number(req.query.lines) || 100) });
});

app.get('/api/comfy/models', async (req, res) => {
  try {
    const details = await comfyService.getModelManagerDetails();
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comfy/config', (req, res) => {
  res.json(comfyService.updateConfig(req.body));
});

app.post('/api/comfy/generate', async (req, res) => {
  try {
    const result = await comfyService.generateImage(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comfy/interrupt', async (req, res) => {
  try {
    const result = await comfyService.cancelGeneration();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comfy/history', (req, res) => {
  res.json(comfyService.getHistory());
});

// 12. Mount Versioned Gateway Router (/api/v2) directly on main port too
const v2Router = createV2Router({
  gatewayService,
  ollamaClient: ollama,
  brainStore,
  ruleEngine,
  agentOrchestrator,
  memoryStore,
  fileService
});
app.use('/api/v2', v2Router);

// 13. API Gateway Dashboard & Management Endpoints (Internal IDE Use)
app.get('/api/gateway/status', (req, res) => {
  res.json(gatewayServer.getStatus());
});

app.post('/api/gateway/start', async (req, res) => {
  try {
    const result = await gatewayServer.start();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gateway/stop', async (req, res) => {
  try {
    const result = await gatewayServer.stop();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gateway/restart', async (req, res) => {
  try {
    const result = await gatewayServer.restart();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gateway/config', (req, res) => {
  res.json(gatewayService.getConfig());
});

app.post('/api/gateway/config', async (req, res) => {
  try {
    const updated = gatewayService.updateConfig(req.body);
    // If the server is currently running and host/port/lan changed, restart it
    if (gatewayServer.status === 'running') {
      await gatewayServer.restart();
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/gateway/keys', (req, res) => {
  res.json(gatewayService.getKeys(true));
});

app.post('/api/gateway/keys', (req, res) => {
  try {
    const newKey = gatewayService.createKey(req.body);
    // Returns full secret ONLY this once!
    res.status(201).json(newKey);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/gateway/keys/:id/rotate', (req, res) => {
  try {
    const rotated = gatewayService.rotateKey(req.params.id);
    res.json(rotated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/gateway/keys/:id/revoke', (req, res) => {
  try {
    gatewayService.revokeKey(req.params.id);
    res.json({ success: true, revoked: req.params.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/gateway/keys/:id', (req, res) => {
  try {
    const updated = gatewayService.updateKey(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/gateway/keys/:id', (req, res) => {
  try {
    gatewayService.deleteKey(req.params.id);
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/gateway/logs', (req, res) => {
  const { keyId, endpoint, status, limit } = req.query;
  res.json(gatewayService.getLogs({ keyId, endpoint, status, limit: limit ? parseInt(limit, 10) : 100 }));
});

app.delete('/api/gateway/logs', (req, res) => {
  gatewayService.clearLogs();
  res.json({ success: true });
});

app.get('/api/gateway/stats', (req, res) => {
  res.json(gatewayService.getMetrics());
});

// 14. Autonomous Builder & AI Context Importer Endpoints
app.get('/api/builder/scan', async (req, res) => {
  try {
    const scan = await aiContextImporter.scanAvailableContext();
    res.json(scan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/builder/preview', async (req, res) => {
  try {
    const preview = await aiContextImporter.previewSource(req.body.source);
    res.json(preview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/builder/import', async (req, res) => {
  try {
    const result = await aiContextImporter.importItems({
      selectedSources: req.body.selectedSources || [],
      ruleEngine,
      memoryStore,
      brainStore
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/builder/sessions', async (req, res) => {
  try {
    const { taskPrompt, autonomyLevel } = req.body;
    if (!taskPrompt) return res.status(400).json({ error: 'taskPrompt is required' });
    const session = await autonomousBuilder.createSession({
      taskPrompt,
      autonomyLevel: autonomyLevel || 'autonomous'
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/builder/sessions/:id', (req, res) => {
  const session = autonomousBuilder.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.post('/api/builder/sessions/:id/approve', async (req, res) => {
  try {
    await autonomousBuilder.approveSession(req.params.id);
    const session = autonomousBuilder.getSession(req.params.id);
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Serve static build if in production
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const mainServer = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`WaMaX IDE Backend running on http://0.0.0.0:${PORT}`);
  console.log(`Workspace Root: ${fileService.getWorkspace()}`);

  // Automatically start Gateway server if enabled in config
  if (gatewayService.config.enabled) {
    try {
      await gatewayServer.start();
    } catch (e) {
      console.warn(`[GatewayServer] Could not auto-start on port ${gatewayService.config.port}:`, e.message);
    }
  }
});

// Safe cleanup on shutdown
const shutdown = async () => {
  console.log('\n[WaMaX IDE] Gracefully shutting down services...');
  try {
    await gatewayServer.stop();
  } catch (e) {}
  try {
    await comfyService.stopServer();
  } catch (e) {}
  mainServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

