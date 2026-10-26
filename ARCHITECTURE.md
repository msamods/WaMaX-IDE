# WaMaX IDE — System Architecture & Design

## 1. Architectural Overview

WaMaX IDE is structured into three clean, decoupled layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      WaMaX Web / Desktop UI                  │
│  (React 18, Vite, Tailwind CSS, Monaco Editor, Lucide Icons)│
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / SSE (Port 3001)
┌──────────────────────────────▼──────────────────────────────┐
│                    WaMaX Node.js Core Backend                │
│                                                             │
│ ┌────────────────┐ ┌────────────────┐ ┌───────────────────┐ │
│ │  Rule Engine   │ │  Brain Studio  │ │  Agent Orchestr.  │ │
│ │ (Precedence)   │ │ (Config Store) │ │ (Approval Gates)  │ │
│ └────────────────┘ └────────────────┘ └───────────────────┘ │
│ ┌────────────────┐ ┌────────────────┐ ┌───────────────────┐ │
│ │  Memory Store  │ │  File Service  │ │  Terminal / Git   │ │
│ │ (FTS & Tokens) │ │ (Path Defense) │ │ (Secure Exec)     │ │
│ └────────────────┘ └────────────────┘ └───────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP API
┌──────────────────────────────▼──────────────────────────────┐
│              Ollama Local Model Engine (Port 11434)          │
│       (keep_alive: 0s -> 0 RAM wasted when idle!)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Deterministic Rule Resolution Engine

Rules are resolved with strict deterministic precedence to guarantee security:
1. **Safety Constraints (Priority 1000):** Inviolable. Enforces workspace confinement, credential protection, and destructive action approval.
2. **Global User Rules (Priority 100):** Preferences like targeted diffs and root cause explanations.
3. **Workspace / Project Rules (Priority 70):** Standards specific to the active repo.
4. **File-Level Rules (Priority 40):** Pattern-matched rules (e.g. `*.ts` or `*.py`).
5. **Brain & Agent Instructions (Priority 20):** Persona-specific directives.
6. **Task Instructions (Priority 10):** Specific user request.

---

## 3. Resource & Memory Conservation (7GB RAM Friendly)

Because the user environment operates on ~7GB usable RAM:
- Every Ollama request is submitted with `keep_alive: 0s`.
- Ollama loads the model into RAM for generation and unloads it immediately after.
- During idle states, RAM usage of WaMaX IDE is only ~60MB.
- RAG Memory retrieval strictly caps context injection to 400-600 tokens so context windows never explode.
