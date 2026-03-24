import type { WorldRecord } from "./types.js"

export class WorldDb {
  private worlds = new Map<string, WorldRecord>()

  upsert(
    worldId: string,
    opts: Partial<Omit<WorldRecord, "worldId">> = {}
  ): void {
    const existing = this.worlds.get(worldId)
    this.worlds.set(worldId, {
      worldId,
      slug: opts.slug ?? existing?.slug ?? worldId,
      publicKey: opts.publicKey ?? existing?.publicKey ?? "",
      endpoints: opts.endpoints ?? existing?.endpoints ?? [],
      lastSeen: opts.lastSeen ?? existing?.lastSeen ?? Date.now(),
    })
  }

  get(worldId: string): WorldRecord | undefined {
    return this.worlds.get(worldId)
  }

  getBySlug(slug: string): WorldRecord | undefined {
    return [...this.worlds.values()].find((world) => world.slug === slug)
  }

  list(): WorldRecord[] {
    return [...this.worlds.values()].sort((a, b) => b.lastSeen - a.lastSeen)
  }

  delete(worldId: string): void {
    this.worlds.delete(worldId)
  }

  get size(): number {
    return this.worlds.size
  }
}
