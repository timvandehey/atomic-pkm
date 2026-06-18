# Atomic PKM - Todo List

## 🛠️ Transition to Vanilla ESM Framework (Eliminating Juris.js)
- [ ] **Remove Juris.js CDNs**: Remove `juris.js` and `juris-headless.js` script tags from `public/index.html`.
- [ ] **Refactor `public/app.js` to Vanilla ESM**:
  - Implement a lean, centralized `AppStore` for global application state (subscribers, getState, setState).
  - Create targeted DOM update routines (`updateHeader()`, `updateSidebar()`, `updateTabHeaders()`, `updateMainArea()`) that react to state changes without destroying active elements.
  - Setup simple state-driven routing and menu toggle events.
- [ ] **Refactor `public/editor.js` to Vanilla ESM**:
  - Re-write the properties form factory to directly inject input fields into the properties panel (`#metadata-form`) and handle change events.
  - Rewrite the edit/view/raw switcher to toggle element classes or visibility (`.hidden` / `display: none`) instead of using virtual DOM keys.
  - Ensure EasyMDE is instantiated only when editing is toggled and destroyed when switching out of edit mode.
  - Keep the Raw Markdown editor as a standard `<textarea>` that stays in sync with state.
- [ ] **Refactor `public/explorer.js` to Vanilla ESM**:
  - Re-write card grid rendering to clear and repopulate elements directly in the container when the search query or class filter updates.
- [ ] **Verify Client-Side Markdown & Dataview**:
  - Ensure client-side markdown uses `marked.js` and resolves `dataviewjs` blocks by fetching HTML from `/api/query` in a non-blocking way.

## 📱 Mobile-First Styling Refinements
- [ ] **Responsive Navigation Drawer**: Refactor CSS to hide the sidebar drawer on mobile screens (< 768px) and slide it in/out on drawer button clicks.
- [ ] **Touch Friendly Form Fields**: Optimize property edit forms for mobile input, adjusting spacing, font-sizing, and deletion buttons.

## 🚀 Semantic Search & Vector Embeddings
- [ ] **Database Vector Schema**: Create an `objects_embeddings` table to house JSON float arrays matching note IDs.
- [ ] **Background Embedding Queue**: Implement an asynchronous background queue in `lib/indexer.js` to request vector generation from local Ollama (`POST /api/embeddings`) on file save without blocking the snappy UI.
- [ ] **Semantic Search API**: Add a server-side similarity search endpoint implementing JavaScript-based cosine similarity.
- [ ] **Related Notes Panel**: Build an interactive side-drawer or footer panel in the note editor displaying the top 5 semantically related notes.
