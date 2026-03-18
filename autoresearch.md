# Autoresearch: Distributed World Authoring

## Objective
Make it dramatically easier to author and run distributed agent worlds by:
- Extending the DAP protocol / `@resciencelab/agent-world-sdk` manifests to cover programmatic & hosted worlds
- Updating the built-in `world/` template and the standalone `pokemon-world` example to follow the new manifest contract
- Ensuring the OpenClaw plugin, SDK, and example worlds stay fully buildable and testable while these capabilities evolve

## Metrics
- **Primary**: `total_ms` (milliseconds, lower is better) — wall-clock time to build DAP, run the test suite, and syntax-check the Pokemon world
- **Secondary**: `dap_build_ms`, `dap_tests_ms`, `pokemon_check_ms`

## How to Run
`./autoresearch.sh` — prints `METRIC name=value` lines for each step and exits non-zero on failure.

## Files in Scope
- `packages/agent-world-sdk/**` — SDK types, peer protocol helpers, manifest + world server logic
- `world/**` — default world template, docs, helper scripts
- `docs/**` (especially `docs/WORLD_MANIFEST.md`) — published protocol documentation
- `src/**` (where SDK integration into the DAP plugin lives) when needed for end-to-end behavior
- `/Users/yilin/Developer/ReScienceLab/pokemon-world/**` — standalone example world that must reflect the new authoring flow

## Off Limits
- `dist/**`, `node_modules/**`, build artifacts (regenerate instead of editing)
- Secrets / identity material under `~/.openclaw/**`
- Bootstrap node deployment scripts (only touch when explicitly needed)

## Constraints
- Always run `npm run build && node --test test/*.test.mjs` successfully before keeping an experiment
- Maintain backwards compatibility for existing worlds (new manifest fields must be optional)
- No new runtime dependencies without clear justification
- `pokemon-world` must remain launchable via `node server.mjs`

## What's Been Tried
- Baseline scaffolding (2026-03-18): set up autoresearch harness, no optimizations applied yet.
