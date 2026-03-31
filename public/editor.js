import { loadGallery } from './gallery.js';

let editorInstance = null;

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
    const bodyEditorContainer = document.getElementById('body-editor');
    const editorContainer = document.getElementById('editor-container');
    const editorPlaceholder = document.getElementById('editor-placeholder');

    // Initialize Toast UI Editor
    editorInstance = new toastui.Editor({
        el: bodyEditorContainer,
        height: 'auto',
        initialEditType: 'markdown',
        previewStyle: 'vertical',
        events: {
            change: markDirty
        }
    });

    window.addEventListener('open-editor', (e) => {
        const obj = e.detail;
        const footerDiv = document.getElementById('editor-footer');
        const footerText = document.getElementById('last-modified-text');
        
        // Show actual editor, hide placeholder
        if (editorContainer) editorContainer.classList.remove('hidden');
        if (editorPlaceholder) editorPlaceholder.classList.add('hidden');

        bodyEditorContainer.dataset.currentId = obj.id;
        editorInstance.setMarkdown((obj.content || '').trim());
        
        const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;
        
        if (footerDiv && footerText) {
            const dateStr = meta._modifiedDate ? new Date(meta._modifiedDate).toLocaleString() : 'Never';
            footerText.innerText = `File: ${obj.id}.md | Last Modified: ${dateStr}`;
            footerDiv.classList.remove('hidden');
        }

        renderMetadataUI(meta, obj.id, obj.title);

        const saveBtn = document.getElementById('btn-save');
        const closeBtn = document.getElementById('btn-close');
        if (saveBtn) saveBtn.disabled = true;
        if (closeBtn) closeBtn.innerText = 'Close';
    });

    function renderMetadataUI(meta, id, title) {
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
            <input type="${type}" data-key="${key}" value="${displayValue}" ${type === 'checkbox' && value ? 'checked' : ''} class="meta-input meta-input-${type}">
            <button class="delete-prop btn-delete-prop" title="Delete Property">✕</button>
        `;

        fieldDiv.querySelector('.delete-prop').addEventListener('click', () => {
            fieldDiv.remove();
            markDirty();
        });
        
        container.appendChild(fieldDiv);
    }

    metaForm.addEventListener('input', markDirty);
}

export function clearEditor() {
    const bodyContainer = document.getElementById('body-editor');
    const app = document.getElementById('app');
    const editorContainer = document.getElementById('editor-container');
    const editorPlaceholder = document.getElementById('editor-placeholder');

    if (editorInstance) {
        editorInstance.setMarkdown('');
    }
    if (bodyContainer) {
        bodyContainer.dataset.currentId = '';
    }
    
    // Hide actual editor, show placeholder
    if (editorContainer) editorContainer.classList.add('hidden');
    if (editorPlaceholder) editorPlaceholder.classList.remove('hidden');

    if (app) {
        app.classList.remove('show-editor');
    }
}

export function getEditorContent() {
    return editorInstance ? editorInstance.getMarkdown() : '';
}
