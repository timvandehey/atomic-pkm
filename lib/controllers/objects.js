import db from "../db.js";
import { syncDataFolder } from "../indexer.js";
import { unlinkSync } from "node:fs"; // Added for deleting files
import { writeFileSync } from "node:fs";
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
            const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const id = `${Date.now()}-${slug}`;
            
            const metadata = {
                title: title,
                type: type || 'note',
                date: new Date().toISOString().split('T')[0]
            };

            const content = "Start typing here...";
            const fullText = stringifyMarkdown(metadata, content);
            writeFileSync(`./data/${id}.md`, fullText);
            syncDataFolder();
            
            return Response.json({ success: true, id });
        } catch (err) {
            console.error("Create Error:", err);
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    },

    // POST /api/save

// lib/controllers/objects.js
    save: async (req) => {
        try {
            const { id, content, metadata } = await req.json();
            const filePath = `./data/${id}.md`;

            // 1. Build the YAML header string from the metadata object
            let yamlHeader = "---\n";
            for (const [key, value] of Object.entries(metadata)) {
                yamlHeader += `${key}: ${value}\n`;
            }
            yamlHeader += "---\n\n";

            // 2. Combine with the body content
            const fullFileContent = yamlHeader + content;

            // 3. Write to disk
            writeFileSync(filePath, fullFileContent, "utf-8");

            // 4. Update the Database so the Sidebar reflects changes
            syncDataFolder();

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
            
            // Delete the physical file
            unlinkSync(`./data/${id}.md`);
            
            // Re-index to remove from SQLite
            syncDataFolder();
            
            return Response.json({ success: true });
        } catch (err) {
            console.error("Delete Error:", err);
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    } ,

    sync: async () => {
        try {
            console.log("Manual sync requested...");
            syncDataFolder(); 
            return Response.json({ success: true, message: "Database updated from files." });
        } catch (err) {
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    },

    // GET /api/search?q=query
    search: (req) => {
        const url = new URL(req.url);
        const queryStr = url.searchParams.get("q") || "";
        const typeFilter = url.searchParams.get("type") || "";
        
        let sql = `
            SELECT * FROM objects 
            WHERE (title LIKE ? OR content LIKE ? OR id LIKE ?)
        `;
        const params = [`%${queryStr}%`, `%${queryStr}%`, `%${queryStr}%` ];

        // If a specific type is selected, add it to the WHERE clause
        if (typeFilter) {
            sql += ` AND type = ?`;
            params.push(typeFilter);
        }
        
        const results = db.query(sql).all(...params);
        return Response.json(results);
    },

    // GET /api/types
    getTypes: () => {
        // Select unique types, ignoring nulls or empty strings
        const query = db.query("SELECT DISTINCT type FROM objects WHERE type IS NOT NULL AND type != ''");
        const types = query.all().map(row => row.type);
        return Response.json(types);
    },

};