---
"@resciencelab/dap": minor
---

Remove Yggdrasil dependency. DAP now uses plain HTTP over TCP as its primary transport (with QUIC as an optional fast transport). This eliminates the need to install and run a Yggdrasil daemon, reducing agent onboarding to installing the plugin only.

Breaking changes:
- `PluginConfig.yggdrasil_peers` removed — use `bootstrap_peers` with plain HTTP addresses
- `PluginConfig.test_mode` removed — no longer needed
- `Identity.cgaIpv6` and `Identity.yggIpv6` removed from the type
- `BootstrapNode.yggAddr` replaced with `addr` (plain hostname or IP)
- `isYggdrasilAddr()` removed from `peer-server`
- `DEFAULT_BOOTSTRAP_PEERS` is now empty — bootstrap addresses will be added to `docs/bootstrap.json` once AWS nodes are configured with public HTTP endpoints
- `startup_delay_ms` default reduced from 30s to 5s
- `yggdrasil_check` agent tool removed
- `openclaw p2p setup` CLI command removed
