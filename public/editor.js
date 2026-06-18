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
            const target = window.appInstance.getState('objects', []).find(o => o.id === id);
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
  return {
    render: () => {
      const activeIdVal = getState('activeTabId');
      const isActive = tab.id === activeIdVal;
      const isRawMode = isActive ? getState('activeTabRawMode', false) : (tab.isRawMode || false);
      const isEdit = isActive ? getState('activeTabEditMode', false) : (tab.isEditMode || false);

      const list = getState('openTabs', [], false);
      const curr = list.find(x => x.id === tab.id) || tab;

      if (isRawMode) {
        if (curr.lastRenderedMode !== 'raw') {
          destroyEasyMDE(curr);
          curr.lastRenderedMode = 'raw';
        }

        return {
          div: {
            key: curr.id + '-raw',
            class: `editor-instance-container ${isActive ? 'active' : 'inactive'}`,
            style: isActive ? {
              height: '100%',
              flex: '1',
              display: 'flex',
              flexDirection: 'column'
            } : {
              display: 'none'
            },
            children: [
              {
                textarea: {
                  key: 'raw-textarea-' + curr.id,
                  class: 'full-raw-editor',
                  placeholder: 'Edit raw markdown file...',
                  value: () => {
                    const listInner = getState('openTabs', []);
                    const itemInner = listInner.find(x => x.id === curr.id);
                    return itemInner ? (itemInner.rawFullContent || '') : '';
                  },
                  oninput: (e) => {
                    const listInner = getState('openTabs', []);
                    const updatedTabs = listInner.map(x => {
                      if (x.id === curr.id) {
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

      // Visual Mode (Rich Editor or Previewer)
      return {
        div: {
          key: curr.id + '-visual',
          class: `editor-instance-container ${isActive ? 'active' : 'inactive'} ${!isEdit ? 'readonly-mode' : ''}`,
          style: isActive ? {
            display: 'flex',
            flexDirection: 'column',
            flex: '1',
            minHeight: '0',
            minWidth: '0'
          } : {
            display: 'none'
          },
          // Reactive attribute helper to hook into mount/update/state changes of this specific tab
          'data-init-tab': () => {
            const activeIdValInner = getState('activeTabId');
            const activeTabEditModeInner = getState('activeTabEditMode');
            const isActiveInner = curr.id === activeIdValInner;
            const isEditInner = isActiveInner ? activeTabEditModeInner : curr.isEditMode;

            // If in view mode, track content changes reactively
            if (!isEditInner) {
              const listInner = getState('openTabs', []);
              const currInner = listInner.find(x => x.id === curr.id);
              if (currInner) {
                const content = currInner.content;
              }
            }

            console.log(`[renderTabEditor] data-init-tab evaluation for ${curr.id}: isActive=${isActiveInner}, isEdit=${isEditInner}`);

            setTimeout(() => {
              const listInner = getState('openTabs', [], false);
              const currInner = listInner.find(x => x.id === curr.id) || curr;

              if (isEditInner) {
                if (currInner.lastRenderedMode !== 'edit') {
                  destroyEasyMDE(currInner); // ensure clean state
                  currInner.lastRenderedMode = 'edit';
                }
                if (isActiveInner) {
                  initEasyMDE(currInner);
                  if (mdeInstances[curr.id]) {
                    mdeInstances[curr.id].codemirror.refresh();
                  }
                }
              } else {
                const viewEl = document.getElementById(`view-content-${curr.id}`);
                if (viewEl) {
                  const contentChanged = currInner.lastRenderedContent !== currInner.content;
                  const modeChanged = currInner.lastRenderedMode !== 'view';
                  const isEmpty = !viewEl.innerHTML;

                  if (modeChanged || contentChanged || isEmpty) {
                    if (currInner.lastRenderedMode === 'edit') {
                      destroyEasyMDE(currInner);
                    }
                    currInner.lastRenderedMode = 'view';
                    currInner.lastRenderedContent = currInner.content;
                    renderMarkdownView(currInner);
                  }
                }
              }
            }, 50);

            return `${isEditInner ? 'edit' : 'view'}-${isActiveInner ? 'active' : 'inactive'}`;
          },
          children: [
            {
              div: {
                key: 'visual-container-' + curr.id,
                class: 'visual-editor-container',
                children: [
                  // Inbox Banner
                  () => {
                    const listInner = getState('openTabs', []);
                    const itemInner = listInner.find(x => x.id === curr.id);
                    if (!itemInner || !itemInner.metadata || !itemInner.metadata._inbox) return null;
                    return {
                      div: {
                        key: 'inbox-banner-' + curr.id,
                        class: 'inbox-banner',
                        children: [
                          {
                            span: {
                              key: 'inbox-icon-' + curr.id,
                              class: 'material-symbols-rounded',
                              style: { color: 'var(--md-sys-color-primary)', marginRight: '0.5rem' },
                              text: 'inbox'
                            }
                          },
                          {
                            span: {
                              key: 'inbox-text-' + curr.id,
                              style: { flex: '1', fontWeight: '500' },
                              text: 'This note is in your Inbox (unprocessed).'
                            }
                          },
                          {
                            button: {
                              key: 'inbox-btn-' + curr.id,
                              class: 'btn-process-inbox',
                              text: 'Mark Processed',
                              onclick: (e) => {
                                e.stopPropagation();
                                if (window.appInstance) {
                                  window.appInstance.actions.processInboxNote(curr.id);
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
                      key: 'meta-form-' + curr.id,
                      id: `metadata-form-${curr.id}`,
                      class: () => {
                        const listInner = getState('openTabs', []);
                        const itemInner = listInner.find(x => x.id === curr.id);
                        const isCollapsed = !(itemInner && itemInner.metaVisible);
                        const isEditInner = itemInner ? itemInner.isEditMode : false;
                        return `metadata-form ${!isEditInner ? 'view-only' : ''} ${isCollapsed ? 'collapsed' : ''}`;
                      },
                      children: [
                        {
                          div: {
                            key: 'meta-header-' + curr.id,
                            class: 'meta-header',
                            onclick: (e) => {
                              const listInner = getState('openTabs');
                              const currentTab = listInner.find(x => x.id === curr.id) || curr;
                              const nextVisible = !currentTab.metaVisible;

                              const updatedTabs = listInner.map(x => {
                                if (x.id === curr.id) {
                                  return { ...x, metaVisible: nextVisible };
                                }
                                return x;
                              });
                              setState('openTabs', updatedTabs);
                              if (window.saveSessionState) window.saveSessionState();

                              const form = document.getElementById(`metadata-form-${curr.id}`);
                              if (form) {
                                form.classList.toggle('collapsed', !nextVisible);
                              }
                            },
                            children: [
                              {
                                span: {
                                  key: 'meta-collapse-icon-' + curr.id,
                                  class: 'material-symbols-rounded meta-toggle-icon',
                                  text: 'expand_more'
                                }
                              },
                              {
                                span: {
                                  key: 'meta-title-' + curr.id,
                                  class: 'meta-title',
                                  text: 'Properties'
                                }
                              },
                              () => {
                                const listInner = getState('openTabs', []);
                                const itemInner = listInner.find(x => x.id === curr.id);
                                const isEditInner = itemInner ? itemInner.isEditMode : false;
                                if (itemInner && itemInner.metaVisible && isEditInner) {
                                  return {
                                    button: {
                                      key: 'btn-add-prop-' + curr.id,
                                      class: 'btn-add-prop',
                                      text: 'Add Property',
                                      onclick: (e) => {
                                        e.stopPropagation();
                                        addMetaProp(curr, getState, setState);
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
                            key: 'meta-fields-' + curr.id,
                            class: 'meta-fields-container',
                            children: () => {
                              const listInner = getState('openTabs', []);
                              const itemInner = listInner.find(x => x.id === curr.id);
                              if (!itemInner || !itemInner.metadata) return [];

                              const fields = [];
                              const cleanMeta = Object.fromEntries(
                                Object.entries(itemInner.metadata).filter(([k]) => !k.startsWith('_'))
                              );

                              Object.entries(cleanMeta).forEach(([key, val]) => {
                                const inputType = getInputType(key, val, itemInner.class || itemInner.type, getState);
                                const isCheckbox = inputType === 'checkbox';
                                const displayVal = val === null || val === undefined ? '' : val;

                                fields.push({
                                  div: {
                                    key: `meta-field-${curr.id}-${key}`,
                                    class: 'meta-field',
                                    children: [
                                      {
                                        label: {
                                          key: `meta-label-${curr.id}-${key}`,
                                          class: 'meta-label',
                                          text: key + ':'
                                        }
                                      },
                                      {
                                        input: {
                                          key: `meta-input-${curr.id}-${key}`,
                                          type: inputType,
                                          class: 'meta-input' + (inputType === 'number' ? ' meta-input-number' : inputType === 'date' ? ' meta-input-date' : ''),
                                          readonly: () => {
                                            const listInner2 = getState('openTabs', []);
                                            const itemInner2 = listInner2.find(x => x.id === curr.id);
                                            return (!itemInner2 || !itemInner2.isEditMode) ? 'readonly' : undefined;
                                          },
                                          disabled: () => {
                                            const listInner2 = getState('openTabs', []);
                                            const itemInner2 = listInner2.find(x => x.id === curr.id);
                                            return (!itemInner2 || !itemInner2.isEditMode) ? 'disabled' : undefined;
                                          },
                                          value: isCheckbox ? undefined : displayVal,
                                          checked: isCheckbox ? !!val : undefined,
                                          onchange: (e) => {
                                            const listInner2 = getState('openTabs', []);
                                            const itemInner2 = listInner2.find(x => x.id === curr.id);
                                            if (itemInner2 && itemInner2.isEditMode) {
                                              updateMetaProp(itemInner2, key, e, getState, setState);
                                            }
                                          }
                                        }
                                      },
                                      () => {
                                        const listInner2 = getState('openTabs', []);
                                        const itemInner2 = listInner2.find(x => x.id === curr.id);
                                        return itemInner2 && itemInner2.isEditMode ? {
                                          button: {
                                            key: `meta-delete-${curr.id}-${key}`,
                                            class: 'delete-prop btn-delete-prop',
                                            text: '✕',
                                            onclick: () => deleteMetaProp(curr, key, getState, setState)
                                          }
                                        } : null;
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
                      key: 'body-container-' + curr.id,
                      class: 'editor-body-container',
                      children: () => {
                        const activeIdValInner = getState('activeTabId');
                        const isActiveInner = curr.id === activeIdValInner;
                        const isEditInner = isActiveInner ? getState('activeTabEditMode', false) : (curr.isEditMode || false);
                        const isRawInner = isActiveInner ? getState('activeTabRawMode', false) : (curr.isRawMode || false);

                        const listInner = getState('openTabs', [], false);
                        const itemInner = listInner.find(x => x.id === curr.id);
                        if (!itemInner) return [];

                        const children = [
                          // Print only metadata
                          {
                            pre: {
                              key: 'print-meta-' + curr.id,
                              class: 'print-only-metadata',
                              style: () => {
                                const listInner2 = getState('openTabs', [], false);
                                const itemInner2 = listInner2.find(x => x.id === curr.id);
                                if (itemInner2 && itemInner2.metadata) {
                                  const cleanMeta = Object.fromEntries(
                                    Object.entries(itemInner2.metadata).filter(([k]) => !k.startsWith('_'))
                                  );
                                  if (Object.keys(cleanMeta).length > 0) return {};
                                }
                                return { display: 'none' };
                              },
                              children: [
                                {
                                  code: {
                                    key: 'print-code-' + curr.id,
                                    text: () => {
                                      const listInner2 = getState('openTabs', [], false);
                                      const itemInner2 = listInner2.find(x => x.id === curr.id);
                                      if (itemInner2 && itemInner2.metadata) {
                                        const cleanMeta = Object.fromEntries(
                                          Object.entries(itemInner2.metadata).filter(([k]) => !k.startsWith('_'))
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
                              key: 'print-body-' + curr.id,
                              class: 'print-only-body-viewer',
                              innerHTML: () => {
                                const listInner2 = getState('openTabs', [], false);
                                const itemInner2 = listInner2.find(x => x.id === curr.id);
                                if (itemInner2) {
                                  return renderMarkdown(itemInner2.content || "");
                                }
                                return "";
                              }
                            }
                          }
                        ];

                        if (isEditInner) {
                          children.push({
                            textarea: {
                              key: 'textarea-' + curr.id,
                              id: `textarea-editor-${curr.id}`,
                              style: { display: 'none' }
                            }
                          });
                        } else {
                          children.push({
                            div: {
                              key: 'viewer-' + curr.id,
                              id: `view-content-${curr.id}`,
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
