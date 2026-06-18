import { GalleryComponent } from './gallery.js?v=52';
import { CreateNoteComponent } from './create-view.js?v=52';
import { EditorComponent, TabEditorComponent, renderMarkdownView, initEasyMDE, destroyEasyMDE } from './editor.js?v=52';
import { ExplorerComponent } from './explorer.js?v=52';

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

const CloseConfirmModal = (props, context) => {
  const { getState, setState } = context;
  return {
    hooks: {
      onMount: () => {
        setTimeout(() => {
          const btn = document.querySelector('.modal-overlay .btn-primary');
          if (btn) btn.focus();
        }, 50);
      }
    },
    render: () => {
      return {
        div: {
          class: 'modal-overlay',
          tabindex: '0',
          autofocus: 'autofocus',
          onclick: (e) => {
            if (e.target === e.currentTarget) {
              setState('showCloseConfirm', false);
              setState('closingTabId', null);
            }
          },
          onkeydown: (e) => {
            if (e.key === 'Escape') {
              setState('showCloseConfirm', false);
              setState('closingTabId', null);
            } else if (e.key === 'Enter') {
              // If the user has manually tabbed/focused a non-primary button, let Enter click it normally
              if (document.activeElement && document.activeElement.tagName === 'BUTTON' && !document.activeElement.classList.contains('btn-primary')) {
                return;
              }
              e.preventDefault();
              const tabId = getState('closingTabId');
              if (window.appInstance) {
                window.appInstance.actions.saveAndClose(tabId);
              }
            }
          },
          children: [
            {
              div: {
                class: 'confirm-modal-content',
                children: [
                  {
                    h3: {
                      text: 'Unsaved Changes'
                    }
                  },
                  {
                    p: {
                      text: 'This note has unsaved changes. Do you want to save them before closing?'
                    }
                  },
                  {
                    div: {
                      class: 'modal-actions',
                      children: [
                        {
                          button: {
                            class: 'btn-primary',
                            autofocus: 'autofocus',
                            text: 'Save',
                            onclick: () => {
                              const tabId = getState('closingTabId');
                              if (window.appInstance) {
                                window.appInstance.actions.saveAndClose(tabId);
                              }
                            }
                          }
                        },
                        {
                          button: {
                            class: 'btn-secondary',
                            text: "Don't Save",
                            onclick: () => {
                              const tabId = getState('closingTabId');
                              if (window.appInstance) {
                                window.appInstance.actions.forceCloseTab(tabId);
                              }
                            }
                          }
                        },
                        {
                          button: {
                            class: 'btn-cancel',
                            text: 'Cancel',
                            onclick: () => {
                              setState('showCloseConfirm', false);
                              setState('closingTabId', null);
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      };
    }
  };
};const AlertModal = (props, context) => {
  const { getState, setState } = context;
  return {
    hooks: {
      onMount: () => {
        setTimeout(() => {
          const btn = document.querySelector('.alert-modal-overlay .btn-primary');
          if (btn) btn.focus();
        }, 50);
      }
    },
    render: () => {
      return {
        div: {
          class: 'modal-overlay alert-modal-overlay',
          tabindex: '0',
          autofocus: 'autofocus',
          onclick: (e) => {
            if (e.target === e.currentTarget) {
              setState('showAlertModal', false);
            }
          },
          onkeydown: (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
              e.preventDefault();
              setState('showAlertModal', false);
            }
          },
          children: [
            {
              div: {
                class: 'confirm-modal-content',
                children: [
                  {
                    h3: {
                      text: () => getState('alertModalTitle', 'Alert')
                    }
                  },
                  {
                    p: {
                      text: () => getState('alertModalMessage', '')
                    }
                  },
                  {
                    div: {
                      class: 'modal-actions',
                      children: [
                        {
                          button: {
                            class: 'btn-primary',
                            autofocus: 'autofocus',
                            text: 'OK',
                            onclick: () => {
                              setState('showAlertModal', false);
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      };
    }
  };
};
const PromptModal = (props, context) => {
  const { getState, setState } = context;
  return {
    hooks: {
      onMount: () => {
        setTimeout(() => {
          const input = document.querySelector('.prompt-modal-overlay input');
          if (input) {
            input.focus();
            input.select();
          }
        }, 50);
      }
    },
    render: () => {
      return {
        div: {
          class: 'modal-overlay prompt-modal-overlay',
          tabindex: '0',
          autofocus: 'autofocus',
          onclick: (e) => {
            if (e.target === e.currentTarget) {
              setState('showPromptModal', false);
              setState('promptCallback', null);
            }
          },
          onkeydown: (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setState('showPromptModal', false);
              setState('promptCallback', null);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const val = getState('promptModalValue', '');
              const cb = getState('promptCallback');
              setState('showPromptModal', false);
              setState('promptCallback', null);
              if (cb) cb(val);
            }
          },
          children: [
            {
              div: {
                class: 'confirm-modal-content',
                children: [
                  {
                    h3: {
                      text: () => getState('promptModalTitle', 'Enter Value')
                    }
                  },
                  {
                    div: {
                      style: { margin: '1rem 0' },
                      children: [
                        {
                          input: {
                            type: 'text',
                            class: 'meta-input',
                            style: { width: '100%', boxSizing: 'border-box', fontSize: '1rem', padding: '0.5rem' },
                            value: () => getState('promptModalValue', ''),
                            oninput: (e) => {
                              setState('promptModalValue', e.target.value);
                            },
                            autofocus: 'autofocus'
                          }
                        }
                      ]
                    }
                  },
                  {
                    div: {
                      class: 'modal-actions',
                      children: [
                        {
                          button: {
                            class: 'btn-primary',
                            text: 'OK',
                            onclick: () => {
                              const val = getState('promptModalValue', '');
                              const cb = getState('promptCallback');
                              setState('showPromptModal', false);
                              setState('promptCallback', null);
                              if (cb) cb(val);
                            }
                          }
                        },
                        {
                          button: {
                            class: 'btn-cancel',
                            text: 'Cancel',
                            onclick: () => {
                              setState('showPromptModal', false);
                              setState('promptCallback', null);
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      };
    }
  };
};

const ConfirmModal = (props, context) => {
  const { getState, setState } = context;
  return {
    hooks: {
      onMount: () => {
        setTimeout(() => {
          const btn = document.querySelector('.confirm-modal-overlay .btn-primary');
          if (btn) btn.focus();
        }, 50);
      }
    },
    render: () => {
      return {
        div: {
          class: 'modal-overlay confirm-modal-overlay',
          tabindex: '0',
          autofocus: 'autofocus',
          onclick: (e) => {
            if (e.target === e.currentTarget) {
              setState('showConfirmModal', false);
              setState('confirmCallback', null);
            }
          },
          onkeydown: (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setState('showConfirmModal', false);
              setState('confirmCallback', null);
            } else if (e.key === 'Enter') {
              if (document.activeElement && document.activeElement.tagName === 'BUTTON' && document.activeElement.classList.contains('btn-cancel')) {
                return;
              }
              e.preventDefault();
              const cb = getState('confirmCallback');
              setState('showConfirmModal', false);
              setState('confirmCallback', null);
              if (cb) cb(true);
            }
          },
          children: [
            {
              div: {
                class: 'confirm-modal-content',
                children: [
                  {
                    h3: {
                      text: () => getState('confirmModalTitle', 'Confirm')
                    }
                  },
                  {
                    p: {
                      text: () => getState('confirmModalMessage', '')
                    }
                  },
                  {
                    div: {
                      class: 'modal-actions',
                      children: [
                        {
                          button: {
                            class: 'btn-primary',
                            autofocus: 'autofocus',
                            text: 'Yes',
                            onclick: () => {
                              const cb = getState('confirmCallback');
                              setState('showConfirmModal', false);
                              setState('confirmCallback', null);
                              if (cb) cb(true);
                            }
                          }
                        },
                        {
                          button: {
                            class: 'btn-cancel',
                            text: 'No',
                            onclick: () => {
                              const cb = getState('confirmCallback');
                              setState('showConfirmModal', false);
                              setState('confirmCallback', null);
                              if (cb) cb(false);
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      };
    }
  };
};

const ReloadConfirmModal = (props, context) => {
  const { getState, setState } = context;
  return {
    hooks: {
      onMount: () => {
        setTimeout(() => {
          const btn = document.querySelector('.reload-confirm-modal-overlay .btn-primary');
          if (btn) btn.focus();
        }, 50);
      }
    },
    render: () => {
      return {
        div: {
          class: 'modal-overlay reload-confirm-modal-overlay',
          tabindex: '0',
          autofocus: 'autofocus',
          onclick: (e) => {
            if (e.target === e.currentTarget) {
              setState('showReloadConfirm', false);
              setState('reloadingTabId', null);
            }
          },
          onkeydown: (e) => {
            if (e.key === 'Escape') {
              setState('showReloadConfirm', false);
              setState('reloadingTabId', null);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const tabId = getState('reloadingTabId');
              if (window.appInstance) {
                window.appInstance.actions.reloadTabContent(tabId);
              }
            }
          },
          children: [
            {
              div: {
                class: 'confirm-modal-content',
                children: [
                  {
                    h3: {
                      text: 'Reload Note'
                    }
                  },
                  {
                    p: {
                      text: 'This note has been modified on disk. Do you want to reload it and pull the latest changes? Any unsaved local edits will be lost.'
                    }
                  },
                  {
                    div: {
                      class: 'modal-actions',
                      children: [
                        {
                          button: {
                            class: 'btn-primary',
                            autofocus: 'autofocus',
                            text: 'Reload',
                            onclick: () => {
                              const tabId = getState('reloadingTabId');
                              if (window.appInstance) {
                                window.appInstance.actions.reloadTabContent(tabId);
                              }
                            }
                          }
                        },
                        {
                          button: {
                            class: 'btn-cancel',
                            text: 'Cancel',
                            onclick: () => {
                              setState('showReloadConfirm', false);
                              setState('reloadingTabId', null);
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      };
    }
  };
};

const getCommands = () => {
  const activeId = app.getState('activeTabId', 'explorer');
  const isEditMode = app.getState('activeTabEditMode', false);
  const isRawMode = app.getState('activeTabRawMode', false);
  const openTabs = app.getState('openTabs', []);
  const tab = openTabs.find(t => t.id === activeId);

  const list = [
    {
      id: 'go-explorer',
      name: 'Go to Explorer / Dashboard',
      icon: 'grid_view',
      action: () => {
        app.setState('activeTabId', 'explorer');
        app.setState('isExplorerActive', true);
        app.setState('activeTabEditMode', false);
        app.setState('activeTabRawMode', false);
      }
    },
    {
      id: 'new-note',
      name: 'New Note / Create Object',
      icon: 'add_circle',
      shortcut: 'Alt+N',
      action: () => app.actions.openNewNoteModal()
    },
    {
      id: 'sync-data',
      name: 'Sync Data Folder with SQLite',
      icon: 'sync',
      shortcut: 'Alt+S',
      action: () => app.actions.handleSync()
    },
    {
      id: 'toggle-auto-edit',
      name: `Toggle Auto-Edit (Currently ${app.getState('autoEdit', false) ? 'ON' : 'OFF'})`,
      icon: 'edit_note',
      shortcut: 'Alt+A',
      action: () => app.actions.toggleAutoEdit()
    },
    {
      id: 'toggle-auto-properties',
      name: `Toggle Auto-Show Properties (Currently ${app.getState('autoShowProperties', false) ? 'ON' : 'OFF'})`,
      icon: 'settings_accessibility',
      shortcut: 'Alt+P',
      action: () => app.actions.toggleAutoShowProperties()
    },
    {
      id: 'open-settings',
      name: 'Open Application Settings',
      icon: 'settings',
      action: () => {
        const settingsTab = app.getState('objects', []).find(o => o.id === 'settings');
        if (settingsTab) app.actions.openTab(settingsTab);
      }
    },
    {
      id: 'open-ai-prompt',
      name: 'Open AI Quick Add Prompt Settings',
      icon: 'smart_toy',
      action: () => {
        const promptTab = app.getState('objects', []).find(o => o.id === 'prompt-quick-add');
        if (promptTab) app.actions.openTab(promptTab);
      }
    },
    {
      id: 'toggle-hamburger-menu',
      name: `Toggle Hamburger Menu (Currently ${app.getState('menuOpen', false) ? 'Open' : 'Closed'})`,
      icon: 'menu',
      shortcut: 'Alt+Space',
      action: () => app.setState('menuOpen', !app.getState('menuOpen', false))
    },
    {
      id: 'toggle-sidebar-mobile',
      name: `Toggle Sidebar Mobile (Currently ${app.getState('mobileSidebarOpen', false) ? 'Open' : 'Closed'})`,
      icon: 'dock_to_left',
      action: () => app.setState('mobileSidebarOpen', !app.getState('mobileSidebarOpen', false))
    }
  ];

  if (activeId !== 'explorer' && tab) {
    if (isEditMode || isRawMode) {
      list.push({
        id: 'save-note',
        name: 'Save Note',
        icon: 'save',
        shortcut: 'Ctrl+S',
        action: () => app.actions.saveNote(activeId)
      });
    }

    list.push(
      {
        id: 'reload-note',
        name: 'Reload Note from Disk',
        icon: 'refresh',
        action: () => {
          app.setState('reloadingTabId', activeId);
          app.setState('showReloadConfirm', true);
        }
      },
      {
        id: 'toggle-edit',
        name: isEditMode ? 'Switch to View Mode (Read-Only)' : 'Switch to Edit Mode',
        icon: isEditMode ? 'visibility' : 'edit',
        shortcut: 'Alt+E',
        action: () => app.actions.toggleEditMode(activeId)
      }
    );

    if (activeId !== 'explorer') {
      list.push({
        id: 'toggle-raw',
        name: isRawMode ? 'Switch to Rich Editor' : 'Switch to Raw Markdown Editor',
        icon: 'code',
        shortcut: 'Alt+R',
        action: () => app.actions.toggleRawMode(activeId)
      });
    }

    list.push(
      {
        id: 'copy-markdown',
        name: 'Copy Note Markdown to Clipboard',
        icon: 'content_copy',
        shortcut: 'Alt+C',
        action: () => app.actions.copyMarkdown(activeId)
      },
      {
        id: 'download-markdown',
        name: 'Download Note as Markdown File',
        icon: 'download',
        shortcut: 'Alt+D',
        action: () => app.actions.downloadMarkdown(activeId)
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

const CommandPaletteModal = (props, context) => {
  const { getState, setState } = context;
  const isOpen = getState('commandPaletteOpen', false);
  if (!isOpen) return null;

  return {
    hooks: {
      onMount: () => {
        setTimeout(() => {
          const input = document.getElementById('command-palette-input');
          if (input) {
            input.focus();
            input.select();
          }
        }, 50);
      }
    },
    render: () => {
      const handleKeyDown = (e) => {
        const query = getState('commandPaletteQuery', '');
        const selectedIndex = getState('commandPaletteSelectedIndex', 0);
        const allCommands = getCommands();
        const filtered = allCommands.filter(c => 
          c.name.toLowerCase().includes(query.toLowerCase())
        );

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (filtered.length > 0) {
            setState('commandPaletteSelectedIndex', (selectedIndex + 1) % filtered.length);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (filtered.length > 0) {
            setState('commandPaletteSelectedIndex', (selectedIndex - 1 + filtered.length) % filtered.length);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filtered[selectedIndex]) {
            filtered[selectedIndex].action();
            setState('commandPaletteOpen', false);
            setState('commandPaletteQuery', '');
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setState('commandPaletteOpen', false);
          setState('commandPaletteQuery', '');
        }
      };

      return {
        div: {
          class: 'modal-overlay command-palette-overlay',
          onclick: () => {
            setState('commandPaletteOpen', false);
            setState('commandPaletteQuery', '');
          },
          children: [
            {
              div: {
                class: 'command-palette-container',
                onclick: (e) => e.stopPropagation(),
                children: [
                  {
                    div: {
                      class: 'command-palette-search-wrapper',
                      children: [
                        {
                          span: {
                            class: 'material-symbols-rounded search-icon',
                            text: 'search'
                          }
                        },
                        {
                          input: {
                            id: 'command-palette-input',
                            type: 'text',
                            placeholder: 'Type a command (e.g. sync, edit, copy)...',
                            value: () => getState('commandPaletteQuery', ''),
                            oninput: (e) => {
                              setState('commandPaletteQuery', e.target.value);
                              setState('commandPaletteSelectedIndex', 0);
                            },
                            onkeydown: handleKeyDown
                          }
                        }
                      ]
                    }
                  },
              {
                div: {
                  class: 'command-palette-results',
                  children: () => {
                    const query = getState('commandPaletteQuery', '');
                    const selectedIndex = getState('commandPaletteSelectedIndex', 0);
                    const allCommands = getCommands();
                    const filtered = allCommands.filter(c => 
                      c.name.toLowerCase().includes(query.toLowerCase())
                    );

                    if (filtered.length === 0) {
                      return [
                        {
                          div: {
                            class: 'command-palette-no-results',
                            text: 'No commands found'
                          }
                        }
                      ];
                    }

                    return filtered.map((cmd, idx) => ({
                      div: {
                        class: `command-palette-item ${idx === selectedIndex ? 'selected' : ''}`,
                        onclick: () => {
                          cmd.action();
                          setState('commandPaletteOpen', false);
                          setState('commandPaletteQuery', '');
                        },
                        children: [
                          {
                            span: {
                              class: 'material-symbols-rounded item-icon',
                              text: cmd.icon
                            }
                          },
                          {
                            span: {
                              class: 'item-name',
                              text: cmd.name
                            }
                          },
                          cmd.shortcut ? {
                            span: {
                              class: 'item-shortcut-indicator',
                              text: cmd.shortcut,
                              style: { marginRight: '0.5rem' }
                            }
                          } : null,
                          idx === selectedIndex ? {
                            span: {
                              class: 'item-shortcut-indicator',
                              text: 'Enter ↵'
                            }
                          } : null
                        ]
                      }
                    }));
                  }
                }
              },
              {
                div: {
                  class: 'command-palette-footer',
                  children: [
                    { span: { text: '↑↓ to navigate' } },
                    { span: { text: '↵ to select' } },
                    { span: { text: 'esc to close' } }
                  ]
                }
              }
            ]
          }
        }
      ]
        }
      };
    }
  };
};

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
      class: () => {
        const autoEdit = getState('autoEdit', false);
        return `top-header ${autoEdit ? 'auto-edit-on' : 'auto-edit-off'}`;
      },
      children: [
        // Left Side: Global Actions Hamburger Menu
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
                        children: () => {
                          const activeTabId = getState('activeTabId', 'explorer');
                          const isEditMode = getState('activeTabEditMode', false);
                          const isRawMode = getState('activeTabRawMode', false);
                          const autoEdit = getState('autoEdit', false);
                          const autoShowProperties = getState('autoShowProperties', false);

                          const menuItems = [
                            // 1. New Note
                            {
                              button: {
                                id: 'btn-new',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  app.actions.openNewNoteModal();
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: 'add' } },
                                  { span: { class: 'menu-item-text', text: 'New Note' } },
                                  { span: { class: 'menu-item-hotkey', text: 'Alt+N' } }
                                ]
                              }
                            },
                            // 2. Auto-Edit Toggle
                            {
                              button: {
                                id: 'btn-auto-edit',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  if (window.appInstance) window.appInstance.actions.toggleAutoEdit();
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: autoEdit ? 'check_box' : 'check_box_outline_blank' } },
                                  { span: { class: 'menu-item-text', text: 'Auto-Edit' } },
                                  { span: { class: 'menu-item-hotkey', text: 'Alt+A' } }
                                ]
                              }
                            },
                            // Auto-Show Properties Toggle
                            {
                              button: {
                                id: 'btn-auto-show-properties',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  if (window.appInstance) window.appInstance.actions.toggleAutoShowProperties();
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: autoShowProperties ? 'check_box' : 'check_box_outline_blank' } },
                                  { span: { class: 'menu-item-text', text: 'Auto-Show Properties' } },
                                  { span: { class: 'menu-item-hotkey', text: 'Alt+P' } }
                                ]
                              }
                            },
                            // 3. Sync Data
                            {
                              button: {
                                id: 'btn-sync',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  if (window.appInstance) window.appInstance.actions.handleSync();
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: 'sync' } },
                                  { span: { class: 'menu-item-text', text: 'Sync Data' } },
                                  { span: { class: 'menu-item-hotkey', text: 'Alt+S' } }
                                ]
                              }
                            }
                          ];

                          // Tab-specific options
                          if (activeTabId !== 'explorer') {
                            menuItems.push({ hr: { class: 'menu-divider' } });

                            // Reload Note
                            menuItems.push({
                              button: {
                                id: 'btn-reload',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  setState('reloadingTabId', activeTabId);
                                  setState('showReloadConfirm', true);
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: 'refresh' } },
                                  { span: { class: 'menu-item-text', text: 'Reload Note' } }
                                ]
                              }
                            });

                            // 4. Save
                            if (isEditMode || isRawMode) {
                              menuItems.push({
                                button: {
                                  id: 'btn-save',
                                  onclick: () => {
                                    setState('menuOpen', false);
                                    if (window.appInstance) window.appInstance.actions.saveNote(activeTabId);
                                  },
                                  children: [
                                    { span: { class: 'material-symbols-rounded', text: 'save' } },
                                    { span: { class: 'menu-item-text', text: 'Save Note' } },
                                    { span: { class: 'menu-item-hotkey', text: 'Ctrl+S' } }
                                  ]
                                }
                              });
                            }

                            // 5. Edit/View Toggle
                            menuItems.push({
                              button: {
                                id: 'btn-toggle-edit',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  if (window.appInstance) window.appInstance.actions.toggleEditMode(activeTabId);
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: isEditMode ? 'visibility' : 'edit' } },
                                  { span: { class: 'menu-item-text', text: isEditMode ? 'View Mode' : 'Edit Mode' } },
                                  { span: { class: 'menu-item-hotkey', text: 'Alt+E' } }
                                ]
                              }
                            });

                            // 6. Toggle Raw
                            if (activeTabId !== 'explorer') {
                              menuItems.push({
                                button: {
                                  id: 'btn-toggle-raw',
                                  onclick: () => {
                                    setState('menuOpen', false);
                                    if (window.appInstance) window.appInstance.actions.toggleRawMode(activeTabId);
                                  },
                                  children: [
                                    { span: { class: 'material-symbols-rounded', text: 'code' } },
                                    { span: { class: 'menu-item-text', text: 'Raw Markdown' } },
                                    { span: { class: 'menu-item-hotkey', text: 'Alt+R' } }
                                  ]
                                }
                              });
                            }


                            // Copy Markdown
                            menuItems.push({
                              button: {
                                id: 'btn-copy-markdown',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  if (window.appInstance) window.appInstance.actions.copyMarkdown(activeTabId);
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: 'content_copy' } },
                                  { span: { class: 'menu-item-text', text: 'Copy Markdown' } },
                                  { span: { class: 'menu-item-hotkey', text: 'Alt+C' } }
                                ]
                              }
                            });

                            // Download Markdown
                            menuItems.push({
                              button: {
                                id: 'btn-download-markdown',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  if (window.appInstance) window.appInstance.actions.downloadMarkdown(activeTabId);
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: 'download' } },
                                  { span: { class: 'menu-item-text', text: 'Download Markdown' } },
                                  { span: { class: 'menu-item-hotkey', text: 'Alt+D' } }
                                ]
                              }
                            });

                            // Print PDF
                            menuItems.push({
                              button: {
                                id: 'btn-print',
                                onclick: () => {
                                  setState('menuOpen', false);
                                  window.print();
                                },
                                children: [
                                  { span: { class: 'material-symbols-rounded', text: 'print' } },
                                  { span: { class: 'menu-item-text', text: 'Print PDF' } }
                                ]
                              }
                            });

                            // 7. Delete Note
                            menuItems.push({
                              button: {
                                id: 'btn-delete',
                                style: { color: 'var(--md-sys-color-error)' },
                                onclick: () => {
                                  setState('menuOpen', false);
                                  showConfirm("Are you sure you want to delete this note? This action is permanent.", "Delete Note", (yes) => {
                                    if (yes && window.appInstance) {
                                      window.appInstance.actions.deleteNote(activeTabId);
                                    }
                                  });
                                },
                                children: [
                                   { span: { class: 'material-symbols-rounded', text: 'delete', style: { color: 'var(--md-sys-color-error)' } } },
                                  { span: { class: 'menu-item-text', text: 'Delete Note' } },
                                  { span: { class: 'menu-item-hotkey', text: 'Alt+Del' } }
                                ]
                              }
                            });
                          }

                          return menuItems;
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        // Center: Tab List
        {
          div: {
            class: 'tab-bar',
            style: { flex: '1' }, // Occupy remaining header space
            children: () => {
              const openTabs = getState('openTabs', []);
              const activeTabId = getState('activeTabId', 'explorer');
              
              // Explorer Tab (static first tab, cannot be closed)
              const tabs = [
                {
                  div: {
                    class: `tab-item ${activeTabId === 'explorer' ? 'active' : ''}`,
                    onclick: () => {
                      if (window.appInstance) {
                        window.appInstance.actions.setActiveTab('explorer');
                      }
                    },
                    children: [
                      { span: { class: 'material-symbols-rounded', style: { fontSize: '1.25rem' }, text: 'grid_view' } },
                      { span: { class: 'tab-title', text: 'Explorer' } }
                    ]
                  }
                }
              ];
              
              // Render open notes as tabs next to it
              openTabs.forEach(tab => {
                const isDirty = checkIsDirty(tab);

                tabs.push({
                  div: {
                    class: `tab-item ${activeTabId === tab.id ? 'active' : ''}`,
                    onclick: () => {
                      if (window.appInstance) {
                        window.appInstance.actions.setActiveTab(tab.id);
                      }
                    },
                    children: [
                      { span: { class: 'tab-title', text: tab.title } },
                      isDirty ? { span: { class: 'tab-dirty-dot', text: '•' } } : null,
                      tab.isOutOfSync ? {
                        span: {
                          class: 'material-symbols-rounded tab-sync-warning',
                          text: tab.isOutOfSync === 'deleted' ? 'delete' : 'sync_problem',
                          title: tab.isOutOfSync === 'deleted' ? 'File deleted on disk. Click to resolve.' : 'File updated on disk. Click to reload.',
                          onclick: (e) => {
                            e.stopPropagation();
                            app.setState('reloadingTabId', tab.id);
                            app.setState('showReloadConfirm', true);
                          }
                        }
                      } : null,
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
        const isExplorer = context.getState('isExplorerActive', true);
        
        if (isExplorer) {
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
    contextMenuOpen: false,
    contextMenuX: 0,
    contextMenuY: 0,
    commandPaletteOpen: false,
    commandPaletteQuery: '',
    commandPaletteSelectedIndex: 0
  },
  
  components: {
    GalleryComponent,
    CreateNoteComponent,
    TopHeaderComponent,
    MainContentComponent,
    ExplorerComponent,
    EditorComponent,
    AlertModal,
    PromptModal,
    ConfirmModal,
    ReloadConfirmModal,
    CloseConfirmModal,
    CommandPaletteModal
  },
  
  layout: {
    div: {
      id: 'app-root',
      children: () => {
        const isCreatingNote = app.getState('isCreatingNote', false);
        const showCloseConfirm = app.getState('showCloseConfirm', false);
        const showAlertModal = app.getState('showAlertModal', false);
        const showPromptModal = app.getState('showPromptModal', false);
        const showReloadConfirm = app.getState('showReloadConfirm', false);
        const showConfirmModal = app.getState('showConfirmModal', false);
        const commandPaletteOpen = app.getState('commandPaletteOpen', false);
        const context = app.createContext();
        if (isCreatingNote) {
          const list = [{ CreateNoteComponent: {} }];
          if (commandPaletteOpen) {
            list.push({ CommandPaletteModal: {} });
          }
          return list;
        }
        
        const items = [
          TopHeaderComponent({}, context),
          MainContentComponent({}, context)
        ];

        if (showCloseConfirm) {
          items.push({ CloseConfirmModal: {} });
        }

        if (showAlertModal) {
          items.push({ AlertModal: {} });
        }

        if (showPromptModal) {
          items.push({ PromptModal: {} });
        }

        if (showReloadConfirm) {
          items.push({ ReloadConfirmModal: {} });
        }

        if (showConfirmModal) {
          items.push({ ConfirmModal: {} });
        }

        if (commandPaletteOpen) {
          items.push({ CommandPaletteModal: {} });
        }
        
        return items;
      }
    }
  }
});

// Synchronize openTabIds state whenever openTabs changes
app.subscribe('openTabs', () => {
  const openTabs = app.getState('openTabs', [], false);
  const currentIds = openTabs.map(t => t.id).join(',');
  const oldIds = app.getState('openTabIds', '', false);
  if (currentIds !== oldIds) {
    app.setState('openTabIds', currentIds);
  }
});
// Function to automatically persist session tabs & active tab states (disabled - refresh starts over)
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
  
  // Trigger transition
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after 3 seconds
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

// Helper to determine the default note class based on class configurations
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

// Attach Actions
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
        
        // Refresh the note list first
        await app.actions.fetchObjects();
        
        // Open the newly created note!
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
    const tabs = app.getState('openTabs');
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
    const tabs = app.getState('openTabs');
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
      
      // Dirty checking prompt before closing
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
    const tabs = app.getState('openTabs');
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
      app.setState('activeTabEditMode', newTab.isEditMode);
      saveSessionState();
    }
  },

  toggleRawMode(tabId) {
    const tabs = app.getState('openTabs');
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
    const tabs = app.getState('openTabs');
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
    const tabs = app.getState('openTabs');
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
    const tabs = app.getState('openTabs');
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
  },  async reloadTabContent(tabId, payload = null) {
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
        app.actions.fetchObjects(); // Fetch in background to update explorer
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

// Global accessor
window.appInstance = app;

// Bootstrap data
await app.actions.fetchObjects();
await app.actions.fetchClasses();
await app.actions.fetchClassesConfig();
await app.actions.fetchSchemas();
await app.actions.fetchSettings();



// Render
app.render('#app');

// Global keyboard shortcuts (Hotkeys)
// Helper to blur focused inputs to enable global shortcuts when switching modes/tabs
function blurActiveInput() {
  if (document.activeElement && (
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'TEXTAREA' ||
    document.activeElement.isContentEditable
  )) {
    document.activeElement.blur();
  }
}

window.addEventListener('keydown', (e) => {
  // Escape key closes the hamburger menu/command palette if open
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (app.getState('commandPaletteOpen', false)) {
      app.setState('commandPaletteOpen', false);
      app.setState('commandPaletteQuery', '');
      return;
    }
    if (app.getState('menuOpen', false)) {
      app.setState('menuOpen', false);
      return;
    }
  }

  // If the user is typing inside an input, textarea, or contenteditable element,
  // ignore global shortcuts EXCEPT for Ctrl+S (saving is always good) and Command Palette toggles
  const isTyping = document.activeElement && (
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'TEXTAREA' ||
    document.activeElement.isContentEditable ||
    document.activeElement.classList.contains('CodeMirror-code')
  );

  const activeId = app.getState('activeTabId', 'explorer');
  const isEditMode = app.getState('activeTabEditMode', false);
  const isRawMode = app.getState('activeTabRawMode', false);

  // 1. Ctrl + S (Save Note)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    if (activeId !== 'explorer' && (isEditMode || isRawMode)) {
      e.preventDefault();
      app.actions.saveNote(activeId);
    }
    return;
  }

  // 1.5. Command Palette Toggle shortcuts:
  // - Alt + Space (requested)
  // - Ctrl + Space (fallback)
  // - Alt + K / Ctrl + K (fallback)
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
    return;
  }

  const keyLower = e.key.toLowerCase();

  // 2. Alt + E (Toggle Edit/View Mode)
  if (e.altKey && keyLower === 'e') {
    if (activeId !== 'explorer') {
      e.preventDefault();
      app.actions.toggleEditMode(activeId);
    }
    return;
  }

  // 3. Alt + R (Toggle Raw Markdown)
  if (e.altKey && keyLower === 'r') {
    if (activeId !== 'explorer') {
      e.preventDefault();
      app.actions.toggleRawMode(activeId);
    }
    return;
  }

  // If typing, ignore other global hotkeys to not interfere with text input
  if (isTyping) return;

  // 4. Alt + N (New Note)
  if (e.altKey && keyLower === 'n') {
    e.preventDefault();
    app.actions.openNewNoteModal();
    return;
  }

  // 5. Alt + A (Toggle Auto-Edit)
  if (e.altKey && keyLower === 'a') {
    e.preventDefault();
    app.actions.toggleAutoEdit();
    return;
  }

  // Alt + P (Toggle Auto-Show Properties)
  if (e.altKey && keyLower === 'p') {
    e.preventDefault();
    app.actions.toggleAutoShowProperties();
    return;
  }

  // 6. Alt + S (Sync Data)
  if (e.altKey && keyLower === 's') {
    e.preventDefault();
    app.actions.handleSync();
    return;
  }

  // Active tab shortcuts
  if (activeId !== 'explorer') {
    // Alt + C (Copy Markdown)
    if (e.altKey && keyLower === 'c') {
      e.preventDefault();
      app.actions.copyMarkdown(activeId);
      return;
    }

    // Alt + D (Download Markdown)
    if (e.altKey && keyLower === 'd') {
      e.preventDefault();
      app.actions.downloadMarkdown(activeId);
      return;
    }

    // 7. Delete / Backspace (Delete Note)
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

// Close hamburger menu if clicking outside the menu container
window.addEventListener('click', (e) => {
  if (app.getState('menuOpen', false)) {
    const menuContainer = document.querySelector('.menu-container');
    if (menuContainer && !menuContainer.contains(e.target)) {
      app.setState('menuOpen', false);
    }
  }
});

// Establish SSE connection for Live Reload & sync monitoring
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

