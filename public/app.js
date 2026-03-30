import { loadGallery, renderGallery } from './gallery.js';
import { initEditor, clearEditor } from './editor.js';

/**
 * Utility to limit the rate at which a function fires.
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Encapsulated App Module
 */
const App = {
    async init() {
        // 1. Initial Data Loads
        await loadGallery();
        await this.populateTypeFilter();
        initEditor();

        // 2. Attach Event Listeners (Replacing HTML onclicks)
        this.bindEvents();
    },

bindEvents() {
        // Search & Filter
        document.getElementById('search-bar')?.addEventListener('input', debounce(() => this.performSearch(), 300));
        document.getElementById('type-filter')?.addEventListener('change', () => this.performSearch());

        // Create Note
        document.getElementById('btn-new')?.addEventListener('click', () => this.showCreateModal());
        document.getElementById('btn-submit-create')?.addEventListener('click', () => this.submitNewObject());
        document.getElementById('btn-cancel-create')?.addEventListener('click', () => this.closeCreateModal());
        
        // Sync Button
        document.getElementById('btn-sync')?.addEventListener('click', () => this.handleSync());

        // Save Button
        document.getElementById('btn-save')?.addEventListener('click', () => this.handleSave());

        // Delete Button
        document.getElementById('btn-delete')?.addEventListener('click', () => this.handleDelete());

        // Close Button (using the new safety check)
        document.getElementById('btn-close')?.addEventListener('click', () => this.handleClose());

        // Keyboard shortcut for Save (Cmd/Ctrl + S)
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
                // Prevent the browser's default save-page action
                e.preventDefault();
                const saveBtn = document.getElementById('btn-save');
                // Trigger save only if there are unsaved changes (button is enabled)
                if (saveBtn && !saveBtn.disabled) {
                    this.handleSave();
                }
            }
        });
    },

    showCreateModal() {
        const modal = document.getElementById('create-modal');
        modal.classList.remove('hidden');
        document.getElementById('new-title').focus();
    },

    closeCreateModal() {
        document.getElementById('create-modal').classList.add('hidden');
        document.getElementById('new-title').value = '';
        document.getElementById('new-type').value = 'note';
    },

    async submitNewObject() {
        const title = document.getElementById('new-title').value;
        const type = document.getElementById('new-type').value;

        if (!title) return alert("Please enter a title.");

        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, type })
        });

        if (response.ok) {
            const result = await response.json();
            this.closeCreateModal();

            const listResponse = await fetch('/api/objects');
            const objects = await listResponse.json();
            
            renderGallery(objects);
            await this.populateTypeFilter();

            const newObj = objects.find(o => o.id === result.id);
            if (newObj) {
                window.dispatchEvent(new CustomEvent('open-editor', { detail: newObj }));
            }
        }
    },

    async performSearch() {
        const query = document.getElementById('search-bar').value;
        const type = document.getElementById('type-filter').value;
        
        const url = `/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`;
        const response = await fetch(url);
        const filteredObjects = await response.json();
        
        renderGallery(filteredObjects);
    },

    async populateTypeFilter() {
        const response = await fetch('/api/types');
        const types = await response.json();
        const filter = document.getElementById('type-filter');

        filter.innerHTML = '<option value="">All Types</option>';
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            filter.appendChild(option);
        });
    },

    async handleSync() {
        const syncBtn = document.getElementById('btn-sync');
        syncBtn.innerText = "⏳";
        clearEditor();
        const response = await fetch('/api/sync', { method: 'POST' });
        if (response.ok) {
            await loadGallery();
            syncBtn.innerText = "🔄";
            const status = document.getElementById('sync-status');
            if (status) status.innerText = `Synced: ${new Date().toLocaleTimeString()}`;
        }
    },

async handleSave() {
        const bodyEditor = document.getElementById('body-editor');
        const id = bodyEditor.dataset.currentId;
        if (!id) return;

        const metadata = {};
        // Target .meta-input to capture input, select, and textarea elements
        document.querySelectorAll('#metadata-form .meta-input').forEach(field => {
            const key = field.dataset.key;
            metadata[key] = field.type === 'checkbox' ? field.checked : 
                            (field.type === 'number' ? Number(field.value) : field.value);
        });

        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, content: bodyEditor.value, metadata })
        });

        if (response.ok) {
            const saveBtn = document.getElementById('btn-save');
            const closeBtn = document.getElementById('btn-close');
            const footerText = document.getElementById('last-modified-text');
            
            if (saveBtn) saveBtn.disabled = true;
            if (closeBtn) closeBtn.innerText = 'Close';
            
            if (footerText) {
                const now = new Date().toLocaleString();
                footerText.innerText = `File: ${id}.md | Last Modified: ${now}`;
            }

            await loadGallery();
            this.showToast('Saved!');
        } else {
            this.showToast('Failed to save changes.', 'error');
        }
    },

    updateFooter(content, modifiedDate) {
        const footerText = document.getElementById('last-modified-text');
        const footerDiv = document.getElementById('editor-footer');
        
        if (!footerText || !footerDiv) return;

        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const dateStr = new Date(modifiedDate).toLocaleString();
        
        footerText.innerText = `Words: ${words} | Last Modified: ${dateStr}`;
        footerDiv.classList.remove('hidden');
    },

async handleDelete() {
        const bodyEditor = document.getElementById('body-editor');
        const id = bodyEditor.dataset.currentId;
        
        if (id && confirm(`Delete "${id}" and its physical markdown file?`)) {
            const res = await fetch('/api/delete', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ id }) 
            });
            
            if (res.ok) {
                clearEditor();
                await loadGallery();
            }
        }
    },

    handleClose() {
        const saveBtn = document.getElementById('btn-save');
        // Check if the save button is enabled
        const isDirty = saveBtn && !saveBtn.disabled;

        if (isDirty) {
            if (confirm("You have unsaved changes. Discard them?")) {
                clearEditor();
            }
        } else {
            clearEditor();
        }
    },

    showToast(message, type = 'success') {
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'toast';
            const container = document.querySelector('.editor-view') || document.body;
            container.appendChild(toast);
        }

        if (type === 'error') {
            toast.classList.add('error');
        } else {
            toast.classList.remove('error');
        }

        toast.innerText = message;
        toast.classList.add('show');
        
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
};




// Start the app
App.init();

// Export the App object so you can debug it in the console if you want (Optional)
export default App;