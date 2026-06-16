let markedLib;

if (typeof window !== 'undefined' && window.marked) {
    markedLib = window.marked;
}

export function getMarkedSync() {
    if (markedLib) return markedLib;
    
    // Server-side (Bun) synchronous import fallback
    if (typeof require !== 'undefined' || typeof Bun !== 'undefined') {
        try {
            markedLib = require("marked");
        } catch (e) {
            console.error("Failed to require 'marked' on server:", e);
        }
    }
    return markedLib;
}

/**
 * Preprocess WikiLinks [[Note Title]] -> HTML anchor tag or client link
 */
export function preprocessWikiLinks(markdown, context = 'client') {
    if (!markdown) return "";
    return markdown.replace(/\[\[([^\]]+)\]\]/g, (match, p1) => {
        const title = p1.trim();
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (context === 'server') {
            return `<a href="/wiki/${slug}" class="wiki-link">${title}</a>`;
        }
        // Client app: returns a link with a custom data-id for tab opening
        return `<a href="#" class="wiki-link" data-id="${slug}">${title}</a>`;
    });
}

/**
 * Synchronously render Markdown content to HTML
 */
export function renderMarkdown(markdown, options = {}) {
    if (!markdown) return "";
    
    const context = options.context || 'client';
    
    let processed = markdown;
    
    // Evaluate dataviewjs blocks if onQueryBlock handler is provided
    if (typeof options.onQueryBlock === 'function') {
        processed = processed.replace(/```dataviewjs\r?\n([\s\S]*?)\r?\n```/g, (match, script) => {
            const resultHtml = options.onQueryBlock(script);
            return `<div class="dataview-block"><div class="dv-container">${resultHtml}</div></div>`;
        });
    }
    
    // 1. Preprocess wiki links
    processed = preprocessWikiLinks(processed, context);
    
    // 2. Load marked library
    const parser = getMarkedSync();
    if (!parser) {
        // Fallback for browser if window.marked was populated late
        if (typeof window !== 'undefined' && window.marked) {
            markedLib = window.marked;
            return markedLib.parse(processed);
        }
        throw new Error("Marked parser is not available.");
    }
    
    // 3. Render markdown
    return parser.parse(processed);
}
