import { renderMarkdown } from './renderer.js?v=52';

// Dictionary to hold EasyMDE instances by tab ID
const mdeInstances = {};

// Helper to parse dataview results
async function fetchDataview(script, container) {
  try {
    container.innerHTML = '<div class="dv-loading">Executing query...</div>';
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script })
    });
    const data = await res.json();
    if (data.success) {
      container.innerHTML = data.html || '<div class="dv-empty">No results</div>';
      
      container.querySelectorAll('.dv-link').forEach(link => {
        link.onclick = (e) => {
          e.preventDefault();
          const id = link.getAttribute('data-id');
          if (window.appInstance) {
            const target = window.appInstance.state.objects.find(o => o.id === id);
            if (target) window.appInstance.actions.openTab(target);
          }
        };
      });
    } else {
      container.innerHTML = `<div class="dv-error">Error: ${data.error}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="dv-error">Fetch Error: ${err.message}</div>`;
  }
}

// Global function to compile and render Markdown + Dataview with retries
export function renderMarkdownView(tab) {
  let retries = 0;
  const maxRetries = 10;
  
  const tryRender = () => {
    const container = document.getElementById('view-content-' + tab.id);
    if (container) {
      console.log(`[Editor] renderMarkdownView: Element 'view-content-${tab.id}' found on try ${retries + 1}. Rendering.`);
      const rawHtml = renderMarkdown(tab.content || "");
      container.innerHTML = rawHtml;

      container.querySelectorAll('pre code.language-dataviewjs').forEach(codeEl => {
        const preEl = codeEl.parentElement;
        const script = codeEl.textContent;

        const blockEl = document.createElement('div');
        blockEl.className = 'dataview-block';

        const codePart = document.createElement('pre');
        codePart.className = 'dv-code-part';
        codePart.style.display = 'none';
        codePart.textContent = script;
        blockEl.appendChild(codePart);

        const resultEl = document.createElement('div');
        resultEl.className = 'dv-container';
        blockEl.appendChild(resultEl);

        preEl.replaceWith(blockEl);
        fetchDataview(script, resultEl);
      });

      // Set click handlers for wiki links
      container.querySelectorAll('.wiki-link').forEach(link => {
        link.onclick = (e) => {
          e.preventDefault();
          const id = link.getAttribute('data-id');
          const target = window.appInstance.getState('objects', []).find(o => o.id === id);
          if (target) {
            window.appInstance.actions.openTab(target);
          } else {
            window.showConfirm(`Note "${id}" does not exist. Would you like to create it?`, "Create Note", () => {
              window.appInstance.actions.openNewNoteModal(id.replace(/-/g, ' '));
            });
          }
        };
      });
    } else if (retries < maxRetries) {
      retries++;
      setTimeout(tryRender, 40);
    } else {
      console.warn(`[Editor] renderMarkdownView: Element 'view-content-${tab.id}' not found in DOM after ${maxRetries} retries.`);
    }
  };

  tryRender();
}

// EasyMDE initialization and cleanup helper with retries
export function initEasyMDE(tab) {
  const el = document.getElementById(`textarea-editor-${tab.id}`);
  
  if (mdeInstances[tab.id]) {
    if (el && mdeInstances[tab.id].element === el) {
      const currVal = mdeInstances[tab.id].value();
      const newVal = tab.content || "";
      if (currVal.replace(/\r\n/g, '\n') !== newVal.replace(/\r\n/g, '\n')) {
        console.log(`[Editor] initEasyMDE: Updating EasyMDE value to match new content for tab ${tab.id}.`);
        mdeInstances[tab.id].value(newVal);
      }
      return;
    }
  }

  if (tab.isInitializingEasyMDE) {
    console.log(`[Editor] initEasyMDE: Already initializing for tab ${tab.id}. Skipping.`);
    return;
  }
  tab.isInitializingEasyMDE = true;

  let retries = 0;
  const maxRetries = 10;

  const tryInit = () => {
    if (mdeInstances[tab.id]) {
      tab.isInitializingEasyMDE = false;
      return;
    }

    const currentEl = document.getElementById(`textarea-editor-${tab.id}`);
    if (currentEl) {
      console.log(`[Editor] initEasyMDE: Element 'textarea-editor-${tab.id}' found on try ${retries + 1}. Initializing EasyMDE.`);
      
      try {
        const instance = new EasyMDE({
          element: currentEl,
          initialValue: tab.content || "",
          spellChecker: false,
          status: false,
          autosave: { enabled: false },
          toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen"]
        });

        mdeInstances[tab.id] = instance;

        instance.codemirror.on("change", (cm, changeObj) => {
          if (tab.isDestroyingEasyMDE) return;

          const newVal = instance.value();
          const latestTabs = window.appInstance ? window.appInstance.getState('openTabs', []) : [];
          const latestTab = latestTabs.find(t => t.id === tab.id) || tab;

          const normNew = (newVal || '').replace(/\r\n/g, '\n');
          const normOld = (latestTab.content || '').replace(/\r\n/g, '\n');
          if (normNew === normOld) return;

          if (window.appInstance) {
            const updatedTabs = latestTabs.map(t => {
              if (t.id === tab.id) {
                return { ...t, content: newVal };
              }
              return t;
            });
            window.appInstance.setState('openTabs', updatedTabs);
            if (window.saveSessionState) window.saveSessionState();
          }
        });
      } catch (e) {
        console.error(`[Editor] Error creating EasyMDE for tab ${tab.id}:`, e);
      } finally {
        tab.isInitializingEasyMDE = false;
      }
    } else if (retries < maxRetries) {
      retries++;
      setTimeout(tryInit, 40);
    } else {
      tab.isInitializingEasyMDE = false;
      console.warn(`[Editor] initEasyMDE: Textarea 'textarea-editor-${tab.id}' not found in DOM after ${maxRetries} retries.`);
    }
  };

  tryInit();
}

export function destroyEasyMDE(tab) {
  tab.isInitializingEasyMDE = false;
  if (mdeInstances[tab.id]) {
    console.log(`[Editor] destroyEasyMDE executing for tab: ${tab.id}`);
    tab.isDestroyingEasyMDE = true;
    try {
      mdeInstances[tab.id].toTextArea();
    } catch (e) {
      console.warn(`[Editor] Error during easyMDEInstance.toTextArea() for tab ${tab.id}:`, e);
    }
    delete mdeInstances[tab.id];
    tab.isDestroyingEasyMDE = false;
  }
}

// Module-level Metadata property helpers
function getInputType(key, value, noteClass, getState) {
  const schemas = getState('schemas', {});
  const schema = schemas[noteClass] || {};
  if (schema[key]) return schema[key];
  const k = key.toLowerCase();
  if (k.includes('date') || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) return 'date';
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') return 'number';
  return 'text';
}

function addMetaProp(tab, getState, setState) {
  if (window.showPrompt) {
    window.showPrompt("Property name:", "", (key) => {
      if (key && !key.startsWith('_')) {
        const tabs = getState('openTabs');
        const updatedTabs = tabs.map(t => {
          if (t.id === tab.id) {
            return {
              ...t,
              metadata: { ...t.metadata, [key]: "" },
              metaVisible: true
            };
          }
          return t;
        });
        setState('openTabs', updatedTabs);
        if (window.saveSessionState) window.saveSessionState();

        // Direct DOM update to ensure it expands immediately
        const form = document.getElementById(`metadata-form-${tab.id}`);
        if (form) {
          form.classList.remove('collapsed');
        }
      }
    });
  }
}

function deleteMetaProp(tab, key, getState, setState) {
  const tabs = getState('openTabs');
  const updatedTabs = tabs.map(t => {
    if (t.id === tab.id) {
      const nextMeta = { ...t.metadata };
      delete nextMeta[key];
      return { ...t, metadata: nextMeta };
    }
    return t;
  });
  setState('openTabs', updatedTabs);
  if (window.saveSessionState) window.saveSessionState();
}

function updateMetaProp(tab, key, e, getState, setState) {
  const tabs = getState('openTabs');
  let val = e.target.value;
  if (e.target.type === 'checkbox') val = e.target.checked;
  else if (e.target.type === 'number') val = Number(e.target.value);
  
  const updatedTabs = tabs.map(t => {
    if (t.id === tab.id) {
      return {
        ...t,
        metadata: { ...t.metadata, [key]: val }
      };
    }
    return t;
  });
  setState('openTabs', updatedTabs);
  if (window.saveSessionState) window.saveSessionState();
}

// Stateful TabEditorComponent helper function (standard VDOM rendering)
export function renderTabEditor(tab, { getState, setState }) {
  const isRawMode = tab.isRawMode;

  if (isRawMode) {
    // Sync lastRenderedMode to 'raw' and clean up any EasyMDE instance
    if (tab.lastRenderedMode !== 'raw') {
      destroyEasyMDE(tab);
      tab.lastRenderedMode = 'raw';
    }

    return {
      div: {
        key: tab.id,
        class: () => {
          const activeIdVal = getState('activeTabId');
          const isActive = tab.id === activeIdVal;
          console.log(`[renderTabEditor] RawMode class check for ${tab.id}: activeId=${activeIdVal}, isActive=${isActive}`);
          return `editor-tab-container ${isActive ? 'active' : 'inactive'}`;
        },
        style: () => {
          const activeIdVal = getState('activeTabId');
          const isActive = tab.id === activeIdVal;
          console.log(`[renderTabEditor] RawMode style check for ${tab.id}: activeId=${activeIdVal}, isActive=${isActive}`);
          if (isActive) {
            return {
              height: '100%',
              flex: '1',
              display: 'flex',
              flexDirection: 'column'
            };
          } else {
            return {
              display: 'none'
            };
          }
        },
        children: [
          {
            textarea: {
              key: 'raw-textarea-' + tab.id,
              class: 'full-raw-editor',
              placeholder: 'Edit raw markdown file...',
              value: () => {
                const list = getState('openTabs', []);
                const item = list.find(x => x.id === tab.id);
                return item ? (item.rawFullContent || '') : '';
              },
              oninput: (e) => {
                const list = getState('openTabs', []);
                const updatedTabs = list.map(x => {
                  if (x.id === tab.id) {
                    return { ...x, rawFullContent: e.target.value };
                  }
                  return x;
                });
                setState('openTabs', updatedTabs);
                if (window.saveSessionState) window.saveSessionState();
              }
            }
          }
        ]
      }
    };
  }

  return {
    div: {
      key: tab.id,
      class: () => {
        const activeIdVal = getState('activeTabId');
        const isActive = tab.id === activeIdVal;
        const list = getState('openTabs', []);
        const curr = list.find(x => x.id === tab.id) || tab;
        const isEdit = curr.isEditMode;
        console.log(`[renderTabEditor] VisualMode class check for ${tab.id}: activeId=${activeIdVal}, isActive=${isActive}, isEdit=${isEdit}`);
        return `editor-tab-container ${isActive ? 'active' : 'inactive'} ${!isEdit ? 'readonly-mode' : ''}`;
      },
      style: () => {
        const activeIdVal = getState('activeTabId');
        const isActive = tab.id === activeIdVal;
        console.log(`[renderTabEditor] VisualMode style check for ${tab.id}: activeId=${activeIdVal}, isActive=${isActive}`);
        if (isActive) {
          return {
            display: 'flex',
            flexDirection: 'column',
            flex: '1',
            minHeight: '0',
            minWidth: '0'
          };
        } else {
          return {
            display: 'none'
          };
        }
      },
      // Reactive attribute helper to hook into mount/update/state changes of this specific tab
      'data-init-tab': () => {
        const activeIdVal = getState('activeTabId');
        const activeTabEditMode = getState('activeTabEditMode');
        const isActive = tab.id === activeIdVal;
        const isEdit = isActive ? activeTabEditMode : tab.isEditMode;

        // If in view mode, track content changes reactively
        if (!isEdit) {
          const list = getState('openTabs', []);
          const curr = list.find(x => x.id === tab.id);
          if (curr) {
            const content = curr.content;
          }
        }

        console.log(`[renderTabEditor] data-init-tab evaluation for ${tab.id}: isActive=${isActive}, isEdit=${isEdit}`);

        setTimeout(() => {
          const list = getState('openTabs', [], false);
          const curr = list.find(x => x.id === tab.id) || tab;

          if (isEdit) {
            if (curr.lastRenderedMode !== 'edit') {
              destroyEasyMDE(curr); // ensure clean state
              curr.lastRenderedMode = 'edit';
            }
            if (isActive) {
              initEasyMDE(curr);
              if (mdeInstances[tab.id]) {
                mdeInstances[tab.id].codemirror.refresh();
              }
            }
          } else {
            const viewEl = document.getElementById(`view-content-${tab.id}`);
            if (viewEl) {
              const contentChanged = curr.lastRenderedContent !== curr.content;
              const modeChanged = curr.lastRenderedMode !== 'view';
              const isEmpty = !viewEl.innerHTML;

              if (modeChanged || contentChanged || isEmpty) {
                if (curr.lastRenderedMode === 'edit') {
                  destroyEasyMDE(curr);
                }
                curr.lastRenderedMode = 'view';
                curr.lastRenderedContent = curr.content;
                renderMarkdownView(curr);
              }
            }
          }
        }, 50);

        return `${isEdit ? 'edit' : 'view'}-${isActive ? 'active' : 'inactive'}`;
      },
      children: [
        {
          div: {
            key: 'visual-container-' + tab.id,
            class: 'visual-editor-container',
            children: [
              // Inbox Banner
              () => {
                const list = getState('openTabs', []);
                const item = list.find(x => x.id === tab.id);
                if (!item || !item.metadata || !item.metadata._inbox) return null;
                return {
                  div: {
                    key: 'inbox-banner-' + tab.id,
                    class: 'inbox-banner',
                    children: [
                      {
                        span: {
                          key: 'inbox-icon-' + tab.id,
                          class: 'material-symbols-rounded',
                          style: { color: 'var(--md-sys-color-primary)', marginRight: '0.5rem' },
                          text: 'inbox'
                        }
                      },
                      {
                        span: {
                          key: 'inbox-text-' + tab.id,
                          style: { flex: '1', fontWeight: '500' },
                          text: 'This note is in your Inbox (unprocessed).'
                        }
                      },
                      {
                        button: {
                          key: 'inbox-btn-' + tab.id,
                          class: 'btn-process-inbox',
                          text: 'Mark Processed',
                          onclick: (e) => {
                            e.stopPropagation();
                            if (window.appInstance) {
                              window.appInstance.actions.processInboxNote(tab.id);
                            }
                          }
                        }
                      }
                    ]
                  }
                };
              },
              // Metadata Properties Form
              {
                div: {
                  key: 'meta-form-' + tab.id,
                  id: `metadata-form-${tab.id}`,
                  class: () => {
                    const list = getState('openTabs', []);
                    const item = list.find(x => x.id === tab.id);
                    const isCollapsed = !(item && item.metaVisible);
                    const isEdit = item ? item.isEditMode : false;
                    return `metadata-form ${!isEdit ? 'view-only' : ''} ${isCollapsed ? 'collapsed' : ''}`;
                  },
                  children: [
                    {
                      div: {
                        key: 'meta-header-' + tab.id,
                        class: 'meta-header',
                        onclick: (e) => {
                          const list = getState('openTabs');
                          const currentTab = list.find(x => x.id === tab.id) || tab;
                          const nextVisible = !currentTab.metaVisible;

                          const updatedTabs = list.map(x => {
                            if (x.id === tab.id) {
                              return { ...x, metaVisible: nextVisible };
                            }
                            return x;
                          });
                          setState('openTabs', updatedTabs);
                          if (window.saveSessionState) window.saveSessionState();

                          const form = document.getElementById(`metadata-form-${tab.id}`);
                          if (form) {
                            form.classList.toggle('collapsed', !nextVisible);
                          }
                        },
                        children: [
                          {
                            span: {
                              key: 'meta-collapse-icon-' + tab.id,
                              class: 'material-symbols-rounded collapse-icon',
                              text: 'expand_more'
                            }
                          },
                          {
                            span: {
                              key: 'meta-title-' + tab.id,
                              class: 'meta-title',
                              text: 'Properties'
                            }
                          },
                          () => {
                            const list = getState('openTabs', []);
                            const item = list.find(x => x.id === tab.id);
                            const isEdit = item ? item.isEditMode : false;
                            if (item && item.metaVisible && isEdit) {
                              return {
                                button: {
                                  key: 'btn-add-prop-' + tab.id,
                                  class: 'btn-add-prop',
                                  text: 'Add Property',
                                  onclick: (e) => {
                                    e.stopPropagation();
                                    addMetaProp(tab, getState, setState);
                                  }
                                }
                              };
                            }
                            return null;
                          }
                        ]
                      }
                    },
                    {
                      div: {
                        key: 'meta-fields-' + tab.id,
                        class: 'meta-fields-container',
                        children: () => {
                          const list = getState('openTabs', []);
                          const item = list.find(x => x.id === tab.id);
                          if (!item || !item.metadata) return [];

                          const fields = [];
                          const cleanMeta = Object.fromEntries(
                            Object.entries(item.metadata).filter(([k]) => !k.startsWith('_'))
                          );

                          Object.entries(cleanMeta).forEach(([key, val]) => {
                            const inputType = getInputType(key, val, item.class || item.type, getState);
                            const isCheckbox = inputType === 'checkbox';
                            const displayVal = val === null || val === undefined ? '' : val;

                            fields.push({
                              div: {
                                key: `meta-row-${tab.id}-${key}`,
                                class: 'meta-row',
                                children: [
                                  {
                                    span: {
                                      key: `meta-label-${tab.id}-${key}`,
                                      class: 'meta-label',
                                      text: key
                                    }
                                  },
                                  {
                                    div: {
                                      key: `meta-value-${tab.id}-${key}`,
                                      class: 'meta-value-container',
                                      children: [
                                        {
                                          input: {
                                            key: `meta-input-${tab.id}-${key}`,
                                            type: inputType,
                                            class: 'meta-input',
                                            readonly: () => {
                                              const listInner = getState('openTabs', []);
                                              const itemInner = listInner.find(x => x.id === tab.id);
                                              return (!itemInner || !itemInner.isEditMode) ? 'readonly' : undefined;
                                            },
                                            disabled: () => {
                                              const listInner = getState('openTabs', []);
                                              const itemInner = listInner.find(x => x.id === tab.id);
                                              return (!itemInner || !itemInner.isEditMode) ? 'disabled' : undefined;
                                            },
                                            value: isCheckbox ? undefined : displayVal,
                                            checked: isCheckbox ? !!val : undefined,
                                            onchange: (e) => {
                                              const listInner = getState('openTabs', []);
                                              const itemInner = listInner.find(x => x.id === tab.id);
                                              if (itemInner && itemInner.isEditMode) {
                                                updateMetaProp(itemInner, key, e, getState, setState);
                                              }
                                            }
                                          }
                                        },
                                        () => {
                                          const listInner = getState('openTabs', []);
                                          const itemInner = listInner.find(x => x.id === tab.id);
                                          return itemInner && itemInner.isEditMode ? {
                                            button: {
                                              key: `meta-delete-${tab.id}-${key}`,
                                              class: 'delete-prop btn-delete-prop',
                                              text: '✕',
                                              onclick: () => deleteMetaProp(tab, key, getState, setState)
                                            }
                                          } : null;
                                        }
                                      ]
                                    }
                                  }
                                ]
                              }
                            });
                          });

                          return fields;
                        }
                      }
                    }
                  ]
                }
              },
              // Editor Content Body
              {
                div: {
                  key: 'body-container-' + tab.id,
                  class: 'editor-body-container',
                  children: () => {
                    const list = getState('openTabs', [], false);
                    const item = list.find(x => x.id === tab.id);
                    if (!item) return [];

                    const children = [
                      // Print only metadata
                      {
                        pre: {
                          key: 'print-meta-' + tab.id,
                          class: 'print-only-metadata',
                          style: () => {
                            const listInner = getState('openTabs', []);
                            const itemInner = listInner.find(x => x.id === tab.id);
                            if (itemInner && itemInner.metadata) {
                              const cleanMeta = Object.fromEntries(
                                Object.entries(itemInner.metadata).filter(([k]) => !k.startsWith('_'))
                              );
                              if (Object.keys(cleanMeta).length > 0) return {};
                            }
                            return { display: 'none' };
                          },
                          children: [
                            {
                              code: {
                                key: 'print-code-' + tab.id,
                                text: () => {
                                  const listInner = getState('openTabs', []);
                                  const itemInner = listInner.find(x => x.id === tab.id);
                                  if (itemInner && itemInner.metadata) {
                                    const cleanMeta = Object.fromEntries(
                                      Object.entries(itemInner.metadata).filter(([k]) => !k.startsWith('_'))
                                    );
                                    if (Object.keys(cleanMeta).length > 0) {
                                      return jsyaml.dump(cleanMeta, { sortKeys: true }).trim();
                                    }
                                  }
                                  return "";
                                }
                              }
                            }
                          ]
                        }
                      },
                      // Hidden copy of body viewer used for printing
                      {
                        div: {
                          key: 'print-body-' + tab.id,
                          class: 'print-only-body-viewer',
                          innerHTML: () => {
                            const listInner = getState('openTabs', []);
                            const itemInner = listInner.find(x => x.id === tab.id);
                            if (itemInner) {
                              return renderMarkdown(itemInner.content || "");
                            }
                            return "";
                          }
                        }
                      }
                    ];

                    const isTabEdit = item.isEditMode;

                    if (isTabEdit) {
                      children.push({
                        textarea: {
                          key: 'textarea-' + tab.id,
                          id: `textarea-editor-${tab.id}`,
                          style: { display: 'none' }
                        }
                      });
                    } else {
                      children.push({
                        div: {
                          key: 'viewer-' + tab.id,
                          id: `view-content-${tab.id}`,
                          class: 'body-viewer'
                        }
                      });
                    }

                    return children;
                  }
                }
              }
            ]
          }
        }
      ]
    }
  };
}

// Dummy TabEditorComponent function component wrapper to prevent errors from other imports
export const TabEditorComponent = (props, context) => {
  return renderTabEditor(props.tab, context);
};

// Main EditorComponent serves as a list container for standard DOM tab elements
export const EditorComponent = (props, { getState, setState }) => {
  return {
    div: {
      class: 'editor-instance-container',
      style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0', minWidth: '0' },
      children: () => {
        const ids = getState('openTabIds', '');
        const openTabs = getState('openTabs', [], false);
        console.log(`[EditorComponent] children() re-evaluating. Open tabs: ${ids}`);
        return openTabs.map(tab => {
          return renderTabEditor(tab, { getState, setState });
        });
      }
    }
  };
};
