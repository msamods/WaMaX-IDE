# WaMaX IDE — Local-First AI Development Environment & Developer API Gateway

> **WaMax | Developed By MSAMODS x WhatYouWantKerala** — [github.com/msamods](https://github.com/msamods)

WaMaX IDE is a high-performance, local-first AI development environment, autonomous agent workspace, and production-grade API Gateway designed for privacy, deterministic security, and zero mandatory cloud API costs.

---

## Key Highlights

- **100% Localhost-First:** Connects directly to local open-weight model runtimes via Ollama (`http://127.0.0.1:11434`).
- **Zero-Cloud & Zero Paid API Subscriptions:** Runs completely offline after downloading models.
- **Laptop Resource Throttling (7GB RAM Friendly):** Configured with `keep_alive: 0s` so local AI models are immediately unloaded from memory after inference. **RAM is only used during API calls**, leaving system memory completely free for compilation and browsing!
- **Deterministic Rules Engine:** Hierarchical rule resolution with inviolable safety constraints (Priority 1000) that can never be overridden by model instructions or user prompts.
- **AI Brain Studio:** Multi-brain switching (WaMaX Master Coding Brain, Python Expert, Node.js Backend, Frontend Developer, Debugging Specialist, Security Auditor, Doubt Solving Mentor).
- **Agent Manager:** 8 specialized agents (Coding, Debugging, Code Review, Testing, Security, Docs, Planner, Research) with tool permissions, approval gating, and local audit logging.
- **Persistent AI Memory:** SQLite / JSON-backed persistent memory with keyword search and token budgeting so project knowledge persists across sessions.
- **Monaco Code Editor:** Professional developer IDE with syntax highlighting, tabs, breadcrumbs, line numbers, and file tree.
- **Doubt Solver & Code Explainer:** Instant one-click actions: "Explain Code", "Fix Bugs", "Refactor", "Write Tests", "Insert into Editor".
- **Integrated Terminal & Git:** Real command execution with approval safeguards and source control status.

---

## Quick Start

### 1. Requirements
- Node.js v18+ (tested on Node v22 and v24)
- Ollama installed locally or on your local network
- Recommended models: `qwen2.5:1.5b` (ultra fast, ~1GB RAM), `qwen3.5:2b` (~2.7GB RAM), or `moondream` (vision)

### 2. Launch Locally (Windows)
Double-click `start-wamax.bat` or run:
```bash
# Terminal 1: Backend API
node server/index.js

# Terminal 2: Frontend UI
npm run dev
```
Open **`http://localhost:5173`** or **`http://localhost:3001`** in your browser.

---

## Automated Test Results

WaMaX IDE includes a built-in automated test suite verifying all 10 core architectural modules:
```bash
node --test tests/core.test.js
```
```text
✔ Setup test sandbox
✔ 1. Mandatory Safety Rules are inviolable and always present
✔ 2. Rule creation, priority ordering, and deterministic resolution
✔ 3. Brain creation, editing, and default fallback
✔ 4. Agent permissions and audit log recording
✔ 5. Persistent Memory creation, search, and token budget
✔ 6. Safe File Path Validation & Traversal Prevention
✔ 7. Terminal Command Approval Safeguards
✔ 8. Ollama unavailable graceful degradation & metrics
✔ Cleanup test sandbox
ℹ tests 10 | pass 10 | fail 0
```
