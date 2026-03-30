import { loadGallery } from './gallery.js';

function getInputType(key, value) {
    const k = key.toLowerCase();
    if (k.includes('date') || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) return 'date';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    return 'text';
}

function markDirty() {
    const saveBtn = document.getElementById('btn-save');
    const closeBtn = document.getElementById('btn-close');
    if (saveBtn) saveBtn.disabled = false;
    if (closeBtn) closeBtn.innerText = 'Cancel';
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
            footerDiv.classList.remove('hidden');
        }

        renderMetadataUI(meta, obj.title);

        const saveBtn = document.getElementById('btn-save');
        const closeBtn = document.getElementById('btn-close');
        if (saveBtn) saveBtn.disabled = true;
        if (closeBtn) closeBtn.innerText = 'Close';
    });

    function renderMetadataUI(meta, title) {
        metaForm.innerHTML = `
            <div class="meta-header">
                <h2 class="meta-title"><span class="meta-toggle-icon">▸</span> ${title}</h2>
                <button id="btn-add-prop" class="btn-add-prop">+ Property</button>
            </div>
            <div id="fields-container" class="hidden"></div>
        `;

        const container = document.getElementById('fields-container');
        for (const [key, value] of Object.entries(meta)) {
            if (key.startsWith('_')) continue; 
            appendField(container, key, value);
        }

        const metaHeader = metaForm.querySelector('.meta-header');
        const toggleIcon = metaForm.querySelector('.meta-toggle-icon');

        metaHeader.addEventListener('click', (e) => {
            // Prevent toggling when the button is clicked
            if (e.target.closest('#btn-add-prop')) return;

            container.classList.toggle('hidden');
            toggleIcon.textContent = container.classList.contains('hidden') ? '▸' : '▾';
        });

        document.getElementById('btn-add-prop').addEventListener('click', () => {
            const newKey = prompt("Property name:");
            if (newKey && !newKey.startsWith('_')) {
                appendField(container, newKey, "");
                container.classList.remove('hidden');
                toggleIcon.textContent = '▾';
            }
        });
    }

    function appendField(container, key, value) {
        const type = getInputType(key, value);
        let displayValue = value;
        if (type === 'date' && value) {
            try { displayValue = new Date(value).toISOString().split('T')[0]; } catch (e) { displayValue = value; }
        }

        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'meta-field';
        
        fieldDiv.innerHTML = `
            <label class="meta-label">${key}:</label>
            <input type="${type}" data-key="${key}" value="${displayValue}" ${type === 'checkbox' && value ? 'checked' : ''} class="meta-input">
            <button class="delete-prop btn-delete-prop" title="Delete Property">✕</button>
        `;

        fieldDiv.querySelector('.delete-prop').addEventListener('click', () => {
            fieldDiv.remove();
            markDirty();
        });
        
        container.appendChild(fieldDiv);
    }

    bodyEditor.addEventListener('input', markDirty);
    metaForm.addEventListener('input', markDirty);
}

export function clearEditor() {
    const body = document.getElementById('body-editor');
    const meta = document.getElementById('metadata-form');
    const app = document.getElementById('app');
    const saveBtn = document.getElementById('btn-save');
    const closeBtn = document.getElementById('btn-close');
    const footerDiv = document.getElementById('editor-footer');

    if (body) {
        body.value = '';
        body.dataset.currentId = '';
    }
    if (meta) {
        meta.innerHTML = '<p class="empty-meta-msg">Select a note from the sidebar...</p>';
    }
    if (app) {
        app.classList.remove('show-editor');
    }
    if (saveBtn) {
        saveBtn.disabled = true;
    }
    if (closeBtn) {
        closeBtn.innerText = 'Close';
    }
    if (footerDiv) {
        footerDiv.classList.add('hidden');
    }
}