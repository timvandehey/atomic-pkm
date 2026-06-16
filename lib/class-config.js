import db from "./db.js";
import yaml from "js-yaml";

let configCache = null;

export function rebuildConfigCache() {
  try {
    const rows = db.prepare("SELECT metadata, content FROM objects WHERE class = 'config'").all();
    const classes = {};

    for (const row of rows) {
      try {
        const metadata = JSON.parse(row.metadata);
        const configures = metadata.configures;
        if (!configures) continue;

        // The body of the note is YAML
        const configData = yaml.load(row.content) || {};
        classes[configures] = {
          label: configData.label || configures.charAt(0).toUpperCase() + configures.slice(1),
          icon: configData.icon || "draft",
          properties: configData.properties || {},
          template: configData.template || { metadata: {}, content: "" },
          ai_quick_add: configData.ai_quick_add || null,
          embedding: configData.embedding || null,
          default: (metadata.default === true || metadata.default === 'true' || configData.default === true || configData.default === 'true')
        };
      } catch (e) {
        console.error(`Error parsing class config row:`, e);
      }
    }

    configCache = classes;
    console.log(`⚙️ Loaded ${Object.keys(classes).length} class configurations.`);
  } catch (err) {
    console.error("Error rebuilding config cache:", err);
    configCache = {};
  }
}

export function getClassesConfig() {
  if (!configCache) {
    rebuildConfigCache();
  }
  return configCache;
}

export function getClassConfig(className) {
  const configs = getClassesConfig();
  return configs[className] || null;
}
