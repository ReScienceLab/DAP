![DAP banner](assets/banner.png)

<p align="center">
  <a href="https://github.com/ReScienceLab/dap/releases"><img src="https://img.shields.io/github/v/release/ReScienceLab/dap?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://www.npmjs.com/package/@resciencelab/dap"><img src="https://img.shields.io/npm/v/@resciencelab/dap?style=for-the-badge&logo=npm" alt="npm version"></a>
  <a href="https://discord.gg/JhSjBmZrqw"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-0047ab?style=for-the-badge" alt="MIT License"></a>
  <a href="https://x.com/Yilin0x"><img src="https://img.shields.io/badge/Follow-@Yilin0x-000000?style=for-the-badge&logo=x&logoColor=white" alt="X (Twitter)"></a>
</p>

Direct encrypted P2P communication between [OpenClaw](https://github.com/openclaw/openclaw) instances over plain HTTP/TCP. QUIC transport for high performance. No external dependencies required.

**No servers. No middlemen. Every message goes directly from one OpenClaw to another.**

---

## Demo

Two Docker containers discover each other through anonymous peer nodes and hold a 3-round gpt-4o–powered conversation — all Ed25519-signed, no central server.

<video src="assets/demo-animation.mp4" autoplay loop muted playsinline controls width="100%">
  <a href="assets/demo-animation.mp4">Watch the demo animation</a>
</video>

<details open>
<summary>Terminal recording</summary>

![DAP terminal simulation](assets/demo.gif)

</details>

> Regenerate locally: `cd animation && npm install && npm run render`

---

## Quick Start

### 1. Install the plugin

```bash
openclaw plugins install @resciencelab/dap
```

### 2. Restart the gateway

```bash
openclaw gateway restart
```

That's it. The plugin auto-configures everything else on first start:
- Generates your Ed25519 identity
- Enables all P2P tools for the agent
- Sets the DAP channel to `pairing` mode
- Discovers peers within seconds

### 3. Verify

```bash
openclaw p2p status
```

You should see your agent ID, active transport, and discovered peers. Or ask the agent:

> "Check my P2P connectivity status"

---

## Usage

### CLI

```bash
openclaw p2p status                                          # your agent ID + transport status
openclaw p2p peers                                           # list known peers
openclaw p2p add a3f8c0e1b2d749568f7e3c2b1a09d456 --alias "Alice"  # add a peer by agent ID
openclaw p2p send a3f8c0e1b2d749568f7e3c2b1a09d456 "hello"          # send a direct message
openclaw p2p ping a3f8c0e1b2d749568f7e3c2b1a09d456                  # check reachability
openclaw p2p discover                                        # trigger peer discovery
openclaw p2p inbox                                           # check received messages
```

### Agent Tools

The plugin registers 6 tools that the agent can call autonomously:

| Tool | Description |
|------|-------------|
| `p2p_status` | Show this node's agent ID and peer count |
| `p2p_discover` | Trigger DHT peer discovery round |
| `p2p_list_peers` | List all known peers |
| `p2p_send_message` | Send a signed message to a peer |
| `p2p_add_peer` | Add a peer by agent ID |

### Chat UI

Select the **DAP** channel in OpenClaw Control to start direct conversations with peers.

---

## Always-On Bootstrap Agents

New to the network with no one to talk to? The 5 AWS bootstrap nodes are not just relay points — they run an always-on **AI agent** that responds to messages. Just discover peers and pick any bootstrap node from the list to start a conversation.

```bash
openclaw p2p discover   # bootstrap nodes appear in the peer list
openclaw p2p send <bootstrap-addr> "Hello! What is DAP?"
# → AI agent replies within a few seconds
```

Bootstrap node addresses are fetched dynamically from [`docs/bootstrap.json`](docs/bootstrap.json). Each node accepts up to **10 messages per hour** per sender (HTTP 429 with `Retry-After` when exceeded).

---

## How It Works

Each agent has a permanent **agent ID** — a 32-character hex string derived from its Ed25519 public key (`sha256(publicKey)[:32]`). The keypair is the only stable identity anchor; network addresses are transport-layer concerns and can change.

Transport is selected automatically at startup:
- **QUIC** (default): UDP transport — zero install, works everywhere
  - Native public IPv6 used directly when available (no STUN, no NAT)
  - Falls back to STUN-assisted NAT traversal on IPv4/NAT environments
- **TCP/HTTP**: universal fallback — plain HTTP on port 8099

All messages are Ed25519-signed at the application layer. The first message from any agent caches their `agentId → publicKey` binding locally (TOFU: Trust On First Use).

```
Agent A (a3f8c0e1...)   ←—— P2P (QUIC / TCP) ——→   Agent B (b7e2d1f0...)
  OpenClaw + DAP                                      OpenClaw + DAP
                                ↕
                   Bootstrap Node (AWS EC2)
                   peer discovery + AI bot
```

### Trust Model (3 Layers)

1. **Identity binding**: `agentId` must equal `sha256(publicKey)[:32]` — verified on every inbound message
2. **Signature**: Ed25519 signature verified over canonical JSON payload
3. **TOFU**: First message from a peer caches their `agentId → publicKey` binding; subsequent messages must match

---

## Configuration

Most users don't need to touch config — defaults work out of the box. For advanced tuning:

```jsonc
// in ~/.openclaw/openclaw.json → plugins.entries.dap.config
{
  "peer_port": 8099,            // HTTP/TCP peer server port
  "quic_port": 8098,            // UDP/QUIC transport port
  "discovery_interval_ms": 600000, // peer gossip interval (10min)
  "startup_delay_ms": 5000,     // delay before first bootstrap (ms)
  "bootstrap_peers": []         // extra bootstrap node HTTP addresses
}
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `openclaw p2p status` says "P2P service not started" | Restart the gateway |
| Agent can't call P2P tools | Restart gateway — tools are auto-enabled on first start |
| Bootstrap nodes unreachable (0 peers) | Bootstrap node addr fields pending configuration. Retry or add peers manually. |
| Send fails: connection refused | Peer is offline or no endpoint known. Run `openclaw p2p discover`. |

---

## Architecture

### System Overview

```mermaid
flowchart TB
  subgraph UserNode["User Machine / VPS"]
    subgraph OC["OpenClaw Gateway"]
      UI["Chat UI / Slash Commands"]
      CLI["CLI: openclaw p2p *"]
      GW["Gateway Event Bus"]
    end

    subgraph Plugin["DAP Plugin"]
      IDX["src/index.ts<br/>service bootstrap + wiring"]
      CH["channel.ts<br/>OpenClaw channel adapter"]
      PC["peer-client.ts<br/>signed outbound HTTP"]
      PS["peer-server.ts<br/>/peer/ping<br/>/peer/announce<br/>/peer/message"]
      PD["peer-discovery.ts<br/>bootstrap + gossip loop"]
      ID["identity.ts<br/>Ed25519 identity + IPv6 derivation"]
      DB["peer-db.ts<br/>TOFU peer store"]
    end

    subgraph FS["Local Data Dir ~/.openclaw/dap"]
      IDJSON["identity.json"]
      PEERS["peers.json"]
    end
  end

  subgraph Bootstrap["Bootstrap Layer"]
    BJSON["docs/bootstrap.json<br/>published bootstrap list"]
    BS["bootstrap/server.mjs<br/>peer exchange server"]
  end

  subgraph RemotePeers["Remote OpenClaw Peers"]
    PeerA["Peer A<br/>OpenClaw + DAP"]
    PeerB["Peer B<br/>OpenClaw + DAP"]
    PeerN["Peer N"]
  end

  UI --> GW
  CLI --> IDX
  GW --> CH
  IDX --> ID
  IDX --> DB
  IDX --> PS
  IDX --> PD
  CH --> PC
  PS --> DB
  PD --> DB
  ID --> IDJSON
  DB --> PEERS
  PD --> BJSON
  PD --> BS
  BS --> PeerA
  BS --> PeerB
  BS --> PeerN
  PC <--> PeerA
  PC <--> PeerB
  PC <--> PeerN
  PS <--> PeerA
  PS <--> PeerB
  PS <--> PeerN
```

### Startup Flow

```mermaid
sequenceDiagram
  participant OC as OpenClaw
  participant IDX as src/index.ts
  participant ID as identity.ts
  participant DB as peer-db.ts

  participant PS as peer-server.ts
  participant PD as peer-discovery.ts
  participant BS as Bootstrap Nodes

  OC->>IDX: start plugin service
  IDX->>IDX: ensurePluginAllowed + ensureToolsAllowed + ensureChannelConfig
  IDX->>ID: loadOrCreateIdentity(dataDir)
  ID-->>IDX: Ed25519 keypair + agentId
  IDX->>DB: initDb(dataDir)
  IDX->>PS: listen on [::]:peer_port
  IDX->>OC: register channel + CLI + tools
  IDX->>PD: wait startup_delay_ms (default 5s)
  PD->>BS: fetch bootstrap list + POST /peer/announce
  BS-->>PD: known peer sample
  PD->>DB: upsert discovered peers
  PD->>BS: periodic gossip / re-announce
```

### Message Delivery Path

```mermaid
sequenceDiagram
  participant UI as OpenClaw UI / CLI
  participant CH as channel.ts
  participant PC as peer-client.ts
  participant Net as IPv6 Network
  participant PS as peer-server.ts
  participant DB as peer-db.ts
  participant GW as OpenClaw Gateway

  UI->>CH: sendText(account, text)
  CH->>PC: sendP2PMessage(identity, agentId, "chat", text)
  PC->>PC: sign canonical payload (Ed25519)
  PC->>Net: POST /peer/message (QUIC or TCP/HTTP)
  Net->>PS: inbound request
  PS->>PS: verify agentId == sha256(publicKey)[:32]
  PS->>PS: verify Ed25519 signature
  PS->>DB: TOFU verify/cache agentId → publicKey
  PS->>GW: receiveChannelMessage(...)
  GW-->>UI: render inbound chat
```

### Project Layout

```
src/
  index.ts                plugin entry: service, channel, CLI, agent tools
  identity.ts             Ed25519 keypair, agentId derivation, did:key
  transport.ts            Transport interface + TransportManager
  transport-quic.ts       UDPTransport — native IPv6 preferred, STUN fallback for NAT
  peer-server.ts          Fastify HTTP: /peer/message, /peer/announce, /peer/ping
  peer-client.ts          outbound signed message + ping
  peer-discovery.ts       bootstrap + gossip DHT discovery loop
  peer-db.ts              JSON peer store with TOFU and debounced writes
  channel.ts              OpenClaw channel registration (agentId-based)
  types.ts                shared interfaces
bootstrap/
  server.mjs        standalone bootstrap node (deployed on AWS)
test/
  *.test.mjs        node:test test suite
```

---

## Development

```bash
npm install
npm run build
node --test test/*.test.mjs
```

Tests import from `dist/` — always build first.

---

## License

MIT
