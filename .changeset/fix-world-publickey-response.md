---
"@resciencelab/agent-world-network": patch
---

Fix gateway /world/:worldId response missing publicKey field. join_world(world_id=...) was always failing with "World public key is unavailable; cannot verify signed membership refreshes" because the publicKey was stored on announce but omitted from the world record response.
