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
        const content = match[2];
        
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
