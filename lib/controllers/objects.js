import db from "../db.js";
import { syncDataFolder, updateFile, deleteFile } from "../indexer.js";
import { unlinkSync, existsSync, writeFileSync } from "node:fs";
import { stringifyMarkdown } from "../parser.js";
import vm from "node:vm";
import { createDvLibrary } from "../dv.js";
import { getClassesConfig, getClassConfig } from "../class-config.js";
import { renderMarkdown } from "../../public/renderer.js";

export const ObjectsController = {
    // GET /api/objects
    list: () => {
        const query = db.query("SELECT * FROM objects ORDER BY last_modified DESC");
        return Response.json(query.all());
    },

    // POST /api/create
    create: async (req) => {
        try {
            const body = await req.json();
            const reqTitle = body.title;
            const reqClass = body.class || body.type || 'note';
            const variables = body.variables || {};

            const baseSlug = reqTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
            let id = baseSlug;
            let counter = 1;
            while (existsSync(`./data/${id}.md`)) {
                id = `${baseSlug}-${counter}`;
                counter++;
            }

            const config = getClassConfig(reqClass);
            let content = "";
            let metadata = { 
                title: reqTitle, 
                class: reqClass
            };

            const dateStr = new Date().toISOString().split('T')[0];

            if (config && config.template) {
                content = config.template.content || content;
                metadata = {
                    ...config.template.metadata,
                    ...metadata
                };
            }

            // Perform template string substitutions ({{date}}, {{title}})
            const substitutions = {
                title: reqTitle,
                date: dateStr,
                ...variables
            };

            for (const [key, val] of Object.entries(substitutions)) {
                const placeholder = `{{${key}}}`;
                const replacement = String(val);
                
                content = content.replaceAll(placeholder, replacement);

                for (const [mKey, mVal] of Object.entries(metadata)) {
                    if (typeof mVal === 'string' && mKey !== 'title') {
                        metadata[mKey] = mVal.replaceAll(placeholder, replacement);
                    }
                }
            }

            metadata.title = reqTitle; // Re-ensure correct title

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

    // GET /api/search?q=query&class=note&tag=work
    search: async (req) => {
        try {
            const url = new URL(req.url);
            const query = url.searchParams.get("q") || "";
            const classVal = url.searchParams.get("class") || url.searchParams.get("type") || "";
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
                // Sanitize for FTS5: Wrap in quotes and escape internal quotes
                const sanitized = `"${query.replace(/"/g, '""')}"`;
                sql += ` JOIN objects_fts f ON o.id = f.id`;
                conditions.push(`f.objects_fts MATCH ?`);
                params.push(sanitized);
            }

            if (classVal) {
                conditions.push(`o.class = ?`);
                params.push(classVal);
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

    // GET /api/classes
    getClasses: () => {
        const configs = getClassesConfig();
        return Response.json(Object.keys(configs));
    },

    // GET /api/types (backward compatibility alias)
    getTypes: () => {
        return ObjectsController.getClasses();
    },

    // GET /api/schemas
    getSchemas: () => {
        const configs = getClassesConfig();
        const schemas = {};
        for (const [name, config] of Object.entries(configs)) {
            schemas[name] = config.properties || {};
        }
        return Response.json(schemas);
    },

    // GET /api/classes/config
    getClassesConfig: () => {
        return Response.json(getClassesConfig());
    },

    // POST /api/query
    query: async (req) => {
        try {
            const { script } = await req.json();
            const dv = createDvLibrary();
            
            // Context with the library and basic helpers
            const context = {
                dv,
                // Expose some useful globals
                Date,
                Math,
                Object,
                Array,
                console: {
                    log: (...args) => console.log("[Dataview]", ...args)
                }
            };

            vm.createContext(context);
            
            // Execute user script. It should return the HTML string.
            const html = vm.runInContext(script, context, { timeout: 100 });
            
            return Response.json({ success: true, html: html || "" });
        } catch (err) {
            console.error("Dataview Query Error:", err);
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    },

    // GET /api/render?id=some-id
    render: async (req) => {
        try {
            const url = new URL(req.url);
            const id = url.searchParams.get("id");
            if (!id) {
                return new Response("Missing 'id' parameter", { status: 400 });
            }
            
            const row = db.prepare("SELECT * FROM objects WHERE id = ?").get(id);
            if (!row) {
                return new Response(`Note '${id}' not found`, { status: 404 });
            }
            
            // Define sandboxed script evaluator for Dataview blocks
            const executeDataviewScript = (script) => {
                try {
                    const dv = createDvLibrary('server');
                    const context = {
                        dv,
                        Date,
                        Math,
                        Object,
                        Array,
                        console: {
                            log: (...args) => console.log("[Dataview]", ...args)
                        }
                    };
                    vm.createContext(context);
                    const html = vm.runInContext(script, context, { timeout: 100 });
                    return html || "";
                } catch (e) {
                    console.error("Dataview Render Query Error:", e);
                    return `<div class="dv-error">Error: ${e.message}</div>`;
                }
            };
            
            // Render content using the shared renderer and evaluating query blocks
            const html = renderMarkdown(row.content || "", {
                context: "server",
                onQueryBlock: (script) => executeDataviewScript(script)
            });
            
            return new Response(html, {
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        } catch (err) {
            console.error("Render Error:", err);
            return new Response(err.message, { status: 500 });
        }
    },
};
