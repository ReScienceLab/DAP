import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import * as os from "node:os"
import * as fs from "node:fs"
import * as path from "node:path"

const nacl = (await import("tweetnacl")).default

// Import from dist
const { startPeerServer, stopPeerServer } = await import("../dist/peer-server.js")
const { initDb } = await import("../dist/peer-db.js")
const { signMessage, agentIdFromPublicKey } = await import("../dist/identity.js")

function makeKeypair() {
  const kp = nacl.sign.keyPair()
  const pubB64 = Buffer.from(kp.publicKey).toString("base64")
  const privB64 = Buffer.from(kp.secretKey.slice(0, 32)).toString("base64")
  const agentId = agentIdFromPublicKey(pubB64)
  return { publicKey: pubB64, privateKey: privB64, agentId }
}

function signRotation(privB64, payload) {
  return signMessage(privB64, payload)
}

describe("key rotation endpoint", () => {
  let port
  let tmpDir

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dap-kr-test-"))
    initDb(tmpDir)
    port = 18099
    await startPeerServer(port, { testMode: true })
  })

  after(async () => {
    await stopPeerServer()
    fs.rmSync(tmpDir, { recursive: true })
  })

  test("accepts valid key rotation", async () => {
    const oldKey = makeKeypair()
    const newKey = makeKeypair()

    const payload = {
      agentId: oldKey.agentId,
      oldPublicKey: oldKey.publicKey,
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }

    const body = {
      ...payload,
      signatureByOldKey: signRotation(oldKey.privateKey, payload),
      signatureByNewKey: signRotation(newKey.privateKey, payload),
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(resp.status, 200)
    const json = await resp.json()
    assert.equal(json.ok, true)
  })

  test("rejects invalid old key signature", async () => {
    const oldKey = makeKeypair()
    const newKey = makeKeypair()
    const wrongKey = makeKeypair()

    const payload = {
      agentId: oldKey.agentId,
      oldPublicKey: oldKey.publicKey,
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }

    const body = {
      ...payload,
      signatureByOldKey: signRotation(wrongKey.privateKey, payload), // wrong!
      signatureByNewKey: signRotation(newKey.privateKey, payload),
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(resp.status, 403)
  })

  test("rejects mismatched agentId", async () => {
    const oldKey = makeKeypair()
    const newKey = makeKeypair()
    const otherKey = makeKeypair()

    const payload = {
      agentId: otherKey.agentId, // doesn't match oldPublicKey
      oldPublicKey: oldKey.publicKey,
      newPublicKey: newKey.publicKey,
      timestamp: Date.now(),
    }

    const body = {
      ...payload,
      signatureByOldKey: signRotation(oldKey.privateKey, payload),
      signatureByNewKey: signRotation(newKey.privateKey, payload),
    }

    const resp = await fetch(`http://[::1]:${port}/peer/key-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(resp.status, 400)
  })
})
