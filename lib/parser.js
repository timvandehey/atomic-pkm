import yaml from 'js-yaml';

export function parseMarkdown(raw) {
    // Split the file into Frontmatter and Content
    // This regex looks for the --- blocks
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    
    if (!match) {
        return { metadata: {}, content: raw };
    }

    try {
        const yamlRaw = match[1];
        const content = match[2].trim();
        
        // js-yaml does the heavy lifting of type-casting
        const metadata = yaml.load(yamlRaw) || {};
        
        return { metadata, content };
    } catch (e) {
        console.error("YAML Parsing Error:", e);
        return { metadata: {}, content: raw };
    }
}

/**
 * Converts metadata object and content string back into a valid Markdown file string.
 */
/**
 * Converts metadata object and content string back into a valid Markdown file.
 * Fixes Date objects to use clean YYYY-MM-DD format.
 */
export function stringifyMarkdown(metadata, content) {
    // Clone the metadata to avoid mutating the original object
    const cleanMetadata = { ...metadata };

    // Normalize and sanitize tags if present (convert to lowercase, replace spaces with hyphens, remove duplicates)
    if (cleanMetadata.tags !== undefined && cleanMetadata.tags !== null) {
        let tagList = [];
        if (Array.isArray(cleanMetadata.tags)) {
            tagList = cleanMetadata.tags.map(t => String(t));
        } else if (typeof cleanMetadata.tags === 'string') {
            tagList = cleanMetadata.tags.split(',');
        } else {
            tagList = [String(cleanMetadata.tags)];
        }
        
        const uniqueTags = [...new Set(
            tagList
                .map(t => t.trim().replace(/\s+/g, '-').toLowerCase())
                .filter(t => t.length > 0)
        )];
        cleanMetadata.tags = uniqueTags.join(',');
    }

    // Iterate through keys and format any Date objects
    Object.keys(cleanMetadata).forEach(key => {
        if (cleanMetadata[key] instanceof Date) {
            // Converts "2026-03-25T00:00:00.000Z" to "2026-03-25"
            cleanMetadata[key] = cleanMetadata[key].toISOString().split('T')[0];
        }
    });

    const yamlBlock = yaml.dump(cleanMetadata);
    return `---\n${yamlBlock}---\n\n${content}`;
}
