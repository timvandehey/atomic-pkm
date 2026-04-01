import { Database } from "bun:sqlite";

const db = new Database("atomic.sqlite");

// Enable Foreign Keys
db.run("PRAGMA foreign_keys = ON;");

// 1. Core Objects Table (Updated with smart_text and primary date)
db.run(`
  CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    content TEXT,
    metadata JSON,
    date TEXT,
    smart_text TEXT,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 2. Normalized Tags Table
db.run(`
  CREATE TABLE IF NOT EXISTS tags (
    object_id TEXT,
    tag TEXT,
    FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE CASCADE,
    PRIMARY KEY (object_id, tag)
  )
`);

// 3. Properties Table (EAV Pattern for advanced filtering)
db.run(`
  CREATE TABLE IF NOT EXISTS properties (
    object_id TEXT,
    key TEXT,
    value TEXT,
    type TEXT, -- 'string', 'number', 'date', 'boolean'
    FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE CASCADE
  )
`);

export default db;
