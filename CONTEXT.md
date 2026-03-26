# Atomic PKM: Project Context & Strategy

## 1. Project Vision
A **Thick Server** Personal Knowledge Management (PKM) system. The local file system is the "Source of Truth," and a high-performance Bun/SQLite middleware provides a structured API for a Vanilla JS (ESM) frontend.

## 2. System Architecture (ESM Modular)
The project is strictly modular to ensure separation of concerns:

- **Runtime:** Bun (v1.3.8) - chosen for SQLite speed and fast I/O.
- **Root Files:** - `server.js`: Entry point. Simple "Traffic Controller" using `Bun.serve`.
- **Server Modules (`/lib`):**
    - `db.js`: Persistent SQLite connection and schema initialization.
    - `parser.js`: Regex-based logic to split YAML frontmatter from Markdown body.
    - `indexer.js`: The "Sync Engine" that reconciles local files with the database.
    - `router.js`: Maps "Method:Path" strings to Controller functions.
    - `controllers/`: Logic for specific domains (e.g., `ObjectsController.js`).
- **Frontend (`/public`):**
    - `app.js`: Module entry point.
    - `gallery.js`: Grid-based display logic.
    - `editor.js`: Modal-based "Form Factory" for editing metadata and content.
- **Storage:** - `/data/*.md`: Local-only Markdown files (Git-ignored).
    - `atomic.sqlite`: High-speed index (Git-ignored).

## 3. Data Schema & Atomic Patterns
- **The Object:** Every file is an "Atomic Object." 
- **The Type:** Behavior is driven by the `type` field in the YAML frontmatter (e.g., `note`, `golf`).
- **Metadata:** All YAML fields are indexed into a JSON column in SQLite for querying.
- **Content:** The Markdown body is stored as a string for rendering/editing.

## 4. Design Philosophy & CLI Rules
- **Philosophy:** Favor Server Logic. The frontend should remain a "Thin View." 
- **Form Factory:** Do not hard-code forms for specific types. Use the "Guesser" logic in `editor.js` to render inputs based on data types (Date, Boolean, Number).
- **The Sync Rule:** Any write operation to the file system MUST be followed immediately by a call to `syncDataFolder()` to keep the SQLite index accurate.
- **Git Protocol:** Never commit `data/` or `atomic.sqlite`. Use the `push` alias (add/commit/push) for code-only updates.

## 5. Implementation Roadmap (Next Steps)
1. **New Object Workflow:** Implementation of a "Create" button that generates a boilerplate `.md` file with basic frontmatter.
2. **Search & Filter:** Adding a search bar to the Gallery to query the SQLite index.
3. **Smart Input Refinement:** Improving the "Guesser" to handle specific numeric increments (e.g., decimals for golf ratings) and star ratings.
4. **Property Templates:** Standardizing YAML keys based on the `type` of object created.