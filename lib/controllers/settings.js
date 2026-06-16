import db from "../db.js";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { parseMarkdown, stringifyMarkdown } from "../parser.js";
import { syncDataFolder } from "../indexer.js";
import { CONFIG } from "../config.js";

const SETTINGS_FILE = "./data/settings.md";

export const SettingsController = {
    // GET /api/settings
    get: () => {
        // 1. Pull from the SQLite index for high-speed reads
        const row = db.prepare("SELECT metadata FROM objects WHERE id = ?").get(CONFIG.SETTINGS_ID);
        if (row && row.metadata) {
            try {
                return Response.json(JSON.parse(row.metadata));
            } catch (e) {}
        }
        
        // 2. Fallback: Read file directly if not yet indexed
        try {
            if (existsSync(SETTINGS_FILE)) {
                const raw = readFileSync(SETTINGS_FILE, "utf-8");
                const { metadata } = parseMarkdown(raw);
                return Response.json(metadata);
            }
        } catch (e) {
            console.error("Error reading settings fallback:", e);
        }
        
        // 3. Absolute Fallback: Default system configurations
        return Response.json({
            sidebarWidth: 250,
            ollamaHost: CONFIG.DEFAULT_OLLAMA_HOST,
            autoEdit: false,
            autoShowProperties: false
        });
    },

    // POST /api/settings
    set: async (req) => {
        try {
            const { key, value } = await req.json();
            
            // 1. Read existing settings file
            let metadata = {};
            let content = "System settings for the Atomic PKM app. You can modify the frontmatter properties above to customize your experience.";
            
            try {
                if (existsSync(SETTINGS_FILE)) {
                    const raw = readFileSync(SETTINGS_FILE, "utf-8");
                    const parsed = parseMarkdown(raw);
                    metadata = parsed.metadata || {};
                    content = parsed.content || content;
                }
            } catch (e) {
                console.error("Error reading settings before set:", e);
            }

            // 2. Merge the new setting
            metadata[key] = value;

            // Ensure title and class are set in the frontmatter
            metadata.title = metadata.title || "Application Settings";
            metadata.class = metadata.class || "settings";

            // 3. Write back to disk and sync
            writeFileSync(SETTINGS_FILE, stringifyMarkdown(metadata, content), "utf-8");
            syncDataFolder();

            return Response.json({ success: true });
        } catch (err) {
            console.error("Settings Set Error:", err);
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    }
};
