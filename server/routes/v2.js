import express from 'express';
import crypto from 'crypto';

export function createV2Router({
  gatewayService,
  ollamaClient,
  brainStore,
  ruleEngine,
  agentOrchestrator,
  memoryStore,
  fileService
}) {
  const router = express.Router();

  // Unified Error Responder
  const sendError = (res, status, code, message, req = null, startTime = null) => {
    if (req && startTime && gatewayService) {
      gatewayService.logRequest({
        keyId: req.apiKey?.id || 'anonymous',
        keyPrefix: req.apiKey?.prefix || 'none',
        endpoint: req.originalUrl || req.url,
        method: req.method,
        status,
        durationMs: Date.now() - startTime,
        errorCode: code,
        errorMessage: message,
        ip: req.ip
      });
    }
    return res.status(status).json({
      error: {
        code,
        message
      }
    });
  };

  // --- CENTRALIZED AUTHENTICATION & RATE LIMITING MIDDLEWARE ---

  const requireAuth = (permission = null) => {
    return (req, res, next) => {
      const startTime = req._startTime || Date.now();
      req._startTime = startTime;

      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Missing Authorization header. Use Bearer wmx_live_...', req, startTime);
      }

      const verification = gatewayService.verifyApiKey(authHeader);
      if (!verification.valid) {
        return sendError(res, 401, verification.code, verification.message, req, startTime);
      }

      const key = verification.key;
      req.apiKey = key;

      // Check permission if specified
      if (permission && !gatewayService.checkPermission(key, permission)) {
        return sendError(res, 403, 'PERMISSION_DENIED', `Key '${key.name}' lacks required permission: '${permission}'`, req, startTime);
      }

      // Check Rate Limit
      const rateLimit = gatewayService.checkRateLimit(key);
      res.setHeader('X-RateLimit-Limit', rateLimit.limit);
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
      res.setHeader('X-RateLimit-Reset', rateLimit.resetSeconds);

      if (!rateLimit.allowed) {
        res.setHeader('Retry-After', rateLimit.resetSeconds);
        return sendError(res, 429, 'RATE_LIMIT_EXCEEDED', `Rate limit of ${rateLimit.limit} req/min exceeded. Retry after ${rateLimit.resetSeconds}s.`, req, startTime);
      }

      next();
    };
  };

  // --- 1. HEALTH & READINESS ---

  // Public Health Check (Does not expose internal paths or credentials)
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'WaMaX IDE API',
      version: 'v2'
    });
  });

  // Authenticated Readiness Check
  router.get('/ready', requireAuth(), async (req, res) => {
    const isOllamaUp = await ollamaClient.isHealthy();
    const sys = ollamaClient.getSystemMetrics();

    res.json({
      status: isOllamaUp ? 'ready' : 'degraded',
      service: 'WaMaX IDE API',
      version: 'v2',
      inference_ready: isOllamaUp,
      active_connections: gatewayService.activeInferences,
      system: {
        memory_usage_percent: sys.percentUsed,
        safe_mode: sys.percentUsed > 85 ? 'throttled' : 'normal'
      }
    });
  });

  // --- 2. MODELS DISCOVERY API ---

  router.get('/models', requireAuth('models:read'), async (req, res) => {
    const startTime = Date.now();
    try {
      const rawModels = await ollamaClient.listModels();
      const isOllamaUp = await ollamaClient.isHealthy();

      const modelsList = [];

      // Always expose 'local-default' alias mapped to real local model
      modelsList.push({
        id: 'local-default',
        object: 'model',
        owned_by: 'local-wimax',
        ready: isOllamaUp,
        description: 'Default zero-RAM local model (mapped to qwen2.5:1.5b)'
      });

      for (const m of rawModels) {
        // Filter based on key allowedModels restrictions
        if (gatewayService.checkModelAccess(req.apiKey, m.name)) {
          modelsList.push({
            id: m.name,
            object: 'model',
            size_bytes: m.size,
            modified_at: m.modified_at,
            owned_by: 'local-ollama',
            ready: isOllamaUp
          });
        }
      }

      gatewayService.logRequest({
        keyId: req.apiKey.id,
        keyPrefix: req.apiKey.prefix,
        endpoint: '/api/v2/models',
        method: 'GET',
        status: 200,
        durationMs: Date.now() - startTime,
        ip: req.ip
      });

      res.json({
        object: 'list',
        data: modelsList
      });
    } catch (err) {
      sendError(res, 500, 'MODEL_DISCOVERY_ERROR', err.message, req, startTime);
    }
  });

  // --- 3. CHAT COMPLETIONS API (OpenAI Compatible) ---

  router.post('/chat/completions', requireAuth('chat:completions'), async (req, res) => {
    const startTime = Date.now();
    let {
      model = 'local-default',
      messages,
      stream = false,
      temperature = 0.7,
      max_tokens,
      brain_id,
      project_context = false
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return sendError(res, 400, 'INVALID_PAYLOAD', 'Body must include messages array with at least one item.', req, startTime);
    }

    // Resolve model alias
    let resolvedModel = model;
    if (model === 'local-default' || !model) {
      resolvedModel = 'qwen2.5:1.5b';
    }

    // Check key model permissions
    if (!gatewayService.checkModelAccess(req.apiKey, resolvedModel) && !gatewayService.checkModelAccess(req.apiKey, model)) {
      return sendError(res, 403, 'MODEL_ACCESS_DENIED', `Key '${req.apiKey.name}' is not authorized to use model '${model}'`, req, startTime);
    }

    // Check Brain permissions and assemble instructions
    let brainInstructions = '';
    let selectedBrain = null;
    if (brain_id) {
      if (!gatewayService.checkBrainAccess(req.apiKey, brain_id)) {
        return sendError(res, 403, 'BRAIN_ACCESS_DENIED', `Key '${req.apiKey.name}' is not authorized to access brain '${brain_id}'`, req, startTime);
      }
      selectedBrain = brainStore.getById(brain_id);
      if (selectedBrain) {
        brainInstructions = selectedBrain.instructions;
      }
    }

    // Resolve Mandatory Inviolable Rules
    let rulesPrompt = '';
    try {
      const resolution = ruleEngine.resolve({
        activeBrain: selectedBrain,
        taskInstruction: messages[messages.length - 1]?.content || ''
      });
      rulesPrompt = resolution.resolvedPrompt || '';
    } catch (e) {
      console.warn('Rule resolution error:', e.message);
    }

    // Optional Project Memory Retrieval
    let memoryContext = '';
    if (project_context) {
      const lastUserQuery = messages.filter((m) => m.role === 'user').pop()?.content || '';
      const memories = memoryStore.search(lastUserQuery, 3);
      if (memories.length > 0) {
        memoryContext = '\n\n[RELEVANT PROJECT MEMORY]:\n' + memories.map((m) => `- (${m.category}) ${m.content}`).join('\n');
      }
    }

    // Assemble messages array with rules and brain at root
    const fullSystemContent = [
      rulesPrompt,
      brainInstructions ? `[ACTIVE BRAIN: ${selectedBrain?.name || brain_id}]\n${brainInstructions}` : '',
      memoryContext
    ].filter(Boolean).join('\n\n');

    const processedMessages = [];
    if (fullSystemContent.trim()) {
      processedMessages.push({ role: 'system', content: fullSystemContent });
    }

    for (const m of messages) {
      // Disallow user from overriding system constraints via fake system role
      if (m.role === 'system' && !req.apiKey.permissions.includes('admin')) {
        processedMessages.push({ role: 'user', content: `[User System Guidance]: ${m.content}` });
      } else {
        processedMessages.push({ role: m.role || 'user', content: m.content || '' });
      }
    }

    // Acquire Inference Slot (Zero-RAM waste concurrency throttle)
    let releaseSlot;
    try {
      releaseSlot = await gatewayService.acquireInferenceSlot();
    } catch (e) {
      return sendError(res, 503, e.code || 'INFERENCE_BUSY', e.message, req, startTime);
    }

    // Handle Client Disconnect Abort
    let clientDisconnected = false;
    const reqAbortController = new AbortController();
    req.on('close', () => {
      clientDisconnected = true;
      reqAbortController.abort();
      if (releaseSlot) {
        releaseSlot();
        releaseSlot = null;
      }
    });

    const completionId = 'chatcmpl-' + crypto.randomBytes(12).toString('hex');
    const createdTimestamp = Math.floor(Date.now() / 1000);

    // STREAMING SSE RESPONSE
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      let promptTokensEstimate = Math.ceil(JSON.stringify(processedMessages).length / 4);
      let completionTokensEstimate = 0;

      try {
        await ollamaClient.chat({
          model: resolvedModel,
          messages: processedMessages,
          temperature,
          stream: true,
          keepAlive: '0s',
          onChunk: (chunkObj) => {
            if (clientDisconnected) return;
            const textChunk = typeof chunkObj === 'string' ? chunkObj : (chunkObj?.content || '');
            if (!textChunk) return;
            completionTokensEstimate++;

            const chunkData = {
              id: completionId,
              object: 'chat.completion.chunk',
              created: createdTimestamp,
              model: resolvedModel,
              choices: [
                {
                  index: 0,
                  delta: { content: textChunk },
                  finish_reason: null
                }
              ]
            };
            res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
          }
        });

        if (!clientDisconnected) {
          // Final terminating chunk
          const finalChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: createdTimestamp,
            model: resolvedModel,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop'
              }
            ]
          };
          res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();

          gatewayService.logRequest({
            keyId: req.apiKey.id,
            keyPrefix: req.apiKey.prefix,
            endpoint: '/api/v2/chat/completions',
            method: 'POST',
            status: 200,
            durationMs: Date.now() - startTime,
            model: resolvedModel,
            brain: brain_id || null,
            promptTokens: promptTokensEstimate,
            completionTokens: completionTokensEstimate,
            ip: req.ip
          });
        }
      } catch (err) {
        if (!clientDisconnected) {
          res.write(`data: ${JSON.stringify({ error: { code: 'INFERENCE_ERROR', message: err.message } })}\n\n`);
          res.end();
        }
        gatewayService.logRequest({
          keyId: req.apiKey.id,
          keyPrefix: req.apiKey.prefix,
          endpoint: '/api/v2/chat/completions',
          method: 'POST',
          status: 500,
          durationMs: Date.now() - startTime,
          model: resolvedModel,
          errorCode: 'INFERENCE_ERROR',
          errorMessage: err.message,
          ip: req.ip
        });
      } finally {
        if (releaseSlot) releaseSlot();
      }
      return;
    }

    // NON-STREAMING JSON RESPONSE
    try {
      const response = await ollamaClient.chat({
        model: resolvedModel,
        messages: processedMessages,
        temperature,
        keep_alive: '0s'
      });

      const promptTokens = response.prompt_eval_count || Math.ceil(JSON.stringify(processedMessages).length / 4);
      const completionTokens = response.eval_count || Math.ceil((response.message?.content || '').length / 4);

      const openaiResponse = {
        id: completionId,
        object: 'chat.completion',
        created: createdTimestamp,
        model: resolvedModel,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: response.message?.content || ''
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens
        }
      };

      gatewayService.logRequest({
        keyId: req.apiKey.id,
        keyPrefix: req.apiKey.prefix,
        endpoint: '/api/v2/chat/completions',
        method: 'POST',
        status: 200,
        durationMs: Date.now() - startTime,
        model: resolvedModel,
        brain: brain_id || null,
        promptTokens,
        completionTokens,
        ip: req.ip
      });

      res.json(openaiResponse);
    } catch (err) {
      sendError(res, 500, 'INFERENCE_FAILED', err.message, req, startTime);
    } finally {
      if (releaseSlot) releaseSlot();
    }
  });

  // --- 4. BRAINS API ---

  router.get('/brains', requireAuth('brains:read'), (req, res) => {
    const brains = brainStore.getAll().filter((b) => gatewayService.checkBrainAccess(req.apiKey, b.id));
    res.json({ object: 'list', data: brains });
  });

  router.get('/brains/:brainId', requireAuth('brains:read'), (req, res) => {
    if (!gatewayService.checkBrainAccess(req.apiKey, req.params.brainId)) {
      return sendError(res, 403, 'BRAIN_ACCESS_DENIED', `Key '${req.apiKey.name}' not authorized for brain '${req.params.brainId}'`);
    }
    const brain = brainStore.getById(req.params.brainId);
    if (!brain) return sendError(res, 404, 'NOT_FOUND', 'Brain not found');
    res.json(brain);
  });

  router.post('/brains/:brainId/chat', requireAuth('brains:chat'), async (req, res) => {
    // Convenience endpoint for brain-specific chat
    req.body.brain_id = req.params.brainId;
    return router.handle({ ...req, url: '/chat/completions' }, res);
  });

  // Administrative Brain modification
  router.post('/brains', requireAuth('brains:write'), (req, res) => {
    const newBrain = brainStore.add(req.body);
    res.status(201).json(newBrain);
  });

  router.patch('/brains/:brainId', requireAuth('brains:write'), (req, res) => {
    const updated = brainStore.update(req.params.brainId, req.body);
    if (!updated) return sendError(res, 404, 'NOT_FOUND', 'Brain not found');
    res.json(updated);
  });

  router.delete('/brains/:brainId', requireAuth('brains:write'), (req, res) => {
    const ok = brainStore.delete(req.params.brainId);
    if (!ok) return sendError(res, 404, 'NOT_FOUND', 'Brain not found or cannot delete default brain');
    res.json({ success: true, deleted: req.params.brainId });
  });

  // --- 5. RULES API ---

  router.get('/rules', requireAuth('rules:read'), (req, res) => {
    const rules = ruleEngine.getAll();
    res.json({ object: 'list', data: rules });
  });

  router.get('/brains/:brainId/rules', requireAuth('rules:read'), (req, res) => {
    const brain = brainStore.getById(req.params.brainId);
    if (!brain) return sendError(res, 404, 'NOT_FOUND', 'Brain not found');
    const resolved = ruleEngine.resolve({ activeBrain: brain });
    res.json({ object: 'list', data: resolved.appliedRules });
  });

  // --- 6. AGENT API ---

  router.get('/agents', requireAuth('agents:read'), (req, res) => {
    const agents = agentOrchestrator.getAll();
    res.json({ object: 'list', data: agents });
  });

  router.post('/agents/:agentId/tasks', requireAuth('agents:run'), async (req, res) => {
    const { agentId } = req.params;
    const { taskInstruction, targetFile, context = {} } = req.body;

    const agent = agentOrchestrator.getById(agentId);
    if (!agent) return sendError(res, 404, 'AGENT_NOT_FOUND', `Agent '${agentId}' not found`);

    if (!taskInstruction || typeof taskInstruction !== 'string') {
      return sendError(res, 400, 'INVALID_PAYLOAD', 'taskInstruction string is required');
    }

    // Task Security Check: Verify permissions & path boundaries
    const safeTargetFile = targetFile ? fileService.safePath(targetFile) : null;

    // Check approval requirements: if agent requires approval, task enters waiting_for_approval
    const requiresApproval = agent.approvalLevel === 'always' || agent.tools?.includes('terminal');

    const task = gatewayService.createTask({
      type: 'agent_execution',
      agentId,
      input: {
        taskInstruction,
        targetFile: safeTargetFile ? path.relative(fileService.getWorkspace(), safeTargetFile) : null,
        context
      },
      keyId: req.apiKey.id
    });

    if (requiresApproval) {
      gatewayService.updateTask(task.id, {
        status: 'waiting_for_approval',
        approvalReason: `Agent '${agent.name}' requires human approval for execution`
      });
      return res.status(202).json({
        task_id: task.id,
        status: 'waiting_for_approval',
        message: 'Task submitted and requires manual approval in WaMaX IDE'
      });
    }

    // Execute asynchronously
    gatewayService.updateTask(task.id, { status: 'running' });
    setTimeout(async () => {
      try {
        const result = await agentOrchestrator.executeTask({
          agentId,
          taskInstruction,
          targetFile: safeTargetFile,
          ollamaClient
        });
        gatewayService.updateTask(task.id, {
          status: 'completed',
          progress: 100,
          result
        });
      } catch (err) {
        gatewayService.updateTask(task.id, {
          status: 'failed',
          error: err.message
        });
      }
    }, 10);

    res.status(202).json({
      task_id: task.id,
      status: 'running',
      message: 'Task accepted for execution'
    });
  });

  router.get('/tasks/:taskId', requireAuth(), (req, res) => {
    const task = gatewayService.getTask(req.params.taskId);
    if (!task) return sendError(res, 404, 'TASK_NOT_FOUND', 'Task not found');
    res.json(task);
  });

  router.post('/tasks/:taskId/cancel', requireAuth(), (req, res) => {
    try {
      const task = gatewayService.cancelTask(req.params.taskId);
      res.json({ success: true, task });
    } catch (err) {
      sendError(res, 400, 'TASK_CANCEL_FAILED', err.message);
    }
  });

  // --- 7. MEMORY API ---

  router.get('/memory/search', requireAuth('memory:read'), (req, res) => {
    const { query = '', limit = 10, category } = req.query;
    let results = memoryStore.search(query, parseInt(limit, 10));
    if (category) {
      results = results.filter((m) => m.category === category);
    }
    res.json({ object: 'list', data: results });
  });

  router.post('/memory', requireAuth('memory:write'), (req, res) => {
    const { content, category = 'project', tags = [] } = req.body;
    if (!content || typeof content !== 'string') {
      return sendError(res, 400, 'INVALID_PAYLOAD', 'content string is required');
    }

    // Ordinary chat keys cannot write to global without admin or explicit memory:write
    const mem = memoryStore.add({
      content: content.trim(),
      category,
      tags: Array.isArray(tags) ? tags : []
    });
    res.status(201).json(mem);
  });

  router.get('/memory/:memoryId', requireAuth('memory:read'), (req, res) => {
    const mem = memoryStore.getAll().find((m) => m.id === req.params.memoryId);
    if (!mem) return sendError(res, 404, 'NOT_FOUND', 'Memory item not found');
    res.json(mem);
  });

  router.delete('/memory/:memoryId', requireAuth('memory:write'), (req, res) => {
    const ok = memoryStore.delete(req.params.memoryId);
    if (!ok) return sendError(res, 404, 'NOT_FOUND', 'Memory item not found');
    res.json({ success: true, deleted: req.params.memoryId });
  });

  // --- 8. IMAGE GENERATION API ---

  router.get('/images/capabilities', requireAuth('images:generate'), async (req, res) => {
    // Probe local ComfyUI or SD provider
    const comfyHost = process.env.COMFYUI_HOST || 'http://127.0.0.1:8188';
    let available = false;
    try {
      const resp = await fetch(`${comfyHost}/system_stats`, { signal: AbortSignal.timeout(1000) });
      available = resp.ok;
    } catch {
      available = false;
    }

    res.json({
      provider: 'ComfyUI (Local)',
      available,
      status: available ? 'online' : 'offline',
      supported_resolutions: ['512x512', '768x768', '1024x1024'],
      formats: ['png', 'webp']
    });
  });

  router.post('/images/generations', requireAuth('images:generate'), async (req, res) => {
    const { prompt, size = '512x512' } = req.body;
    if (!prompt) return sendError(res, 400, 'INVALID_PAYLOAD', 'prompt string is required');

    // Check if provider is available
    const comfyHost = process.env.COMFYUI_HOST || 'http://127.0.0.1:8188';
    let available = false;
    try {
      const resp = await fetch(`${comfyHost}/system_stats`, { signal: AbortSignal.timeout(1000) });
      available = resp.ok;
    } catch {
      available = false;
    }

    if (!available) {
      return sendError(res, 503, 'IMAGE_PROVIDER_UNAVAILABLE', 'Local image generation provider (ComfyUI) is currently offline.');
    }

    const task = gatewayService.createTask({
      type: 'image_generation',
      input: { prompt, size },
      keyId: req.apiKey.id
    });

    res.status(202).json({
      task_id: task.id,
      status: 'queued',
      message: 'Image generation task queued'
    });
  });

  // --- 9. OPENAPI 3.0 SPECIFICATION ---

  router.get('/openapi.json', (req, res) => {
    const config = gatewayService.getConfig();
    const port = config.port || 8787;
    const host = config.host || '127.0.0.1';

    const spec = {
      openapi: '3.0.3',
      info: {
        title: 'WaMaX IDE Developer API & Gateway',
        version: 'v2',
        description: 'WaMax | Developed By MSAMODS x WhatYouWantKerala [Link github.com/msamods]\n\nLocal-first, privacy-respecting, zero-cost developer API allowing authorized external applications to access WaMaX IDE capabilities.',
        contact: {
          name: 'MSAMODS',
          url: 'https://github.com/msamods'
        }
      },
      servers: [
        {
          url: `http://${host}:${port}/api/v2`,
          description: 'Configured API Gateway Endpoint'
        },
        {
          url: `http://127.0.0.1:${port}/api/v2`,
          description: 'Localhost Gateway Endpoint'
        }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'wmx_live_...'
          }
        }
      },
      security: [{ BearerAuth: [] }],
      paths: {
        '/health': {
          get: {
            summary: 'Public Health Check',
            responses: { 200: { description: 'API Server is healthy' } }
          }
        },
        '/ready': {
          get: {
            summary: 'Authenticated Readiness Check',
            responses: { 200: { description: 'Reports AI runtime readiness' } }
          }
        },
        '/models': {
          get: {
            summary: 'Discover Authorized Models',
            responses: { 200: { description: 'List of authorized models' } }
          }
        },
        '/chat/completions': {
          post: {
            summary: 'OpenAI-Compatible Chat Completions',
            description: 'Streams or generates completions using local models with zero RAM waste.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['messages'],
                    properties: {
                      model: { type: 'string', default: 'local-default' },
                      messages: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            role: { type: 'string' },
                            content: { type: 'string' }
                          }
                        }
                      },
                      stream: { type: 'boolean', default: false },
                      temperature: { type: 'number', default: 0.7 }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: 'OpenAI-compatible chat completion' },
              401: { description: 'Unauthorized' },
              429: { description: 'Rate limit exceeded' }
            }
          }
        },
        '/brains': {
          get: { summary: 'List Authorized AI Brains' }
        },
        '/brains/{brainId}/chat': {
          post: { summary: 'Send Chat to Specific Brain' }
        },
        '/rules': {
          get: { summary: 'List Active Rules' }
        },
        '/agents': {
          get: { summary: 'List Autonomous Agents' }
        },
        '/agents/{agentId}/tasks': {
          post: { summary: 'Submit Task to Agent' }
        },
        '/tasks/{taskId}': {
          get: { summary: 'Get Task Status' }
        },
        '/memory/search': {
          get: { summary: 'Search Project Memories' }
        },
        '/images/capabilities': {
          get: { summary: 'Check Local Image Generation Capabilities' }
        }
      }
    };

    res.json(spec);
  });

  return router;
}
