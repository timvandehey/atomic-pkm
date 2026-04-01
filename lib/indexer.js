import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import db from "./db.js";
import { parseMarkdown } from "./parser.js";

/**
 * Detects the data type of a value for property indexing.
 */
function getValueType(key, value) {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'string';
}

/**
 * Extracts hashtags from a string.
 */
function extractHashtags(text) {
    if (!text) return [];
    const matches = text.match(/#[\w-]+/g);
    return matches ? matches.map(m => m.slice(1).toLowerCase()) : [];
}

/**
 * Updates or inserts a single file into the database with rich indexing.
 */
export function updateFile(id) {
    const filePath = `./data/${id}.md`;
    if (!existsSync(filePath)) return;

    try {
        const stats = statSync(filePath);
        const mtime = stats.mtime.toISOString();

        // 1. Efficiency Check
        const existing = db.prepare("SELECT metadata FROM objects WHERE id = ?").get(id);
        if (existing) {
            const meta = JSON.parse(existing.metadata);
            if (meta._modifiedDate === mtime) return; 
        }

        const raw = readFileSync(filePath, "utf-8");
        const { metadata, content } = parseMarkdown(raw);

        // Inject system fields
        metadata._createdDate = stats.birthtime.toISOString();
        metadata._modifiedDate = mtime;
        metadata._lastSynced = new Date().toISOString();

        // 2. Prepare Smart Search Text
        let smartTextParts = [metadata.title || id, content];
        const tags = new Set(extractHashtags(content));

        const properties = [];
        for (const [key, value] of Object.entries(metadata)) {
            if (key.startsWith('_')) continue;

            const type = getValueType(key, value);
            let stringValue = String(value);
            
            // Format Date for DB consistency
            if (value instanceof Date) {
                stringValue = value.toISOString().split('T')[0];
            }

            properties.push({ key, value: stringValue, type });

            if (type === 'string' && key !== 'type' && key !== 'title' && key !== 'tags') {
                smartTextParts.push(stringValue);
            }

            if (key === 'tags') {
                if (Array.isArray(value)) value.forEach(t => tags.add(String(t).toLowerCase()));
                else if (typeof value === 'string') value.split(/,\s*/).forEach(t => tags.add(t.toLowerCase()));
            }
        }

        const smartText = smartTextParts.join(" ").replace(/\s+/g, " ").trim();
        
        let primaryDate = metadata.date;
        if (primaryDate instanceof Date) primaryDate = primaryDate.toISOString().split('T')[0];
        if (!primaryDate) primaryDate = metadata._createdDate?.split('T')[0];

        // 3. Atomic Database Update
        db.transaction(() => {
            db.prepare(`
                INSERT INTO objects (id, title, type, metadata, content, date, smart_text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    type=excluded.type,
                    metadata=excluded.metadata,
                    content=excluded.content,
                    date=excluded.date,
                    smart_text=excluded.smart_text
            `).run(
                id, 
                metadata.title || id, 
                metadata.type || 'note', 
                JSON.stringify(metadata), 
                content,
                String(primaryDate || ''),
                smartText
            );

            db.prepare("DELETE FROM tags WHERE object_id = ?").run(id);
            const tagStmt = db.prepare("INSERT INTO tags (object_id, tag) VALUES (?, ?)");
            tags.forEach(t => tagStmt.run(id, String(t)));

            db.prepare("DELETE FROM properties WHERE object_id = ?").run(id);
            const propStmt = db.prepare("INSERT INTO properties (object_id, key, value, type) VALUES (?, ?, ?, ?)");
            properties.forEach(p => propStmt.run(id, String(p.key), String(p.value), String(p.type)));
        })();

        console.log(`Synced: ${id}.md`);
    } catch (err) {
        console.error(`Error syncing ${id}.md:`, err.message);
    }
}

/**
 * Removes a single file from the database.
 */
export function deleteFile(id) {
    try {
        db.prepare("DELETE FROM objects WHERE id = ?").run(id);
        console.log(`Removed from DB: ${id}.id`);
    } catch (err) {
        console.error(`Error deleting ${id} from DB:`, err.message);
    }
}

/**
 * Full sync.
 */
export function syncDataFolder() {
    const files = readdirSync("./data").filter(f => f.endsWith(".md"));
    const existingIds = files.map(f => f.replace(".md", ""));

    const allDbObjects = db.query("SELECT id FROM objects").all();
    let cleanupCount = 0;
    allDbObjects.forEach(row => {
        if (!existingIds.includes(row.id)) {
            deleteFile(row.id);
            cleanupCount++;
        }
    });

    existingIds.forEach(id => {
        updateFile(id);
    });

    if (cleanupCount > 0) {
        console.log(`| Startup cleanup: Removed ${cleanupCount} stale entries.`);
    }
}
