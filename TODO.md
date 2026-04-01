# Atomic PKM - Todo List

## 🛠️ Infrastructure & Deployment
- [x] **Clean up `node_modules`**: Delete existing folder and run `bun install` to prune orphaned dependencies (`milkdown`, `vue`, etc.).
- [ ] **Test Production Build**: Run `./prepare-deploy.sh` and verify the resulting archive.
- [ ] **Server Production Mode**: Ensure the server uses the `dist` folder or specific production logic when `NODE_ENV=production`.
- [x] **Integrated File Watcher**: Implement a background file watcher within the server (using `fs.watch` or similar) to monitor the `data/` folder. The indexer should be updated to support **incremental syncs**, only processing specific added, modified, or deleted files to keep the database in sync without a full folder scan.
- [x] **Smart Search Indexing**: Update SQLite schema and indexer to include a `smart_text` field that intelligently combines body content and metadata values (filtering out noise like property names and dates) for better search relevance.
- [x] **Collaborative Search Design**: Refine the database schema for properties, tags, and dates based on the design document in `docs/design/search-optimization.md`.

## ✨ UI/UX Refinements
- [x] **Mobile Experience**: Verify the "slide-in" editor transition works smoothly with the new Grid constraints.
- [ ] **Icon Refresh**: Add more vibrant icons to match the new Electric Blue theme.
- [x] **Read-only View Mode**: Implement a "View Mode" for notes (potentially using the Toast UI Viewer) with an **Edit** button to toggle into the full editor.
- [ ] **Settings Migration**: Move sidebar width from `localStorage` to a server-side user profile (Post-login).

## 🚀 Future Features
- [ ] **Templates**: Create a system to define and manage note templates within the app and use them to quickly create new notes.
- [ ] **Dataview Bridge**: Implement the `dataviewjs`-style bridge (Frontend interceptor, Server-side `node:vm` sandbox, and SQLite querying library).
- [ ] **User Login**: Implement a secure login system.
- [ ] **Multi-user Support**: Associate notes and settings with specific users.
