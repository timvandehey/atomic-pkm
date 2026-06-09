import { GalleryComponent } from './gallery.js?v=5';
import { CreateNoteComponent } from './create-view.js?v=5';
import { EditorComponent, renderMarkdownView, initEasyMDE, destroyEasyMDE } from './editor.js?v=5';
import { ExplorerComponent } from './explorer.js?v=5';

// Helper to parse full Markdown string into metadata and content body
function parseFullMarkdown(raw) {
  try {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (match) {
      return {
        metadata: jsyaml.load(match[1]),
        content: match[2].trim()
      };
    }
  } catch (e) {
    console.error("YAML Parse Error", e);
  }
  return null;
}

// Global Top Header Component containing Menus, Tabs, and Note Actions
const TopHeaderComponent = (props, { getState, setState }) => {
  return {
    header: {
      class: 'top-header',
      children: [
        // Left Side: Global Actions (Menu / Sync, New Note)
        {
          div: {
            class: 'header-left',
            children: [
              {
                div: {
                  class: 'menu-container',
                  children: [
                    {
                      button: {
                        id: 'btn-menu',
                        title: 'Menu',
                        onclick: () => setState('menuOpen', !getState('menuOpen', false)),
                        children: [{ span: { class: 'material-symbols-rounded', text: 'menu' } }]
                      }
                    },
                    {
                      div: {
                        class: () => `dropdown-content ${getState('menuOpen', false) ? '' : 'hidden'}`,
                        children: [
                          {
                            button: {
                              id: 'btn-sync',
                              title: 'Sync Files',
                              onclick: () => {
                                setState('menuOpen', false);
                                if (window.appInstance) window.appInstance.actions.handleSync();
                              },
                              children: [
                                { span: { class: 'material-symbols-rounded', text: 'sync' } },
                                { span: { text: ' Sync Data' } }
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                button: {
                  id: 'btn-new',
                  title: 'New Note',
                  onclick: () => setState('isCreatingNote', true),
                  children: [{ span: { class: 'material-symbols-rounded', text: 'add' } }]
                }
              }
            ]
          }
        },
        // Center: Tab List
        {
          div: {
            class: 'tab-bar',
            children: () => {
              const openTabs = getState('openTabs', []);
              const activeTabId = getState('activeTabId', 'explorer');
              
              // Explorer Tab (static first tab, cannot be closed)
              const tabs = [
                {
                  div: {
                    class: () => `tab-item ${activeTabId === 'explorer' ? 'active' : ''}`,
                    onclick: () => {
                      if (window.appInstance) {
                        window.appInstance.actions.setActiveTab('explorer');
                      }
                    },
                    children: [
                      { span: { class: 'material-symbols-rounded', style: 'font-size: 1.25rem;', text: 'grid_view' } },
                      { span: { class: 'tab-title', text: 'Explorer' } }
                    ]
                  }
                }
              ];
              
              // Render open notes as tabs next to it
              openTabs.forEach(tab => {
                tabs.push({
                  div: {
                    class: () => `tab-item ${activeTabId === tab.id ? 'active' : ''}`,
                    onclick: () => {
                      if (window.appInstance) {
                        window.appInstance.actions.setActiveTab(tab.id);
                      }
                    },
                    children: [
                      { span: { class: 'tab-title', text: tab.title } },
                      {
                        span: {
                          class: 'material-symbols-rounded tab-close',
                          text: 'close',
                          onclick: (e) => {
                            e.stopPropagation();
                            if (window.appInstance) {
                              window.appInstance.actions.closeTab(tab.id);
                            }
                          }
                        }
                      }
                    ]
                  }
                });
              });
              
              return tabs;
            }
          }
        },
        // Right Side: Active Tab Actions (Edit, Save, Raw, Delete)
        {
          div: {
            class: 'header-right',
            children: () => {
              const activeTabId = getState('activeTabId', 'explorer');
              if (activeTabId === 'explorer') return [];
              
              const openTabs = getState('openTabs', []);
              const tab = openTabs.find(t => t.id === activeTabId);
              if (!tab) return [];
              
              return [
                // Edit/View toggle button (dynamic functional definition)
                () => {
                  const tabs = getState('openTabs', []);
                  const activeId = getState('activeTabId');
                  const t = tabs.find(x => x.id === activeId);
                  if (!t) return null;
                  
                  return {
                    button: {
                      class: () => `header-btn ${t.isEditMode ? 'btn-primary' : ''}`,
                      title: () => t.isEditMode ? 'View Mode' : 'Edit Mode',
                      onclick: () => {
                        console.log("[Header] Edit toggle button clicked for tab:", t.id);
                        if (window.appInstance) window.appInstance.actions.toggleEditMode(t.id);
                      },
                      children: [{ 
                        span: { 
                          class: 'material-symbols-rounded', 
                          text: () => t.isEditMode ? 'visibility' : 'edit' 
                        } 
                      }]
                    }
                  };
                },
                // Save button
                () => {
                  const tabs = getState('openTabs', []);
                  const activeId = getState('activeTabId');
                  const t = tabs.find(x => x.id === activeId);
                  if (t && (t.isEditMode || t.isRawMode)) {
                    return {
                      button: {
                        class: 'btn-primary header-btn',
                        title: 'Save',
                        onclick: () => {
                          if (window.appInstance) window.appInstance.actions.saveNote(t.id);
                        },
                        children: [{ span: { class: 'material-symbols-rounded', text: 'save' } }]
                      }
                    };
                  }
                  return null;
                },
                // Toggle Raw mode button
                () => {
                  const tabs = getState('openTabs', []);
                  const activeId = getState('activeTabId');
                  const t = tabs.find(x => x.id === activeId);
                  if (t && (t.isEditMode || t.isRawMode)) {
                    return {
                      button: {
                        class: () => `header-btn ${t.isRawMode ? 'active' : ''}`,
                        title: 'Toggle Raw Markdown',
                        onclick: () => {
                          if (window.appInstance) window.appInstance.actions.toggleRawMode(t.id);
                        },
                        children: [{ span: { class: 'material-symbols-rounded', text: 'code' } }]
                      }
                    };
                  }
                  return null;
                },
                // Delete button
                () => {
                  const tabs = getState('openTabs', []);
                  const activeId = getState('activeTabId');
                  const t = tabs.find(x => x.id === activeId);
                  if (t) {
                    return {
                      button: {
                        class: 'header-btn',
                        style: 'color: var(--md-sys-color-error);',
                        title: 'Delete Note',
                        onclick: () => {
                          if (confirm("Are you sure you want to delete this note? This action is permanent.")) {
                            if (window.appInstance) window.appInstance.actions.deleteNote(t.id);
                          }
                        },
                        children: [{ span: { class: 'material-symbols-rounded', text: 'delete' } }]
                      }
                    };
                  }
                  return null;
                }
              ].filter(Boolean);
            }
          }
        }
      ]
    }
  };
};

// Main Content switcher based on active tab
const MainContentComponent = (props, context) => {
  return {
    div: {
      class: 'main-content-area',
      children: () => {
        const activeTabId = context.getState('activeTabId', 'explorer');
        const openTabs = context.getState('openTabs', []); // Reactive subscription to trigger re-renders on tab state changes
        
        if (activeTabId === 'explorer') {
          return [ExplorerComponent(props, context)];
        }
        return [EditorComponent(props, context)];
      }
    }
  };
};

// Main App Setup
const app = new Juris({
  states: {
    objects: [],
    types: [],
    schemas: {},
    sidebarWidth: 250,
    openTabs: [],
    activeTabId: 'explorer',
    mobileSidebarOpen: true,
    menuOpen: false,
    advancedSearchOpen: false,
    searchQuery: '',
    searchType: '',
    searchTag: '',
    isCreatingNote: false,
    newNoteTitle: '',
    newNoteType: 'note',
    selectedTemplate: ''
  },
  
  components: {
    GalleryComponent,
    CreateNoteComponent,
    TopHeaderComponent,
    MainContentComponent,
    ExplorerComponent,
    EditorComponent
  },
  
  layout: {
    div: {
      id: 'app-root',
      children: () => {
        const isCreatingNote = app.getState('isCreatingNote', false);
        const context = app.createContext();
        if (isCreatingNote) {
          return [CreateNoteComponent({}, context)];
        }
        
        return [
          TopHeaderComponent({}, context),
          MainContentComponent({}, context)
        ];
      }
    }
  }
});


// Attach Actions
app.actions = {
  async fetchObjects() {
    const q = app.getState('searchQuery', '');
    const type = app.getState('searchType', '');
    const tag = app.getState('searchTag', '');
    const url = `/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&tag=${encodeURIComponent(tag)}`;
    const res = await fetch(url);
    const data = await res.json();
    app.setState('objects', data);
  },

  async fetchTypes() {
    const res = await fetch('/api/types');
    const data = await res.json();
    app.setState('types', data);
  },

  async fetchSchemas() {
    const res = await fetch('/api/schemas');
    const data = await res.json();
    app.setState('schemas', data);
  },

  async fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      if (settings.sidebarWidth) {
        app.setState('sidebarWidth', settings.sidebarWidth);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  },

  async saveSidebarWidth(width) {
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
    if (note.type === 'query') {
      const meta = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata;
      app.setState('searchQuery', meta.search_query || "");
      app.setState('searchType', meta.search_type || "");
      app.setState('searchTag', meta.search_tag || "");
      app.setState('advancedSearchOpen', !!(meta.search_type || meta.search_tag));
      app.setState('activeTabId', 'explorer');
      app.actions.fetchObjects();
      return;
    }

    const openTabs = app.getState('openTabs', []);
    const existing = openTabs.find(t => t.id === note.id);
    if (!existing) {
      const tab = {
        ...note,
        metadata: typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata,
        isEditMode: false,
        isRawMode: false,
        metaVisible: false,
        rawFullContent: ''
      };
      app.setState('openTabs', [...openTabs, tab]);
      setTimeout(() => renderMarkdownView(tab), 50);
    } else {
      if (!existing.isEditMode) {
        setTimeout(() => renderMarkdownView(existing), 50);
      }
    }
    app.setState('activeTabId', note.id);
    app.setState('mobileSidebarOpen', false);
  },

  setActiveTab(id) {
    console.log("[App] Setting active tab to:", id);
    app.setState('activeTabId', id);
    const tabs = app.getState('openTabs');
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      if (tab.isEditMode && !tab.isRawMode) {
        setTimeout(() => initEasyMDE(tab), 50);
      } else if (!tab.isEditMode && !tab.isRawMode) {
        setTimeout(() => renderMarkdownView(tab), 50);
      }
    }
  },

  closeTab(id) {
    const openTabs = app.getState('openTabs', []);
    const index = openTabs.findIndex(t => t.id === id);
    if (index !== -1) {
      const tab = openTabs[index];
      destroyEasyMDE(tab);
      const updatedTabs = openTabs.filter(t => t.id !== id);
      
      let activeId = app.getState('activeTabId');
      if (activeId === id) {
        activeId = updatedTabs.length > 0 ? updatedTabs[updatedTabs.length - 1].id : 'explorer';
      }
      
      app.setState('openTabs', updatedTabs);
      if (activeId) {
        app.actions.setActiveTab(activeId);
      } else {
        app.setState('activeTabId', 'explorer');
      }
    }
  },

  toggleEditMode(tabId) {
    console.log("[App] toggleEditMode executing for:", tabId);
    const tabs = app.getState('openTabs');
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      if (tab.isEditMode) {
        console.log("[App] Destroying EasyMDE before state update");
        destroyEasyMDE(tab);
      }
      
      const updatedTabs = tabs.map(t => {
        if (t.id === tabId) {
          return { ...t, isEditMode: !t.isEditMode };
        }
        return t;
      });
      
      app.setState('openTabs', updatedTabs);
      
      const newTab = updatedTabs.find(t => t.id === tabId);
      if (newTab.isEditMode) {
        console.log("[App] Scheduling initEasyMDE");
        setTimeout(() => initEasyMDE(newTab), 50);
      } else {
        console.log("[App] Scheduling renderMarkdownView");
        setTimeout(() => renderMarkdownView(newTab), 50);
      }
    }
  },

  toggleRawMode(tabId) {
    const tabs = app.getState('openTabs');
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      if (tab.isRawMode) {
        const parsed = parseFullMarkdown(tab.rawFullContent);
        if (!parsed) {
          alert("Invalid Markdown format. Ensure you have --- frontmatter blocks.");
          return;
        }
        const updatedTabs = tabs.map(t => {
          if (t.id === tabId) {
            return {
              ...t,
              metadata: parsed.metadata,
              content: parsed.content,
              isRawMode: false
            };
          }
          return t;
        });
        app.setState('openTabs', updatedTabs);
        const newTab = updatedTabs.find(t => t.id === tabId);
        if (newTab.isEditMode) {
          setTimeout(() => initEasyMDE(newTab), 50);
        } else {
          setTimeout(() => renderMarkdownView(newTab), 50);
        }
      } else {
        destroyEasyMDE(tab);
        const frontmatter = jsyaml.dump(tab.metadata);
        const updatedTabs = tabs.map(t => {
          if (t.id === tabId) {
            return {
              ...t,
              rawFullContent: `---\n${frontmatter}---\n\n${t.content}`,
              isRawMode: true
            };
          }
          return t;
        });
        app.setState('openTabs', updatedTabs);
      }
    }
  },

  async saveNote(tabId) {
    const tabs = app.getState('openTabs');
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      let finalContent = tab.content;
      let finalMetadata = tab.metadata;
      
      if (tab.isRawMode) {
        const parsed = parseFullMarkdown(tab.rawFullContent);
        if (!parsed) {
          alert("Invalid Markdown format. Ensure you have --- frontmatter blocks.");
          return;
        }
        finalMetadata = parsed.metadata;
        finalContent = parsed.content;
      }
      
      destroyEasyMDE(tab);
      
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: tab.id,
            content: finalContent,
            metadata: finalMetadata
          })
        });
        
        if (res.ok) {
          const updatedTabs = tabs.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                metadata: finalMetadata,
                content: finalContent,
                isEditMode: false,
                isRawMode: false
              };
            }
            return t;
          });
          app.setState('openTabs', updatedTabs);
          await app.actions.fetchObjects();
          const newTab = updatedTabs.find(t => t.id === tabId);
          setTimeout(() => renderMarkdownView(newTab), 50);
        } else {
          const err = await res.json();
          alert("Save failed: " + err.error);
        }
      } catch (err) {
        alert("Network error: " + err.message);
      }
    }
  },

  async deleteNote(tabId) {
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId })
      });
      
      if (res.ok) {
        app.actions.closeTab(tabId);
        await app.actions.fetchObjects();
      } else {
        const err = await res.json();
        alert("Delete failed: " + err.error);
      }
    } catch (err) {
      alert("Network error: " + err.message);
    }
  },

  cancelNewNote() {
    app.setState('isCreatingNote', false);
    app.setState('newNoteTitle', '');
    app.setState('newNoteType', 'note');
    app.setState('selectedTemplate', '');
  },

  async submitNewNote() {
    const title = app.getState('newNoteTitle', '');
    const type = app.getState('newNoteType', 'note');
    const templateId = app.getState('selectedTemplate', '');
    
    if (!title) return alert("Please enter a title.");
    
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type,
          templateId,
          variables: {}
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        app.actions.cancelNewNote();
        await app.actions.fetchObjects();
        
        const createdObj = app.getState('objects', []).find(o => o.id === result.id);
        if (createdObj) {
          app.actions.openTab(createdObj);
          const tabs = app.getState('openTabs');
          const updatedTabs = tabs.map(t => {
            if (t.id === result.id) {
              return { ...t, isEditMode: true };
            }
            return t;
          });
          app.setState('openTabs', updatedTabs);
          const newTab = updatedTabs.find(t => t.id === result.id);
          if (newTab) {
            setTimeout(() => initEasyMDE(newTab), 50);
          }
        }
      } else {
        const err = await res.json();
        alert("Failed to create note: " + err.error);
      }
    } catch (err) {
      alert("Network error: " + err.message);
    }
  },

  async handleSync() {
    try {
      await fetch('/api/sync', { method: 'POST' });
      await app.actions.fetchObjects();
      await app.actions.fetchTypes();
      await app.actions.fetchSchemas();
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }
};

// Global accessor
window.appInstance = app;

// Bootstrap data
await app.actions.fetchObjects();
await app.actions.fetchTypes();
await app.actions.fetchSchemas();
await app.actions.fetchSettings();

// Render
app.render('#app');
