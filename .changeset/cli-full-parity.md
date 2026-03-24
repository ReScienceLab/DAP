---
"@resciencelab/agent-world-network": minor
---

feat(cli): add join/leave/ping/send commands for full plugin parity

The standalone AWN CLI (`awn`) now exposes all capabilities available in the OpenClaw plugin:

- `awn join <world_id|slug|host:port>` — join a world by ID, slug, or direct address; resolves via Gateway and sends a signed `world.join` P2P message
- `awn leave <world_id>` — send `world.leave` and remove from joined list
- `awn joined` — list currently joined worlds
- `awn ping <agent_id>` — check reachability of a known agent
- `awn send <agent_id> <message>` — send a signed `chat` P2P message to an agent

Adds `sign_http_request()` and `build_signed_p2p_message()` helpers to `crypto.rs` (wire-compatible with the TypeScript plugin). The daemon gains a `joined_worlds` state map and five new IPC routes.
