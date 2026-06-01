import { reactive, watch } from 'vue';

export const store = reactive({
    // State
    objects: [],
    types: [],
    schemas: {},
    sidebarWidth: 250,
    openTabs: [], // Array of objects: { id, title, type, content, metadata, isEditMode, metaVisible }
    activeTabId: null,
    
    // Search Filters
    searchQuery: '',
    searchType: '',
    searchTag: '',
    
    // UI State
    menuOpen: false,
    advancedSearchOpen: false,
    isCreatingNote: false,
    newNoteTitle: '',
    newNoteType: 'note',
    selectedTemplate: '',
    mobileSidebarOpen: true,

    // Actions
    async fetchObjects() {
        const url = `/api/search?q=${encodeURIComponent(this.searchQuery)}&type=${encodeURIComponent(this.searchType)}&tag=${encodeURIComponent(this.searchTag)}`;
        const res = await fetch(url);
        this.objects = await res.json();
    },

    async fetchTypes() {
        const res = await fetch('/api/types');
        this.types = await res.json();
    },

    async fetchSchemas() {
        const res = await fetch('/api/schemas');
        this.schemas = await res.json();
    },

    async fetchSettings() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            if (settings.sidebarWidth) {
                this.sidebarWidth = settings.sidebarWidth;
            }
        } catch (err) {
            console.error("Failed to fetch settings:", err);
        }
    },

    async saveSidebarWidth(width) {
        this.sidebarWidth = width;
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'sidebarWidth', value: width })
            });
        } catch (err) {
            console.error("Failed to save settings:", err);
        }
    },

    openTab(note) {
        // If query type, perform search instead of opening tab
        if (note.type === 'query') {
            const meta = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata;
            this.searchQuery = meta.search_query || "";
            this.searchType = meta.search_type || "";
            this.searchTag = meta.search_tag || "";
            this.advancedSearchOpen = !!(meta.search_type || meta.search_tag);
            this.fetchObjects();
            return;
        }

        const existing = this.openTabs.find(t => t.id === note.id);
        if (!existing) {
            // Clone the note and add view-specific properties
            const tab = {
                ...note,
                metadata: typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata,
                isEditMode: false,
                metaVisible: false
            };
            this.openTabs.push(tab);
        }
        this.activeTabId = note.id;
        this.mobileSidebarOpen = false;
    },

    closeTab(id) {
        const index = this.openTabs.findIndex(t => t.id === id);
        if (index !== -1) {
            this.openTabs.splice(index, 1);
            if (this.activeTabId === id) {
                this.activeTabId = this.openTabs.length > 0 ? this.openTabs[this.openTabs.length - 1].id : null;
            }
        }
        if (this.openTabs.length === 0) {
            this.mobileSidebarOpen = true;
        }
    },

    async handleSync() {
        await fetch('/api/sync', { method: 'POST' });
        await this.fetchObjects();
    }
});

// Watch search filters to trigger fetch
watch(() => [store.searchQuery, store.searchType, store.searchTag], () => {
    store.fetchObjects();
}, { deep: true });
