# Design: Dataview Bridge (dv)

Implementing a custom **Dataview** library to create a bridge between Markdown files, the SQLite database, and the Toast UI Editor.

## 🏗️ Architecture Overview

The system consists of three distinct layers:

### 1. UI Interceptor (Frontend)
Located in `public/editor.js`, this layer uses the Toast UI `customHTMLRenderer` to intercept `dataviewjs` code blocks. Instead of rendering them as static code, it generates a unique placeholder `div` and triggers an asynchronous fetch to the server.

- **Trigger**: Detecting ` ```dataviewjs ` blocks.
- **Action**: Call `fetchDataview(literal, id)`.
- **Output**: A loading placeholder that gets hydrated with server-returned HTML.

### 2. Sandbox Library (Server-side Logic)
A internal library (potentially in `lib/dv.js`) that defines the `dv` object exposed to user scripts.

- **`dv.pages(query)`**: Translates simple queries (like tags) into high-performance SQLite lookups.
- **`dv.list(items)`**: Formats an array of data into an HTML unordered list.
- **`dv.table(headers, rows)`**: Formats data into a structured HTML table.

### 3. Execution Engine (Server-side Runtime)
Integration in `server.js` (or a dedicated controller) that uses `node:vm` to execute the user's script safely.

- **Sandbox**: A isolated context containing the `dv` library and a restricted `console`.
- **Safety**: Uses `vm.runInContext` with a strict `timeout` (e.g., 50ms) to prevent infinite loops or server crashes.

## 🛠️ Implementation Plan

1. **Backend**:
   - Create `lib/dv.js` to house the `createDvLibrary` logic.
   - Add a new API route `POST /api/query` in `lib/router.js` and a corresponding controller method.
   - Implement the `node:vm` execution logic with proper error handling.

2. **Frontend**:
   - Update the Toast UI Editor initialization in `public/editor.js` to include the `customHTMLRenderer`.
   - Implement the `fetchDataview` helper function to handle the API call and DOM updates.

3. **Styling**:
   - Add CSS for `.dv-loading`, `.dv-error`, and the resulting `table`/`ul` outputs to ensure they match the Electric Blue theme.
