---
"@resciencelab/agent-world-sdk": major
---

Implement domain-separated signatures to prevent cross-context replay attacks

This is a BREAKING CHANGE that implements AgentWire-style domain separation across all signing contexts.

## Security Improvements

- **Prevents cross-context replay attacks**: Signatures valid in one context (e.g., HTTP requests) cannot be replayed in another context (e.g., Agent Cards)
- **Adds 7 domain separators**: HTTP_REQUEST, HTTP_RESPONSE, AGENT_CARD, KEY_ROTATION, ANNOUNCE, MESSAGE, WORLD_STATE
- **Format**: `"AgentWorld-{Context}-{VERSION}\0"` (includes null byte terminator to prevent JSON confusion)

## Breaking Changes

### Signature Format
All signatures now include a domain-specific prefix before the payload:
```
message = DomainSeparator + JSON.stringify(canonicalize(payload))
signature = Ed25519(message, secretKey)
```

### Affected APIs
- `signHttpRequest()` - Now uses `DOMAIN_SEPARATORS.HTTP_REQUEST`
- `verifyHttpRequestHeaders()` - Verifies with domain separation
- `signHttpResponse()` - Now uses `DOMAIN_SEPARATORS.HTTP_RESPONSE`
- `verifyHttpResponseHeaders()` - Verifies with domain separation
- `buildSignedAgentCard()` - Agent Card JWS now prepends `DOMAIN_SEPARATORS.AGENT_CARD`
- Peer protocol (announce, message, key-rotation) - All use context-specific separators

### New Exports
- `DOMAIN_SEPARATORS` - Constant object with all 7 domain separators
- `signWithDomainSeparator(separator, payload, secretKey)` - Low-level signing function
- `verifyWithDomainSeparator(separator, publicKey, payload, signature)` - Low-level verification function

## Migration Guide

### For Signature Verification
Existing signatures created before this change will NOT verify. All agents must upgrade simultaneously or use a coordinated rollout strategy.

### For Custom Signing
If you were using `signPayload()` or `verifySignature()` directly, migrate to domain-separated versions:

**Before:**
```typescript
const sig = signPayload(payload, secretKey);
const valid = verifySignature(publicKey, payload, sig);
```

**After:**
```typescript
const sig = signWithDomainSeparator(DOMAIN_SEPARATORS.MESSAGE, payload, secretKey);
const valid = verifyWithDomainSeparator(DOMAIN_SEPARATORS.MESSAGE, publicKey, payload, sig);
```

## Agent Card Capability
Agent Cards now advertise `"domain-separated-signatures"` capability in the conformance block.

## Verification
All existing tests pass + 19 new domain separation security tests covering cross-context replay attack prevention.
