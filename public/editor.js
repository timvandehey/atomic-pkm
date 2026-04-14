import { loadGallery } from './gallery.js';

let editorInstance = null;
let viewerInstance = null;
let currentObject = null;

function getInputType(key, value) {
    const k = key.toLowerCase();
    if (k.includes('date') || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) return 'date';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    return 'text';
}

/**
 * Called whenever content or metadata changes.
 */
function markDirty() {
    const saveBtn = document.getElementById('btn-save');
    const viewBtn = document.getElementById('btn-view-toggle');
    const closeBtn = document.getElementById('btn-close');
    
    // Only mark dirty if we are in Edit Mode
    const isEditMode = !document.getElementById('body-editor').classList.contains('hidden');
    if (!isEditMode) return;

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('hidden');
    }
    if (viewBtn) {
        viewBtn.classList.add('hidden');
    }
    if (closeBtn) closeBtn.innerHTML = '<span class="material-symbols-rounded">cancel</span>';
}

export function initEditor() {
    const metaForm = document.getElementById('metadata-form');
    const bodyEditorContainer = document.getElementById('body-editor');
    const bodyViewerContainer = document.getElementById('body-viewer');
    const editorContainer = document.getElementById('editor-container');
    const editorPlaceholder = document.getElementById('editor-placeholder');

    // 1. Initialize Toast UI Editor
    editorInstance = new toastui.Editor({
        el: bodyEditorContainer,
        height: 'auto',
        initialEditType: 'markdown',
        previewStyle: 'vertical',
        events: {
            change: markDirty
        }
    });

    // 2. Initialize Toast UI Viewer
    viewerInstance = new toastui.Editor.factory({
        el: bodyViewerContainer,
        viewer: true,
        height: 'auto'
    });

    window.addEventListener('open-editor', (e) => {
        currentObject = e.detail;
        
        if (editorContainer) editorContainer.classList.remove('hidden');
        if (editorPlaceholder) editorPlaceholder.classList.add('hidden');

        // Restore dataset ID for handleSave
        bodyEditorContainer.dataset.currentId = currentObject.id;

        const content = (currentObject.content || '').trim();
        editorInstance.setMarkdown(content);
        viewerInstance.setMarkdown(content);
        
        setViewMode(true);

        const meta = typeof currentObject.metadata === 'string' ? JSON.parse(currentObject.metadata) : currentObject.metadata;
        renderMetadataUI(meta, currentObject.id, currentObject.title);
        updateFooterInfo(meta, currentObject.id);
    });

    // Button Listeners
    document.getElementById('btn-edit')?.addEventListener('click', () => setViewMode(false));
    document.getElementById('btn-view-toggle')?.addEventListener('click', () => setViewMode(true));

    function updateFooterInfo(meta, id) {
        const footerDiv = document.getElementById('editor-footer');
        const footerText = document.getElementById('last-modified-text');
        if (footerDiv && footerText) {
            const dateStr = meta._modifiedDate ? new Date(meta._modifiedDate).toLocaleString() : 'Never';
            footerText.innerText = `File: ${id}.md | Last Modified: ${dateStr}`;
            footerDiv.classList.remove('hidden');
        }
    }

    function renderMetadataUI(meta, id, title) {
        metaForm.innerHTML = `
            <div class="meta-header">
                <h2 class="meta-title">
                    <span class="material-symbols-rounded meta-toggle-icon">expand_more</span> 
                    ${title}
                </h2>
                <button id="btn-add-prop" class="btn-add-prop">
                    <span class="material-symbols-rounded" style="font-size: 1rem;">add</span> Property
                </button>
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
            
            const isHidden = container.classList.toggle('hidden');
            toggleIcon.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
        });

        document.getElementById('btn-add-prop').addEventListener('click', () => {
            const newKey = prompt("Property name:");
            if (newKey && !newKey.startsWith('_')) {
                appendField(container, newKey, "");
                container.classList.remove('hidden');
                toggleIcon.style.transform = 'rotate(0deg)';
                markDirty();
            }
        });
    }

    function appendField(container, key, value) {
        const type = getInputType(key, value);
        let displayValue = value;
        if (value instanceof Date) displayValue = value.toISOString().split('T')[0];

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

/**
 * Toggles between View and Edit modes
 */
export function setViewMode(isView) {
    const viewer = document.getElementById('body-viewer');
    const editor = document.getElementById('body-editor');
    const btnEdit = document.getElementById('btn-edit');
    const btnView = document.getElementById('btn-view-toggle');
    const btnSave = document.getElementById('btn-save');
    const btnClose = document.getElementById('btn-close');
    const metaForm = document.getElementById('metadata-form');

    if (isView) {
        viewer.classList.remove('hidden');
        editor.classList.add('hidden');
        btnEdit.classList.remove('hidden');
        btnView.classList.add('hidden');
        btnSave.classList.add('hidden');
        if (btnClose) btnClose.innerHTML = '<span class="material-symbols-rounded">close</span>';
        
        metaForm.classList.add('view-only');
        
        // Refresh viewer content
        if (editorInstance && viewerInstance) {
            viewerInstance.setMarkdown(editorInstance.getMarkdown());
        }
    } else {
        viewer.classList.add('hidden');
        editor.classList.remove('hidden');
        btnEdit.classList.add('hidden');
        
        metaForm.classList.remove('view-only');
        
        if (editorInstance) editorInstance.focus();
    }
}

export function clearEditor() {
    const editorContainer = document.getElementById('editor-container');
    const editorPlaceholder = document.getElementById('editor-placeholder');
    const app = document.getElementById('app');
    const btnSave = document.getElementById('btn-save');

    if (editorInstance) editorInstance.setMarkdown('');
    if (viewerInstance) viewerInstance.setMarkdown('');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.classList.add('hidden');
    }
    
    if (editorContainer) editorContainer.classList.add('hidden');
    if (editorPlaceholder) editorPlaceholder.classList.remove('hidden');
    if (app) app.classList.remove('show-editor');
}

export function getEditorContent() {
    return editorInstance ? editorInstance.getMarkdown() : '';
}

function getValueType(key, value) {
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'text';
}
