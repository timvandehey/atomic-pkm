import { readFileSync, readdirSync, statSync } from "node:fs";
import db from "./db.js";
import { parseMarkdown } from "./parser.js";

export function syncDataFolder() {
    const files = readdirSync("./data").filter(f => f.endsWith(".md"));
    const existingIds = files.map(f => f.replace(".md", ""));

    // 1. CLEANUP: Remove entries from SQLite that no longer have a physical file
    const allDbObjects = db.query("SELECT id FROM objects").all();
    allDbObjects.forEach(row => {
        if (!existingIds.includes(row.id)) {
            console.log(`Cleaning up stale DB entry: ${row.id}`);
            db.prepare("DELETE FROM objects WHERE id = ?").run(row.id);
        }
    });

    // 2. SYNC: Update or Insert existing files
    files.forEach(file => {
        const id = file.replace(".md", "");
        const filePath = `./data/${file}`;
        const raw = readFileSync(filePath, "utf-8");
        const stats = statSync(filePath);
        const { metadata, content } = parseMarkdown(raw);

        // Inject system fields
        metadata._createdDate = stats.birthtime.toISOString();
        metadata._modifiedDate = stats.mtime.toISOString();
        metadata._lastSynced = new Date().toISOString();

        db.prepare(`
            INSERT INTO objects (id, title, type, metadata, content)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                type=excluded.type,
                metadata=excluded.metadata,
                content=excluded.content
        `).run(
            id, 
            metadata.title || id, 
            metadata.type || 'note', 
            JSON.stringify(metadata), 
            content
        );
    });
}