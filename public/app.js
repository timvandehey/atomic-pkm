import { renderCreateView } from './create-view.js?v=52';
import { renderEditor, initEasyMDE, destroyEasyMDE } from './editor.js?v=52';
import { renderExplorer } from './explorer.js?v=52';

// State Management: Centralized AppStore
class AppStore {
  constructor(initialState) {
    this.state = { ...initialState };
    this.listeners = {}; // key -> Set of callbacks
    this.globalListeners = new Set();
    this.getState = this.getState.bind(this);
    this.setState = this.setState.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.executeBatch = this.executeBatch.bind(this);
  }
  
  getState(key, defaultValue) {
    return this.state[key] !== undefined ? this.state[key] : defaultValue;
  }
  
  setState(key, value) {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.notify(key);
    }
  }
  
  executeBatch(fn) {
    this._suppressNotify = true;
    const changedKeys = new Set();
    this._batchChangedKeys = changedKeys;
    try {
      fn();
    } finally {
      this._suppressNotify = false;
      this._batchChangedKeys = null;
      for (const k of changedKeys) {
        this.notify(k);
      }
      this.notifyGlobal();
    }
  }

  notify(key) {
    if (this._suppressNotify) {
      if (this._batchChangedKeys) this._batchChangedKeys.add(key);
      return;
    }
    if (this.listeners[key]) {
      for (const cb of this.listeners[key]) {
        try { cb(this.state[key]); } catch (e) { console.error(e); }
      }
    }
    this.notifyGlobal();
  }

  notifyGlobal() {
    if (this._suppressNotify) return;
    for (const cb of this.globalListeners) {
      try { cb(this.state); } catch (e) { console.error(e); }
    }
  }

  subscribe(key, cb) {
    if (typeof key === 'function') {
      this.globalListeners.add(key);
      return () => this.globalListeners.delete(key);
    }
    if (!this.listeners[key]) {
      this.listeners[key] = new Set();
    }
    this.listeners[key].add(cb);
    return () => {
      this.listeners[key].delete(cb);
    };
  }
}

// Helper to determine if a tab has unsaved changes (dirty)
export function checkIsDirty(tab) {
  if (!tab) return false;
  
  const currentContent = (tab.content || '').replace(/\r\n/g, '\n').trim();
  const originalContent = (tab._originalContent || '').replace(/\r\n/g, '\n').trim();
  
  if (tab.isRawMode) {
    const parsed = parseFullMarkdown(tab.rawFullContent);
    if (!parsed) return true;

    const origMetaObj = JSON.parse(tab._originalMetadata || '{}');

    // Filter out system keys starting with '_'
    const cleanOrigMeta = Object.fromEntries(
      Object.entries(origMetaObj).filter(([k]) => !k.startsWith('_'))
    );
    const cleanCurrMeta = Object.fromEntries(
      Object.entries(parsed.metadata || {}).filter(([k]) => !k.startsWith('_'))
    );

    // Dump them to YAML canonically (sortKeys: true)
    const origFront = jsyaml.dump(cleanOrigMeta, { sortKeys: true });
    const currFront = jsyaml.dump(cleanCurrMeta, { sortKeys: true });

    const currentRaw = currFront.replace(/\r\n/g, '\n').trim() + "\n\n" + (parsed.content || '').replace(/\r\n/g, '\n').trim();
    const expectedRaw = origFront.replace(/\r\n/g, '\n').trim() + "\n\n" + (tab._originalContent || '').replace(/\r\n/g, '\n').trim();

    return currentRaw.trim() !== expectedRaw.trim();
  }
  
  const contentDirty = currentContent !== originalContent;
  
  let metaDirty = false;
  try {
    const origMeta = JSON.parse(tab._originalMetadata || '{}');
    const currMeta = tab.metadata || {};
    
    const origKeys = Object.keys(origMeta).filter(k => !k.startsWith('_'));
    const currKeys = Object.keys(currMeta).filter(k => !k.startsWith('_'));
    
    if (origKeys.length !== currKeys.length) {
      metaDirty = true;
    } else {
      for (const k of origKeys) {
        const val1 = origMeta[k];
        const val2 = currMeta[k];
        const isEmpty1 = val1 === undefined || val1 === null || val1 === '';
        const isEmpty2 = val2 === undefined || val2 === null || val2 === '';
        if (isEmpty1 && isEmpty2) continue;
        if (val1 !== val2) {
          metaDirty = true;
          break;
        }
      }
    }
  } catch (e) {
    metaDirty = true;
  }
  
  return contentDirty || metaDirty;
}

// Helper to determine if a tab matches an incoming file payload
function isTabEqual(tab, payload) {
  if (!tab || !payload) return false;
  
  const tabContent = (tab.content || '').replace(/\r\n/g, '\n').trim();
  const diskContent = (payload.content || '').replace(/\r\n/g, '\n').trim();
  if (tabContent !== diskContent) return false;
  
  try {
    const tabMeta = tab.metadata || {};
    const diskMeta = typeof payload.metadata === 'string' ? JSON.parse(payload.metadata) : (payload.metadata || {});
    
    const tabKeys = Object.keys(tabMeta).filter(k => !k.startsWith('_'));
    const diskKeys = Object.keys(diskMeta).filter(k => !k.startsWith('_'));
    
    if (tabKeys.length !== diskKeys.length) return false;
    
    for (const k of tabKeys) {
      const val1 = tabMeta[k];
      const val2 = diskMeta[k];
      const isEmpty1 = val1 === undefined || val1 === null || val1 === '';
      const isEmpty2 = val2 === undefined || val2 === null || val2 === '';
      if (isEmpty1 && isEmpty2) continue;
      if (val1 !== val2) return false;
    }
  } catch (e) {
    return false;
  }
  
  return true;
}

// HTML Escaping Helper
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Helper to parse full Markdown string into metadata and content body
export function parseFullMarkdown(raw) {
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

// Command Palette options builder
const getCommands = (store) => {
  const activeId = store.getState('activeTabId', 'explorer');
  const isEditMode = store.getState('activeTabEditMode', false);
  const isRawMode = store.getState('activeTabRawMode', false);
  const openTabs = store.getState('openTabs', []);
  const tab = openTabs.find(t => t.id === activeId);

  const list = [
    {
      id: 'go-explorer',
      name: 'Go to Explorer / Dashboard',
      icon: 'grid_view',
      action: () => {
        store.setState('activeTabId', 'explorer');
        store.setState('isExplorerActive', true);
        store.setState('activeTabEditMode', false);
        store.setState('activeTabRawMode', false);
      }
    },
    {
      id: 'new-note',
      name: 'New Note / Create Object',
      icon: 'add_circle',
      shortcut: 'Alt+N',
      action: () => store.actions.openNewNoteModal()
    },
    {
      id: 'sync-data',
      name: 'Sync Data Folder with SQLite',
      icon: 'sync',
      shortcut: 'Alt+S',
      action: () => store.actions.handleSync()
    },
    {
      id: 'toggle-auto-edit',
      name: `Toggle Auto-Edit (Currently ${store.getState('autoEdit', false) ? 'ON' : 'OFF'})`,
      icon: 'edit_note',
      shortcut: 'Alt+A',
      action: () => store.actions.toggleAutoEdit()
    },
    {
      id: 'toggle-auto-properties',
      name: `Toggle Auto-Show Properties (Currently ${store.getState('autoShowProperties', false) ? 'ON' : 'OFF'})`,
      icon: 'settings_accessibility',
      shortcut: 'Alt+P',
      action: () => store.actions.toggleAutoShowProperties()
    },
    {
      id: 'open-settings',
      name: 'Open Application Settings',
      icon: 'settings',
      action: () => {
        const settingsTab = store.getState('objects', []).find(o => o.id === 'settings');
        if (settingsTab) store.actions.openTab(settingsTab);
      }
    },
    {
      id: 'open-ai-prompt',
      name: 'Open AI Quick Add Prompt Settings',
      icon: 'smart_toy',
      action: () => {
        const promptTab = store.getState('objects', []).find(o => o.id === 'prompt-quick-add');
        if (promptTab) store.actions.openTab(promptTab);
      }
    },
    {
      id: 'toggle-hamburger-menu',
      name: `Toggle Hamburger Menu (Currently ${store.getState('menuOpen', false) ? 'Open' : 'Closed'})`,
      icon: 'menu',
      shortcut: 'Alt+Space',
      action: () => store.setState('menuOpen', !store.getState('menuOpen', false))
    }
  ];

  if (activeId !== 'explorer' && tab) {
    if (isEditMode || isRawMode) {
      list.push({
        id: 'save-note',
        name: 'Save Note',
        icon: 'save',
        shortcut: 'Ctrl+S',
        action: () => store.actions.saveNote(activeId)
      });
    }

    list.push(
      {
        id: 'reload-note',
        name: 'Reload Note from Disk',
        icon: 'refresh',
        action: () => {
          store.setState('reloadingTabId', activeId);
          store.setState('showReloadConfirm', true);
        }
      },
      {
        id: 'toggle-edit',
        name: isEditMode ? 'Switch to View Mode (Read-Only)' : 'Switch to Edit Mode',
        icon: isEditMode ? 'visibility' : 'edit',
        shortcut: 'Alt+E',
        action: () => store.actions.toggleEditMode(activeId)
      }
    );

    list.push({
      id: 'toggle-raw',
      name: isRawMode ? 'Switch to Rich Editor' : 'Switch to Raw Markdown Editor',
      icon: 'code',
      shortcut: 'Alt+R',
      action: () => store.actions.toggleRawMode(activeId)
    });

    list.push(
      {
        id: 'copy-markdown',
        name: 'Copy Note Markdown to Clipboard',
        icon: 'content_copy',
        shortcut: 'Alt+C',
        action: () => store.actions.copyMarkdown(activeId)
      },
      {
        id: 'download-markdown',
        name: 'Download Note as Markdown File',
        icon: 'download',
        shortcut: 'Alt+D',
        action: () => store.actions.downloadMarkdown(activeId)
      },
      {
        id: 'print-pdf',
        name: 'Print Note / Save as PDF',
        icon: 'print',
        action: () => window.print()
      },
      {
        id: 'delete-note',
        name: 'Delete Current Note',
        icon: 'delete',
        shortcut: 'Alt+Backspace',
        action: () => {
          showConfirm("Are you sure you want to delete this note? This action is permanent.", "Delete Note", (yes) => {
            if (yes && window.appInstance) {
              window.appInstance.actions.deleteNote(activeId);
            }
          });
        }
      }
    );
  }

  return list;
};

// Initialize centralized store
const app = new AppStore({
  objects: [],
  classes: [],
  classesConfig: {},
  schemas: {},
  sidebarWidth: 250,
  openTabs: [],
  openTabIds: '',
  activeTabId: 'explorer',
  isExplorerActive: true,
  quickAddText: '',
  quickAddLoading: false,
  quickAddError: null,
  activeTabEditMode: false,
  activeTabRawMode: false,
  showCloseConfirm: false,
  closingTabId: null,
  mobileSidebarOpen: true,
  menuOpen: false,
  advancedSearchOpen: false,
  searchQuery: '',
  searchClass: '',
  searchTag: '',
  isCreatingNote: false,
  newNoteTitle: '',
  newNoteClass: 'note',
  selectedTemplate: '',
  autoEdit: localStorage.getItem('pkm_auto_edit') === 'true',
  autoShowProperties: localStorage.getItem('pkm_auto_show_properties') === 'true',
  showAlertModal: false,
  alertModalTitle: 'Alert',
  alertModalMessage: '',
  showPromptModal: false,
  promptModalTitle: '',
  promptModalValue: '',
  promptCallback: null,
  showConfirmModal: false,
  confirmModalTitle: 'Confirm',
  confirmModalMessage: '',
  confirmCallback: null,
  showReloadConfirm: false,
  reloadingTabId: null,
  commandPaletteOpen: false,
  commandPaletteQuery: '',
  commandPaletteSelectedIndex: 0
});

window.appInstance = app;

// Synchronize openTabIds whenever openTabs changes
app.subscribe('openTabs', () => {
  const openTabs = app.getState('openTabs', []);
  const currentIds = openTabs.map(t => t.id).join(',');
  const oldIds = app.getState('openTabIds', '');
  if (currentIds !== oldIds) {
    app.setState('openTabIds', currentIds);
  }
});

export function saveSessionState() {}
window.saveSessionState = saveSessionState;

export function showAlert(message, title = "Alert") {
  app.setState('alertModalTitle', title);
  app.setState('alertModalMessage', message);
  app.setState('showAlertModal', true);
}
window.showAlert = showAlert;

export function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
window.showToast = showToast;

export function showPrompt(title, defaultValue, callback) {
  app.setState('promptModalTitle', title);
  app.setState('promptModalValue', defaultValue || '');
  app.setState('promptCallback', callback);
  app.setState('showPromptModal', true);
}
window.showPrompt = showPrompt;

export function showConfirm(message, title = "Confirm", callback) {
  app.setState('confirmModalTitle', title);
  app.setState('confirmModalMessage', message);
  app.setState('confirmCallback', callback);
  app.setState('showConfirmModal', true);
}
window.showConfirm = showConfirm;

export function getDefaultNoteClass() {
  const configs = app.getState('classesConfig', {});
  for (const [className, config] of Object.entries(configs)) {
    if (config.default === true) {
      return className;
    }
  }
  return 'note';
}
window.getDefaultNoteClass = getDefaultNoteClass;

// Actions attachment
app.actions = {
  async quickAddNote(text) {
    if (!text || !text.trim()) return;
    
    app.setState('quickAddLoading', true);
    app.setState('quickAddError', null);
    
    try {
      const res = await fetch('/api/ai/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        app.setState('quickAddText', '');
        showToast(`AI Quick-Added: "${data.title}"`);
        
        await app.actions.fetchObjects();
        
        if (data.object) {
          app.actions.openTab(data.object);
        }
      } else {
        const errMsg = data.error || "Unknown error";
        app.setState('quickAddError', errMsg);
        showAlert(errMsg, "AI Quick Add Error");
      }
    } catch (err) {
      app.setState('quickAddError', err.message);
      showAlert("Network error: " + err.message, "Connection Error");
    } finally {
      app.setState('quickAddLoading', false);
    }
  },

  async processInboxNote(tabId) {
    const tabs = app.getState('openTabs', []);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      const nextMeta = { ...tab.metadata };
      delete nextMeta._inbox;
      
      const finalContent = tab.content;
      
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: tab.id,
            content: finalContent,
            metadata: nextMeta
          })
        });
        
        if (res.ok) {
          const updatedTabs = tabs.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                metadata: nextMeta,
                _originalMetadata: JSON.stringify(nextMeta)
              };
            }
            return t;
          });
          app.setState('openTabs', updatedTabs);
          showToast("Note marked as processed");
          await app.actions.fetchObjects();
          saveSessionState();
        } else {
          const err = await res.json();
          showAlert("Failed to process note: " + err.error);
        }
      } catch (err) {
        showAlert("Network error: " + err.message);
      }
    }
  },

  async fetchObjects() {
    const q = app.getState('searchQuery', '');
    const classVal = app.getState('searchClass', '');
    const tag = app.getState('searchTag', '');
    const url = `/api/search?q=${encodeURIComponent(q)}&class=${encodeURIComponent(classVal)}&tag=${encodeURIComponent(tag)}`;
    const res = await fetch(url);
    const data = await res.json();
    app.setState('objects', data);
  },

  async fetchClasses() {
    const res = await fetch('/api/classes');
    const data = await res.json();
    app.setState('classes', data);
  },

  async fetchClassesConfig() {
    const res = await fetch('/api/classes/config');
    const data = await res.json();
    app.setState('classesConfig', data);
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

  openTab(note, forceEditMode = false) {
    if (note.class === 'query') {
      const meta = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata;
      app.executeBatch(() => {
        app.setState('searchQuery', meta.search_query || "");
        app.setState('searchClass', meta.search_class || meta.search_type || "");
        app.setState('searchTag', meta.search_tag || "");
        app.setState('advancedSearchOpen', !!(meta.search_class || meta.search_type || meta.search_tag));
        app.setState('activeTabId', 'explorer');
        app.setState('isExplorerActive', true);
        app.setState('activeTabEditMode', false);
        app.setState('activeTabRawMode', false);
      });
      app.actions.fetchObjects();
      saveSessionState();
      return;
    }

    const openTabs = app.getState('openTabs', []);
    const existing = openTabs.find(t => t.id === note.id);
    const autoEdit = forceEditMode || app.getState('autoEdit', false);

    if (!existing) {
      const parsedMeta = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata;
      const autoShowProperties = app.getState('autoShowProperties', false);
      const tab = {
        ...note,
        metadata: parsedMeta,
        isEditMode: autoEdit,
        isRawMode: false,
        metaVisible: autoShowProperties,
        rawFullContent: '',
        _originalContent: note.content || '',
        _originalMetadata: JSON.stringify(parsedMeta || {})
      };
      
      app.executeBatch(() => {
        app.setState('openTabs', [...openTabs, tab]);
        app.setState('activeTabEditMode', autoEdit);
        app.setState('activeTabRawMode', false);
        app.setState('activeTabId', note.id);
        app.setState('isExplorerActive', false);
        app.setState('mobileSidebarOpen', false);
      });
      blurActiveInput();
    } else {
      if (autoEdit && !existing.isEditMode) {
        const updatedTabs = openTabs.map(t => {
          if (t.id === existing.id) {
            return { ...t, isEditMode: true };
          }
          return t;
        });
        
        app.executeBatch(() => {
          app.setState('openTabs', updatedTabs);
          app.setState('activeTabEditMode', true);
          app.setState('activeTabRawMode', false);
          app.setState('activeTabId', note.id);
          app.setState('isExplorerActive', false);
          app.setState('mobileSidebarOpen', false);
        });
      } else {
        app.executeBatch(() => {
          app.setState('activeTabEditMode', existing.isEditMode);
          app.setState('activeTabRawMode', existing.isRawMode);
          app.setState('activeTabId', note.id);
          app.setState('isExplorerActive', false);
          app.setState('mobileSidebarOpen', false);
        });
        blurActiveInput();
      }
    }
    saveSessionState();
  },

  setActiveTab(id) {
    console.log("[App] Setting active tab to:", id);
    if (id === 'explorer') {
      app.executeBatch(() => {
        app.setState('activeTabId', id);
        app.setState('isExplorerActive', true);
        app.setState('activeTabEditMode', false);
        app.setState('activeTabRawMode', false);
      });
      saveSessionState();
      return;
    }
    const tabs = app.getState('openTabs', []);
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      app.executeBatch(() => {
        app.setState('activeTabId', id);
        app.setState('isExplorerActive', false);
        app.setState('activeTabEditMode', tab.isEditMode);
        app.setState('activeTabRawMode', tab.isRawMode);
      });
      blurActiveInput();
    }
    saveSessionState();
  },

  closeTab(id) {
    const openTabs = app.getState('openTabs', []);
    const index = openTabs.findIndex(t => t.id === id);
    if (index !== -1) {
      const tab = openTabs[index];
      
      const isDirty = checkIsDirty(tab);
      if (isDirty) {
        app.setState('closingTabId', id);
        app.setState('showCloseConfirm', true);
        return;
      }

      app.actions.forceCloseTab(id);
    }
  },

  forceCloseTab(id) {
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
      app.setState('showCloseConfirm', false);
      app.setState('closingTabId', null);
      if (activeId) {
        app.actions.setActiveTab(activeId);
      } else {
        app.setState('activeTabId', 'explorer');
        app.setState('isExplorerActive', true);
        app.setState('activeTabEditMode', false);
        app.setState('activeTabRawMode', false);
      }
      saveSessionState();
    }
  },

  async saveAndClose(tabId) {
    const tabs = app.getState('openTabs', []);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      let finalContent = tab.content;
      let finalMetadata = tab.metadata;
      
      if (tab.isRawMode) {
        const parsed = parseFullMarkdown(tab.rawFullContent);
        if (!parsed) {
          showAlert("Invalid Markdown format. Ensure you have --- frontmatter blocks.");
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
          const updatedTabs = tabs.filter(t => t.id !== tabId);
          let activeId = app.getState('activeTabId');
          if (activeId === tabId) {
            activeId = updatedTabs.length > 0 ? updatedTabs[updatedTabs.length - 1].id : 'explorer';
          }
          
          app.setState('openTabs', updatedTabs);
          app.setState('showCloseConfirm', false);
          app.setState('closingTabId', null);
          await app.actions.fetchObjects();
          
          if (activeId) {
            app.actions.setActiveTab(activeId);
          } else {
            app.setState('activeTabId', 'explorer');
            app.setState('isExplorerActive', true);
            app.setState('activeTabEditMode', false);
            app.setState('activeTabRawMode', false);
          }
          saveSessionState();
        } else {
          const err = await res.json();
          showAlert("Save failed: " + err.error);
        }
      } catch (err) {
        showAlert("Network error: " + err.message);
      }
    }
  },

  toggleEditMode(tabId) {
    console.log("[App] toggleEditMode executing for:", tabId);
    const tabs = app.getState('openTabs', []);
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
      app.setState('activeTabEditMode', newTab.isEditMode);
      saveSessionState();
    }
  },

  toggleRawMode(tabId) {
    const tabs = app.getState('openTabs', []);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      if (tab.isRawMode) {
        const parsed = parseFullMarkdown(tab.rawFullContent);
        if (!parsed) {
          showAlert("Invalid Markdown format. Ensure you have --- frontmatter blocks.");
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
        app.setState('activeTabRawMode', newTab.isRawMode);
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
        const newTab = updatedTabs.find(t => t.id === tabId);
        app.setState('activeTabRawMode', newTab.isRawMode);
      }
      saveSessionState();
    }
  },

  async saveNote(tabId) {
    const tabs = app.getState('openTabs', []);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      let finalContent = tab.content;
      let finalMetadata = tab.metadata;
      
      if (tab.isRawMode) {
        const parsed = parseFullMarkdown(tab.rawFullContent);
        if (!parsed) {
          showAlert("Invalid Markdown format. Ensure you have --- frontmatter blocks.");
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
          const autoEdit = app.getState('autoEdit', false);
          const updatedTabs = tabs.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                metadata: finalMetadata,
                content: finalContent,
                isEditMode: autoEdit,
                isRawMode: false,
                _originalContent: finalContent,
                _originalMetadata: JSON.stringify(finalMetadata)
              };
            }
            return t;
          });
          app.setState('openTabs', updatedTabs);
          app.setState('activeTabEditMode', autoEdit);
          app.setState('activeTabRawMode', false);
          await app.actions.fetchObjects();
          saveSessionState();
        } else {
          const err = await res.json();
          showAlert("Save failed: " + err.error);
        }
      } catch (err) {
        showAlert("Network error: " + err.message);
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
        showAlert("Delete failed: " + err.error);
      }
    } catch (err) {
      showAlert("Network error: " + err.message);
    }
  },

  copyMarkdown(tabId) {
    const tabs = app.getState('openTabs', []);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      let fullMarkdown = '';
      if (tab.isRawMode) {
        fullMarkdown = tab.rawFullContent;
      } else {
        const frontmatter = jsyaml.dump(tab.metadata);
        fullMarkdown = `---\n${frontmatter}---\n\n${(tab.content || '').trim()}`;
      }
      
      navigator.clipboard.writeText(fullMarkdown)
        .then(() => {
          showToast("Markdown copied to clipboard!");
        })
        .catch(err => {
          showToast("Failed to copy markdown: " + err, true);
        });
    }
  },

  downloadMarkdown(tabId) {
    const tabs = app.getState('openTabs', []);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      let fullMarkdown = '';
      if (tab.isRawMode) {
        fullMarkdown = tab.rawFullContent;
      } else {
        const frontmatter = jsyaml.dump(tab.metadata);
        fullMarkdown = `---\n${frontmatter}---\n\n${(tab.content || '').trim()}`;
      }
      
      try {
        const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tab.id}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Markdown download started!");
      } catch (err) {
        showToast("Failed to download markdown: " + err, true);
      }
    }
  },

  openNewNoteModal(title = '', className = null) {
    app.setState('newNoteTitle', title);
    app.setState('newNoteClass', className || getDefaultNoteClass());
    app.setState('selectedTemplate', '');
    app.setState('isCreatingNote', true);
  },

  cancelNewNote() {
    app.setState('isCreatingNote', false);
    app.setState('newNoteTitle', '');
    app.setState('newNoteClass', getDefaultNoteClass());
    app.setState('selectedTemplate', '');
  },

  async submitNewNote() {
    const title = app.getState('newNoteTitle', '');
    const classVal = app.getState('newNoteClass', 'note');
    
    if (!title) return showAlert("Please enter a title.");
    
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          class: classVal,
          type: classVal,
          variables: {}
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        await app.actions.fetchObjects();
        
        const createdObj = app.getState('objects', []).find(o => o.id === result.id);
        if (createdObj) {
          app.executeBatch(() => {
            app.actions.cancelNewNote();
            app.actions.openTab(createdObj, true);
          });
        }
      } else {
        const err = await res.json();
        showAlert("Failed to create note: " + err.error);
      }
    } catch (err) {
      showAlert("Network error: " + err.message);
    }
  },

  async handleSync() {
    try {
      await fetch('/api/sync', { method: 'POST' });
      await app.actions.fetchObjects();
      await app.actions.fetchClasses();
      await app.actions.fetchClassesConfig();
      await app.actions.fetchSchemas();
    } catch (err) {
      console.error("Sync failed:", err);
    }
  },

  toggleAutoEdit() {
    const nextVal = !app.getState('autoEdit', false);
    app.setState('autoEdit', nextVal);
    localStorage.setItem('pkm_auto_edit', String(nextVal));
  },

  toggleAutoShowProperties() {
    const nextVal = !app.getState('autoShowProperties', false);
    app.setState('autoShowProperties', nextVal);
    localStorage.setItem('pkm_auto_show_properties', String(nextVal));
  },

  markTabOutOfSync(id, deleted = false) {
    console.log(`[App] markTabOutOfSync: ${id}, deleted: ${deleted}`);
    const openTabs = app.getState('openTabs', []);
    const tab = openTabs.find(t => t.id === id);
    if (tab) {
      const updatedTabs = openTabs.map(t => {
        if (t.id === id) {
          return { ...t, isOutOfSync: deleted ? 'deleted' : 'changed' };
        }
        return t;
      });
      app.setState('openTabs', updatedTabs);
    }
    app.actions.fetchObjects();
  },

  async reloadTabContent(tabId, payload = null) {
    console.log(`[App] reloadTabContent: ${tabId}`);
    const openTabs = app.getState('openTabs', []);
    const tab = openTabs.find(t => t.id === tabId);
    if (!tab) {
      app.setState('showReloadConfirm', false);
      app.setState('reloadingTabId', null);
      return;
    }

    if (tab.isOutOfSync === 'deleted') {
      app.setState('showReloadConfirm', false);
      app.setState('reloadingTabId', null);
      showAlert(`Note "${tab.title}" has been deleted on disk. Closing tab.`, "Note Deleted");
      app.actions.forceCloseTab(tabId);
      return;
    }

    destroyEasyMDE(tab);

    try {
      let latestObj = payload;
      if (!latestObj) {
        await app.actions.fetchObjects();
        const latestObjects = app.getState('objects', []);
        latestObj = latestObjects.find(o => o.id === tabId);
      } else {
        app.actions.fetchObjects();
      }

      if (latestObj) {
        const autoEdit = app.getState('autoEdit', false);
        const parsedMeta = typeof latestObj.metadata === 'string' ? JSON.parse(latestObj.metadata) : latestObj.metadata;
        const updatedTabs = openTabs.map(t => {
          if (t.id === tabId) {
            const nextEditMode = autoEdit || t.isEditMode;
            const updatedTab = {
              ...t,
              title: latestObj.title,
              content: latestObj.content || '',
              metadata: parsedMeta || {},
              isEditMode: nextEditMode,
              isOutOfSync: false,
              _originalContent: latestObj.content || '',
              _originalMetadata: JSON.stringify(parsedMeta || {})
            };
            if (t.isRawMode) {
              const frontmatter = jsyaml.dump(parsedMeta);
              updatedTab.rawFullContent = `---\n${frontmatter}---\n\n${latestObj.content || ''}`;
            }
            return updatedTab;
          }
          return t;
        });

        app.setState('openTabs', updatedTabs);
        app.setState('showReloadConfirm', false);
        app.setState('reloadingTabId', null);

        const newTab = updatedTabs.find(t => t.id === tabId);
        if (newTab) {
          const activeTabId = app.getState('activeTabId');
          if (activeTabId === tabId) {
            app.setState('activeTabEditMode', newTab.isEditMode);
            app.setState('activeTabRawMode', newTab.isRawMode);
          }
        }
        saveSessionState();
      } else {
        app.setState('showReloadConfirm', false);
        app.setState('reloadingTabId', null);
        showAlert(`Note "${tab.title}" could not be found. Closing tab.`, "Error");
        app.actions.forceCloseTab(tabId);
      }
    } catch (err) {
      showAlert("Failed to reload note: " + err.message);
    }
  }
};

// Render helpers for specific sections
function updateHeader() {
  const header = document.getElementById('top-header');
  if (!header) return;
  
  const autoEdit = app.getState('autoEdit', false);
  header.className = `top-header ${autoEdit ? 'auto-edit-on' : 'auto-edit-off'}`;
  
  const activeTabId = app.getState('activeTabId', 'explorer');
  const isEditMode = app.getState('activeTabEditMode', false);
  const isRawMode = app.getState('activeTabRawMode', false);
  const autoShowProperties = app.getState('autoShowProperties', false);
  const menuOpen = app.getState('menuOpen', false);
  const openTabs = app.getState('openTabs', []);
  
  let menuHtml = `
    <div class="menu-container">
      <button id="btn-menu" title="Menu">
        <span class="material-symbols-rounded">menu</span>
      </button>
      <div class="dropdown-content ${menuOpen ? '' : 'hidden'}" id="dropdown-menu">
        <button id="btn-new">
          <span class="material-symbols-rounded">add</span>
          <span class="menu-item-text">New Note</span>
          <span class="menu-item-hotkey">Alt+N</span>
        </button>
        <button id="btn-auto-edit">
          <span class="material-symbols-rounded">${autoEdit ? 'check_box' : 'check_box_outline_blank'}</span>
          <span class="menu-item-text">Auto-Edit</span>
          <span class="menu-item-hotkey">Alt+A</span>
        </button>
        <button id="btn-auto-show-properties">
          <span class="material-symbols-rounded">${autoShowProperties ? 'check_box' : 'check_box_outline_blank'}</span>
          <span class="menu-item-text">Auto-Show Properties</span>
          <span class="menu-item-hotkey">Alt+P</span>
        </button>
        <button id="btn-sync">
          <span class="material-symbols-rounded">sync</span>
          <span class="menu-item-text">Sync Data</span>
          <span class="menu-item-hotkey">Alt+S</span>
        </button>
  `;
  
  if (activeTabId !== 'explorer') {
    menuHtml += `
        <hr class="menu-divider">
        <button id="btn-reload">
          <span class="material-symbols-rounded">refresh</span>
          <span class="menu-item-text">Reload Note</span>
        </button>
        ${(isEditMode || isRawMode) ? `
        <button id="btn-save">
          <span class="material-symbols-rounded">save</span>
          <span class="menu-item-text">Save Note</span>
          <span class="menu-item-hotkey">Ctrl+S</span>
        </button>
        ` : ''}
        <button id="btn-toggle-edit">
          <span class="material-symbols-rounded">${isEditMode ? 'visibility' : 'edit'}</span>
          <span class="menu-item-text">${isEditMode ? 'View Mode' : 'Edit Mode'}</span>
          <span class="menu-item-hotkey">Alt+E</span>
        </button>
        <button id="btn-toggle-raw">
          <span class="material-symbols-rounded">code</span>
          <span class="menu-item-text">Raw Markdown</span>
          <span class="menu-item-hotkey">Alt+R</span>
        </button>
        <button id="btn-copy-markdown">
          <span class="material-symbols-rounded">content_copy</span>
          <span class="menu-item-text">Copy Markdown</span>
          <span class="menu-item-hotkey">Alt+C</span>
        </button>
        <button id="btn-download-markdown">
          <span class="material-symbols-rounded">download</span>
          <span class="menu-item-text">Download Markdown</span>
          <span class="menu-item-hotkey">Alt+D</span>
        </button>
        <button id="btn-print">
          <span class="material-symbols-rounded">print</span>
          <span class="menu-item-text">Print PDF</span>
        </button>
        <button id="btn-delete" style="color: var(--md-sys-color-error)">
          <span class="material-symbols-rounded" style="color: var(--md-sys-color-error)">delete</span>
          <span class="menu-item-text">Delete Note</span>
          <span class="menu-item-hotkey">Alt+Del</span>
        </button>
    `;
  }
  
  menuHtml += `
      </div>
    </div>
  `;
  
  header.innerHTML = `
    <div class="header-left">
      ${menuHtml}
    </div>
    <div class="tab-bar" style="flex: 1;">
      <div class="tab-item ${activeTabId === 'explorer' ? 'active' : ''}" id="tab-btn-explorer">
        <span class="material-symbols-rounded" style="font-size: 1.25rem;">grid_view</span>
        <span class="tab-title">Explorer</span>
      </div>
    </div>
  `;
  
  const tabBar = header.querySelector('.tab-bar');
  openTabs.forEach(tab => {
    const isDirty = checkIsDirty(tab);
    const isActive = activeTabId === tab.id;
    
    const tabItem = document.createElement('div');
    tabItem.className = `tab-item ${isActive ? 'active' : ''}`;
    tabItem.id = `tab-btn-${tab.id}`;
    
    let warningHtml = '';
    if (tab.isOutOfSync) {
      const isDel = tab.isOutOfSync === 'deleted';
      warningHtml = `
        <span class="material-symbols-rounded tab-sync-warning" 
              title="${isDel ? 'File deleted on disk. Click to resolve.' : 'File updated on disk. Click to reload.'}">${isDel ? 'delete' : 'sync_problem'}</span>
      `;
    }
    
    tabItem.innerHTML = `
      <span class="tab-title">${escapeHtml(tab.title)}</span>
      ${isDirty ? '<span class="tab-dirty-dot">•</span>' : ''}
      ${warningHtml}
      <span class="material-symbols-rounded tab-close" data-id="${tab.id}">close</span>
    `;
    
    tabItem.onclick = (e) => {
      if (e.target.classList.contains('tab-sync-warning')) {
        e.stopPropagation();
        app.setState('reloadingTabId', tab.id);
        app.setState('showReloadConfirm', true);
        return;
      }
      if (e.target.classList.contains('tab-close')) {
        e.stopPropagation();
        app.actions.closeTab(tab.id);
        return;
      }
      
      app.actions.setActiveTab(tab.id);
    };
    
    tabBar.appendChild(tabItem);
  });
  
  header.querySelector('#btn-menu').onclick = (e) => {
    e.stopPropagation();
    app.setState('menuOpen', !menuOpen);
  };
  
  header.querySelector('#btn-new').onclick = () => {
    app.setState('menuOpen', false);
    app.actions.openNewNoteModal();
  };
  
  header.querySelector('#btn-auto-edit').onclick = () => {
    app.setState('menuOpen', false);
    app.actions.toggleAutoEdit();
  };
  
  header.querySelector('#btn-auto-show-properties').onclick = () => {
    app.setState('menuOpen', false);
    app.actions.toggleAutoShowProperties();
  };
  
  header.querySelector('#btn-sync').onclick = () => {
    app.setState('menuOpen', false);
    app.actions.handleSync();
  };
  
  header.querySelector('#tab-btn-explorer').onclick = () => {
    app.actions.setActiveTab('explorer');
  };
  
  if (activeTabId !== 'explorer') {
    header.querySelector('#btn-reload').onclick = () => {
      app.setState('menuOpen', false);
      app.setState('reloadingTabId', activeTabId);
      app.setState('showReloadConfirm', true);
    };
    
    if (isEditMode || isRawMode) {
      header.querySelector('#btn-save').onclick = () => {
        app.setState('menuOpen', false);
        app.actions.saveNote(activeTabId);
      };
    }
    
    header.querySelector('#btn-toggle-edit').onclick = () => {
      app.setState('menuOpen', false);
      app.actions.toggleEditMode(activeTabId);
    };
    
    header.querySelector('#btn-toggle-raw').onclick = () => {
      app.setState('menuOpen', false);
      app.actions.toggleRawMode(activeTabId);
    };
    
    header.querySelector('#btn-copy-markdown').onclick = () => {
      app.setState('menuOpen', false);
      app.actions.copyMarkdown(activeTabId);
    };
    
    header.querySelector('#btn-download-markdown').onclick = () => {
      app.setState('menuOpen', false);
      app.actions.downloadMarkdown(activeTabId);
    };
    
    header.querySelector('#btn-print').onclick = () => {
      app.setState('menuOpen', false);
      window.print();
    };
    
    header.querySelector('#btn-delete').onclick = () => {
      app.setState('menuOpen', false);
      showConfirm("Are you sure you want to delete this note? This action is permanent.", "Delete Note", (yes) => {
        if (yes && window.appInstance) {
          window.appInstance.actions.deleteNote(activeTabId);
        }
      });
    };
  }
}

function updateMainArea() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  
  const isCreating = app.getState('isCreatingNote', false);
  const activeTabId = app.getState('activeTabId', 'explorer');
  
  if (isCreating) {
    let container = document.getElementById('create-view-container');
    if (!container) {
      mainContent.innerHTML = `<div id="create-view-container" style="height: 100%; width: 100%;"></div>`;
      container = document.getElementById('create-view-container');
    }
    renderCreateView(container, app);
    return;
  }
  
  if (activeTabId === 'explorer') {
    let container = document.getElementById('explorer-container');
    if (!container) {
      mainContent.innerHTML = `<div id="explorer-container" style="height: 100%; width: 100%; overflow: hidden;"></div>`;
      container = document.getElementById('explorer-container');
      renderExplorer(container, app);
    } else {
      const noteList = container.querySelector('#note-list');
      if (noteList) {
        import('./gallery.js?v=52').then(({ renderGallery }) => {
          renderGallery(noteList, app);
        });
      }
    }
    return;
  }
  
  let containerParent = document.getElementById('editor-container-parent');
  if (!containerParent) {
    mainContent.innerHTML = `<div id="editor-container-parent" style="display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; height: 100%; width: 100%;"></div>`;
    containerParent = document.getElementById('editor-container-parent');
  }
  renderEditor(containerParent, app);
}

function updateModals() {
  const container = document.getElementById('modal-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  renderAlertModal(container, app);
  renderConfirmModal(container, app);
  renderPromptModal(container, app);
  renderReloadConfirmModal(container, app);
  renderCloseConfirmModal(container, app);
  renderCommandPaletteModal(container, app);
}

// Modal Render Helpers
function renderAlertModal(container, app) {
  const isOpen = app.getState('showAlertModal', false);
  if (!isOpen) return;
  
  const title = app.getState('alertModalTitle', 'Alert');
  const msg = app.getState('alertModalMessage', '');
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay alert-modal-overlay';
  modal.tabIndex = 0;
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(msg)}</p>
      <div class="modal-actions">
        <button class="btn-primary" id="alert-ok-btn">OK</button>
      </div>
    </div>
  `;
  
  modal.onclick = (e) => {
    if (e.target === modal) app.setState('showAlertModal', false);
  };
  
  modal.onkeydown = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      app.setState('showAlertModal', false);
    }
  };
  
  modal.querySelector('#alert-ok-btn').onclick = () => {
    app.setState('showAlertModal', false);
  };
  
  container.appendChild(modal);
  setTimeout(() => modal.querySelector('#alert-ok-btn').focus(), 50);
}

function renderConfirmModal(container, app) {
  const isOpen = app.getState('showConfirmModal', false);
  if (!isOpen) return;
  
  const title = app.getState('confirmModalTitle', 'Confirm');
  const msg = app.getState('confirmModalMessage', '');
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay confirm-modal-overlay';
  modal.tabIndex = 0;
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(msg)}</p>
      <div class="modal-actions">
        <button class="btn-primary" id="confirm-yes-btn">Yes</button>
        <button class="btn-cancel" id="confirm-no-btn">No</button>
      </div>
    </div>
  `;
  
  const handleNo = () => {
    const cb = app.getState('confirmCallback');
    app.setState('showConfirmModal', false);
    app.setState('confirmCallback', null);
    if (cb) cb(false);
  };
  
  const handleYes = () => {
    const cb = app.getState('confirmCallback');
    app.setState('showConfirmModal', false);
    app.setState('confirmCallback', null);
    if (cb) cb(true);
  };
  
  modal.onclick = (e) => {
    if (e.target === modal) handleNo();
  };
  
  modal.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleNo();
    } else if (e.key === 'Enter') {
      if (document.activeElement && document.activeElement.id === 'confirm-no-btn') return;
      e.preventDefault();
      handleYes();
    }
  };
  
  modal.querySelector('#confirm-yes-btn').onclick = handleYes;
  modal.querySelector('#confirm-no-btn').onclick = handleNo;
  
  container.appendChild(modal);
  setTimeout(() => modal.querySelector('#confirm-yes-btn').focus(), 50);
}

function renderPromptModal(container, app) {
  const isOpen = app.getState('showPromptModal', false);
  if (!isOpen) return;
  
  const title = app.getState('promptModalTitle', 'Enter Value');
  const initialValue = app.getState('promptModalValue', '');
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay prompt-modal-overlay';
  modal.tabIndex = 0;
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <h3>${escapeHtml(title)}</h3>
      <div style="margin: 1rem 0;">
        <input type="text" class="meta-input" id="prompt-input" style="width: 100%; box-sizing: border-box; font-size: 1rem; padding: 0.5rem;">
      </div>
      <div class="modal-actions">
        <button class="btn-primary" id="prompt-ok-btn">OK</button>
        <button class="btn-cancel" id="prompt-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  
  const input = modal.querySelector('#prompt-input');
  input.value = initialValue;
  
  const handleCancel = () => {
    app.setState('showPromptModal', false);
    app.setState('promptCallback', null);
  };
  
  const handleOk = () => {
    const val = input.value;
    const cb = app.getState('promptCallback');
    app.setState('showPromptModal', false);
    app.setState('promptCallback', null);
    if (cb) cb(val);
  };
  
  modal.onclick = (e) => {
    if (e.target === modal) handleCancel();
  };
  
  modal.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleOk();
    }
  };
  
  modal.querySelector('#prompt-ok-btn').onclick = handleOk;
  modal.querySelector('#prompt-cancel-btn').onclick = handleCancel;
  
  container.appendChild(modal);
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
}

function renderReloadConfirmModal(container, app) {
  const isOpen = app.getState('showReloadConfirm', false);
  if (!isOpen) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay reload-confirm-modal-overlay';
  modal.tabIndex = 0;
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <h3>Reload Note</h3>
      <p>This note has been modified on disk. Do you want to reload it and pull the latest changes? Any unsaved local edits will be lost.</p>
      <div class="modal-actions">
        <button class="btn-primary" id="reload-confirm-btn">Reload</button>
        <button class="btn-cancel" id="reload-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  
  const handleCancel = () => {
    app.setState('showReloadConfirm', false);
    app.setState('reloadingTabId', null);
  };
  
  const handleReload = () => {
    const tabId = app.getState('reloadingTabId');
    if (window.appInstance) {
      window.appInstance.actions.reloadTabContent(tabId);
    }
  };
  
  modal.onclick = (e) => {
    if (e.target === modal) handleCancel();
  };
  
  modal.onkeydown = (e) => {
    if (e.key === 'Escape') handleCancel();
    else if (e.key === 'Enter') {
      e.preventDefault();
      handleReload();
    }
  };
  
  modal.querySelector('#reload-confirm-btn').onclick = handleReload;
  modal.querySelector('#reload-cancel-btn').onclick = handleCancel;
  
  container.appendChild(modal);
  setTimeout(() => modal.querySelector('#reload-confirm-btn').focus(), 50);
}

function renderCloseConfirmModal(container, app) {
  const isOpen = app.getState('showCloseConfirm', false);
  if (!isOpen) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.tabIndex = 0;
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <h3>Unsaved Changes</h3>
      <p>This note has unsaved changes. Do you want to save them before closing?</p>
      <div class="modal-actions">
        <button class="btn-primary" id="close-save-btn">Save</button>
        <button class="btn-secondary" id="close-discard-btn">Don't Save</button>
        <button class="btn-cancel" id="close-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  
  const handleCancel = () => {
    app.setState('showCloseConfirm', false);
    app.setState('closingTabId', null);
  };
  
  const handleSave = () => {
    const tabId = app.getState('closingTabId');
    if (window.appInstance) {
      window.appInstance.actions.saveAndClose(tabId);
    }
  };
  
  const handleDiscard = () => {
    const tabId = app.getState('closingTabId');
    if (window.appInstance) {
      window.appInstance.actions.forceCloseTab(tabId);
    }
  };
  
  modal.onclick = (e) => {
    if (e.target === modal) handleCancel();
  };
  
  modal.onkeydown = (e) => {
    if (e.key === 'Escape') handleCancel();
    else if (e.key === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON' && !document.activeElement.classList.contains('btn-primary')) return;
      e.preventDefault();
      handleSave();
    }
  };
  
  modal.querySelector('#close-save-btn').onclick = handleSave;
  modal.querySelector('#close-discard-btn').onclick = handleDiscard;
  modal.querySelector('#close-cancel-btn').onclick = handleCancel;
  
  container.appendChild(modal);
  setTimeout(() => modal.querySelector('#close-save-btn').focus(), 50);
}

function renderCommandPaletteModal(container, app) {
  const isOpen = app.getState('commandPaletteOpen', false);
  if (!isOpen) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay command-palette-overlay';
  modal.innerHTML = `
    <div class="command-palette-container">
      <div class="command-palette-search-wrapper">
        <span class="material-symbols-rounded search-icon">search</span>
        <input id="command-palette-input" type="text" placeholder="Type a command (e.g. sync, edit, copy)...">
      </div>
      <div class="command-palette-results" id="command-palette-results"></div>
      <div class="command-palette-footer">
        <span>↑↓ to navigate</span>
        <span>↵ to select</span>
        <span>esc to close</span>
      </div>
    </div>
  `;
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      app.setState('commandPaletteOpen', false);
      app.setState('commandPaletteQuery', '');
    }
  };
  
  const input = modal.querySelector('#command-palette-input');
  const resultsContainer = modal.querySelector('#command-palette-results');
  
  input.value = app.getState('commandPaletteQuery', '');
  
  const updateResults = () => {
    const query = app.getState('commandPaletteQuery', '');
    const selectedIndex = app.getState('commandPaletteSelectedIndex', 0);
    const allCommands = getCommands(app);
    const filtered = allCommands.filter(c => 
      c.name.toLowerCase().includes(query.toLowerCase())
    );
    
    resultsContainer.innerHTML = '';
    if (filtered.length === 0) {
      resultsContainer.innerHTML = `<div class="command-palette-no-results">No commands found</div>`;
      return;
    }
    
    filtered.forEach((cmd, idx) => {
      const item = document.createElement('div');
      item.className = `command-palette-item ${idx === selectedIndex ? 'selected' : ''}`;
      item.onclick = () => {
        cmd.action();
        app.setState('commandPaletteOpen', false);
        app.setState('commandPaletteQuery', '');
      };
      
      let shortcutHtml = '';
      if (cmd.shortcut) {
        shortcutHtml = `<span class="item-shortcut-indicator" style="margin-right: 0.5rem;">${cmd.shortcut}</span>`;
      }
      
      let enterHtml = '';
      if (idx === selectedIndex) {
        enterHtml = `<span class="item-shortcut-indicator">Enter ↵</span>`;
      }
      
      item.innerHTML = `
        <span class="material-symbols-rounded item-icon">${cmd.icon}</span>
        <span class="item-name">${escapeHtml(cmd.name)}</span>
        ${shortcutHtml}
        ${enterHtml}
      `;
      resultsContainer.appendChild(item);
    });
  };
  
  updateResults();
  
  input.oninput = (e) => {
    app.setState('commandPaletteQuery', e.target.value);
    app.setState('commandPaletteSelectedIndex', 0);
    updateResults();
  };
  
  input.onkeydown = (e) => {
    const query = app.getState('commandPaletteQuery', '');
    const selectedIndex = app.getState('commandPaletteSelectedIndex', 0);
    const allCommands = getCommands(app);
    const filtered = allCommands.filter(c => 
      c.name.toLowerCase().includes(query.toLowerCase())
    );
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) {
        const nextIdx = (selectedIndex + 1) % filtered.length;
        app.setState('commandPaletteSelectedIndex', nextIdx);
        updateResults();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length > 0) {
        const nextIdx = (selectedIndex - 1 + filtered.length) % filtered.length;
        app.setState('commandPaletteSelectedIndex', nextIdx);
        updateResults();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        app.setState('commandPaletteOpen', false);
        app.setState('commandPaletteQuery', '');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      app.setState('commandPaletteOpen', false);
      app.setState('commandPaletteQuery', '');
    }
  };
  
  container.appendChild(modal);
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
}

// Master Render loop
export function renderApp() {
  updateHeader();
  updateMainArea();
  updateModals();
}

app.subscribe(() => {
  renderApp();
});

// Bootstrap flow
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div id="app-root">
      <header class="top-header" id="top-header"></header>
      <div class="main-content-area" id="main-content"></div>
      <div id="modal-container"></div>
    </div>
  `;
  
  renderApp();
  
  await app.actions.fetchObjects();
  await app.actions.fetchClasses();
  await app.actions.fetchClassesConfig();
  await app.actions.fetchSchemas();
  await app.actions.fetchSettings();
  
  renderApp();
});

function blurActiveInput() {
  if (document.activeElement && (
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'TEXTAREA' ||
    document.activeElement.isContentEditable
  )) {
    document.activeElement.blur();
  }
}

// Keyboard shortcuts (Hotkeys)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (app.getState('commandPaletteOpen', false)) {
      app.setState('commandPaletteOpen', false);
      app.setState('commandPaletteQuery', '');
      renderApp();
      return;
    }
    if (app.getState('menuOpen', false)) {
      app.setState('menuOpen', false);
      renderApp();
      return;
    }
  }

  const isTyping = document.activeElement && (
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'TEXTAREA' ||
    document.activeElement.isContentEditable ||
    document.activeElement.classList.contains('CodeMirror-code')
  );

  const activeId = app.getState('activeTabId', 'explorer');
  const isEditMode = app.getState('activeTabEditMode', false);
  const isRawMode = app.getState('activeTabRawMode', false);

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    if (activeId !== 'explorer' && (isEditMode || isRawMode)) {
      e.preventDefault();
      app.actions.saveNote(activeId);
    }
    return;
  }

  const isPaletteTrigger = 
    (e.altKey && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar')) ||
    (e.ctrlKey && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar')) ||
    (e.altKey && e.key.toLowerCase() === 'k') ||
    ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k');

  if (isPaletteTrigger) {
    e.preventDefault();
    const current = app.getState('commandPaletteOpen', false);
    app.setState('commandPaletteOpen', !current);
    if (!current) {
      app.setState('commandPaletteQuery', '');
      app.setState('commandPaletteSelectedIndex', 0);
    }
    renderApp();
    return;
  }

  const keyLower = e.key.toLowerCase();

  if (e.altKey && keyLower === 'e') {
    if (activeId !== 'explorer') {
      e.preventDefault();
      app.actions.toggleEditMode(activeId);
    }
    return;
  }

  if (e.altKey && keyLower === 'r') {
    if (activeId !== 'explorer') {
      e.preventDefault();
      app.actions.toggleRawMode(activeId);
    }
    return;
  }

  if (isTyping) return;

  if (e.altKey && keyLower === 'n') {
    e.preventDefault();
    app.actions.openNewNoteModal();
    return;
  }

  if (e.altKey && keyLower === 'a') {
    e.preventDefault();
    app.actions.toggleAutoEdit();
    return;
  }

  if (e.altKey && keyLower === 'p') {
    e.preventDefault();
    app.actions.toggleAutoShowProperties();
    return;
  }

  if (e.altKey && keyLower === 's') {
    e.preventDefault();
    app.actions.handleSync();
    return;
  }

  if (activeId !== 'explorer') {
    if (e.altKey && keyLower === 'c') {
      e.preventDefault();
      app.actions.copyMarkdown(activeId);
      return;
    }

    if (e.altKey && keyLower === 'd') {
      e.preventDefault();
      app.actions.downloadMarkdown(activeId);
      return;
    }

    const isDeleteKey = e.key === 'Delete' || e.key === 'Del' || (e.altKey && (e.key === 'Backspace' || e.code === 'Backspace'));
    if (isDeleteKey) {
      e.preventDefault();
      showConfirm("Are you sure you want to delete this note? This action is permanent.", "Delete Note", (yes) => {
        if (yes && window.appInstance) {
          window.appInstance.actions.deleteNote(activeId);
        }
      });
      return;
    }
  }
});

window.addEventListener('click', (e) => {
  if (app.getState('menuOpen', false)) {
    const menuContainer = document.querySelector('.menu-container');
    if (menuContainer && !menuContainer.contains(e.target)) {
      app.setState('menuOpen', false);
    }
  }
});

// SSE connection for live updates
const eventSource = new EventSource('/api/live-reload');
eventSource.onmessage = (event) => {
  const data = event.data;
  console.log(`[SSE] Received message: ${data}`);
  if (data.startsWith('data-changed:')) {
    const firstColonIdx = data.indexOf(':');
    const secondColonIdx = data.indexOf(':', firstColonIdx + 1);
    
    let id = '';
    let payload = null;
    if (secondColonIdx !== -1) {
      id = data.substring(firstColonIdx + 1, secondColonIdx);
      try {
        payload = JSON.parse(data.substring(secondColonIdx + 1));
      } catch (e) {
        console.error("Failed to parse SSE payload", e);
      }
    } else {
      id = data.substring(firstColonIdx + 1);
    }

    if (window.appInstance) {
      window.appInstance.actions.fetchObjects();
      const isConfig = id.startsWith('config-') || (payload && payload.metadata && (payload.metadata.class === 'config' || payload.metadata.type === 'config'));
      if (isConfig) {
        window.appInstance.actions.fetchClasses();
        window.appInstance.actions.fetchClassesConfig();
      }

      const openTabs = window.appInstance.getState('openTabs', []);
      const tab = openTabs.find(t => t.id === id);
      if (tab) {
        if (payload) {
          if (isTabEqual(tab, payload)) {
            console.log(`[SSE] Tab ${id} matches disk content. No reload needed.`);
            return;
          }
          const isDirty = checkIsDirty(tab);
          if (!isDirty) {
            console.log(`[SSE] Tab ${id} is not dirty. Silent reloading from payload...`);
            window.appInstance.actions.reloadTabContent(id, payload);
            return;
          }
        }
        console.log(`[SSE] Tab ${id} is dirty or no payload. Showing reload warning.`);
        window.appInstance.actions.markTabOutOfSync(id, false);
        const activeId = window.appInstance.getState('activeTabId');
        if (activeId === id) {
          window.appInstance.setState('reloadingTabId', id);
          window.appInstance.setState('showReloadConfirm', true);
        }
      }
    }
  } else if (data.startsWith('data-deleted:')) {
    const id = data.replace('data-deleted:', '');
    if (window.appInstance) {
      window.appInstance.actions.fetchObjects();
      if (id.startsWith('config-')) {
        window.appInstance.actions.fetchClasses();
        window.appInstance.actions.fetchClassesConfig();
      }
      const openTabs = window.appInstance.getState('openTabs', []);
      const tab = openTabs.find(t => t.id === id);
      if (tab) {
        window.appInstance.actions.markTabOutOfSync(id, true);
        const activeId = window.appInstance.getState('activeTabId');
        if (activeId === id) {
          window.appInstance.setState('reloadingTabId', id);
          window.appInstance.setState('showReloadConfirm', true);
        }
      }
    }
  } else if (data === 'reload') {
    if (window.appInstance) {
      window.appInstance.actions.fetchObjects();
    }
  }
};

eventSource.onerror = (err) => {
  if (eventSource.readyState === EventSource.CONNECTING) {
    console.warn('[SSE] Connection lost. Reconnecting...');
  } else {
    console.error('[SSE] Connection error:', err);
  }
};
