import { syncDataFolder, updateFile, deleteFile } from "./lib/indexer.js";
import { handleRequest, broadcastReload } from "./lib/router.js";
import { watch, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import db from "./lib/db.js";
import { CONFIG } from "./lib/config.js";
import { stringifyMarkdown, parseMarkdown } from "./lib/parser.js";
import { rebuildConfigCache } from "./lib/class-config.js";

const PORT = 3000;
const DATA_DIR = "./data";

// 0. Bootstrap Default Configurations
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

const settingsPath = `${DATA_DIR}/${CONFIG.SETTINGS_ID}.md`;
if (!existsSync(settingsPath)) {
    const defaultSettingsMetadata = {
        title: "Application Settings",
        class: "settings",
        sidebarWidth: 250,
        ollamaHost: CONFIG.DEFAULT_OLLAMA_HOST,
        autoEdit: false,
        autoShowProperties: false,
        quickAddPromptId: CONFIG.DEFAULT_QUICK_ADD_PROMPT_ID
    };
    const defaultSettingsContent = "System settings for the Atomic PKM app. You can modify the frontmatter properties above to customize your experience.";
    writeFileSync(settingsPath, stringifyMarkdown(defaultSettingsMetadata, defaultSettingsContent), "utf-8");
    console.log(`Created default settings file at ${settingsPath}`);
} else {
    // If settings.md already exists, merge missing quickAddPromptId and clean up obsolete props
    try {
        const raw = readFileSync(settingsPath, "utf-8");
        const { metadata, content } = parseMarkdown(raw);
        let updated = false;
        
        if (!metadata.quickAddPromptId) {
            metadata.quickAddPromptId = CONFIG.DEFAULT_QUICK_ADD_PROMPT_ID;
            updated = true;
        }
        if (metadata.hasOwnProperty("quickAddModel")) {
            delete metadata.quickAddModel;
            updated = true;
        }
        if (metadata.hasOwnProperty("quickAddTemperature")) {
            delete metadata.quickAddTemperature;
            updated = true;
        }
        if (metadata.hasOwnProperty("quickAddPrompt")) {
            delete metadata.quickAddPrompt;
            updated = true;
        }
        
        if (updated) {
            writeFileSync(settingsPath, stringifyMarkdown(metadata, content), "utf-8");
            console.log(`Updated settings file at ${settingsPath} with quickAddPromptId.`);
        }
    } catch (e) {
        console.error("Error checking/updating settings.md default fields:", e);
    }
}

// Bootstrap prompt-quick-add.md
const promptPath = `${DATA_DIR}/${CONFIG.DEFAULT_QUICK_ADD_PROMPT_ID}.md`;
if (!existsSync(promptPath)) {
    const defaultPromptMetadata = {
        title: "AI Quick Add Prompt",
        class: "system-prompt",
        model: CONFIG.DEFAULT_MODEL,
        temperature: CONFIG.DEFAULT_TEMPERATURE
    };
    const defaultPromptContent = `You are a Personal Knowledge Management (PKM) assistant. Your job is to parse a raw natural language input and output a structured JSON response.

You must reply with a JSON object containing the following structure:
{
  "title": "A short, descriptive title for the note",
  "class": "The category/class of the note (e.g. note, task, contact, credential, golf)",
  "content": "A clean, nicely formatted Markdown body for the note.",
  "properties": {
    "key1": "value1",
    "key2": "value2"
  },
  "tags": ["tag1", "tag2"]
}

Guidelines:
1. "properties" should contain metadata fields (e.g., date, value, gate_code, location). If the input mentions a specific code/value/number, extract it into a property. If the class is "task", include properties like "status: open", "due: YYYY-MM-DD" if applicable.
2. Do not include metadata like "title", "class", "tags" inside the "properties" object.
3. Keep the content concise and focused. Do not repeat the properties in the content if they are already clear.`;
    writeFileSync(promptPath, stringifyMarkdown(defaultPromptMetadata, defaultPromptContent), "utf-8");
    console.log(`Created default AI prompt file at ${promptPath}`);
}

// 1. Initial Full Sync on Startup
console.log("🔄 Initializing data sync...");
syncDataFolder();

// 3. Populate config cache from SQLite
rebuildConfigCache();

// 2. Start the Background File Watchers
// Cooldown Map to prevent duplicate events from fs.watch
const cooldowns = new Map();
const COOLDOWN_MS = 250;

console.log(`👀 Watching for changes in ${DATA_DIR}...`);
watch(DATA_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith(".md")) return;

    const id = filename.replace(".md", "");
    const filePath = `${DATA_DIR}/${filename}`;

    const now = Date.now();
    if (cooldowns.has(id) && (now - cooldowns.get(id)) < COOLDOWN_MS) return;
    cooldowns.set(id, now);

    if (existsSync(filePath)) {
        updateFile(id);
        const obj = db.prepare("SELECT * FROM objects WHERE id = ?").get(id);
        if (obj) {
            const payload = {
                content: obj.content,
                metadata: typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata,
                title: obj.title
            };
            if (obj.class === 'config' || payload.metadata.class === 'config') {
                rebuildConfigCache();
            }
            broadcastReload(`data-changed:${id}:${JSON.stringify(payload)}`);
        } else {
            broadcastReload(`data-changed:${id}`);
        }
    } else {
        deleteFile(id);
        rebuildConfigCache();
        broadcastReload(`data-deleted:${id}`);
    }
});

// 3. Start the Server
const args = process.argv;
const hostIndex = args.indexOf("--host");
const HOST = hostIndex !== -1 && args[hostIndex + 1] ? args[hostIndex + 1] : "0.0.0.0";

Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch(req) {
        return handleRequest(req);
    },
});

function getLocalIp() {
    try {
        const interfaces = networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
    } catch (e) {}
    return null;
}

const localIp = getLocalIp();
if (HOST === "0.0.0.0") {
    if (localIp) {
        console.log(`🚀 Server started at http://localhost:${PORT} and http://${localIp}:${PORT}`);
    } else {
        console.log(`🚀 Server started at http://localhost:${PORT}`);
    }
} else {
    console.log(`🚀 Server started at http://${HOST}:${PORT}`);
}
