import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { TransportManager } from "../dist/transport.js"

const baseId = { agentId: "", publicKey: "", privateKey: "" }

describe("TransportManager", () => {
  it("exports TransportManager class", () => {
    assert.ok(TransportManager)
    assert.equal(typeof TransportManager, "function")
  })

  it("starts with no active transport", () => {
    const tm = new TransportManager()
    assert.equal(tm.active, null)
  })

  it("returns empty endpoints when no transports registered", () => {
    const tm = new TransportManager()
    assert.deepEqual(tm.getEndpoints(), [])
  })

  it("returns empty array from getAll when no transports active", () => {
    const tm = new TransportManager()
    assert.deepEqual(tm.getAll(), [])
  })

  it("register adds transport to internal list", async () => {
    const tm = new TransportManager()
    const mock = {
      id: "quic",
      address: "",
      start: async () => false,
      stop: async () => {},
      isActive: () => false,
      send: async () => {},
      onMessage: () => {},
      getEndpoint: () => ({ transport: "quic", address: "", port: 8098, priority: 10, ttl: 3600 }),
    }
    tm.register(mock)
    const active = await tm.start(baseId)
    assert.equal(active, null)
  })

  it("selects first successful transport as active", async () => {
    const tm = new TransportManager()
    const failTransport = {
      id: "tcp",
      address: "",
      start: async () => false,
      stop: async () => {},
      isActive: () => false,
      send: async () => {},
      onMessage: () => {},
      getEndpoint: () => ({ transport: "tcp", address: "", port: 8099, priority: 1, ttl: 86400 }),
    }
    const successTransport = {
      id: "quic",
      address: "1.2.3.4:8098",
      start: async () => true,
      stop: async () => {},
      isActive: () => true,
      send: async () => {},
      onMessage: () => {},
      getEndpoint: () => ({ transport: "quic", address: "1.2.3.4:8098", port: 8098, priority: 10, ttl: 3600 }),
    }
    tm.register(failTransport)
    tm.register(successTransport)
    const active = await tm.start(baseId)
    assert.equal(active.id, "quic")
    assert.equal(active.address, "1.2.3.4:8098")
  })

  it("returns all active transports from getAll", async () => {
    const tm = new TransportManager()
    const t1 = {
      id: "tcp",
      address: "10.0.0.1",
      start: async () => true,
      stop: async () => {},
      isActive: () => true,
      send: async () => {},
      onMessage: () => {},
      getEndpoint: () => ({ transport: "tcp", address: "10.0.0.1", port: 8099, priority: 1, ttl: 86400 }),
    }
    const t2 = {
      id: "quic",
      address: "1.2.3.4:8098",
      start: async () => true,
      stop: async () => {},
      isActive: () => true,
      send: async () => {},
      onMessage: () => {},
      getEndpoint: () => ({ transport: "quic", address: "1.2.3.4:8098", port: 8098, priority: 10, ttl: 3600 }),
    }
    tm.register(t1)
    tm.register(t2)
    await tm.start(baseId)
    assert.equal(tm.getAll().length, 2)
    assert.equal(tm.get("tcp").id, "tcp")
    assert.equal(tm.get("quic").id, "quic")
  })

  it("getEndpoints returns endpoints for all active transports", async () => {
    const tm = new TransportManager()
    const t1 = {
      id: "tcp",
      address: "10.0.0.1",
      start: async () => true,
      stop: async () => {},
      isActive: () => true,
      send: async () => {},
      onMessage: () => {},
      getEndpoint: () => ({ transport: "tcp", address: "10.0.0.1", port: 8099, priority: 1, ttl: 86400 }),
    }
    tm.register(t1)
    await tm.start(baseId)
    const endpoints = tm.getEndpoints()
    assert.equal(endpoints.length, 1)
    assert.equal(endpoints[0].transport, "tcp")
    assert.equal(endpoints[0].address, "10.0.0.1")
    assert.equal(endpoints[0].priority, 1)
  })

  it("resolveTransport picks quic for host:port addresses", () => {
    const tm = new TransportManager()
    const quic = {
      id: "quic",
      address: "1.2.3.4:8098",
      start: async () => true,
      stop: async () => {},
      isActive: () => true,
      send: async () => {},
      onMessage: () => {},
      getEndpoint: () => ({ transport: "quic", address: "1.2.3.4:8098", port: 8098, priority: 10, ttl: 3600 }),
    }
    tm.register(quic)
    tm.start(baseId).then(() => {
      const resolved = tm.resolveTransport("1.2.3.4:8098")
      assert.equal(resolved?.id, "quic")
    })
  })

  it("stop clears all transports", async () => {
    const tm = new TransportManager()
    let stopped = false
    const t = {
      id: "quic",
      address: "1.2.3.4:8098",
      start: async () => true,
      stop: async () => { stopped = true },
      isActive: () => true,
      send: async () => {},
      onMessage: () => {},
      getEndpoint: () => ({ transport: "quic", address: "1.2.3.4:8098", port: 8098, priority: 10, ttl: 3600 }),
    }
    tm.register(t)
    await tm.start(baseId)
    assert.equal(tm.active?.id, "quic")
    await tm.stop()
    assert.equal(tm.active, null)
    assert.equal(stopped, true)
  })
})
