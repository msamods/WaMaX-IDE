// WaMaX IDE API Client
import { Brain, Agent, Rule, MemoryItem, ProjectFile, GitStatusInfo } from '../types/ide';

const BASE_URL = '/api';

export const api = {
  // Health & Metrics
  async getHealth() {
    const res = await fetch(`${BASE_URL}/health`);
    return await res.json();
  },

  // Models
  async getModels(): Promise<{ name: string; sizeMB: number; modified_at: string }[]> {
    const res = await fetch(`${BASE_URL}/models`);
    return await res.json();
  },

  // Brains
  async getBrains(): Promise<Brain[]> {
    const res = await fetch(`${BASE_URL}/brains`);
    return await res.json();
  },
  async createBrain(data: Partial<Brain>): Promise<Brain> {
    const res = await fetch(`${BASE_URL}/brains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async updateBrain(id: string, data: Partial<Brain>): Promise<Brain> {
    const res = await fetch(`${BASE_URL}/brains/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async deleteBrain(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/brains/${id}`, { method: 'DELETE' });
    return await res.json();
  },

  // Agents
  async getAgents(): Promise<Agent[]> {
    const res = await fetch(`${BASE_URL}/agents`);
    return await res.json();
  },
  async updateAgent(id: string, data: Partial<Agent>): Promise<Agent> {
    const res = await fetch(`${BASE_URL}/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // Rules
  async getRules(): Promise<Rule[]> {
    const res = await fetch(`${BASE_URL}/rules`);
    return await res.json();
  },
  async createRule(data: Partial<Rule>): Promise<Rule> {
    const res = await fetch(`${BASE_URL}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async updateRule(id: string, data: Partial<Rule>): Promise<Rule> {
    const res = await fetch(`${BASE_URL}/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async deleteRule(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/rules/${id}`, { method: 'DELETE' });
    return await res.json();
  },
  async resolveRules(params: { brainId?: string; agentId?: string; targetFile?: string; taskInstruction?: string }) {
    const res = await fetch(`${BASE_URL}/rules/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  },

  // Memories
  async getMemories(): Promise<MemoryItem[]> {
    const res = await fetch(`${BASE_URL}/memory`);
    return await res.json();
  },
  async createMemory(data: Partial<MemoryItem>): Promise<MemoryItem> {
    const res = await fetch(`${BASE_URL}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },
  async deleteMemory(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/memory/${id}`, { method: 'DELETE' });
    return await res.json();
  },

  // Files
  async getFileTree(path = ''): Promise<{ workspace: string; tree: ProjectFile[] }> {
    const res = await fetch(`${BASE_URL}/files/tree?path=${encodeURIComponent(path)}`);
    return await res.json();
  },
  async readFile(filePath: string): Promise<{ path: string; content: string }> {
    const res = await fetch(`${BASE_URL}/files/read?path=${encodeURIComponent(filePath)}`);
    return await res.json();
  },
  async writeFile(filePath: string, content: string): Promise<{ success: boolean; path: string }> {
    const res = await fetch(`${BASE_URL}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content })
    });
    return await res.json();
  },
  async deleteFile(filePath: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath })
    });
    return await res.json();
  },

  // Git
  async getGitStatus(): Promise<GitStatusInfo> {
    const res = await fetch(`${BASE_URL}/git/status`);
    return await res.json();
  },
  async getGitDiff(file = ''): Promise<{ diff: string }> {
    const res = await fetch(`${BASE_URL}/git/diff?file=${encodeURIComponent(file)}`);
    return await res.json();
  },
  async commitGit(message: string): Promise<{ success: boolean; result: string }> {
    const res = await fetch(`${BASE_URL}/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return await res.json();
  },

  // Terminal
  async executeTerminal(command: string, requireApproval = false, approved = false) {
    const res = await fetch(`${BASE_URL}/terminal/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, requireApproval, approved })
    });
    return await res.json();
  },

  // AI Chat Stream
  async chatStream(
    params: {
      messages: { role: string; content: string }[];
      brainId?: string;
      agentId?: string;
      model?: string;
      attachedContext?: string;
      targetFile?: string;
    },
    onChunk: (chunk: { content?: string; thinking?: string; done?: boolean }) => void,
    signal?: AbortSignal
  ) {
    const res = await fetch(`${BASE_URL}/ai/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AI Chat Stream Error: ${err}`);
    }

    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onChunk(data);
          } catch {}
        }
      }
    }
  }
};
