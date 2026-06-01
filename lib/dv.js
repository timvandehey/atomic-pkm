import db from "./db.js";

/**
 * Creates the 'dv' object for use in the sandbox.
 */
export function createDvLibrary() {
    return {
        /**
         * Returns an array of page objects based on a query.
         * @param {string} source - e.g., "#tag" or "type"
         */
        pages: (source) => {
            if (!source) return db.prepare("SELECT * FROM objects").all().map(parseMetadata);

            if (typeof source === 'string') {
                if (source.startsWith('#')) {
                    const tag = source.slice(1).toLowerCase();
                    return db.prepare(`
                        SELECT o.* FROM objects o
                        JOIN tags t ON o.id = t.object_id
                        WHERE t.tag = ?
                    `).all(tag).map(parseMetadata);
                } else {
                    return db.prepare("SELECT * FROM objects WHERE type = ?")
                             .all(source)
                             .map(parseMetadata);
                }
            }
            return [];
        },

        /**
         * Renders a list of items as HTML.
         */
        list: (items) => {
            if (!Array.isArray(items)) return "";
            return `<ul class="dv-list">${items.map(i => `<li>${formatValue(i)}</li>`).join('')}</ul>`;
        },

        /**
         * Renders a table.
         */
        table: (headers, rows) => {
            if (!Array.isArray(headers) || !Array.isArray(rows)) return "";
            const head = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
            const body = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${formatValue(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
            return `<table class="dv-table">${head}${body}</table>`;
        },

        /**
         * Simple helper to format dates or objects.
         */
        el: (tag, text, attrs = {}) => {
            const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
            return `<${tag} ${attrStr}>${text}</${tag}>`;
        }
    };
}

function parseMetadata(obj) {
    if (obj && typeof obj.metadata === 'string') {
        obj.metadata = JSON.parse(obj.metadata);
    }
    return obj;
}

function formatValue(val) {
    if (val === null || val === undefined) return "";
    if (typeof val === 'object' && val.id && val.title) {
        // Return a internal link-like structure or just the title
        return `<span class="dv-link" data-id="${val.id}">${val.title}</span>`;
    }
    return String(val);
}
