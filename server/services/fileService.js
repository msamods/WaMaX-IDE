// Safe Workspace File Management and Patch Operations
import fs from 'fs';
import path from 'path';
import os from 'os';

export class FileService {
  constructor(workspaceRoot) {
    this.workspaceRoot = path.resolve(workspaceRoot || process.cwd());
    this.backupDir = path.join(this.workspaceRoot, '.wamax', 'backups');
    this.recentFile = path.join(process.cwd(), 'server', 'data', 'recent_workspaces.json');
    if (!fs.existsSync(this.backupDir)) {
      try { fs.mkdirSync(this.backupDir, { recursive: true }); } catch {}
    }
  }

  setWorkspace(newRoot) {
    if (newRoot && fs.existsSync(newRoot)) {
      this.workspaceRoot = path.resolve(newRoot);
    }
  }

  getWorkspace() {
    return this.workspaceRoot;
  }

  validatePath(relativePath) {
    const resolved = path.resolve(this.workspaceRoot, relativePath || '');
    if (!resolved.startsWith(this.workspaceRoot)) {
      throw new Error(`SECURITY ERROR: Path traversal attempt outside workspace! Target: ${relativePath}`);
    }
    return resolved;
  }

  getTree(dir = '', depth = 0, maxDepth = 6) {
    if (depth > maxDepth) return [];
    const absoluteDir = this.validatePath(dir);
    if (!fs.existsSync(absoluteDir)) return [];

    const IGNORED = new Set([
      'node_modules', '.git', '.vscode', 'dist', 'build', '.idea',
      '.next', 'coverage', '.wamax', '.cache'
    ]);

    const items = [];
    try {
      const files = fs.readdirSync(absoluteDir, { withFileTypes: true });
      for (const f of files) {
        if (IGNORED.has(f.name) || f.name.startsWith('.DS_Store')) continue;
        const rel = path.join(dir, f.name).replace(/\\/g, '/');

        if (f.isDirectory()) {
          items.push({
            name: f.name,
            path: rel,
            isDirectory: true,
            children: this.getTree(rel, depth + 1, maxDepth)
          });
        } else {
          const ext = path.extname(f.name).toLowerCase();
          const stats = fs.statSync(path.join(absoluteDir, f.name));
          items.push({
            name: f.name,
            path: rel,
            isDirectory: false,
            size: stats.size,
            extension: ext
          });
        }
      }
    } catch (e) {
      console.error(`Error reading directory ${dir}:`, e.message);
    }
    return items;
  }

  readFile(relPath) {
    const abs = this.validatePath(relPath);
    if (!fs.existsSync(abs)) throw new Error(`File not found: ${relPath}`);
    return fs.readFileSync(abs, 'utf8');
  }

  writeFile(relPath, content) {
    const abs = this.validatePath(relPath);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Create backup point
    if (fs.existsSync(abs)) {
      const backupFile = path.join(this.backupDir, `${path.basename(relPath)}.${Date.now()}.bak`);
      fs.copyFileSync(abs, backupFile);
    }

    fs.writeFileSync(abs, content, 'utf8');
    return { success: true, path: relPath };
  }

  createFile(relPath, initialContent = '') {
    return this.writeFile(relPath, initialContent);
  }

  createDirectory(relPath) {
    const abs = this.validatePath(relPath);
    fs.mkdirSync(abs, { recursive: true });
    return { success: true, path: relPath };
  }

  deleteItem(relPath) {
    const abs = this.validatePath(relPath);
    if (!fs.existsSync(abs)) throw new Error(`Item not found: ${relPath}`);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      fs.rmSync(abs, { recursive: true, force: true });
    } else {
      fs.unlinkSync(abs);
    }
    return { success: true, path: relPath };
  }

  // Browse local filesystem for workspace folder picker
  browseDirectories(targetDir = '') {
    const isWin = process.platform === 'win32';
    const home = os.homedir();

    // Default bookmarks
    const bookmarks = [
      { name: 'Current Workspace', path: this.workspaceRoot },
      { name: 'User Home', path: home },
      { name: 'Desktop', path: path.join(home, 'Desktop') },
      { name: 'Downloads', path: path.join(home, 'Downloads') },
      { name: 'Documents', path: path.join(home, 'Documents') }
    ].filter(b => fs.existsSync(b.path));

    // If on Windows and no targetDir specified, list drives
    let availableDrives = [];
    if (isWin) {
      for (const letter of ['C', 'D', 'E', 'F', 'G']) {
        const driveRoot = `${letter}:\\`;
        if (fs.existsSync(driveRoot)) {
          availableDrives.push({ name: `Local Disk (${letter}:)`, path: driveRoot });
        }
      }
    }

    const currentPath = targetDir ? path.resolve(targetDir) : this.workspaceRoot;
    if (!fs.existsSync(currentPath)) {
      throw new Error(`Directory does not exist: ${targetDir}`);
    }

    const stat = fs.statSync(currentPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${targetDir}`);
    }

    const parentPath = path.dirname(currentPath) !== currentPath ? path.dirname(currentPath) : null;
    const subdirectories = [];

    const IGNORED = new Set([
      '$Recycle.Bin', 'System Volume Information', 'Recovery',
      'node_modules', '.git', '.cache'
    ]);

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory() || IGNORED.has(ent.name) || ent.name.startsWith('.')) continue;
        const subPath = path.join(currentPath, ent.name);
        let hasChildren = false;
        try {
          const subEntries = fs.readdirSync(subPath, { withFileTypes: true });
          hasChildren = subEntries.some(s => s.isDirectory() && !s.name.startsWith('.'));
        } catch {}

        subdirectories.push({
          name: ent.name,
          path: subPath,
          hasChildren
        });
      }
    } catch (e) {
      console.warn(`Error reading subdirectories of ${currentPath}:`, e.message);
    }

    return {
      currentPath,
      parentPath,
      bookmarks,
      drives: availableDrives,
      directories: subdirectories,
      recent: this.getRecentWorkspaces()
    };
  }

  getRecentWorkspaces() {
    try {
      if (fs.existsSync(this.recentFile)) {
        return JSON.parse(fs.readFileSync(this.recentFile, 'utf8'));
      }
    } catch {}
    return [this.workspaceRoot];
  }

  addRecentWorkspace(wsPath) {
    if (!wsPath || !fs.existsSync(wsPath)) return;
    try {
      let recents = this.getRecentWorkspaces().filter(p => p !== wsPath);
      recents.unshift(wsPath);
      recents = recents.slice(0, 8);
      const dir = path.dirname(this.recentFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.recentFile, JSON.stringify(recents, null, 2), 'utf8');
    } catch {}
  }
}
