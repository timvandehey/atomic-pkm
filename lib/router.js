import { ObjectsController } from "./controllers/objects.js";

// ... existing imports ...
export const routes = {
    "GET:/api/objects": ObjectsController.list,
    "POST:/api/save": ObjectsController.save,
    "POST:/api/create": ObjectsController.create,
    "POST:/api/delete": ObjectsController.delete,
    "GET:/api/search": ObjectsController.search,
    "GET:/api/types": ObjectsController.getTypes,
    "POST:/api/sync": ObjectsController.sync,
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
    const file = Bun.file(`public${path}`);
    if (await file.exists()) {
        return new Response(file);
    }
    return new Response("Not Found", { status: 404 });
}