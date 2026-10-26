import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class GatewayService {
  constructor(dataPath) {
    this.keysFile = path.join(dataPath, 'gateway_keys.json');
    this.logsFile = path.join(dataPath, 'gateway_logs.json');
    this.configFile = path.join(dataPath, 'gateway_config.json');
    this.tasksFile = path.join(dataPath, 'gateway_tasks.json');

    this.ensureFiles();
    this.keys = this.loadJSON(this.keysFile, []);
    this.logs = this.loadJSON(this.logsFile, []);
    this.tasks = new Map();
    this.loadTasks();

    // Default configuration
    this.config = this.loadJSON(this.configFile, {
      host: process.env.WAMAX_API_HOST || '127.0.0.1',
      port: parseInt(process.env.WAMAX_API_PORT || '8787', 10),
      version: process.env.WAMAX_API_VERSION || 'v2',
      enabled: process.env.WAMAX_API_ENABLED !== 'false',
      lanEnabled: process.env.WAMAX_API_LAN_ENABLED === 'true',
      maxBodyMb: parseInt(process.env.WAMAX_API_MAX_BODY_MB || '2', 10),
      rateLimitRpmDefault: 30,
      maxConcurrentInference: 1, // Crucial for 7GB RAM limit
      maxQueueLength: 20,
      corsAllowOrigins: ['*'],
      contentLogging: false // Redact prompt/completion content by default
    });

    // In-memory rate limiting counters & concurrency control
    this.rateLimitBuckets = new Map(); // keyId -> { count, resetAt }
    this.activeInferences = 0;
    this.inferenceQueue = [];

    // Ensure at least one default development key if empty
    if (this.keys.length === 0) {
      this.createKey({
        name: 'Internal Development Tools',
        permissions: ['*'],
        rateLimitRpm: 60,
        description: 'Auto-generated development master key'
      });
    }
  }

  ensureFiles() {
    const dir = path.dirname(this.keysFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadJSON(file, fallback) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (e) {
      console.warn(`[GatewayService] Failed to load ${file}, using fallback:`, e.message);
    }
    return fallback;
  }

  saveJSON(file, data) {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error(`[GatewayService] Failed to save ${file}:`, e.message);
    }
  }

  loadTasks() {
    const saved = this.loadJSON(this.tasksFile, []);
    for (const t of saved) {
      this.tasks.set(t.id, t);
    }
  }

  saveTasks() {
    const arr = Array.from(this.tasks.values()).slice(-100);
    this.saveJSON(this.tasksFile, arr);
  }

  // Detect available LAN interfaces (IPv4 non-internal)
  getNetworkInterfaces() {
    const nets = os.networkInterfaces();
    const results = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          results.push({
            name,
            address: net.address,
            netmask: net.netmask,
            mac: net.mac
          });
        }
      }
    }
    return results;
  }

  // --- API KEY MANAGEMENT ---

  hashSecret(secret) {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  generateRawSecret() {
    // wmx_live_<64-character hex string>
    return 'wmx_live_' + crypto.randomBytes(32).toString('hex');
  }

  createKey({
    name,
    permissions = ['chat:completions', 'models:read'],
    allowedModels = ['*'],
    allowedBrains = ['*'],
    allowedEndpoints = ['*'],
    rateLimitRpm = 30,
    expiresAt = null,
    description = ''
  }) {
    const rawSecret = this.generateRawSecret();
    const hashedSecret = this.hashSecret(rawSecret);
    const keyId = 'key_' + crypto.randomBytes(8).toString('hex');
    const prefix = rawSecret.slice(0, 15) + '...' + rawSecret.slice(-4);

    const keyRecord = {
      id: keyId,
      name: name || 'Unnamed Key',
      hashedSecret,
      prefix,
      permissions: permissions.includes('*') ? ['*'] : permissions,
      allowedModels,
      allowedBrains,
      allowedEndpoints,
      rateLimitRpm: rateLimitRpm || 30,
      expiresAt: expiresAt || null,
      description,
      status: 'active', // active, disabled, revoked
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      requestCount: 0,
      errorCount: 0
    };

    this.keys.push(keyRecord);
    this.saveJSON(this.keysFile, this.keys);

    this.recordAuditEvent({
      event: 'key_created',
      keyId,
      name: keyRecord.name,
      permissions: keyRecord.permissions
    });

    // Return the record including the raw secret ONLY ONCE
    return {
      ...keyRecord,
      rawSecret
    };
  }

  rotateKey(id) {
    const key = this.keys.find((k) => k.id === id);
    if (!key) throw new Error('API Key not found');
    if (key.status === 'revoked') throw new Error('Cannot rotate a revoked key');

    const newSecret = this.generateRawSecret();
    key.hashedSecret = this.hashSecret(newSecret);
    key.prefix = newSecret.slice(0, 15) + '...' + newSecret.slice(-4);
    key.rotatedAt = new Date().toISOString();

    this.saveJSON(this.keysFile, this.keys);
    this.recordAuditEvent({ event: 'key_rotated', keyId: id, name: key.name });

    return {
      ...key,
      rawSecret: newSecret
    };
  }

  revokeKey(id) {
    const key = this.keys.find((k) => k.id === id);
    if (!key) throw new Error('API Key not found');

    key.status = 'revoked';
    key.revokedAt = new Date().toISOString();
    this.saveJSON(this.keysFile, this.keys);

    this.recordAuditEvent({ event: 'key_revoked', keyId: id, name: key.name });
    return true;
  }

  updateKey(id, updates) {
    const key = this.keys.find((k) => k.id === id);
    if (!key) throw new Error('API Key not found');
    if (key.status === 'revoked') throw new Error('Cannot modify a revoked key');

    if (updates.name !== undefined) key.name = updates.name;
    if (updates.permissions !== undefined) key.permissions = updates.permissions;
    if (updates.allowedModels !== undefined) key.allowedModels = updates.allowedModels;
    if (updates.allowedBrains !== undefined) key.allowedBrains = updates.allowedBrains;
    if (updates.allowedEndpoints !== undefined) key.allowedEndpoints = updates.allowedEndpoints;
    if (updates.rateLimitRpm !== undefined) key.rateLimitRpm = updates.rateLimitRpm;
    if (updates.expiresAt !== undefined) key.expiresAt = updates.expiresAt;
    if (updates.status !== undefined && updates.status !== 'revoked') key.status = updates.status;

    this.saveJSON(this.keysFile, this.keys);
    this.recordAuditEvent({ event: 'key_updated', keyId: id, updates });
    return key;
  }

  deleteKey(id) {
    const idx = this.keys.findIndex((k) => k.id === id);
    if (idx === -1) throw new Error('API Key not found');
    const removed = this.keys.splice(idx, 1)[0];
    this.saveJSON(this.keysFile, this.keys);
    this.recordAuditEvent({ event: 'key_deleted', keyId: id, name: removed.name });
    return true;
  }

  getKeys(safe = true) {
    if (!safe) return this.keys;
    return this.keys.map((k) => {
      const { hashedSecret, ...safeKey } = k;
      return safeKey;
    });
  }

  // --- AUTHENTICATION & VALIDATION ---

  verifyApiKey(rawSecret) {
    if (!rawSecret || typeof rawSecret !== 'string') {
      return { valid: false, code: 'MISSING_KEY', message: 'No API key provided' };
    }

    const trimmed = rawSecret.trim().replace(/^Bearer\s+/i, '');
    if (!trimmed.startsWith('wmx_live_')) {
      return { valid: false, code: 'INVALID_FORMAT', message: 'API key must start with wmx_live_' };
    }

    const hashedInput = this.hashSecret(trimmed);
    const inputBuf = Buffer.from(hashedInput, 'utf8');

    for (const key of this.keys) {
      const storedBuf = Buffer.from(key.hashedSecret, 'utf8');
      if (inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf)) {
        if (key.status === 'revoked') {
          return { valid: false, code: 'KEY_REVOKED', message: 'This API key has been revoked' };
        }
        if (key.status === 'disabled') {
          return { valid: false, code: 'KEY_DISABLED', message: 'This API key is temporarily disabled' };
        }
        if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
          return { valid: false, code: 'KEY_EXPIRED', message: 'This API key has expired' };
        }

        // Update usage statistics
        key.lastUsedAt = new Date().toISOString();
        key.requestCount = (key.requestCount || 0) + 1;
        this.saveJSON(this.keysFile, this.keys);

        return { valid: true, key };
      }
    }

    return { valid: false, code: 'INVALID_KEY', message: 'Invalid API key provided' };
  }

  checkPermission(key, requiredPermission) {
    if (!key) return false;
    if (key.permissions.includes('*') || key.permissions.includes('admin')) return true;
    return key.permissions.includes(requiredPermission);
  }

  checkModelAccess(key, modelId) {
    if (!key) return false;
    if (key.allowedModels.includes('*')) return true;
    return key.allowedModels.includes(modelId);
  }

  checkBrainAccess(key, brainId) {
    if (!key) return false;
    if (key.allowedBrains.includes('*')) return true;
    return key.allowedBrains.includes(brainId);
  }

  // --- RATE LIMITING ---

  checkRateLimit(key) {
    const keyId = key.id;
    const limit = key.rateLimitRpm || this.config.rateLimitRpmDefault || 30;
    const now = Date.now();

    let bucket = this.rateLimitBuckets.get(keyId);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + 60000 };
      this.rateLimitBuckets.set(keyId, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, limit - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    if (bucket.count > limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds
      };
    }

    return {
      allowed: true,
      limit,
      remaining,
      resetSeconds
    };
  }

  // 7GB RAM Friendly Concurrency Semaphore
  async acquireInferenceSlot() {
    const maxConcurrent = this.config.maxConcurrentInference || 1;
    if (this.activeInferences < maxConcurrent) {
      this.activeInferences++;
      return () => {
        this.activeInferences = Math.max(0, this.activeInferences - 1);
        this.processNextInferenceQueue();
      };
    }

    // Queue with backpressure check
    const maxQueue = this.config.maxQueueLength || 20;
    if (this.inferenceQueue.length >= maxQueue) {
      const err = new Error('Server queue is full. Maximum concurrent inference requests exceeded.');
      err.code = 'BACKPRESSURE_QUEUE_FULL';
      throw err;
    }

    return new Promise((resolve, reject) => {
      this.inferenceQueue.push({ resolve, reject, queuedAt: Date.now() });
    });
  }

  processNextInferenceQueue() {
    const maxConcurrent = this.config.maxConcurrentInference || 1;
    if (this.activeInferences < maxConcurrent && this.inferenceQueue.length > 0) {
      const next = this.inferenceQueue.shift();
      this.activeInferences++;
      next.resolve(() => {
        this.activeInferences = Math.max(0, this.activeInferences - 1);
        this.processNextInferenceQueue();
      });
    }
  }

  // --- AUDIT LOGGING ---

  logRequest({
    keyId = 'anonymous',
    keyPrefix = 'none',
    endpoint,
    method,
    status,
    durationMs,
    model = null,
    brain = null,
    promptTokens = 0,
    completionTokens = 0,
    errorCode = null,
    errorMessage = null,
    ip = '127.0.0.1'
  }) {
    const entry = {
      id: 'log_' + crypto.randomBytes(6).toString('hex'),
      timestamp: new Date().toISOString(),
      keyId,
      keyPrefix,
      endpoint,
      method,
      status,
      durationMs,
      model,
      brain,
      promptTokens,
      completionTokens,
      totalTokens: (promptTokens || 0) + (completionTokens || 0),
      errorCode,
      errorMessage,
      ip: ip.replace(/^.*:/, '') // Clean IPv6 localhost ::ffff:127.0.0.1
    };

    this.logs.unshift(entry);
    if (this.logs.length > 500) {
      this.logs.length = 500;
    }
    this.saveJSON(this.logsFile, this.logs);
  }

  recordAuditEvent(event) {
    const entry = {
      id: 'audit_' + crypto.randomBytes(6).toString('hex'),
      timestamp: new Date().toISOString(),
      ...event
    };
    // Logs audit events to console and file
    console.log(`[Gateway Audit]`, JSON.stringify(entry));
  }

  getLogs({ keyId, endpoint, status, limit = 100 } = {}) {
    let filtered = this.logs;
    if (keyId) filtered = filtered.filter((l) => l.keyId === keyId);
    if (endpoint) filtered = filtered.filter((l) => l.endpoint.includes(endpoint));
    if (status) filtered = filtered.filter((l) => l.status === parseInt(status, 10));
    return filtered.slice(0, limit);
  }

  clearLogs() {
    this.logs = [];
    this.saveJSON(this.logsFile, this.logs);
    return true;
  }

  getMetrics() {
    const totalRequests = this.logs.length;
    const successRequests = this.logs.filter((l) => l.status >= 200 && l.status < 400).length;
    const failedRequests = this.logs.filter((l) => l.status >= 400).length;
    const rateLimitedRequests = this.logs.filter((l) => l.status === 429).length;

    const durations = this.logs.map((l) => l.durationMs).filter((d) => typeof d === 'number');
    const avgDuration = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const activeKeysCount = this.keys.filter((k) => k.status === 'active').length;

    return {
      totalRequests,
      successRequests,
      failedRequests,
      rateLimitedRequests,
      avgDurationMs: avgDuration,
      activeKeysCount,
      totalKeysCount: this.keys.length,
      activeInferences: this.activeInferences,
      queuedInferences: this.inferenceQueue.length
    };
  }

  // --- CONFIGURATION ---

  getConfig() {
    const lans = this.getNetworkInterfaces();
    return {
      ...this.config,
      detectedInterfaces: lans,
      primaryLanAddress: lans[0]?.address || '127.0.0.1'
    };
  }

  updateConfig(updates) {
    if (updates.port !== undefined) {
      const p = parseInt(updates.port, 10);
      if (isNaN(p) || p < 1024 || p > 65535) {
        throw new Error('Port must be between 1024 and 65535');
      }
      this.config.port = p;
    }
    if (updates.host !== undefined) this.config.host = updates.host;
    if (updates.lanEnabled !== undefined) this.config.lanEnabled = !!updates.lanEnabled;
    if (updates.enabled !== undefined) this.config.enabled = !!updates.enabled;
    if (updates.maxBodyMb !== undefined) this.config.maxBodyMb = updates.maxBodyMb;
    if (updates.rateLimitRpmDefault !== undefined) this.config.rateLimitRpmDefault = updates.rateLimitRpmDefault;
    if (updates.maxConcurrentInference !== undefined) this.config.maxConcurrentInference = updates.maxConcurrentInference;
    if (updates.contentLogging !== undefined) this.config.contentLogging = !!updates.contentLogging;

    this.saveJSON(this.configFile, this.config);
    return this.getConfig();
  }

  // --- ASYNC TASK MANAGEMENT (Agents & Images) ---

  createTask({ type, agentId = null, input, keyId }) {
    const taskId = 'task_' + crypto.randomBytes(8).toString('hex');
    const task = {
      id: taskId,
      type,
      agentId,
      input,
      keyId,
      status: 'queued', // queued, running, waiting_for_approval, completed, failed, cancelled
      progress: 0,
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.tasks.set(taskId, task);
    this.saveTasks();
    return task;
  }

  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    this.saveTasks();
    return task;
  }

  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      throw new Error(`Cannot cancel task with status: ${task.status}`);
    }
    task.status = 'cancelled';
    task.updatedAt = new Date().toISOString();
    this.saveTasks();
    return task;
  }
}
