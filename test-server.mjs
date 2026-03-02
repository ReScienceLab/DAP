/**
 * Local test: run a standalone P2P peer server (Node B).
 * Usage: NODE_ROLE=server P2P_PORT=8099 node test-server.mjs
 */
import { loadOrCreateIdentity, getActualIpv6 } from "./dist/identity.js";
import { initDb } from "./dist/peer-db.js";
import { startPeerServer, getInbox } from "./dist/peer-server.js";
import { mkdirSync } from "fs";
import { join } from "path";

const PORT = parseInt(process.env.P2P_PORT ?? "8099");
const DATA_DIR = join("/tmp", "p2p-node-b");

mkdirSync(DATA_DIR, { recursive: true });

const identity = loadOrCreateIdentity(DATA_DIR);
initDb(DATA_DIR);

const actualIpv6 = getActualIpv6();
if (actualIpv6) identity.yggIpv6 = actualIpv6;

console.log(`[node-b] Agent ID : ${identity.agentId.slice(0, 8)}...`);
console.log(`[node-b] IPv6     : ${identity.yggIpv6}`);
console.log(`[node-b] Starting peer server on [::]:${PORT} (test mode)...`);

await startPeerServer(PORT, { testMode: true });
console.log(`[node-b] Ready. Waiting for messages... (Ctrl+C to stop)`);

// Print inbox every 3s
setInterval(() => {
  const msgs = getInbox();
  if (msgs.length > 0) {
    const m = msgs[0];
    console.log(`\n[node-b] *** RECEIVED MESSAGE ***`);
    console.log(`[node-b]   from   : ${m.fromYgg}`);
    console.log(`[node-b]   content: "${m.content}"`);
    console.log(`[node-b]   event  : ${m.event}`);
    console.log(`[node-b]   verified: ${m.verified}`);
  }
}, 3000);
