// Ollama Local AI Adapter with Resource-Aware Memory Management
import os from 'os';

export class OllamaClient {
  constructor(baseUrl = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url) {
    if (url) this.baseUrl = url.replace(/\/+$/, '');
  }

  getSystemMetrics() {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    return {
      totalMemMB: Math.round(totalMemBytes / (1024 * 1024)),
      freeMemMB: Math.round(freeMemBytes / (1024 * 1024)),
      usedMemMB: Math.round(usedMemBytes / (1024 * 1024)),
      percentUsed: Math.round((usedMemBytes / totalMemBytes) * 100),
      cpus: os.cpus().length,
      platform: os.platform()
    };
  }

  async isHealthy() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = await res.json();
      return (data.models || []).map(m => ({
        name: m.name,
        sizeMB: Math.round((m.size || 0) / (1024 * 1024)),
        modified_at: m.modified_at,
        digest: m.digest,
        details: m.details || {}
      }));
    } catch (e) {
      return [];
    }
  }

  async pullModel(modelName, onProgress) {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    if (!res.ok) throw new Error(`Failed to pull model: HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (onProgress) onProgress(parsed);
        } catch {}
      }
    }
    return { success: true };
  }

  /**
   * Chat completion with keep_alive configuration:
   * Keep_alive: "0s" or "30s" ensures the model is freed from RAM when not in use!
   */
  async chat({
    model = 'qwen2.5:1.5b',
    messages = [],
    temperature = 0.7,
    keepAlive = '30s', // Free RAM shortly after request!
    stream = false,
    onChunk
  }) {
    const payload = {
      model,
      messages,
      stream,
      keep_alive: keepAlive,
      options: {
        temperature,
        num_ctx: 4096
      }
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama Error (${res.status}): ${errText}`);
    }

    if (!stream) {
      return await res.json();
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let thinking = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          const content = json.message?.content || '';
          const th = json.message?.thinking || '';
          fullResponse += content;
          thinking += th;
          if (onChunk) onChunk({ content, thinking, done: json.done });
        } catch {}
      }
    }

    return {
      message: {
        role: 'assistant',
        content: fullResponse,
        thinking
      },
      done: true
    };
  }
}
