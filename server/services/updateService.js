// WaMaX Zero-Data-Loss GitHub Release Updater
// Preserves memories, rules, brains, gateway keys, and workspace settings during updates

import fs from 'fs';
import path from 'path';
import os from 'os';

export class UpdateService {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.currentVersion = options.currentVersion || '1.0.0';
    this.repo = 'msamods/WaMaX-IDE';

    // Decoupled Persistent Data Directory
    this.dataPath = process.env.WAMAX_DATA_DIR || path.join(this.workspaceRoot, 'server', 'data');
    this.backupPath = path.join(os.homedir(), '.wamax', 'backups');

    if (!fs.existsSync(this.backupPath)) {
      try {
        fs.mkdirSync(this.backupPath, { recursive: true });
      } catch {}
    }
  }

  // 1. Check GitHub for latest release
  async checkForUpdates() {
    try {
      const res = await fetch(`https://api.github.com/repos/${this.repo}/releases/latest`, {
        headers: { 'User-Agent': 'WaMaX-IDE-AutoUpdater' },
        signal: AbortSignal.timeout(3000)
      });

      if (!res.ok) {
        return {
          currentVersion: this.currentVersion,
          latestVersion: this.currentVersion,
          updateAvailable: false,
          notes: 'No new releases found on GitHub.'
        };
      }

      const release = await res.json();
      const latestTag = release.tag_name ? release.tag_name.replace(/^v/, '') : this.currentVersion;
      const updateAvailable = latestTag !== this.currentVersion;

      return {
        currentVersion: this.currentVersion,
        latestVersion: latestTag,
        updateAvailable,
        releaseName: release.name || release.tag_name,
        publishedAt: release.published_at,
        notes: release.body || 'New features, model optimizations, and security updates.',
        downloadUrl: release.zipball_url || release.html_url
      };
    } catch (err) {
      return {
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
        updateAvailable: false,
        error: err.message
      };
    }
  }

  // 2. Memory & State Snapshot (Zero-Data-Loss Protection)
  async createPreUpdateBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupPath, `wamax_backup_${timestamp}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filesToProtect = [
      'memories.json',
      'rules.json',
      'brains.json',
      'agents.json',
      'gateway_keys.json',
      'gateway_audit.json',
      'comfy_config.json',
      'comfy_history.json'
    ];

    let backedUpCount = 0;
    for (const file of filesToProtect) {
      const src = path.join(this.dataPath, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupDir, file));
        backedUpCount++;
      }
    }

    return {
      success: true,
      backupDir,
      backedUpFiles: backedUpCount,
      timestamp
    };
  }

  // 3. Status and Data Location info
  getDataLocation() {
    return {
      dataPath: this.dataPath,
      backupPath: this.backupPath,
      protectedEntities: ['memories', 'rules', 'brains', 'agents', 'api_keys', 'history']
    };
  }
}
