// WaMaX Dynamic Model Router & Auto-Switcher
// Automatically selects the best local model based on intent, memory load, and availability

export class ModelRouter {
  constructor(options = {}) {
    this.ollamaClient = options.ollamaClient;
    this.fallbackChain = [
      'qwen2.5-coder:1.5b',
      'qwen2.5:1.5b',
      'qwen3.5:2b',
      'qwen2.5:0.5b',
      'llama3.2:1b'
    ];
    this.autoSwitchEnabled = true;
  }

  // Detect task category from user prompt
  classifyTask(prompt = '') {
    const p = prompt.toLowerCase();

    // Code & Dev Tasks
    if (
      p.includes('function') ||
      p.includes('class ') ||
      p.includes('bug') ||
      p.includes('fix') ||
      p.includes('code') ||
      p.includes('const ') ||
      p.includes('api') ||
      p.includes('git') ||
      p.includes('script') ||
      p.includes('refactor') ||
      p.includes('test')
    ) {
      return 'coding';
    }

    // Heavy Reasoning
    if (
      p.includes('why') ||
      p.includes('explain') ||
      p.includes('compare') ||
      p.includes('architect') ||
      p.includes('analyze') ||
      p.includes('solve')
    ) {
      return 'reasoning';
    }

    return 'chat';
  }

  // Select optimal model based on available models and free system memory
  async selectModel({ prompt, preferredModel, freeMemMB = 2048 }) {
    if (!this.autoSwitchEnabled && preferredModel) {
      return { model: preferredModel, reason: 'user_selected' };
    }

    const available = await this.ollamaClient.listModels();
    const installedNames = available.map(m => m.name);

    if (installedNames.length === 0) {
      return { model: preferredModel || 'qwen2.5:1.5b', reason: 'default_fallback' };
    }

    const task = this.classifyTask(prompt);

    // Low Memory Guard: If free RAM is critically low (< 1.2 GB), pick smallest model
    if (freeMemMB < 1200) {
      const smallest = installedNames.find(n => n.includes('0.5b') || n.includes('1.5b') || n.includes('1b')) || installedNames[0];
      return {
        model: smallest,
        task,
        reason: 'low_memory_guard',
        freeMemMB
      };
    }

    // Task Matching
    if (task === 'coding') {
      const coder = installedNames.find(n => n.includes('coder'));
      if (coder) return { model: coder, task, reason: 'task_coding' };
    }

    if (task === 'reasoning') {
      const reasoner = installedNames.find(n => n.includes('r1') || n.includes('deepseek') || n.includes('3b'));
      if (reasoner) return { model: reasoner, task, reason: 'task_reasoning' };
    }

    // If preferred model is installed, use it
    if (preferredModel && installedNames.includes(preferredModel)) {
      return { model: preferredModel, task, reason: 'preferred_installed' };
    }

    // Otherwise return first available matching fallback chain
    for (const fb of this.fallbackChain) {
      const match = installedNames.find(n => n.startsWith(fb.split(':')[0]));
      if (match) return { model: match, task, reason: 'fallback_chain' };
    }

    return { model: installedNames[0], task, reason: 'first_available' };
  }

  // Execute chat with automatic fault tolerance: if model OOMs or fails, auto-switch to fallback
  async chatWithAutoSwitch({ messages, preferredModel, stream = false, onChunk = null }) {
    const selection = await this.selectModel({
      prompt: messages[messages.length - 1]?.content || '',
      preferredModel
    });

    try {
      if (stream && onChunk) {
        return await this.ollamaClient.chatStream(
          selection.model,
          messages,
          onChunk
        );
      } else {
        return await this.ollamaClient.chat(selection.model, messages);
      }
    } catch (err) {
      console.warn(`[ModelRouter] Model ${selection.model} failed (${err.message}). Auto-switching to emergency fallback...`);
      // Find secondary fallback
      const available = await this.ollamaClient.listModels();
      const secondary = available.find(m => m.name !== selection.model)?.name || 'qwen2.5:1.5b';

      if (stream && onChunk) {
        return await this.ollamaClient.chatStream(secondary, messages, onChunk);
      } else {
        return await this.ollamaClient.chat(secondary, messages);
      }
    }
  }
}
