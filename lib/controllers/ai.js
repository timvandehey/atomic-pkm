import db from "../db.js";
import { writeFileSync, existsSync } from "node:fs";
import { stringifyMarkdown } from "../parser.js";
import { syncDataFolder } from "../indexer.js";
import { getClassesConfig } from "../class-config.js";
import { CONFIG } from "../config.js";

function getSettings() {
    const row = db.prepare("SELECT metadata FROM objects WHERE id = ?").get(CONFIG.SETTINGS_ID);
    if (row && row.metadata) {
        try {
            return JSON.parse(row.metadata);
        } catch (e) {}
    }
    return {};
}

function getQuickAddPrompt(settings) {
    const promptId = settings.quickAddPromptId || CONFIG.DEFAULT_QUICK_ADD_PROMPT_ID;
    const row = db.prepare("SELECT metadata, content FROM objects WHERE id = ?").get(promptId);
    if (row) {
        try {
            const metadata = JSON.parse(row.metadata);
            return {
                model: metadata.model || CONFIG.DEFAULT_MODEL,
                temperature: Number(metadata.temperature ?? CONFIG.DEFAULT_TEMPERATURE),
                systemPrompt: row.content
            };
        } catch (e) {}
    }
    return {
        model: CONFIG.DEFAULT_MODEL,
        temperature: CONFIG.DEFAULT_TEMPERATURE,
        systemPrompt: "You are a PKM assistant. Parse user input into JSON."
    };
}

export const AIController = {
    // POST /api/ai/quick-add
    quickAdd: async (req) => {
        try {
            const { text } = await req.json();
            if (!text || !text.trim()) {
                return Response.json({ success: false, error: "Text input is required." }, { status: 400 });
            }

            const settings = getSettings();
            const promptConfig = getQuickAddPrompt(settings);
            const ollamaHost = settings.ollamaHost || CONFIG.DEFAULT_OLLAMA_HOST;

            // Dynamically construct class-specific guidelines
            const classesConfig = getClassesConfig();
            let classGuidelines = "";
            for (const [className, config] of Object.entries(classesConfig)) {
                classGuidelines += `- Class "${className}" (Label: "${config.label}", Icon: "${config.icon}")\n`;
                if (config.properties && Object.keys(config.properties).length > 0) {
                    classGuidelines += `  Properties schema:\n`;
                    for (const [propKey, propType] of Object.entries(config.properties)) {
                        classGuidelines += `    - ${propKey}: type ${propType}\n`;
                    }
                }
                if (config.ai_quick_add && config.ai_quick_add.prompt) {
                    classGuidelines += `  Specific Guidelines/Prompt:\n    ${config.ai_quick_add.prompt.trim().replace(/\n/g, '\n    ')}\n`;
                }
                classGuidelines += `\n`;
            }

            let finalSystemPrompt = promptConfig.systemPrompt;
            if (finalSystemPrompt.includes("{{class_guidelines}}")) {
                finalSystemPrompt = finalSystemPrompt.replace("{{class_guidelines}}", classGuidelines);
            } else {
                finalSystemPrompt = finalSystemPrompt + "\n\nAvailable Classes & Guidelines:\n" + classGuidelines;
            }

            console.log(`🤖 Requesting AI Quick Add from Ollama at ${ollamaHost}...`);
            console.log(`Model: ${promptConfig.model}, Temperature: ${promptConfig.temperature}`);

            const response = await fetch(`${ollamaHost}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: promptConfig.model,
                    prompt: text,
                    system: finalSystemPrompt,
                    stream: false,
                    options: {
                        temperature: promptConfig.temperature
                    },
                    format: "json"
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Ollama API returned HTTP ${response.status}: ${errText}`);
            }

            const resJson = await response.json();
            if (!resJson || !resJson.response) {
                throw new Error("Invalid response structure from Ollama.");
            }

            let parsedResponse;
            try {
                parsedResponse = JSON.parse(resJson.response);
            } catch (e) {
                console.error("Failed to parse JSON response from Ollama:", resJson.response);
                parsedResponse = {
                    title: "Quick Add Note",
                    class: "note",
                    content: resJson.response,
                    properties: {},
                    tags: []
                };
            }

            // Generate clean unique ID
            const baseSlug = (parsedResponse.title || "ai-quick-add").toLowerCase().replace(/[^a-z0-9]/g, '-');
            let id = baseSlug;
            let counter = 1;
            while (existsSync(`./data/${id}.md`)) {
                id = `${baseSlug}-${counter}`;
                counter++;
            }

            // Normalize tags by converting to lowercase and replacing spaces with hyphens
            const rawTags = parsedResponse.tags || [];
            const tagsArray = (Array.isArray(rawTags) ? rawTags : String(rawTags).split(','))
                .map(t => String(t).trim().replace(/\s+/g, '-').toLowerCase())
                .filter(t => t.length > 0);
            const tagsString = tagsArray.join(",");

            // Construct standard frontmatter
            const metadata = {
                title: parsedResponse.title || "Quick Add Note",
                class: parsedResponse.class || parsedResponse.type || "note",
                tags: tagsString,
                userInput: text.trim(),
                _inbox: true
            };

            // Merge parsed properties and normalize arrays to comma-separated strings
            if (parsedResponse.properties && typeof parsedResponse.properties === 'object') {
                for (const [key, val] of Object.entries(parsedResponse.properties)) {
                    if (key === 'title' || key === 'type' || key === 'class' || key === 'tags') continue;
                    if (Array.isArray(val)) {
                        metadata[key] = val.map(v => String(v).trim()).filter(Boolean).join(", ");
                    } else {
                        metadata[key] = val;
                    }
                }
            }

            let content = parsedResponse.content || "";
            // Clean up blockquote formatting (lines starting with '>') if they are excessive
            const lines = content.split('\n');
            let quoteCount = 0;
            let nonEmptyCount = 0;
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.length > 0) {
                    nonEmptyCount++;
                    if (trimmed.startsWith('>')) {
                        quoteCount++;
                    }
                }
            }
            if (nonEmptyCount > 0 && (quoteCount / nonEmptyCount) > 0.5) {
                content = lines.map(line => {
                    const trimmed = line.trimStart();
                    if (trimmed.startsWith('>')) {
                        return trimmed.slice(1).replace(/^\s/, '');
                    }
                    return line;
                }).join('\n');
            }

            // Write to file and sync SQLite index
            const filePath = `./data/${id}.md`;
            writeFileSync(filePath, stringifyMarkdown(metadata, content), "utf-8");
            
            // Sync database immediately
            syncDataFolder();

            return Response.json({
                success: true,
                id,
                title: metadata.title,
                object: {
                    id,
                    title: metadata.title,
                    class: metadata.class,
                    content,
                    metadata
                }
            });

        } catch (err) {
            console.error("AI Quick Add Error:", err);
            return Response.json({
                success: false,
                error: `Failed to perform AI quick-add. details: ${err.message}`
            }, { status: 500 });
        }
    }
};
