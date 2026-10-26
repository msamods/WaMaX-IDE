import express from 'express';
import http from 'http';
import cors from 'cors';
import { createV2Router } from '../routes/v2.js';

export class GatewayServer {
  constructor({
    gatewayService,
    ollamaClient,
    brainStore,
    ruleEngine,
    agentOrchestrator,
    memoryStore,
    fileService
  }) {
    this.gatewayService = gatewayService;
    this.ollamaClient = ollamaClient;
    this.brainStore = brainStore;
    this.ruleEngine = ruleEngine;
    this.agentOrchestrator = agentOrchestrator;
    this.memoryStore = memoryStore;
    this.fileService = fileService;

    this.server = null;
    this.app = null;
    this.status = 'stopped'; // 'running', 'stopped', 'error'
    this.lastError = null;
    this.listeningAddress = null;
    this.listeningPort = null;
  }

  createApp() {
    const app = express();
    const config = this.gatewayService.getConfig();

    // CORS configuration
    app.use(
      cors({
        origin: (origin, callback) => {
          // Allow all if configured, or allow requests without origin (cURL, tools)
          if (!origin || config.corsAllowOrigins.includes('*') || config.corsAllowOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Blocked by CORS policy'));
          }
        },
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      })
    );

    // Body limit parsing
    const maxBodyMb = config.maxBodyMb || 2;
    app.use(express.json({ limit: `${maxBodyMb}mb` }));
    app.use(express.urlencoded({ extended: true, limit: `${maxBodyMb}mb` }));

    // Mount /api/v2
    const v2Router = createV2Router({
      gatewayService: this.gatewayService,
      ollamaClient: this.ollamaClient,
      brainStore: this.brainStore,
      ruleEngine: this.ruleEngine,
      agentOrchestrator: this.agentOrchestrator,
      memoryStore: this.memoryStore,
      fileService: this.fileService
    });

    app.use('/api/v2', v2Router);

    // Root info
    app.get('/', (req, res) => {
      res.json({
        service: 'WaMaX IDE API Gateway',
        status: 'online',
        developer: 'MSAMODS x WhatYouWantKerala',
        github: 'https://github.com/msamods',
        version: 'v2',
        docs: '/api/v2/openapi.json'
      });
    });

    // Central 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${req.method} ${req.url} does not exist on WaMaX API Gateway`
        }
      });
    });

    // Central Error Handler (Prevents stack trace leaks)
    app.use((err, req, res, next) => {
      console.error('[GatewayServer Error]', err.message);
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred'
        }
      });
    });

    return app;
  }

  async start() {
    if (this.status === 'running') {
      return { status: 'already_running', port: this.listeningPort, host: this.listeningAddress };
    }

    const config = this.gatewayService.getConfig();
    const port = config.port || 8787;

    // Strict local binding default unless LAN is explicitly enabled
    let host = '127.0.0.1';
    if (config.lanEnabled) {
      host = '0.0.0.0'; // Bind to all interfaces for LAN
    }

    this.app = this.createApp();
    this.server = http.createServer(this.app);

    return new Promise((resolve, reject) => {
      this.server.once('error', (err) => {
        this.status = 'error';
        this.lastError = err.message;
        if (err.code === 'EADDRINUSE') {
          this.lastError = `Port ${port} is already in use by another process. Please change the port in Gateway Settings.`;
        }
        console.error(`[GatewayServer] Failed to bind ${host}:${port} -`, this.lastError);
        reject(new Error(this.lastError));
      });

      this.server.listen(port, host, () => {
        this.status = 'running';
        this.listeningAddress = host;
        this.listeningPort = port;
        this.lastError = null;

        const lanAddrs = this.gatewayService.getNetworkInterfaces();
        const primaryLan = lanAddrs[0]?.address || '127.0.0.1';

        console.log(`[GatewayServer] Listening on http://${host}:${port}/api/v2 (LAN Enabled: ${config.lanEnabled})`);
        resolve({
          status: 'running',
          host,
          port,
          localBaseUrl: `http://127.0.0.1:${port}/api/v2`,
          lanBaseUrl: config.lanEnabled ? `http://${primaryLan}:${port}/api/v2` : null,
          lanEnabled: config.lanEnabled
        });
      });
    });
  }

  async stop() {
    if (!this.server || this.status === 'stopped') {
      this.status = 'stopped';
      return { status: 'stopped' };
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.status = 'stopped';
        this.server = null;
        this.listeningAddress = null;
        this.listeningPort = null;
        console.log('[GatewayServer] Stopped.');
        resolve({ status: 'stopped' });
      });
    });
  }

  async restart() {
    await this.stop();
    return this.start();
  }

  getStatus() {
    const config = this.gatewayService.getConfig();
    const metrics = this.gatewayService.getMetrics();
    const lanAddrs = this.gatewayService.getNetworkInterfaces();
    const primaryLan = lanAddrs[0]?.address || '127.0.0.1';

    return {
      status: this.status,
      port: this.listeningPort || config.port,
      host: this.listeningAddress || config.host,
      localBaseUrl: `http://127.0.0.1:${this.listeningPort || config.port}/api/v2`,
      lanBaseUrl: config.lanEnabled ? `http://${primaryLan}:${this.listeningPort || config.port}/api/v2` : null,
      lanEnabled: config.lanEnabled,
      version: config.version,
      lastError: this.lastError,
      metrics,
      detectedInterfaces: lanAddrs
    };
  }
}
