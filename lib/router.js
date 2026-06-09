import { ObjectsController } from "./controllers/objects.js";
import { SettingsController } from "./controllers/settings.js";

// ... existing imports ...
export const routes = {
    "GET:/api/objects": ObjectsController.list,
    "POST:/api/save": ObjectsController.save,
    "POST:/api/create": ObjectsController.create,
    "POST:/api/delete": ObjectsController.delete,
    "GET:/api/search": ObjectsController.search,
    "GET:/api/types": ObjectsController.getTypes,
    "GET:/api/schemas": ObjectsController.getSchemas,
    "POST:/api/sync": ObjectsController.sync,
    "POST:/api/query": ObjectsController.query,
    "GET:/api/settings": SettingsController.get,
    "POST:/api/settings": SettingsController.set,
};

export async function handleRequest(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const routeKey = `${method}:${path}`;

    // 1. Check API Routes
    if (routes[routeKey]) {
        return await routes[routeKey](req);
    }

    // 2. Static File Handler (moved to a small helper for clarity)
    return await serveStatic(path);
}

async function serveStatic(path) {
    if (path === "/") path = "/index.html";
    
    const headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    };

    // 1. Try serving from public/ (Buildless assets)
    let file = Bun.file(`public${path}`);
    if (await file.exists()) {
        return new Response(file, { headers });
    }
    
    // 2. Try serving from dist/ (Production assets fallback)
    file = Bun.file(`dist${path}`);
    if (await file.exists()) {
        return new Response(file, { headers });
    }
    
    // 3. If in development, allow falling back to root
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) {
        file = Bun.file(`.${path}`);
        if (await file.exists()) {
            return new Response(file, { headers });
        }
    }
    
    return new Response("Not Found", { status: 404 });
}