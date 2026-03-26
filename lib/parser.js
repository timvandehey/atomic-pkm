export function parseMarkdown(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let metadata = {};
    let content = raw;

    if (match) {
        const yamlRaw = match[1];
        content = match[2];

        yamlRaw.split("\n").forEach(line => {
            const [key, ...valueParts] = line.split(":");
            if (key && valueParts.length) {
                metadata[key.trim()] = valueParts.join(":").trim();
            }
        });
    }

    return { metadata, content };
}