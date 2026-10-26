# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## Reporting a Vulnerability

We take the security of local AI and developer machines seriously. Because WaMaX IDE runs code on local systems, we enforce strict security boundaries:

- **Path Traversal Prevention**: File access is strictly validated against permitted workspace roots.
- **Terminal Command Safeguards**: Destructive shell operations require explicit user approval.
- **Secret Redaction**: Imported AI context is automatically scrubbed of credentials (`ghp_`, `sk-`, `AIza`, bearer tokens).
- **Default Localhost Binding**: The API Gateway and ComfyUI server bind only to `127.0.0.1` unless LAN mode is explicitly enabled by the user.

If you discover a security vulnerability, please do NOT file a public GitHub issue. Instead, report it confidentially via GitHub Security Advisories or email [msamods.org@gmail.com](mailto:msamods.org@gmail.com).
