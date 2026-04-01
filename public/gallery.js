/**
 * Renders an array of objects to the gallery container.
 * This is the function the Search Bar calls directly.
 */
export function renderGallery(objects) {
    // console.log("Sidebar Rendered:", JSON.stringify(objects, null, 2));
    const container = document.getElementById('note-list');
    container.innerHTML = '';

    objects.forEach(obj => {
        const card = document.createElement('article');
        card.className = 'card';
// Inside your renderGallery loop in gallery.js
        card.onclick = () => {
            if (obj.type === 'query') {
                const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;

                // Populate search inputs
                document.getElementById('search-bar').value = meta.search_query || "";
                document.getElementById('type-filter').value = meta.search_type || "";
                document.getElementById('tag-filter').value = meta.search_tag || "";

                // Show advanced panel if filters are active
                if (meta.search_type || meta.search_tag) {
                    document.getElementById('advanced-search').classList.remove('hidden');
                }

                // Trigger the search
                // Note: We need to access the App instance. 
                // Since App is exported as default, we can use a custom event or reach out to it.
                // For simplicity, let's just trigger the 'input' event on search-bar.
                document.getElementById('search-bar').dispatchEvent(new Event('input'));
                return;
            }

            document.getElementById('app').classList.add('show-editor');
            window.dispatchEvent(new CustomEvent('open-editor', { detail: obj }));
        };
        
        const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;
        
        // Your existing "Type-Aware" logic preserved here
        const displayData = obj.type === 'golf' 
            ? `<div class="card-score">Score: <strong>${meta.score || 'N/A'}</strong></div>` 
            : `<div class="card-content">${(obj.content || '').substring(0, 100)}...</div>`;

        card.innerHTML = `
            <div class="card-type">${obj.type}</div>
            <h3>${obj.title}</h3>
            ${displayData}
            <div class="card-location">📍 ${meta.location || 'Unknown'}</div>
        `;
        container.appendChild(card);
    });
}

/**
 * The initial load function that fetches all objects from the server.
 */
export async function loadGallery() {
    const response = await fetch('/api/objects');
    const objects = await response.json();
    renderGallery(objects); // Simply hands the data to the renderer
}