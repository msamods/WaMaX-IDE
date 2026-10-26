// Persistent AI Memory Store with Keyword Search and Token Budgeting
import fs from 'fs';
import path from 'path';

export class MemoryStore {
  constructor(storagePath) {
    this.storagePath = storagePath || './data/memories.json';
    this.memories = this.loadMemories();
  }

  loadMemories() {
    try {
      if (fs.existsSync(this.storagePath)) {
        return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      }
    } catch (e) {
      console.error('Error loading memories:', e.message);
    }
    return [
      {
        id: 'mem-1',
        category: 'architecture',
        title: 'Local-First Zero-Cloud Principle',
        content: 'WaMaX IDE is built on a 100% localhost-first architecture. Do not use external paid APIs without explicit user configuration.',
        scope: 'global',
        tags: ['architecture', 'local-first', 'privacy'],
        createdAt: Date.now()
      },
      {
        id: 'mem-2',
        category: 'conventions',
        title: 'Resource Throttling for 7GB RAM Laptops',
        content: 'The user operates on a system with ~7GB usable RAM. Keep Ollama models unloaded when idle (keep_alive: 0 or short timeout) to prevent RAM exhaustion.',
        scope: 'global',
        tags: ['hardware', 'ram', 'ollama'],
        createdAt: Date.now()
      },
      {
        id: 'mem-3',
        category: 'preferences',
        title: 'Dark Theme & Concise Responses',
        content: 'User prefers dark theme, concise code explanations, and direct copy-pasteable patches over long speculative text.',
        scope: 'global',
        tags: ['preferences', 'ux'],
        createdAt: Date.now()
      }
    ];
  }

  save() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(this.memories, null, 2));
    } catch (e) {
      console.error('Error saving memories:', e.message);
    }
  }

  getAll() {
    return this.memories;
  }

  add(memory) {
    const item = {
      ...memory,
      id: memory.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.memories.push(item);
    this.save();
    return item;
  }

  update(id, updates) {
    const idx = this.memories.findIndex(m => m.id === id);
    if (idx === -1) return null;
    this.memories[idx] = { ...this.memories[idx], ...updates, updatedAt: Date.now() };
    this.save();
    return this.memories[idx];
  }

  delete(id) {
    const before = this.memories.length;
    this.memories = this.memories.filter(m => m.id !== id);
    this.save();
    return this.memories.length < before;
  }

  /**
   * Search relevant memories and return within a token budget (approx ~4 chars per token)
   */
  retrieve({ query, category, maxTokens = 600, scope = 'global' }) {
    if (!this.memories.length) return { text: '', items: [] };

    const terms = (query || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    // Score memories
    const scored = this.memories.map(mem => {
      let score = 0;
      if (category && mem.category === category) score += 3;
      if (mem.scope === scope || mem.scope === 'global') score += 2;

      const searchableText = `${mem.title} ${mem.content} ${(mem.tags || []).join(' ')}`.toLowerCase();
      for (const term of terms) {
        if (searchableText.includes(term)) score += 5;
      }
      return { mem, score };
    });

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);

    const selected = [];
    let currentTokens = 0;

    for (const { mem, score } of scored) {
      if (score <= 0 && terms.length > 0) continue; // Skip irrelevant items
      const estimatedTokens = Math.ceil((mem.title.length + mem.content.length) / 4);
      if (currentTokens + estimatedTokens > maxTokens) break;
      selected.push(mem);
      currentTokens += estimatedTokens;
      if (selected.length >= 5) break;
    }

    if (!selected.length) return { text: '', items: [] };

    const text = [
      '# PERSISTENT LOCAL PROJECT MEMORY (RETRIEVED CONTEXT):',
      ...selected.map(m => `- [${m.category.toUpperCase()} / ${m.title}]: ${m.content}`)
    ].join('\n');

    return { text, items: selected };
  }

  search(query, limit = 5) {
    const res = this.retrieve({ query, maxTokens: limit * 200 });
    return res.items.slice(0, limit);
  }
}
