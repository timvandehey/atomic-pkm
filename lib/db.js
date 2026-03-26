import { Database } from "bun:sqlite";

const db = new Database("atomic.sqlite");

// Initialize Schema
db.run(`
  CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    content TEXT,
    metadata JSON,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;