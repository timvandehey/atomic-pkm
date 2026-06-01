import db from "../db.js";

export const SettingsController = {
    // GET /api/settings
    get: () => {
        const rows = db.query("SELECT * FROM settings").all();
        const settings = {};
        rows.forEach(row => {
            try {
                settings[row.key] = JSON.parse(row.value);
            } catch {
                settings[row.key] = row.value;
            }
        });
        return Response.json(settings);
    },

    // POST /api/settings
    set: async (req) => {
        try {
            const { key, value } = await req.json();
            db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
              .run(key, JSON.stringify(value));
            return Response.json({ success: true });
        } catch (err) {
            console.error("Settings Set Error:", err);
            return Response.json({ success: false, error: err.message }, { status: 500 });
        }
    }
};
