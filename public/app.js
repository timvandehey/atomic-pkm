import { loadGallery, renderGallery } from './gallery.js';
import { initEditor, clearEditor, getEditorContent } from './editor.js';

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
        this.initResizer();

        // 2. Attach Event Listeners (Replacing HTML onclicks)
        this.bindEvents();
    },

    initResizer() {
        const sidebar = document.querySelector('.sidebar');
        const resizer = document.getElementById('sidebar-resizer');
        if (!resizer || !sidebar) return;

        // Load saved width
        const savedWidth = localStorage.getItem('sidebar-width');
        if (savedWidth) {
            sidebar.style.width = `${savedWidth}px`;
        }

        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            // Disable pointer events on the editor to prevent iframe issues or selection
            document.querySelector('.editor-view').style.pointerEvents = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const offset = 0; // Adjust if body has margin/padding
            let newWidth = e.clientX - offset;

            // Constraints are handled by CSS min-width/max-width, 
            // but we apply them here for smoother feedback
            if (newWidth < 250) newWidth = 250;
            if (newWidth > 600) newWidth = 600;

            sidebar.style.width = `${newWidth}px`;
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.querySelector('.editor-view').style.pointerEvents = 'auto';
                
                // Save width to localStorage
                localStorage.setItem('sidebar-width', sidebar.offsetWidth);
            }
        });
    },

bindEvents() {
        // Hamburger Menu
        document.getElementById('btn-menu')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('menu-dropdown')?.classList.toggle('hidden');
        });

        // Advanced Search Toggle
        document.getElementById('btn-toggle-advanced')?.addEventListener('click', () => {
            const panel = document.getElementById('advanced-search');
            const isClosing = !panel.classList.contains('hidden');
            
            panel.classList.toggle('hidden');

            if (isClosing) {
                // Reset filters
                document.getElementById('type-filter').value = "";
                document.getElementById('tag-filter').value = "";
                this.performSearch(); // Refresh search with cleared filters
            }
        });

        // Close menu when clicking outside
        window.addEventListener('click', () => {
            document.getElementById('menu-dropdown')?.classList.add('hidden');
        });

        // Search & Filter
        const searchHandler = debounce(() => this.performSearch(), 300);
        document.getElementById('search-bar')?.addEventListener('input', searchHandler);
        document.getElementById('type-filter')?.addEventListener('change', () => this.performSearch());
        document.getElementById('tag-filter')?.addEventListener('input', searchHandler);

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
        const tag = document.getElementById('tag-filter').value;
        
        const url = `/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&tag=${encodeURIComponent(tag)}`;
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
        const originalText = syncBtn.innerHTML;
        syncBtn.innerHTML = "⏳ Syncing...";
        syncBtn.disabled = true;
        
        clearEditor();
        try {
            const response = await fetch('/api/sync', { method: 'POST' });
            if (response.ok) {
                await loadGallery();
                this.showToast('Data synced successfully!');
            } else {
                this.showToast('Sync failed.', 'error');
            }
        } catch (err) {
            this.showToast('Sync error.', 'error');
        } finally {
            syncBtn.innerHTML = originalText;
            syncBtn.disabled = false;
        }
    },

async handleSave() {
        const bodyEditor = document.getElementById('body-editor');
        const id = bodyEditor.dataset.currentId;
        if (!id) return;

        const content = getEditorContent();
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
            body: JSON.stringify({ id, content, metadata })
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

        const actualContent = content || getEditorContent();
        const words = actualContent.trim() ? actualContent.trim().split(/\s+/).length : 0;
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
