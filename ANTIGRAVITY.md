# Atomic PKM: Project Context & Strategy

Do Not use nodejs (npm), use Bun (perferably built-in)
DO NOT ever use typescript

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

## 5. Frontend & Juris.js Framework Rules

### 5.1 Reactivity & Rendering Lifecycle
- **VDOM vs Component-Level Lifecycle Hooks:** Juris does NOT support lifecycle hooks (such as `onrender`, `onMount`, `onUpdate`, etc.) directly on raw virtual DOM nodes (e.g. `{ input: { onMount: ... } }` is invalid). It only supports lifecycle hooks at the Component definition level. To define component-level hooks, the component function must return an object with a `render` method and a `hooks` configuration:
  ```javascript
  const MyComponent = (props, context) => {
    return {
      hooks: {
        onMount: () => { console.log("Mounted!"); },
        onUpdate: (oldProps, newProps) => { console.log("Updated props!"); },
        onUnmount: () => { console.log("Unmounted!"); }
      },
      render: () => {
        return { div: { text: "Hello" } };
      }
    };
  };
  ```
- **Asynchronous Hooks Support:** Component lifecycle hooks (`onMount`, `onUpdate`, and `onUnmount`) can return Promises. Juris natively handles asynchronous setups and resolves updates in a non-blocking rendering pipeline.
- **Reactivity Isolation & IIFE Avoidance:** Never immediately execute a reactive state-reading function (e.g. `(() => getState('path'))()`) inside a static VDOM children array. Doing so registers the reactive subscription on the entire parent component, leading to full unmounting, destruction of cursor focus, and complete rebuilding of DOM subtrees on every state change. Instead, wrap the reactive expression inside an **anonymous reactive function child** `() => getState('path')` or `() => { ... }` to isolate reactivity to that specific placeholder.
- **Focusing Elements:** To set keyboard focus on a newly rendered DOM element, do NOT attempt to use VDOM callbacks. Instead, schedule a `setTimeout` (typically 50ms - 100ms) within the triggering **Action** or within the Component's `onMount` hook to query the element using `document.getElementById` and call `.focus()`.

### 5.2 Component Structure & Reusability
- **Virtual DOM Conventions:** Juris interfaces are expressed as pure JavaScript objects (Object VDOM). Use standard lowercase element keys (e.g., `{ div: { ... } }`) and standard HTML attributes. Note that you should use `class` instead of `className`.
- **Element Caching & Recycling (The `key` Prop):** When diffing the VDOM, Juris evaluates element cache matches using a generated key hash based on the element's static properties (`id`, `className`, and `text`). Because functions are serialized as `"[function]"`, dynamic evaluation attributes (such as reactive events or dynamic style functions) fail to distinguish separate nodes. Always provide a static `key: uniqueId` attribute to force Juris to cleanly unmount/remount elements when the underlying model changes.
- **Component Return Styles:** A Juris component can return:
  1. A single VDOM node: `{ div: { ... } }`.
  2. A VDOM array: `[ { div: {} }, { span: {} } ]` (rendered as a `DocumentFragment`).
  3. A stateful Component Object containing `hooks` and a `render` function.
  4. A reactive renderer object containing a `render` function (automatically re-evaluates updates).

### 5.3 Centralized State Management (`StateManager`)
- **StateManager APIs:** State changes are transactional and managed via:
  - `getState(path, defaultValue, track)`: Retrieves state from a dot-notated path. Set `track` to `false` as the third parameter to retrieve a value without registering a reactive dependency.
  - `setState(path, value, context)`: Updates a path. Checks for circular updates and blocks them if detected (max update depth is 50).
  - `executeBatch(callback)`: Groups multiple `setState` calls into a single transaction to prevent layout thrashing and run updates in a single batch.
- **Subscriptions:**
  - `subscribe(path, callback, hierarchical = true)`: Standard external subscription. Hierarchical subscriptions trigger if any parent path or nested child path updates.
  - `subscribeExact(path, callback)`: Notified only if the exact path is changed.

### 5.4 Progressive Enhancement (`DOMEnhancer`)
- **API Syntax:** Progressive enhancement allows you to enhance existing, server-rendered static HTML elements with reactive state and event handlers.
  - `app.enhance(selectorOrElement, definition, options)`
- **Dynamic Elements & MutationObservers:** `DOMEnhancer` uses a unified `MutationObserver` to automatically detect newly inserted elements matching the selector and enhance them dynamically.
- **Viewport-Aware (Lazy) Enhancement:** You can defer the enhancement of elements until they enter the user's viewport to optimize memory and rendering performance:
  ```javascript
  app.enhance('.lazy-widget', {
    text: () => 'Loaded!',
    style: { opacity: 1 }
  }, {
    viewportAware: true,
    viewportMargin: '100px',
    minimal: { // Temporary definition to preserve layout sizing
      style: { height: '200px' }
    }
  });
  ```
- **Selectors Category (Container Enhancement):** If the definition contains a `selectors` object, DOMEnhancer registers it as a container enhancement. It monitors child elements inside the container matching the specified sub-selectors and enhances them individually:
  ```javascript
  app.enhance('.form-container', {
    style: { padding: '10px' },
    selectors: {
      'input.reactive-input': (elContext) => ({
        oninput: (e) => elContext.setState('form.input', e.target.value)
      })
    }
  });
  ```

### 5.5 Headless Architecture (`HeadlessManager`)
- **UI-Independent Services:** Headless components represent stateful logic, sync mechanisms, or external services that do not render UI directly.
- **Registration & Auto-initialization:** Registered via `app.registerHeadlessComponent(name, componentFn, options)` or in the `headlessComponents` configuration. Setting `{ autoInit: true }` initializes the component immediately upon app startup.
- **Context API Exposure:** Headless components accept `(props, context)` and return `{ api, hooks }`. The `api` methods are consolidated and spread onto the global context, allowing visual components to call headless actions directly (e.g. `context.navigate(...)`).

### 5.6 Routing Rules (`Router` Headless Component)
- **Modular Router Component:** Routing is provided by the headless component `Router` (loaded from `headless/juris-router.js`).
- **URL Modes:**
  - `hash` (Default): Listens to `hashchange` (e.g. `#/dashboard`).
  - `history`: Listens to `popstate` and uses HTML5 History API (`pushState`/`replaceState`).
  - `memory`: Runs entirely in-memory (ideal for testing or server contexts).
- **Navigation API:**
  - Programmatic navigation is executed via `context.navigate(path, options)` or `context.replace(path, options)`.
  - State retrieval: `context.getCurrentPath()`, `context.getSegments()`, `context.getParams()`, `context.getQuery()`.
- **Dynamic Parameters & Query Strings:** Dynamic path segments (e.g. `/:userId`) are parsed into `url.params` using pattern matching. Query strings (e.g., `?search=term`) are parsed into `url.query`.
- **Custom Segment Parsing:** Configure custom segment names through `segmentParsing.customKeys` to automatically structure path segments in the state:
  ```javascript
  segmentParsing: {
    enabled: true,
    customKeys: ['base', 'sub', 'section', 'item']
  }
  ```
- **Asynchronous Route Guards:** Define navigation flow controls via `globalGuards` or route-specific `guards`. Guards can be async and block navigation by returning `false`:
  ```javascript
  const authGuard = async (newUrl, oldUrl, routeMatch) => {
    const isLoggedIn = await checkAuth();
    return isLoggedIn; // Returns false to cancel navigation
  };
  ```
- **Control Flow Components:** Juris supports declarative logic/control flow components by structuring children as an object:
  - `ConditionalRenderer`: Renders `true` or `false` components based on a reactive boolean `condition`.
  - `SwitchRenderer`: Renders case components based on matching a reactive `value`.
  - `ListRenderer`: Iterates over a reactive array `data` and uses a `render` function to display each item.
  - *Example:*
    ```javascript
    children: {
      SwitchRenderer: {
        value: () => getState('activeTabId'),
        explorer: { ExplorerComponent: {} },
        editor: { EditorComponent: {} }
      }
    }
    ```
  - *Note:* In the actual codebase, standard JS conditional logic (`if/else`, ternary operators) and list operations (`.map()`) inside anonymous reactive function children `() => { ... }` are preferred for direct control flow.
```

