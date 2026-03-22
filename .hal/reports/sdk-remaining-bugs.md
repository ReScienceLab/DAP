# Agent World SDK — Remaining Bug Fixes

## Summary

Five remaining bugs in `packages/agent-world-sdk/src/` need fixing. BUG-1 (broadcast leak) was already fixed. This report covers the rest.

## Priority Item

Fix all remaining SDK bugs: base58 codec, key rotation validation, domain separator mismatch, ledger dead code, and Fastify reply pattern.

## Bugs

### BUG-2 [MEDIUM] — base58Encode/Decode incorrect for leading-zero inputs

**Files:** `packages/agent-world-sdk/src/identity.ts` (lines 12-25), `packages/agent-world-sdk/src/peer-protocol.ts` (lines 343-360)

**Root cause:** `base58Encode` in identity.ts starts with `digits = [0]` and always emits `BASE58_ALPHABET[digits[i]]` for every digit including the trailing zero. Combined with the leading-zero `"1"` prefix loop, `Buffer.from([0])` encodes to `"11"` instead of `"1"`. The `base58Decode` in peer-protocol.ts has a mirror issue: `"1"` decodes to `[0, 0]` instead of `[0]`.

**Confirmed reproduction:**
- encode `[0]` → `"11"` (should be `"1"`)
- encode `[0,0]` → `"111"` (should be `"11"`)
- decode `"1"` → `[0, 0]` (should be `[0]`)

**Fix for base58Encode in identity.ts:**
After the main encoding loop, skip high-order zero digits before emitting characters:
```typescript
let str = ""
for (let i = 0; i < buf.length && buf[i] === 0; i++) str += "1"
let k = digits.length - 1
while (k >= 0 && digits[k] === 0) k--
for (let i = k; i >= 0; i--) str += BASE58_ALPHABET[digits[i]]
return str
```

**Fix for base58Decode in peer-protocol.ts:**
Strip trailing zero bytes from the numeric result before prepending leading zeros:
```typescript
let leadingOnes = 0;
for (const char of str) {
  if (char === "1") leadingOnes++;
  else break;
}
let k = bytes.length - 1;
while (k >= 0 && bytes[k] === 0) k--;
const numericBytes = bytes.slice(0, k + 1).reverse();
const result = new Uint8Array(leadingOnes + numericBytes.length);
result.set(numericBytes, leadingOnes);
return result;
```

**Tests needed:** Add unit tests for base58 round-trip with edge cases: `[0]`, `[0,0]`, `[0,1]`, `[1,0]`, `[1]`, `[0,0,1]`. Verify encode→decode round-trip produces original input. Also verify `deriveDidKey` and `toPublicKeyMultibase` still produce correct results for Ed25519 keys after the fix.

---

### BUG-3 [MEDIUM] — Key rotation does not validate newAgentId ↔ newPublicKey binding

**File:** `packages/agent-world-sdk/src/peer-protocol.ts` (around line 279)

**Root cause:** The `/peer/key-rotation` handler verifies `oldAgentId` matches `oldPublicKey` via `agentIdFromPublicKey()`, but never checks that `newAgentId` matches `newPublicKey`. An attacker can submit a rotation request with arbitrary `newAgentId` metadata.

**Fix:** Add this validation after the existing `oldAgentId` check (around line 283):
```typescript
if (agentIdFromPublicKey(newPublicKeyB64) !== rot.newAgentId) {
  return reply.code(400).send({ error: "newAgentId does not match newPublicKey" });
}
```

**Tests needed:** Add a test case that submits a key rotation request where `newAgentId` does not match the derived agentId from `newPublicKey`. Expect 400 response with appropriate error message.

---

### BUG-4 [LOW] — world.state body signature domain separator mismatch

**File:** `packages/agent-world-sdk/src/world-server.ts` (in `broadcastWorldState()` function, around line 279)

**Root cause:** `broadcastWorldState()` signs the body payload with `DOMAIN_SEPARATORS.WORLD_STATE`, but the receiving `/peer/message` endpoint in `peer-protocol.ts` (around line 183) uses `DOMAIN_SEPARATORS.MESSAGE` for body-level signature verification. If a world.state message arrives without HTTP header signing, the body signature will always fail verification.

**Fix:** Change the domain separator in `broadcastWorldState()` from `WORLD_STATE` to `MESSAGE`:
```typescript
// In broadcastWorldState():
payload["signature"] = signWithDomainSeparator(
  DOMAIN_SEPARATORS.MESSAGE,  // was DOMAIN_SEPARATORS.WORLD_STATE
  payload,
  identity.secretKey
);
```

**Tests needed:** Add a test that sends a world.state message using only body-level signing (no HTTP headers) and verifies it is accepted by the /peer/message endpoint.

---

### BUG-5 [LOW] — LEDGER_DOMAIN dead code + LEDGER_SEPARATOR fragile construction

**File:** `packages/agent-world-sdk/src/world-ledger.ts` (lines 9-10)

**Root cause:**
1. `LEDGER_DOMAIN` is declared but never used anywhere — it's dead code.
2. `LEDGER_SEPARATOR` is constructed by string-splitting `DOMAIN_SEPARATORS.MESSAGE` to extract the version, which is fragile and confusing. It should use `PROTOCOL_VERSION` directly.

**Fix:**
1. Remove the `LEDGER_DOMAIN` line entirely.
2. Replace `LEDGER_SEPARATOR` with:
```typescript
import { PROTOCOL_VERSION } from "./version.js"
const LEDGER_SEPARATOR = `AgentWorld-Ledger-${PROTOCOL_VERSION}\0`
```
3. Make sure the import of `PROTOCOL_VERSION` is added at the top of the file.

**Tests needed:** Verify existing WorldLedger tests still pass (hash chain verification, signature verification). The separator value should be identical before and after the refactor, so no behavioral change is expected.

---

### BUG-6 [LOW] — Fastify async handler implicit undefined return after reply.send()

**File:** `packages/agent-world-sdk/src/peer-protocol.ts` (around line 223, in the `/peer/message` handler)

**Root cause:** When `onMessage` callback calls `sendReply` (which invokes `reply.send()`), the async handler function returns `undefined` implicitly. Fastify 5 docs recommend `return reply` after calling `reply.send()` in async handlers to avoid potential race conditions.

The current code:
```typescript
if (onMessage) {
  let replied = false;
  await onMessage(agentId, msg.event as string, content, (body, statusCode) => {
    replied = true;
    if (statusCode) reply.code(statusCode);
    reply.send(body);
  });
  if (!replied) return { ok: true };
  // ← implicit undefined return when replied=true
}
```

**Fix:** Add explicit `return reply` after the onMessage block:
```typescript
if (!replied) return { ok: true };
return reply;
```

**Tests needed:** Verify existing /peer/message tests still pass. No behavioral change expected.

## Recommendations

1. Fix BUG-2 and BUG-3 first — they are correctness issues in crypto/identity code.
2. Fix BUG-4, BUG-5, BUG-6 as protocol hardening.
3. All existing tests must continue to pass after fixes.
4. Run `npm --prefix packages/agent-world-sdk run build` and `node --test test/*.test.mjs` to validate.
