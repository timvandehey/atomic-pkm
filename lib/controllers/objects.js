import db from "../db.js";
import { syncDataFolder, updateFile, deleteFile } from "../indexer.js";
import { unlinkSync, existsSync, writeFileSync } from "node:fs";
import { stringifyMarkdown } from "../parser.js";

export const ObjectsController = {
    // GET /api/objects
    list: () => {
        const query = db.query("SELECT * FROM objects");
        return Response.json(query.all());
    },

    // POST /api/create
    create: async (req) => {
        try {
            const { title, type } = await req.json();
            const baseSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
            let id = baseSlug;
            let counter = 1;
            while (existsSync(`./data/${id}.md`)) {
                id = `${baseSlug}-${counter}`;
                counter++;
            }
            const metadata = { title, type: type || 'note', date: new Date().toISOString().split('T')[0] };
            const content = "Start typing here...";
            writeFileSync(`./data/${id}.md`, stringifyMarkdown(metadata, content));
            return Response.json({ success: true, id });
        } catch (err) {
            console.error("Create Error:", err);
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    },

    // POST /api/save
    save: async (req) => {
        try {
            const { id, content, metadata } = await req.json();
            writeFileSync(`./data/${id}.md`, stringifyMarkdown(metadata, content));
            return Response.json({ success: true });
        } catch (err) {
            console.error("Save Error:", err);
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    },

    // POST /api/delete
    delete: async (req) => {
        try {
            const { id } = await req.json();
            if (existsSync(`./data/${id}.md`)) unlinkSync(`./data/${id}.md`);
            return Response.json({ success: true });
        } catch (err) {
            console.error("Delete Error:", err);
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    },

    sync: async () => {
        try {
            syncDataFolder(); 
            return Response.json({ success: true, message: "Full resync complete." });
        } catch (err) {
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    },

    // GET /api/search?q=query&type=note&tag=work
    search: async (req) => {
        try {
            const url = new URL(req.url);
            const query = url.searchParams.get("q") || "";
            const type = url.searchParams.get("type") || "";
            const tag = url.searchParams.get("tag") || "";

            let sql = `SELECT DISTINCT o.* FROM objects o`;
            let params = [];
            let conditions = [];

            // 1. Tag Join if needed
            if (tag) {
                sql += ` JOIN tags t ON o.id = t.object_id`;
                conditions.push(`t.tag = ?`);
                params.push(tag.toLowerCase());
            }

            // 2. Text Search (using smart_text)
            if (query) {
                conditions.push(`o.smart_text LIKE ?`);
                params.push(`%${query}%`);
            }

            // 3. Type Filtering
            if (type) {
                conditions.push(`o.type = ?`);
                params.push(type);
            }

            if (conditions.length > 0) {
                sql += ` WHERE ` + conditions.join(" AND ");
            }

            const results = db.prepare(sql).all(...params);
            return Response.json(results);
        } catch (err) {
            console.error("Search Error:", err);
            return Response.json({ error: err.message }, { status: 500 });
        }
    },

    // GET /api/types
    getTypes: () => {
        const query = db.query("SELECT DISTINCT type FROM objects WHERE type IS NOT NULL AND type != ''");
        const types = query.all().map(row => row.type);
        return Response.json(types);
    },
};
