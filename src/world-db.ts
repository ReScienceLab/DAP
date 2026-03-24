import * as fs from "fs"
import * as path from "path"
import { DiscoveredWorldRecord, Endpoint } from "./types"

interface WorldStore {
  version: number
  worlds: Record<string, DiscoveredWorldRecord>
}

let dbPath: string
let store: WorldStore = { version: 1, worlds: {} }
let _saveTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 1000

function load(): void {
  if (fs.existsSync(dbPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(dbPath, "utf-8"))
      store = {
        version: 1,
        worlds: typeof raw?.worlds === "object" && raw.worlds ? raw.worlds : {},
      }
    } catch {
      store = { version: 1, worlds: {} }
    }
  } else {
    store = { version: 1, worlds: {} }
  }
}

function saveImmediate(): void {
  if (_saveTimer) {
    clearTimeout(_saveTimer)
    _saveTimer = null
  }
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2))
}

function save(): void {
  if (_saveTimer) return
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    fs.writeFileSync(dbPath, JSON.stringify(store, null, 2))
  }, SAVE_DEBOUNCE_MS)
}

export function initWorldDb(dataDir: string): void {
  dbPath = path.join(dataDir, "worlds.json")
  load()
}

export function flushWorldDb(): void {
  if (_saveTimer) saveImmediate()
}

export function listWorlds(): DiscoveredWorldRecord[] {
  return Object.values(store.worlds).sort((a, b) => b.lastSeen - a.lastSeen)
}

export function getWorld(worldId: string): DiscoveredWorldRecord | null {
  return store.worlds[worldId] ?? null
}

export function getWorldBySlug(slug: string): DiscoveredWorldRecord | null {
  return listWorlds().find((world) => world.slug === slug) ?? null
}

export function upsertWorld(
  worldId: string,
  opts: {
    slug?: string
    publicKey?: string
    endpoints?: Endpoint[]
    lastSeen?: number
    source?: "gateway" | "gossip" | "manual"
    discoveredVia?: string
  } = {}
): void {
  const now = Date.now()
  const existing = store.worlds[worldId]
  const slug = opts.slug ?? existing?.slug ?? worldId

  store.worlds[worldId] = {
    worldId,
    slug,
    publicKey: opts.publicKey ?? existing?.publicKey ?? "",
    endpoints: opts.endpoints ?? existing?.endpoints ?? [],
    lastSeen: opts.lastSeen ?? existing?.lastSeen ?? now,
    source: opts.source ?? existing?.source ?? "gossip",
    discoveredVia: opts.discoveredVia ?? existing?.discoveredVia,
  }

  if (opts.lastSeen === undefined) {
    store.worlds[worldId].lastSeen = now
  }

  save()
}

export function removeWorldRecord(worldId: string): void {
  delete store.worlds[worldId]
  saveImmediate()
}
