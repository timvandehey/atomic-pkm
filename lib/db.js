import { Database } from "bun:sqlite";

const db = new Database("atomic.sqlite");

// Enable Foreign Keys
db.run("PRAGMA foreign_keys = ON;");

// 1. Core Objects Table
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

// 2. FTS5 Virtual Table for Search
// We use the trigram tokenizer for "fuzzy" substring matching
db.run(`
  CREATE VIRTUAL TABLE IF NOT EXISTS objects_fts USING fts5(
    id UNINDEXED, 
    title, 
    content, 
    tokenize="trigram"
  )
`);

// 3. Normalized Tags Table
db.run(`
  CREATE TABLE IF NOT EXISTS tags (
    object_id TEXT,
    tag TEXT,
    FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE CASCADE,
    PRIMARY KEY (object_id, tag)
  )
`);

// 4. Properties Table
db.run(`
  CREATE TABLE IF NOT EXISTS properties (
    object_id TEXT,
    key TEXT,
    value TEXT,
    type TEXT,
    FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE CASCADE
  )
`);

export default db;
