# WaMaX IDE — Installation & Deployment Guide

## 1. Local Machine Installation (Windows / Linux / macOS)

### Prerequisites:
1. **Node.js**: v18.0.0 or newer.
2. **Ollama**: Download from [ollama.com](https://ollama.com).
3. **Recommended Model**:
   ```bash
   ollama pull qwen2.5:1.5b
   ```

### Running Locally:
```bash
cd wamax-ide

# Install dependencies (only once)
npm install

# Start both backend and frontend:
# Windows:
start-wamax.bat

# Or manual command:
node server/index.js
```
Open **`http://localhost:3001`** (or `http://localhost:5173` for Vite hot-reload dev mode).

---

## 2. Remote VPS / SSH Device Deployment

WaMaX IDE is fully deployed and active on your VPS (`178.83.59.202`) managed under PM2:

```bash
# Check status on VPS:
pm2 status wamax-ide

# View logs:
pm2 logs wamax-ide

# Restart service:
pm2 restart wamax-ide
```

Access the VPS instance directly via:
**`http://178.83.59.202:3005`**

---

## 3. Automated Test Verification

Run the comprehensive 10-point test suite anytime:
```bash
node --test tests/core.test.js
```
Tests verify:
- Inviolable Priority 1000 safety constraints
- Deterministic rule precedence resolution
- AI Brain studio creation and fallbacks
- Agent permissions and local audit logging
- Persistent memory RAG retrieval & token budgeting
- Path traversal defense & safe file sandboxing
- Command execution approval gates
- Offline Ollama graceful error handling
