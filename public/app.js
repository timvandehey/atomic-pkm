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
        const searchBar = document.getElementById('search-bar');
        const clearSearchBtn = document.getElementById('btn-clear-search');
        
        const searchHandler = debounce(() => {
            this.performSearch();
            // Toggle clear button visibility
            if (searchBar.value) {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
        }, 300);

        searchBar?.addEventListener('input', searchHandler);
        document.getElementById('type-filter')?.addEventListener('change', () => this.performSearch());
        document.getElementById('tag-filter')?.addEventListener('input', searchHandler);

        // Clear Search Click
        clearSearchBtn?.addEventListener('click', () => {
            searchBar.value = "";
            clearSearchBtn.classList.add('hidden');
            this.performSearch();
            searchBar.focus();
        });

        // Save Search
        document.getElementById('btn-save-search')?.addEventListener('click', () => this.handleSaveSearch());

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

    async showCreateModal() {
        const modal = document.getElementById('create-modal');
        const templateSelect = document.getElementById('template-select');
        const typeList = document.getElementById('type-list');
        
        // 1. Fetch templates
        const tResponse = await fetch('/api/search?type=template');
        const templates = await tResponse.json();
        
        templateSelect.innerHTML = '<option value="">None (Blank Note)</option>';
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.title;
            // Look for 'creates' property, fallback to 'note'
            const meta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
            opt.dataset.targetType = meta.creates || 'note';
            templateSelect.appendChild(opt);
        });

        // 2. Fetch all current types for autocomplete
        const typeResponse = await fetch('/api/types');
        const types = await typeResponse.json();
        console.log("Fetched types for autocomplete:", types);
        typeList.innerHTML = '';
        const uniqueTypes = new Set(['note', 'template', 'query', ...types]);
        uniqueTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            typeList.appendChild(opt);
        });
        console.log("Final type-list HTML:", typeList.innerHTML);

        // 3. Handle template selection auto-fill and dynamic variables
        templateSelect.onchange = () => {
            const varContainer = document.getElementById('template-variables');
            varContainer.innerHTML = '';
            
            if (templateSelect.selectedIndex < 0) return;
            const selected = templateSelect.options[templateSelect.selectedIndex];
            
            if (selected && selected.value) {
                const targetType = selected.dataset.targetType || 'note';
                document.getElementById('new-type').value = targetType;

                const template = templates.find(t => t.id === selected.value);
                if (template) {
                    const meta = typeof template.metadata === 'string' ? JSON.parse(template.metadata) : template.metadata;
                    const content = template.content || '';
                    
                    const fullText = JSON.stringify(meta) + content;
                    const matches = [...fullText.matchAll(/\{\{([\w-]+)\}\}/g)];
                    let vars = Array.from(new Set(matches.map(m => m[1])));
                    
                    if (targetType === 'template' && !vars.includes('creates')) {
                        vars.push('creates');
                    }

                    const builtIns = ['title', 'date'];
                    vars = vars.filter(v => !builtIns.includes(v));

                    if (vars.includes('creates') && vars.includes('targetType')) {
                        vars = vars.filter(v => v !== 'targetType');
                    }

                    if (vars.length > 0) {
                        const header = document.createElement('div');
                        header.style = "font-size: 0.75rem; font-weight: 700; color: var(--md-sys-color-primary); margin-top: 0.5rem; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05rem;";
                        header.textContent = "Template Parameters";
                        varContainer.appendChild(header);

                        const humanize = (s) => s === 'creates' ? 'target type' : s.replace(/([A-Z])/g, ' $1').toLowerCase().trim();

                        vars.forEach(v => {
                            const field = document.createElement('div');
                            field.className = 'variable-field';
                            const labelText = humanize(v);
                            const placeholder = v === 'creates' ? 'e.g. note, meeting...' : v;
                            field.innerHTML = `
                                <label>${labelText}:</label>
                                <input type="text" data-var="${v}" placeholder="${placeholder}">
                            `;
                            varContainer.appendChild(field);
                        });
                    }
                }
            } else {
                document.getElementById('new-type').value = '';
            }
        };

        // 4. Auto-select text on focus
        const newTypeInput = document.getElementById('new-type');
        newTypeInput.onfocus = () => newTypeInput.select();
        newTypeInput.onclick = () => newTypeInput.select();

        modal.classList.remove('hidden');
        document.getElementById('new-title').focus();
    },

    closeCreateModal() {
        document.getElementById('create-modal').classList.add('hidden');
        document.getElementById('new-title').value = '';
        document.getElementById('new-type').value = '';
    },

    async submitNewObject() {
        const title = document.getElementById('new-title').value;
        let type = document.getElementById('new-type').value.trim() || 'note';
        const templateId = document.getElementById('template-select').value;

        // Collect dynamic variables
        const variables = {};
        document.querySelectorAll('#template-variables input').forEach(input => {
            if (input.dataset.var) {
                variables[input.dataset.var] = input.value;
            }
        });

        if (!title) return alert("Please enter a title.");

        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, type, templateId, variables })
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
                document.getElementById('app').classList.add('show-editor');
                window.dispatchEvent(new CustomEvent('open-editor', { detail: newObj }));
                // For new notes, switch to Edit mode immediately
                import('./editor.js').then(m => m.setViewMode(false));
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

    async handleSaveSearch() {
        const query = document.getElementById('search-bar').value;
        const type = document.getElementById('type-filter').value;
        const tag = document.getElementById('tag-filter').value;

        if (!query && !type && !tag) return alert("Search is empty. Nothing to save.");

        const title = prompt("Enter a name for this saved search:", "My Search");
        if (!title) return;

        // Create a 'query' type object
        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title, 
                type: 'query'
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            // Now save the search params as metadata
            // We need to wait a tiny bit for the file watcher to sync the new file
            // Or we just call save immediately
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: result.id, 
                    content: `This is a saved search for:\n- Query: ${query}\n- Type: ${type}\n- Tag: ${tag}`, 
                    metadata: {
                        title,
                        type: 'query',
                        search_query: query,
                        search_type: type,
                        search_tag: tag
                    }
                })
            });

            this.showToast('Search saved!');
            await loadGallery();
        }
    },

    async handleSync() {
        const syncBtn = document.getElementById('btn-sync');
        const originalHTML = syncBtn.innerHTML;
        syncBtn.innerHTML = '<span class="material-symbols-rounded">sync</span> Syncing...';
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
            syncBtn.innerHTML = originalHTML;
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
            const viewBtn = document.getElementById('btn-view-toggle');
            const closeBtn = document.getElementById('btn-close');
            const footerText = document.getElementById('last-modified-text');
            
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.classList.add('hidden');
            }
            if (viewBtn) viewBtn.classList.add('hidden'); // Hide both, will revert to View mode

            // Switch back to View mode after save
            import('./editor.js').then(m => m.setViewMode(true));

            if (closeBtn) closeBtn.innerHTML = '<span class="material-symbols-rounded">close</span>';
            
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
        const isDirty = saveBtn && !saveBtn.disabled;

        if (isDirty) {
            if (confirm("You have unsaved changes. Discard them?")) {
                clearEditor();
                import('./editor.js').then(m => m.setViewMode(true));
            }
        } else {
            clearEditor();
            import('./editor.js').then(m => m.setViewMode(true));
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
