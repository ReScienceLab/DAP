---
"@resciencelab/dap": minor
---

feat: align request signing with AgentWire v0.2 spec

Outbound HTTP requests now include X-AgentWorld-* headers with method/path/authority/Content-Digest binding for cross-endpoint replay resistance. Server verifies v0.2 header signatures when present, falling back to legacy body-only signatures for backward compatibility.
