import db from "../db.js";
import { syncDataFolder, updateFile, deleteFile } from "../indexer.js";
import { unlinkSync, existsSync, writeFileSync } from "node:fs";
import { stringifyMarkdown } from "../parser.js";

export const ObjectsController = {
    // GET /api/objects
    list: () => {
        const query = db.query("SELECT * FROM objects ORDER BY last_modified DESC");
        return Response.json(query.all());
    },

    // POST /api/create
    create: async (req) => {
        try {
            const { title: reqTitle, type: reqType, templateId } = await req.json();
            const baseSlug = reqTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
            let id = baseSlug;
            let counter = 1;
            while (existsSync(`./data/${id}.md`)) {
                id = `${baseSlug}-${counter}`;
                counter++;
            }

            let content = "Start typing here...";
            let metadata = { 
                title: reqTitle, 
                type: reqType || 'note'
            };

            const dateStr = new Date().toISOString().split('T')[0];

            // If template selected, copy from it
            if (templateId) {
                const template = db.prepare("SELECT content, metadata FROM objects WHERE id = ?").get(templateId);
                if (template) {
                    content = template.content;
                    const templateMeta = JSON.parse(template.metadata);
                    
                    // Merge metadata
                    metadata = { 
                        ...templateMeta,
                        ...metadata,
                        type: reqType || templateMeta.creates || templateMeta.type || 'note'
                    };

                    // 1. Prepare all possible substitutions
                    const substitutions = {
                        ...templateMeta, // Original template props
                        'title': reqTitle,
                        'date': dateStr
                    };

                    // 2. Perform substitutions in Content and Metadata
                    for (const [key, val] of Object.entries(substitutions)) {
                        const placeholder = `{{${key}}}`;
                        const replacement = String(val);
                        
                        content = content.replaceAll(placeholder, replacement);
                        
                        for (const [mKey, mVal] of Object.entries(metadata)) {
                            if (typeof mVal === 'string') {
                                metadata[mKey] = mVal.replaceAll(placeholder, replacement);
                            }
                        }
                    }

                    // 3. Clean up: Remove 'creates' ONLY if the new object is NOT a template
                    if (metadata.type !== 'template') {
                        delete metadata.creates;
                    }
                }
            }

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

            if (tag) {
                sql += ` JOIN tags t ON o.id = t.object_id`;
                conditions.push(`t.tag = ?`);
                params.push(tag.toLowerCase());
            }

            if (query) {
                sql += ` JOIN objects_fts f ON o.id = f.id`;
                conditions.push(`f.objects_fts MATCH ?`);
                params.push(`${query}*`);
            }

            if (type) {
                conditions.push(`o.type = ?`);
                params.push(type);
            }

            if (conditions.length > 0) {
                sql += ` WHERE ` + conditions.join(" AND ");
            }

            sql += ` ORDER BY o.last_modified DESC`;

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
