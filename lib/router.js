import { ObjectsController } from "./controllers/objects.js";
import { SettingsController } from "./controllers/settings.js";
import { AIController } from "./controllers/ai.js";

// ... existing imports ...
export const routes = {
    "GET:/api/objects": ObjectsController.list,
    "POST:/api/save": ObjectsController.save,
    "POST:/api/create": ObjectsController.create,
    "POST:/api/delete": ObjectsController.delete,
    "GET:/api/search": ObjectsController.search,
    "GET:/api/classes": ObjectsController.getClasses,
    "GET:/api/classes/config": ObjectsController.getClassesConfig,
    "GET:/api/types": ObjectsController.getTypes,
    "GET:/api/schemas": ObjectsController.getSchemas,
    "POST:/api/sync": ObjectsController.sync,
    "POST:/api/query": ObjectsController.query,
    "GET:/api/render": ObjectsController.render,
    "GET:/api/settings": SettingsController.get,
    "POST:/api/settings": SettingsController.set,
    "POST:/api/ai/quick-add": AIController.quickAdd,
    "GET:/api/live-reload": handleLiveReload,
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
    
    // 2. If in development, allow falling back to root
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) {
        file = Bun.file(`.${path}`);
        if (await file.exists()) {
            return new Response(file, { headers });
        }
    }
    
    return new Response("Not Found", { status: 404 });
}

const liveReloadClients = new Set();

export function handleLiveReload(req) {
    const stream = new ReadableStream({
        start(controller) {
            liveReloadClients.add(controller);
            
            const interval = setInterval(() => {
                try {
                    controller.enqueue("data: ping\n\n");
                } catch (e) {
                    clearInterval(interval);
                    liveReloadClients.delete(controller);
                }
            }, 10000);

            req.signal.addEventListener("abort", () => {
                clearInterval(interval);
                liveReloadClients.delete(controller);
            });
        },
        cancel() {
            liveReloadClients.delete(this);
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
        },
    });
}

export function broadcastReload(type = "reload") {
    console.log(`🔄 Sending ${type} signal to clients...`);
    for (const client of liveReloadClients) {
        try {
            client.enqueue(`data: ${type}\n\n`);
        } catch (e) {
            // Ignore closed controller errors
        }
    }
}