export async function loadGallery() {
    const response = await fetch('/api/objects');
    const objects = await response.json();
    const container = document.getElementById('gallery');
    container.innerHTML = '';

    objects.forEach(obj => {
        const card = document.createElement('article');
        card.className = 'card';
        // We'll dispatch a custom event or use a callback for the editor later
        card.onclick = () => window.dispatchEvent(new CustomEvent('open-editor', { detail: obj }));
        
        const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;
        const displayData = obj.type === 'golf' 
            ? `<div class="card-score">Score: <strong>${meta.score}</strong></div>` 
            : `<div class="card-content">${obj.content.substring(0, 100)}...</div>`;

        card.innerHTML = `
            <div class="card-type">${obj.type}</div>
            <h3>${obj.title}</h3>
            ${displayData}
            <div class="card-location">📍 ${meta.location || 'Unknown'}</div>
        `;
        container.appendChild(card);
    });
}