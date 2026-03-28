import { loadGallery, renderGallery } from './gallery.js';
import { initEditor, clearEditor } from './editor.js';

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
        document.getElementById('search-bar')?.addEventListener('input', () => this.performSearch());
        document.getElementById('type-filter')?.addEventListener('change', () => this.performSearch());

        // Create Note
        document.getElementById('btn-new')?.addEventListener('click', () => this.showCreateModal());
        document.getElementById('btn-submit-create')?.addEventListener('click', () => this.submitNewObject());
        
        // Sync Button
        document.getElementById('btn-sync')?.addEventListener('click', () => this.handleSync());

        // Save Button
        document.getElementById('btn-save')?.addEventListener('click', () => this.handleSave());

        // Delete Button
        document.getElementById('btn-delete')?.addEventListener('click', () => this.handleDelete());
        document.getElementById('btn-back')?.addEventListener('click', () => clearEditor());
    },

    showCreateModal() {
        const modal = document.getElementById('create-modal');
        modal.style.display = 'block';
        document.getElementById('new-title').focus();
    },

    closeCreateModal() {
        document.getElementById('create-modal').style.display = 'none';
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
        document.querySelectorAll('#metadata-form input').forEach(input => {
            const key = input.dataset.key;
            metadata[key] = input.type === 'checkbox' ? input.checked : (input.type === 'number' ? Number(input.value) : input.value);
        });

        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, content: bodyEditor.value, metadata })
        });

    if (response.ok) {
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) saveBtn.style.border = "1px solid #ccc"; // Reset to "Clean"
        await loadGallery();
        console.log("Saved and Clean");
    }
    },

    async handleDelete() {
        const bodyEditor = document.getElementById('body-editor');
        const id = bodyEditor.dataset.currentId;
        if (id && confirm(`Delete "${id}"?`)) {
            const res = await fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
            if (res.ok) {
                clearEditor();
                await loadGallery();
            }
        }
    },
};




// Start the app
App.init();

// Export the App object so you can debug it in the console if you want (Optional)
export default App;