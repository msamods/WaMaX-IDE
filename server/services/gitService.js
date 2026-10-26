// Git operations service using system git
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class GitService {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot || process.cwd();
  }

  setWorkspace(root) {
    if (root) this.workspaceRoot = root;
  }

  async runGit(args) {
    try {
      const { stdout } = await execAsync(`git ${args}`, {
        cwd: this.workspaceRoot,
        timeout: 15000
      });
      return stdout.trim();
    } catch (e) {
      return '';
    }
  }

  async getStatus() {
    try {
      const branch = await this.runGit('rev-parse --abbrev-ref HEAD');
      const statusOut = await this.runGit('status --porcelain');
      
      const modified = [];
      const staged = [];
      const untracked = [];

      statusOut.split('\n').filter(Boolean).forEach(line => {
        const x = line[0];
        const y = line[1];
        const file = line.slice(3).trim();

        if (x === '?' && y === '?') {
          untracked.push(file);
        } else {
          if (x !== ' ' && x !== '?') staged.push(file);
          if (y !== ' ') modified.push(file);
        }
      });

      return {
        branch: branch || 'main',
        clean: !statusOut,
        modified,
        staged,
        untracked,
        ahead: 0,
        behind: 0
      };
    } catch {
      return { branch: 'main', clean: true, modified: [], staged: [], untracked: [], ahead: 0, behind: 0 };
    }
  }

  async getDiff(file = '') {
    return await this.runGit(`diff ${file}`);
  }

  async stage(file = '.') {
    return await this.runGit(`add "${file}"`);
  }

  async commit(message) {
    if (!message) throw new Error('Commit message is required');
    const safeMsg = message.replace(/"/g, '\\"');
    return await this.runGit(`commit -m "${safeMsg}"`);
  }
}
