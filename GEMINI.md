# Atomic PKM: Project Context & Strategy

Do Not use nodejs (npm), use Bun (preferably built-in runtime)
DO NOT ever use typescript

## 1. Project Vision
A **Thick Server** Personal Knowledge Management (PKM) system. The local file system is the "Source of Truth," and a high-performance Bun/SQLite middleware provides a structured API for a Vanilla JS (ESM) frontend. The frontend must be extremely lean, simple, and mobile-first, without Virtual DOM (VDOM) frameworks like Juris.js.

## 2. System Architecture (ESM Modular)
The project is strictly modular to ensure separation of concerns:

- **Runtime:** Bun (v1.3.8) - chosen for SQLite speed and fast I/O.
- **Root Files:** 
    - `server.js`: Entry point. Simple "Traffic Controller" using `Bun.serve`.
- **Server Modules (`/lib`):**
    - `db.js`: Persistent SQLite connection and schema initialization.
    - `parser.js`: Regex-based logic to split YAML frontmatter from Markdown body.
    - `indexer.js`: The "Sync Engine" that reconciles local files with the database.
    - `router.js`: Maps "Method:Path" strings to Controller functions.
    - `controllers/`: Logic for specific domains (e.g., `ObjectsController.js`).
- **Frontend (`/public`):**
    - `app.js`: Module entry point. Handlers for tabs, sidebar, settings, and main UI shell.
    - `explorer.js`: Vanilla JS rendering logic for the grid-based file dashboard.
    - `editor.js`: Vanilla JS note editor managing preview mode, EasyMDE, raw markdown editor, and properties form.
    - `renderer.js`: Shared Markdown/Wikilinks preprocessor and renderer.
- **Storage:** 
    - `/data/*.md`: Local-only Markdown files (Git-ignored).
    - `atomic.sqlite`: High-speed index (Git-ignored).

## 3. Data Schema & Atomic Patterns
- **The Object:** Every file is an "Atomic Object." 
- **The Type:** Behavior is driven by the `class` (or backward-compatible `type`) field in the YAML frontmatter (e.g., `note`, `golf`).
- **Metadata:** All YAML fields are indexed into a JSON column in SQLite for querying.
- **Content:** The Markdown body is stored as a string for rendering/editing.

## 4. Design Philosophy & CLI Rules
- **Philosophy:** Favor Server Logic. The frontend should remain a "Thin View." 
- **Vanilla ESM View Engine (No VDOM)**: Do not use Juris.js or any other Virtual DOM library. Use direct DOM updates, simple templates, or standard element manipulation.
- **Form Factory:** Do not hard-code forms for specific types. Use "Guesser" logic in `editor.js` to render inputs based on property data types (Date, Boolean, Number).
- **The Sync Rule:** Any write operation to the file system MUST be followed immediately by a call to `syncDataFolder()` to keep the SQLite index accurate.
- **Git Protocol:** Never commit `data/` or `atomic.sqlite`. Use `git` commands for code-only updates.

## 5. Transition to Vanilla ESM Framework
To replace Juris.js, the codebase is moving to a lightweight Vanilla JS architecture:

### 5.1 Simple State Management
We use a lightweight, centralized state management system (Store/Pub-Sub) or direct DOM render dispatchers. 
A minimal `AppStore` should maintain the state:
- `objects`: List of all note objects.
- `openTabs`: List of open note tabs (containing `id`, `title`, `content`, `metadata`, `isEditMode`, `isRawMode`, `metaVisible`, etc.).
- `activeTabId`: ID of the currently selected tab or `'explorer'`.
- `sidebarWidth`: Numeric width in pixels.

When state changes, specific DOM sections (the Sidebar, the Tab Bar, or the Active Editor Container) are updated directly by targeted render functions rather than rebuilding the entire DOM tree.

### 5.2 Preservation of Focus & Input States
- EasyMDE editor instances are attached to hidden textareas. During edit mode, we read and write content from/to the editor directly. We do not re-render the outer editor element to prevent losing text cursor position and history.
- The Raw Markdown editor is a standard `<textarea>`. It retains focus natively as long as the element is not destroyed.

### 5.3 Rendering Lifecycle & marked.js
- **Client-Side Rendering**: In the web application, Markdown is compiled client-side using `marked.js` (imported synchronously from the CDN window global).
- **Client-Side Dataview**: Dataview blocks (````dataviewjs````) are detected client-side during the render phase. The client queries the server `/api/query` with the script content and displays the returned HTML in a `.dataview-block` container.
- **Server-Side Rendering**: For external integrations (e.g., Hugo web builder), the server route `/api/render?id=...` pre-renders complete HTML, evaluating `dataviewjs` scripts in a sandboxed VM environment before returning the compiled HTML.

## 6. Mobile-First Responsive Design
- The layout must fit standard phone screens comfortably.
- A sliding or toggleable drawer side navigation menu is used on screens under `768px`.
- Layout measurements and typography use standard relative values (`rem` and `em`).
