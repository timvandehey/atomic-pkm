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
      const rawHtml = marked.parse(tab.content || "");
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
  let retries = 0;
  const maxRetries = 10;

  const tryInit = () => {
    const el = document.getElementById(`textarea-editor-${tab.id}`);
    if (el) {
      console.log(`[Editor] initEasyMDE: Element 'textarea-editor-${tab.id}' found on try ${retries + 1}. Initializing EasyMDE.`);
      if (tab.easyMDEInstance) {
        tab.easyMDEInstance.toTextArea();
        tab.easyMDEInstance = null;
      }

      tab.easyMDEInstance = new EasyMDE({
        element: el,
        initialValue: tab.content || "",
        spellChecker: false,
        status: false,
        autosave: { enabled: false },
        toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen"]
      });

      tab.easyMDEInstance.codemirror.on("change", () => {
        tab.content = tab.easyMDEInstance.value();
      });
    } else if (retries < maxRetries) {
      retries++;
      setTimeout(tryInit, 40);
    } else {
      console.warn(`[Editor] initEasyMDE: Textarea 'textarea-editor-${tab.id}' not found in DOM after ${maxRetries} retries.`);
    }
  };

  tryInit();
}

export function destroyEasyMDE(tab) {
  if (tab.easyMDEInstance) {
    console.log(`[Editor] destroyEasyMDE executing for tab: ${tab.id}`);
    tab.easyMDEInstance.toTextArea();
    tab.easyMDEInstance = null;
  }
}

export const EditorComponent = (props, { getState, setState }) => {
  const getInputType = (key, value, noteType) => {
    const schemas = getState('schemas', {});
    const schema = schemas[noteType] || {};
    if (schema[key]) return schema[key];
    const k = key.toLowerCase();
    if (k.includes('date') || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) return 'date';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    return 'text';
  };

  const addMetaProp = (tab) => {
    const key = prompt("Property name:");
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
    }
  };

  const deleteMetaProp = (tab, key) => {
    const tabs = getState('openTabs');
    const updatedTabs = tabs.map(t => {
      if (t.id === tab.id) {
        const nextMeta = { ...t.metadata };
        delete nextMeta[key];
        return {
          ...t,
          metadata: nextMeta
        };
      }
      return t;
    });
    setState('openTabs', updatedTabs);
  };

  const updateMetaProp = (tab, key, e) => {
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
  };

  return {
    div: {
      style: 'display: flex; flex-direction: column; height: 100%; min-width: 0; flex: 1;',
      class: () => {
        const activeTabId = getState('activeTabId');
        const openTabs = getState('openTabs', []);
        const tab = openTabs.find(t => t.id === activeTabId);
        return `editor-instance-container ${(!tab || !tab.isEditMode) ? 'readonly-mode' : ''}`;
      },
      children: () => {
        const openTabs = getState('openTabs', []);
        const activeTabId = getState('activeTabId', null);
        const tab = openTabs.find(t => t.id === activeTabId);

        console.log("[EditorComponent] Root children executing. Tab:", activeTabId, "isEditMode:", tab ? tab.isEditMode : "no-tab");

        if (!tab) {
          return [];
        }

        if (tab.isRawMode) {
          return [
            {
              div: {
                class: 'raw-editor-container',
                style: 'height: 100%; flex: 1;',
                children: [
                  {
                    textarea: {
                      class: 'full-raw-editor',
                      placeholder: 'Edit raw markdown file...',
                      value: () => {
                        const tabs = getState('openTabs', []);
                        const t = tabs.find(x => x.id === tab.id);
                        return t ? (t.rawFullContent || '') : '';
                      },
                      oninput: (e) => {
                        tab.rawFullContent = e.target.value;
                      }
                    }
                  }
                ]
              }
            }
          ];
        }

        return [
          {
            div: {
              class: 'visual-editor-container',
              style: 'height: 100%; flex: 1; display: flex; flex-direction: column;',
              children: [
                // Metadata Properties Form
                {
                  div: {
                    id: () => `metadata-form-${tab.id}`,
                    class: () => {
                      const tabs = getState('openTabs', []);
                      const t = tabs.find(x => x.id === tab.id);
                      return `metadata-form ${(!t || !t.isEditMode) ? 'view-only' : ''}`;
                    },
                    children: [
                      {
                        div: {
                          class: 'meta-header',
                          onclick: () => {
                            const tabs = getState('openTabs');
                            const updatedTabs = tabs.map(t => {
                              if (t.id === tab.id) {
                                return { ...t, metaVisible: !t.metaVisible };
                              }
                              return t;
                            });
                            setState('openTabs', updatedTabs);
                          },
                          children: [
                            {
                              h2: {
                                class: 'meta-title',
                                children: [
                                  {
                                    span: {
                                      class: 'material-symbols-rounded meta-toggle-icon',
                                      style: () => {
                                        const tabs = getState('openTabs', []);
                                        const t = tabs.find(x => x.id === tab.id);
                                        return `transform: ${t && t.metaVisible ? 'rotate(0deg)' : 'rotate(-90deg)'}; transition: transform 0.2s;`;
                                      },
                                      text: 'expand_more'
                                    }
                                  },
                                  { span: { text: 'Properties' } }
                                ]
                              }
                            },
                            () => {
                              const tabs = getState('openTabs', []);
                              const t = tabs.find(x => x.id === tab.id);
                              return t && t.isEditMode ? {
                                button: {
                                  class: 'btn-add-prop',
                                  onclick: (e) => {
                                    e.stopPropagation();
                                    addMetaProp(tab);
                                  },
                                  children: [
                                    { span: { class: 'material-symbols-rounded', style: 'font-size: 1rem; vertical-align: middle;', text: 'add' } },
                                    { span: { text: ' Property' } }
                                  ]
                                }
                              } : null;
                            }
                          ]
                        }
                      },
                      {
                        div: {
                          id: () => `fields-container-${tab.id}`,
                          style: () => {
                            const tabs = getState('openTabs', []);
                            const t = tabs.find(x => x.id === tab.id);
                            return t && t.metaVisible ? 'display: block;' : 'display: none;';
                          },
                          children: () => {
                            const tabs = getState('openTabs', []);
                            const t = tabs.find(x => x.id === tab.id);
                            if (!t) return [];
                            
                            const meta = t.metadata || {};
                            return Object.entries(meta)
                              .filter(([key]) => !key.startsWith('_'))
                              .map(([key, val]) => {
                                const inputType = getInputType(key, val, t.type);
                                const isDate = inputType === 'date';
                                const isCheckbox = inputType === 'checkbox';
                                
                                let displayVal = val;
                                if (isDate && typeof val === 'string') {
                                  displayVal = val.split('T')[0];
                                }

                                return {
                                  div: {
                                    class: 'meta-field',
                                    children: [
                                      { label: { class: 'meta-label', text: key + ':' } },
                                      {
                                        input: {
                                          type: inputType,
                                          class: 'meta-input',
                                          readonly: () => {
                                            const tabsList = getState('openTabs', []);
                                            const currTab = tabsList.find(x => x.id === t.id);
                                            return (!currTab || !currTab.isEditMode) ? 'readonly' : undefined;
                                          },
                                          disabled: () => {
                                            const tabsList = getState('openTabs', []);
                                            const currTab = tabsList.find(x => x.id === t.id);
                                            return (!currTab || !currTab.isEditMode) ? 'disabled' : undefined;
                                          },
                                          value: isCheckbox ? undefined : displayVal,
                                          checked: isCheckbox ? !!val : undefined,
                                          onchange: (e) => {
                                            if (t.isEditMode) {
                                              updateMetaProp(t, key, e);
                                            }
                                          }
                                        }
                                      },
                                      () => {
                                        const tabsList = getState('openTabs', []);
                                        const currTab = tabsList.find(x => x.id === t.id);
                                        return currTab && currTab.isEditMode ? {
                                          button: {
                                            class: 'delete-prop btn-delete-prop',
                                            text: '✕',
                                            onclick: () => deleteMetaProp(t, key)
                                          }
                                        } : null;
                                      }
                                    ]
                                  }
                                };
                              });
                          }
                        }
                      }
                    ]
                  }
                },
                // Editor Content Body
                {
                  div: {
                    class: 'crepe-container',
                    style: 'flex: 1; overflow-y: auto;',
                    children: () => {
                      const tabs = getState('openTabs', []);
                      const t = tabs.find(x => x.id === tab.id);
                      if (!t) return [];
                      
                      return t.isEditMode ? [
                        {
                          textarea: {
                            id: () => `textarea-editor-${t.id}`,
                            style: () => ({ display: 'none' })
                          }
                        }
                      ] : [
                        {
                          div: {
                            id: () => `view-content-${t.id}`,
                            class: 'body-viewer'
                          }
                        }
                      ];
                    }
                  }
                }
              ]
            }
          }
        ];
      }
    }
  };
};
