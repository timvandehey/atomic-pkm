let currentObjectId = null;

function openEditor(obj) {
    currentObjectId = obj.id;
    const modal = document.getElementById('editor-modal');
    const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;

    // 1. Build the Metadata Form (The "Form Factory" seed)
    const formContainer = document.getElementById('metadata-form');
    formContainer.innerHTML = ''; // Clear previous
    
    Object.keys(meta).forEach(key => {
        const row = document.createElement('div');
        row.className = 'form-row';
        row.innerHTML = `
            <label>${key}</label>
            <input type="text" name="${key}" value="${meta[key]}" data-key="${key}">
        `;
        formContainer.appendChild(row);
    });

    // 2. Load the Body
    document.getElementById('body-editor').value = obj.content;
    
    modal.style.display = 'block';
}

function closeEditor() {
    document.getElementById('editor-modal').style.display = 'none';
}

// Update the loadGallery function to make cards clickable
async function loadGallery() {
    const response = await fetch('/api/objects');
    const objects = await response.json();
    const container = document.getElementById('gallery');
    container.innerHTML = '';

    objects.forEach(obj => {
        const card = document.createElement('article');
        card.className = 'card';
        // Add click listener
        card.onclick = () => openEditor(obj);
        
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
// Initial Load
loadGallery();