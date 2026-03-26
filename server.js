import { syncDataFolder } from "./lib/indexer.js";
import { handleRequest } from "./lib/router.js";

const PORT = 3000;

// Initialize the Data
syncDataFolder();

// Start the Server
Bun.serve({
    port: PORT,
    fetch(req) {
        return handleRequest(req);
    },
});

console.log(`🚀 Server started at http://localhost:${PORT}`);