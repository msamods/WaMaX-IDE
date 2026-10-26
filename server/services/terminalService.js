// Safe Terminal & Command Execution Service
import { spawn } from 'child_process';
import os from 'os';

export class TerminalService {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot || process.cwd();
    this.history = [];
    this.activeProcesses = new Map();
  }

  setWorkspace(root) {
    if (root) this.workspaceRoot = root;
  }

  executeCommand({ command, cwd, requireApproval = false, approved = false, onOutput }) {
    if (requireApproval && !approved) {
      return {
        status: 'pending_approval',
        command,
        message: 'This command requires explicit user approval before execution.'
      };
    }

    const id = `proc-${Date.now()}`;
    const workDir = cwd || this.workspaceRoot;
    const isWin = os.platform() === 'win32';
    const shell = isWin ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWin ? ['-NoProfile', '-Command', command] : ['-c', command];

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(shell, shellArgs, {
        cwd: workDir,
        env: { ...process.env, CI: 'true' }
      });

      this.activeProcesses.set(id, proc);

      proc.stdout.on('data', data => {
        const str = data.toString();
        stdout += str;
        if (onOutput) onOutput({ type: 'stdout', data: str });
      });

      proc.stderr.on('data', data => {
        const str = data.toString();
        stderr += str;
        if (onOutput) onOutput({ type: 'stderr', data: str });
      });

      proc.on('close', code => {
        this.activeProcesses.delete(id);
        const record = {
          id,
          command,
          cwd: workDir,
          exitCode: code,
          stdout,
          stderr,
          timestamp: Date.now()
        };
        this.history.unshift(record);
        if (this.history.length > 50) this.history.pop();
        resolve(record);
      });

      proc.on('error', err => {
        this.activeProcesses.delete(id);
        resolve({
          id,
          command,
          exitCode: 1,
          stdout,
          stderr: err.message,
          timestamp: Date.now()
        });
      });
    });
  }

  kill(id) {
    const proc = this.activeProcesses.get(id);
    if (proc) {
      proc.kill();
      this.activeProcesses.delete(id);
      return true;
    }
    return false;
  }

  getHistory() {
    return this.history;
  }
}
