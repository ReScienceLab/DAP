/**
 * Identity management: Ed25519 keypair generation and agent ID derivation.
 *
 * The Ed25519 keypair is the single source of truth for agent identity.
 * Everything else — network addresses, transport protocols — is transient.
 */
import * as nacl from "tweetnacl"
import { sha256 } from "@noble/hashes/sha256"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { Identity } from "./types"

// ── did:key mapping ─────────────────────────────────────────────────────────

const MULTICODEC_ED25519_PREFIX = Buffer.from([0xed, 0x01])
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

function base58Encode(buf: Buffer): string {
  const digits = [0]
  for (const byte of buf) {
    let carry = byte
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let str = ""
  for (let i = 0; i < buf.length && buf[i] === 0; i++) str += "1"
  for (let i = digits.length - 1; i >= 0; i--) str += BASE58_ALPHABET[digits[i]]
  return str
}

export function deriveDidKey(publicKeyB64: string): string {
  const pubBytes = Buffer.from(publicKeyB64, "base64")
  const prefixed = Buffer.concat([MULTICODEC_ED25519_PREFIX, pubBytes])
  return `did:key:z${base58Encode(prefixed)}`
}

// ── Core identity ───────────────────────────────────────────────────────────

export function agentIdFromPublicKey(publicKeyB64: string): string {
  const pubBytes = Buffer.from(publicKeyB64, "base64")
  const fullHex = Buffer.from(sha256(pubBytes)).toString("hex")
  return `aw:sha256:${fullHex}`
}

export function generateIdentity(): Identity {
  const keypair = nacl.sign.keyPair()
  const pubBytes = keypair.publicKey
  const privBytes = keypair.secretKey.slice(0, 32)

  const pubB64 = Buffer.from(pubBytes).toString("base64")
  const privB64 = Buffer.from(privBytes).toString("base64")

  return {
    agentId: agentIdFromPublicKey(pubB64),
    publicKey: pubB64,
    privateKey: privB64,
  }
}

export function loadOrCreateIdentity(dataDir: string): Identity {
  const idFile = path.join(dataDir, "identity.json")
  if (fs.existsSync(idFile)) {
    const raw = JSON.parse(fs.readFileSync(idFile, "utf-8"))
    // Migrate missing or legacy 32-char truncated agentId → aw:sha256:<64hex>
    if (!raw.agentId || /^[0-9a-f]{32}$/.test(raw.agentId)) {
      raw.agentId = agentIdFromPublicKey(raw.publicKey)
      fs.writeFileSync(idFile, JSON.stringify(raw, null, 2))
    }
    // Strip legacy Yggdrasil fields if present
    const { cgaIpv6: _cga, yggIpv6: _ygg, ...clean } = raw
    return clean as Identity
  }
  fs.mkdirSync(dataDir, { recursive: true })
  const id = generateIdentity()
  fs.writeFileSync(idFile, JSON.stringify(id, null, 2))
  return id
}

// ── Canonical serialization + signing ───────────────────────────────────────

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = canonicalize((value as Record<string, unknown>)[k])
    }
    return sorted
  }
  return value
}

export function signMessage(privateKeyB64: string, data: Record<string, unknown>): string {
  const privBytes = Buffer.from(privateKeyB64, "base64")
  const privFull = nacl.sign.keyPair.fromSeed(privBytes)
  const msg = Buffer.from(JSON.stringify(canonicalize(data)))
  const sig = nacl.sign.detached(msg, privFull.secretKey)
  return Buffer.from(sig).toString("base64")
}

export function verifySignature(
  publicKeyB64: string,
  data: Record<string, unknown>,
  signatureB64: string
): boolean {
  try {
    const pubBytes = Buffer.from(publicKeyB64, "base64")
    const sigBytes = Buffer.from(signatureB64, "base64")
    const msg = Buffer.from(JSON.stringify(canonicalize(data)))
    return nacl.sign.detached.verify(msg, sigBytes, pubBytes)
  } catch {
    return false
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────

/**
 * Returns true if addr is a globally-routable unicast IPv6 address (2000::/3).
 */
export function isGlobalUnicastIPv6(addr: string): boolean {
  if (!addr || !addr.includes(":")) return false
  const clean = addr.replace(/^::ffff:/i, "").toLowerCase()
  if (clean === "::1") return false
  if (clean.startsWith("fe80:")) return false
  if (clean.startsWith("fc") || clean.startsWith("fd")) return false
  const first = parseInt(clean.split(":")[0].padStart(4, "0"), 16)
  return first >= 0x2000 && first <= 0x3fff
}

/**
 * Returns the first globally-routable public IPv6 address on any interface.
 */
export function getPublicIPv6(): string | null {
  const ifaces = os.networkInterfaces()
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === "IPv6" && !info.internal && isGlobalUnicastIPv6(info.address)) {
        return info.address
      }
    }
  }
  return null
}

/**
 * Returns the first non-loopback, non-link-local IPv6 address on any interface.
 */
export function getActualIpv6(): string | null {
  const ifaces = os.networkInterfaces()
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === "IPv6" && !info.internal && !info.address.startsWith("fe80:")) {
        return info.address
      }
    }
  }
  return null
}
