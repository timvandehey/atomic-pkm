import { loadGallery } from './gallery.js';

function getInputType(key, value) {
    const k = key.toLowerCase();
    if (k.includes('date') || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) return 'date';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    return 'text';
}

export function initEditor() {
    const metaForm = document.getElementById('metadata-form');
    const bodyEditor = document.getElementById('body-editor');

    window.addEventListener('open-editor', (e) => {
        const obj = e.detail;
        const footerDiv = document.getElementById('editor-footer');
        const footerText = document.getElementById('last-modified-text');
        
        bodyEditor.dataset.currentId = obj.id;
        bodyEditor.value = (obj.content || '').trim();
        
        const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;
        
        if (footerDiv && footerText) {
            const dateStr = meta._modifiedDate ? new Date(meta._modifiedDate).toLocaleString() : 'Never';
            footerText.innerText = `File: ${obj.id}.md | Last Modified: ${dateStr}`;
            footerDiv.style.display = 'block';
        }

        renderMetadataUI(meta, obj.title);
    });

    function renderMetadataUI(meta, title) {
        metaForm.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 style="margin:0; font-size:1.2rem;">${title}</h2>
                <button id="btn-add-prop" style="font-size:0.7rem; cursor:pointer;">+ Property</button>
            </div>
            <div id="fields-container"></div>
        `;

        const container = document.getElementById('fields-container');
        for (const [key, value] of Object.entries(meta)) {
            if (key.startsWith('_')) continue; 
            appendField(container, key, value);
        }

        document.getElementById('btn-add-prop').onclick = () => {
            const newKey = prompt("Property name:");
            if (newKey && !newKey.startsWith('_')) appendField(container, newKey, "");
        };
    }

    function appendField(container, key, value) {
        const type = getInputType(key, value);
        let displayValue = value;
        if (type === 'date' && value) {
            try { displayValue = new Date(value).toISOString().split('T')[0]; } catch (e) { displayValue = value; }
        }

        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'meta-field';
        fieldDiv.style = "display: flex; align-items: center; margin-bottom: 6px; gap: 8px;";
        
        fieldDiv.innerHTML = `
            <label style="font-size: 0.8rem; width: 90px; font-weight: bold; overflow: hidden; text-overflow: ellipsis;">${key}:</label>
            <input type="${type}" data-key="${key}" value="${displayValue}" ${type === 'checkbox' && value ? 'checked' : ''} 
                   style="flex: 1; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
            <button class="delete-prop" style="background:none; border:none; cursor:pointer; font-size:0.8rem;" title="Delete Property">✕</button>
        `;

        fieldDiv.querySelector('.delete-prop').onclick = () => {
            fieldDiv.remove();
            document.getElementById('btn-save').style.border = "2px solid #ffc107";
        };
        
        container.appendChild(fieldDiv);
    }

    bodyEditor.addEventListener('input', () => {
        document.getElementById('btn-save').style.border = "2px solid #ffc107";
    });

    metaForm.addEventListener('input', () => {
        document.getElementById('btn-save').style.border = "2px solid #ffc107";
    });
}

export function clearEditor() {
    const body = document.getElementById('body-editor');
    const meta = document.getElementById('metadata-form');
    const app = document.getElementById('app');
    const saveBtn = document.getElementById('btn-save');
    const footerDiv = document.getElementById('editor-footer');

    if (body) {
        body.value = '';
        body.dataset.currentId = '';
    }
    if (meta) {
        meta.innerHTML = '<p style="color:#888; padding:20px;">Select a note from the sidebar...</p>';
    }
    if (app) {
        app.classList.remove('show-editor');
    }
    if (saveBtn) {
        saveBtn.style.border = "1px solid #ccc";
    }
    if (footerDiv) {
        footerDiv.style.display = 'none';
    }
}