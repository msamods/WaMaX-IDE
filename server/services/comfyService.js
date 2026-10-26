// ComfyUI Service for WaMaX IDE
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const CURATED_MODELS = [
  {
    id: 'sd-v1-5-pruned',
    name: 'v1-5-pruned-emaonly.safetensors',
    family: 'Stable Diffusion 1.5',
    sizeBytes: 4265380512,
    sizeFormatted: '3.97 GB',
    license: 'CreativeML Open RAIL-M',
    description: 'The standard SD 1.5 base model. Highly compatible with existing LoRAs and fast on 4GB-8GB GPUs.',
    url: 'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors',
    filename: 'v1-5-pruned-emaonly.safetensors'
  },
  {
    id: 'dreamshaper-8',
    name: 'dreamshaper_8.safetensors',
    family: 'Stable Diffusion 1.5',
    sizeBytes: 2133860352,
    sizeFormatted: '1.99 GB',
    license: 'CreativeML Open RAIL-M (Civitai)',
    description: 'Lightweight, high quality general purpose model with great photorealism and anime/illustration styling.',
    url: 'https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8_pruned.safetensors',
    filename: 'dreamshaper_8.safetensors'
  },
  {
    id: 'sdxl-turbo',
    name: 'sd_xl_turbo_1.0_fp16.safetensors',
    family: 'SDXL Turbo (1-Step)',
    sizeBytes: 6938000000,
    sizeFormatted: '6.46 GB',
    license: 'Stability AI Community License',
    description: 'Fast single-step SDXL real-time image synthesizer. Requires 8GB+ VRAM.',
    url: 'https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors',
    filename: 'sd_xl_turbo_1.0_fp16.safetensors'
  }
];

export class ComfyService {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.dataPath = options.dataPath || path.join(this.workspaceRoot, 'server', 'data');
    this.configFile = path.join(this.dataPath, 'comfy_config.json');
    this.historyFile = path.join(this.dataPath, 'comfy_history.json');

    this.logs = [];
    this.maxLogs = 500;
    this.comfyProcess = null;
    this.managedPid = null;
    this.activeDownload = null;
    this.activePromptId = null;

    this.config = this.loadConfig();
    this.history = this.loadHistory();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        return JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
      }
    } catch (e) {
      console.warn('[ComfyService] Error loading comfy_config.json:', e.message);
    }

    // Default configuration
    return {
      serverUrl: 'http://127.0.0.1:8188',
      installDir: path.join(this.workspaceRoot, 'comfyui'),
      pythonPath: 'python',
      autoStart: false,
      host: '127.0.0.1',
      port: 8188
    };
  }

  saveConfig() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (e) {
      console.error('[ComfyService] Failed to save config:', e);
    }
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf-8'));
      }
    } catch (e) {
      console.warn('[ComfyService] Error loading history:', e.message);
    }
    return [];
  }

  saveHistory() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history.slice(-100), null, 2), 'utf-8');
    } catch (e) {
      console.error('[ComfyService] Failed to save history:', e);
    }
  }

  appendLog(line) {
    const entry = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  getLogs(count = 100) {
    return this.logs.slice(-count);
  }

  // 1. Check prerequisites (Python, Git, OS)
  async checkPrerequisites() {
    let pythonAvailable = false;
    let pythonVersion = '';
    let gitAvailable = false;
    let gitVersion = '';

    try {
      const { stdout } = await execAsync('python --version');
      pythonAvailable = true;
      pythonVersion = stdout.trim();
    } catch (e) {
      pythonAvailable = false;
    }

    try {
      const { stdout } = await execAsync('git --version');
      gitAvailable = true;
      gitVersion = stdout.trim();
    } catch (e) {
      gitAvailable = false;
    }

    return {
      os: {
        platform: process.platform,
        type: os.type(),
        release: os.release(),
        totalMemoryGB: (os.totalmem() / (1024 ** 3)).toFixed(1),
        freeMemoryGB: (os.freemem() / (1024 ** 3)).toFixed(1)
      },
      python: {
        available: pythonAvailable,
        version: pythonVersion
      },
      git: {
        available: gitAvailable,
        version: gitVersion
      }
    };
  }

  // 2. Detection & Status
  async getStatus() {
    const prereqs = await this.checkPrerequisites();

    // Check if ComfyUI files exist on disk
    const mainPyPath = path.join(this.config.installDir, 'main.py');
    const isInstalled = fs.existsSync(mainPyPath);

    // Check if server is reachable
    let serverOnline = false;
    let serverStats = null;
    let models = [];

    try {
      const statsRes = await fetch(`${this.config.serverUrl}/system_stats`, {
        signal: AbortSignal.timeout(1500)
      });
      if (statsRes.ok) {
        serverOnline = true;
        serverStats = await statsRes.json();
      }
    } catch {
      serverOnline = false;
    }

    // If server is online, query available checkpoints from ComfyUI API
    if (serverOnline) {
      try {
        const objRes = await fetch(`${this.config.serverUrl}/object_info/CheckpointLoaderSimple`, {
          signal: AbortSignal.timeout(2000)
        });
        if (objRes.ok) {
          const objData = await objRes.json();
          models = objData?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
        }
      } catch (err) {
        console.warn('[ComfyService] Error querying object_info:', err.message);
      }
    } else if (isInstalled) {
      // Check local models/checkpoints folder
      models = this.getLocalCheckpoints();
    }

    // Determine categorized status
    let status = 'not_installed';
    let statusDescription = 'ComfyUI is not installed. Setup is required for local visual asset generation.';

    if (serverOnline) {
      if (models.length > 0) {
        status = 'ready';
        statusDescription = `ComfyUI online and ready with ${models.length} checkpoint model(s).`;
      } else {
        status = 'server_ready_no_model';
        statusDescription = 'ComfyUI server is reachable, but no checkpoint model is loaded.';
      }
    } else if (isInstalled) {
      status = 'installed_stopped';
      statusDescription = `ComfyUI is installed at ${this.config.installDir}, but the server is stopped.`;
    }

    return {
      status,
      statusDescription,
      isInstalled,
      serverOnline,
      serverUrl: this.config.serverUrl,
      installDir: this.config.installDir,
      managedProcessRunning: !!this.comfyProcess && !this.comfyProcess.killed,
      managedPid: this.managedPid,
      models,
      prerequisites: prereqs,
      systemStats: serverStats,
      activePromptId: this.activePromptId,
      curatedModels: CURATED_MODELS
    };
  }

  getLocalCheckpoints() {
    const ckptDir = path.join(this.config.installDir, 'models', 'checkpoints');
    if (!fs.existsSync(ckptDir)) return [];
    try {
      return fs.readdirSync(ckptDir).filter(f => f.endsWith('.safetensors') || f.endsWith('.ckpt'));
    } catch {
      return [];
    }
  }

  // 3. Setup Wizard: Clone Repository
  async cloneRepository(customTargetDir) {
    const targetDir = customTargetDir || this.config.installDir;

    // Safety checks: Never overwrite existing installation
    if (fs.existsSync(path.join(targetDir, 'main.py'))) {
      throw new Error(`Directory '${targetDir}' already contains a ComfyUI installation. Overwriting is blocked.`);
    }

    // Ensure parent dir exists
    const parentDir = path.dirname(targetDir);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    this.appendLog(`Cloning official ComfyUI repo into ${targetDir}...`);

    return new Promise((resolve, reject) => {
      const gitProc = spawn('git', ['clone', '--depth', '1', 'https://github.com/Comfy-Org/ComfyUI', targetDir], {
        windowsHide: true
      });

      gitProc.stdout?.on('data', data => this.appendLog(`[Git] ${data.toString().trim()}`));
      gitProc.stderr?.on('data', data => this.appendLog(`[Git] ${data.toString().trim()}`));

      gitProc.on('close', code => {
        if (code === 0) {
          this.config.installDir = targetDir;
          this.saveConfig();
          this.appendLog(`ComfyUI cloned successfully to ${targetDir}`);
          resolve({ success: true, installDir: targetDir });
        } else {
          this.appendLog(`Git clone failed with exit code ${code}`);
          reject(new Error(`Git clone failed with code ${code}`));
        }
      });

      gitProc.on('error', err => {
        this.appendLog(`Git clone process error: ${err.message}`);
        reject(err);
      });
    });
  }

  // 4. Install Requirements
  async installRequirements() {
    if (!fs.existsSync(path.join(this.config.installDir, 'requirements.txt'))) {
      throw new Error(`requirements.txt not found in ${this.config.installDir}`);
    }

    this.appendLog('Installing ComfyUI Python dependencies via pip...');

    return new Promise((resolve, reject) => {
      const pipProc = spawn('python', ['-m', 'pip', 'install', '-r', 'requirements.txt'], {
        cwd: this.config.installDir,
        windowsHide: true
      });

      pipProc.stdout?.on('data', data => this.appendLog(`[Pip] ${data.toString().trim()}`));
      pipProc.stderr?.on('data', data => this.appendLog(`[Pip] ${data.toString().trim()}`));

      pipProc.on('close', code => {
        if (code === 0) {
          this.appendLog('Dependencies installed successfully.');
          resolve({ success: true });
        } else {
          this.appendLog(`Pip install finished with exit code ${code}`);
          // Some packages may give non-zero code on warning, resolve with status
          resolve({ success: code === 0, code });
        }
      });

      pipProc.on('error', err => {
        this.appendLog(`Pip execution error: ${err.message}`);
        reject(err);
      });
    });
  }

  // 5. Start and Stop Controls
  async startServer() {
    // If already managed and running
    if (this.comfyProcess && !this.comfyProcess.killed) {
      return { success: true, message: 'Server is already running', pid: this.managedPid };
    }

    // Verify main.py exists
    const mainPy = path.join(this.config.installDir, 'main.py');
    if (!fs.existsSync(mainPy)) {
      throw new Error(`ComfyUI main.py not found at ${this.config.installDir}. Please run setup first.`);
    }

    const host = this.config.host || '127.0.0.1';
    const port = this.config.port || 8188;

    this.appendLog(`Launching managed ComfyUI process: python main.py --listen ${host} --port ${port}`);

    const proc = spawn('python', ['main.py', '--listen', host, '--port', String(port)], {
      cwd: this.config.installDir,
      windowsHide: true
    });

    this.comfyProcess = proc;
    this.managedPid = proc.pid;

    proc.stdout?.on('data', data => {
      const line = data.toString().trim();
      this.appendLog(`[ComfyUI] ${line}`);
    });

    proc.stderr?.on('data', data => {
      const line = data.toString().trim();
      this.appendLog(`[ComfyUI Err] ${line}`);
    });

    proc.on('exit', (code, signal) => {
      this.appendLog(`Managed ComfyUI process exited (code=${code}, signal=${signal})`);
      this.comfyProcess = null;
      this.managedPid = null;
    });

    // Wait up to 10 seconds for server to start responding
    let online = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const res = await fetch(`${this.config.serverUrl}/system_stats`, { signal: AbortSignal.timeout(800) });
        if (res.ok) {
          online = true;
          break;
        }
      } catch {}
    }

    this.appendLog(online ? 'ComfyUI server responded successfully.' : 'Process started, waiting for initial readiness.');
    return {
      success: true,
      pid: this.managedPid,
      online,
      serverUrl: this.config.serverUrl
    };
  }

  async stopServer() {
    if (!this.comfyProcess || this.comfyProcess.killed) {
      return { success: true, message: 'No managed process to stop' };
    }

    const pid = this.managedPid;
    this.appendLog(`Stopping managed ComfyUI process (PID ${pid})...`);

    try {
      if (process.platform === 'win32') {
        // Windows tree kill
        await execAsync(`taskkill /pid ${pid} /T /F`);
      } else {
        this.comfyProcess.kill('SIGTERM');
      }
    } catch (e) {
      this.appendLog(`Stop warning: ${e.message}`);
    }

    this.comfyProcess = null;
    this.managedPid = null;
    return { success: true, message: 'ComfyUI process stopped' };
  }

  async restartServer() {
    await this.stopServer();
    await new Promise(r => setTimeout(r, 1000));
    return await this.startServer();
  }

  // 6. Update Configuration
  updateConfig(updates = {}) {
    if (updates.serverUrl) this.config.serverUrl = updates.serverUrl;
    if (updates.installDir) this.config.installDir = updates.installDir;
    if (updates.pythonPath) this.config.pythonPath = updates.pythonPath;
    if (updates.host) this.config.host = updates.host;
    if (updates.port) this.config.port = Number(updates.port);
    this.saveConfig();
    return this.config;
  }

  // 7. Model Manager: Curated Models with explicit user action
  async getModelManagerDetails() {
    const status = await this.getStatus();
    const installedModels = status.models;

    const curated = CURATED_MODELS.map(m => {
      const isInstalled = installedModels.some(im => im.toLowerCase() === m.filename.toLowerCase());
      const localFilePath = path.join(this.config.installDir, 'models', 'checkpoints', m.filename);
      let localSize = null;
      if (fs.existsSync(localFilePath)) {
        localSize = fs.statSync(localFilePath).size;
      }

      return {
        ...m,
        installed: isInstalled || !!localSize,
        localPath: localFilePath,
        actualSizeBytes: localSize
      };
    });

    return {
      installDir: this.config.installDir,
      modelsFolder: path.join(this.config.installDir, 'models', 'checkpoints'),
      installedCheckpoints: installedModels,
      curatedModels: curated
    };
  }

  // 8. Image Generation via ComfyUI API
  async generateImage({
    prompt,
    negativePrompt = 'blurry, distorted, low quality, artifacts, watermark',
    width = 512,
    height = 512,
    model,
    steps = 20,
    cfg = 7.0,
    seed = Math.floor(Math.random() * 10000000)
  }) {
    const status = await this.getStatus();
    if (!status.serverOnline) {
      throw new Error('ComfyUI server is offline. Please start ComfyUI first.');
    }

    const availableModels = status.models;
    const selectedModel = model || availableModels[0];

    if (!selectedModel) {
      throw new Error('No model checkpoint available. Please install a checkpoint model first.');
    }

    // Build standard ComfyUI workflow graph
    const workflow = {
      '3': {
        inputs: {
          seed,
          steps: Math.min(Math.max(steps, 10), 50),
          cfg: Math.min(Math.max(cfg, 1), 15),
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1.0,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0]
        },
        class_type: 'KSampler'
      },
      '4': {
        inputs: {
          ckpt_name: selectedModel
        },
        class_type: 'CheckpointLoaderSimple'
      },
      '5': {
        inputs: {
          width: Math.min(Math.max(width, 256), 1024),
          height: Math.min(Math.max(height, 256), 1024),
          batch_size: 1
        },
        class_type: 'EmptyLatentImage'
      },
      '6': {
        inputs: {
          text: prompt,
          clip: ['4', 1]
        },
        class_type: 'CLIPTextEncode'
      },
      '7': {
        inputs: {
          text: negativePrompt,
          clip: ['4', 1]
        },
        class_type: 'CLIPTextEncode'
      },
      '8': {
        inputs: {
          samples: ['3', 0],
          vae: ['4', 2]
        },
        class_type: 'VAEDecode'
      },
      '9': {
        inputs: {
          filename_prefix: 'WaMaX_Asset',
          images: ['8', 0]
        },
        class_type: 'SaveImage'
      }
    };

    this.appendLog(`Submitting workflow to ComfyUI for prompt: "${prompt.slice(0, 40)}..."`);

    // POST /prompt
    const postRes = await fetch(`${this.config.serverUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw new Error(`ComfyUI prompt error: ${errText}`);
    }

    const { prompt_id } = await postRes.json();
    this.activePromptId = prompt_id;
    this.appendLog(`ComfyUI prompt queued with ID: ${prompt_id}`);

    // Poll /history/{prompt_id} until completed or timeout (max 120s)
    const startTime = Date.now();
    let resultImages = [];

    while (Date.now() - startTime < 120000) {
      await new Promise(r => setTimeout(r, 1000));

      try {
        const histRes = await fetch(`${this.config.serverUrl}/history/${prompt_id}`);
        if (histRes.ok) {
          const histData = await histRes.json();
          if (histData[prompt_id] && histData[prompt_id].outputs) {
            const outputs = histData[prompt_id].outputs;
            // Find node 9 images
            if (outputs['9'] && outputs['9'].images) {
              resultImages = outputs['9'].images;
              break;
            }
          }
        }
      } catch (err) {
        // Continue polling
      }
    }

    this.activePromptId = null;

    if (resultImages.length === 0) {
      throw new Error('ComfyUI generation timed out or produced no output.');
    }

    const imgMeta = resultImages[0];
    const viewUrl = `${this.config.serverUrl}/view?filename=${encodeURIComponent(imgMeta.filename)}&subfolder=${encodeURIComponent(imgMeta.subfolder || '')}&type=${encodeURIComponent(imgMeta.type || 'output')}`;

    // Download image buffer
    const imgRes = await fetch(viewUrl);
    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Data}`;

    // Save copy in workspace assets/generated
    const assetsDir = path.join(this.workspaceRoot, 'assets', 'generated');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const localAssetFilename = `wamax_${Date.now()}_${imgMeta.filename}`;
    const localAssetPath = path.join(assetsDir, localAssetFilename);
    fs.writeFileSync(localAssetPath, buffer);

    const historyRecord = {
      id: `gen_${Date.now()}`,
      prompt,
      negativePrompt,
      model: selectedModel,
      width,
      height,
      seed,
      timestamp: new Date().toISOString(),
      filename: imgMeta.filename,
      localAssetPath,
      previewUrl: dataUrl
    };

    this.history.unshift(historyRecord);
    this.saveHistory();

    return historyRecord;
  }

  // 9. Cancel Generation
  async cancelGeneration() {
    this.appendLog('Cancelling active ComfyUI generation...');
    try {
      const res = await fetch(`${this.config.serverUrl}/interrupt`, { method: 'POST' });
      this.activePromptId = null;
      return { success: res.ok };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  getHistory() {
    return this.history;
  }
}
