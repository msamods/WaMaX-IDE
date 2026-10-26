# Contributing to WaMaX IDE

Thank you for your interest in contributing to **WaMaX IDE**!

WaMaX IDE is built with a local-first, privacy-respecting philosophy:
- **Zero Mandatory Cloud Dependencies**: Core features must always work 100% offline.
- **Laptop Resource Guard**: Always release memory after inference (`keep_alive: 0s`).
- **Safety First**: Never expose private files, API keys, or personal tokens.

---

## 🛠️ Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/msamods/WaMaX-IDE.git
   cd WaMaX-IDE
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run local dev servers**:
   ```bash
   # Terminal 1: Backend API Gateway
   node server/index.js

   # Terminal 2: Frontend Vite Server
   npm run dev
   ```

4. **Run unit tests**:
   ```bash
   node --test tests/*.test.js
   ```

5. **Build executable**:
   ```bash
   build-exe.bat
   ```

---

## 📜 Pull Request Guidelines

1. Ensure all 41+ automated tests pass with `node --test tests/*.test.js`.
2. Do not introduce mandatory third-party cloud subscriptions or tracking.
3. Keep the branding intact: `WaMax | Developed by MSAMODS x WhatYouWantKerala`.
