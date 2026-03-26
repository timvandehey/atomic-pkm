import db from "../db.js";
import { syncDataFolder } from "../indexer.js";
import { writeFileSync } from "node:fs";

export const ObjectsController = {
    // GET /api/objects
    list: () => {
        return Response.json(db.query("SELECT * FROM objects").all());
    },

    // POST /api/save
    save: async (req) => {
        const { id, content, metadata } = await req.json();
        
        let yaml = "---\n";
        for (const [key, value] of Object.entries(metadata)) {
            yaml += `${key}: ${value}\n`;
        }
        yaml += "---\n";
        
        writeFileSync(`./data/${id}.md`, yaml + content);
        syncDataFolder();
        
        return Response.json({ success: true });
    }
};