import { syncDataFolder, updateFile, deleteFile } from "./lib/indexer.js";
import { handleRequest } from "./lib/router.js";
import { watch, existsSync } from "node:fs";

const PORT = 3000;
const DATA_DIR = "./data";

// 1. Initial Full Sync on Startup
console.log("🔄 Initializing data sync...");
syncDataFolder();

// 2. Start the Background File Watcher
// Cooldown Map to prevent duplicate events from fs.watch
const cooldowns = new Map();
const COOLDOWN_MS = 100;

console.log(`👀 Watching for changes in ${DATA_DIR}...`);
watch(DATA_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith(".md")) return;

    const id = filename.replace(".md", "");
    const filePath = `${DATA_DIR}/${filename}`;

    // Simple debounce/cooldown
    const now = Date.now();
    if (cooldowns.has(id) && (now - cooldowns.get(id)) < COOLDOWN_MS) return;
    cooldowns.set(id, now);

    if (existsSync(filePath)) {
        // File created or modified
        updateFile(id);
    } else {
        // File deleted
        deleteFile(id);
    }
});

// 3. Start the Server
Bun.serve({
    port: PORT,
    fetch(req) {
        return handleRequest(req);
    },
});

console.log(`🚀 Server started at http://localhost:${PORT}`);
