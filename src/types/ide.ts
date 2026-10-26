export type RuleScope = 'global' | 'workspace' | 'project' | 'file' | 'brain' | 'agent' | 'task';

export interface Rule {
  id: string;
  name: string;
  description: string;
  content: string;
  scope: RuleScope;
  priority: number; // Higher number = higher precedence
  filePatterns?: string[];
  languages?: string[];
  applicableBrains?: string[];
  applicableAgents?: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Brain {
  id: string;
  name: string;
  description: string;
  purpose: string;
  preferredModel: string;
  fallbackModel?: string;
  systemInstructions: string;
  ruleIds: string[];
  memoryPolicy: 'full' | 'summary' | 'disabled';
  toolPermissions: string[];
  temperature: number;
  contextBudget: number; // e.g. 4096
  allowedFileOps: ('read' | 'write' | 'delete' | 'execute')[];
  networkAccess: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  role: 'coding' | 'debugging' | 'review' | 'testing' | 'research' | 'docs' | 'planner' | 'security';
  assignedBrainId: string;
  model: string;
  instructions: string;
  allowedTools: string[];
  fileScope: string[];
  networkPermissions: boolean;
  maxExecutionTimeSec: number;
  maxToolCalls: number;
  requireApproval: boolean;
  status: 'idle' | 'running' | 'paused' | 'error';
  auditLog: {
    timestamp: number;
    action: string;
    details: string;
    approvedBy?: string;
  }[];
}

export interface MemoryItem {
  id: string;
  category: 'preferences' | 'architecture' | 'conventions' | 'decisions' | 'bugs' | 'summaries';
  title: string;
  content: string;
  scope: string; // e.g. "global" or project path
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  timestamp: number;
  modelUsed?: string;
  brainId?: string;
  agentId?: string;
  diffSnippet?: {
    file: string;
    original: string;
    modified: string;
  };
  attachments?: {
    name: string;
    type: 'code' | 'image' | 'file';
    content: string;
  }[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  brainId: string;
  agentId?: string;
  model: string;
  messages: ChatMessage[];
}

export interface ProjectFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  children?: ProjectFile[];
  extension?: string;
}

export interface GitStatusInfo {
  branch: string;
  clean: boolean;
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}
