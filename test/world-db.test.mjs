import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import {
  initWorldDb,
  flushWorldDb,
  listWorlds,
  getWorld,
  getWorldBySlug,
  upsertWorld,
  removeWorldRecord,
} from "../dist/world-db.js"

describe("world-db", () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "world-db-"))
    initWorldDb(tmpDir)
  })

  afterEach(() => {
    flushWorldDb()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("stores and looks up worlds by worldId and slug", () => {
    upsertWorld("aw:sha256:world-1", {
      slug: "arena",
      publicKey: "pub-1",
      endpoints: [{ transport: "tcp", address: "203.0.113.10", port: 9000, priority: 1, ttl: 3600 }],
      source: "gateway",
    })

    assert.equal(getWorld("aw:sha256:world-1")?.publicKey, "pub-1")
    assert.equal(getWorldBySlug("arena")?.worldId, "aw:sha256:world-1")
  })

  it("persists worlds to worlds.json", () => {
    upsertWorld("aw:sha256:world-2", { slug: "lobby", publicKey: "pub-2", source: "manual" })
    flushWorldDb()

    initWorldDb(tmpDir)
    const worlds = listWorlds()
    assert.equal(worlds.length, 1)
    assert.equal(worlds[0].worldId, "aw:sha256:world-2")
    assert.equal(worlds[0].slug, "lobby")
  })

  it("removes a world record immediately", () => {
    upsertWorld("aw:sha256:world-3", { slug: "sandbox" })
    removeWorldRecord("aw:sha256:world-3")
    assert.equal(getWorld("aw:sha256:world-3"), null)
  })
})
