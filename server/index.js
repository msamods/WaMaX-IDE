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

// 11. ComfyUI Image Studio (Optional)
app.get('/api/comfy/status', async (req, res) => {
  try {
    const r = await fetch('http://127.0.0.1:8188/system_stats', { signal: AbortSignal.timeout(2000) });
    res.json({ available: r.ok });
  } catch {
    res.json({ available: false, hint: 'ComfyUI is optional. To enable, launch ComfyUI on http://127.0.0.1:8188.' });
  }
});

// Serve static build if in production
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WaMaX IDE Backend running on http://0.0.0.0:${PORT}`);
  console.log(`Workspace Root: ${fileService.getWorkspace()}`);
});
