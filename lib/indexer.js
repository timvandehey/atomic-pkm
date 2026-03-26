import { readdirSync, readFileSync } from "node:fs";
import db from "./db.js";
import { parseMarkdown } from "./parser.js";

export function syncDataFolder() {
    const files = readdirSync("./data");
    const insert = db.prepare(`
        INSERT OR REPLACE INTO objects (id, type, title, content, metadata)
        VALUES (?1, ?2, ?3, ?4, ?5)
    `);

    files.forEach(file => {
        if (file.endsWith(".md")) {
            const id = file.split('.')[0];
            const raw = readFileSync(`./data/${file}`, "utf8");
            const { metadata, content } = parseMarkdown(raw);

            insert.run(
                id, 
                metadata.type || "note", 
                metadata.title || id, 
                content, 
                JSON.stringify(metadata)
            );
        }
    });
    console.log(`✅ Sync Complete: ${files.length} files processed.`);
}