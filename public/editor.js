import { renderMarkdown } from './renderer.js?v=52';

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

// Render Markdown + Dataview
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

      container.querySelectorAll('.wiki-link').forEach(link => {
        link.onclick = (e) => {
          e.preventDefault();
          const id = link.getAttribute('data-id');
          const target = window.appInstance.getState('objects', []).find(o => o.id === id);
          if (target) {
            window.appInstance.actions.openTab(target);
          } else {
            window.showConfirm(`Note "${id}" does not exist. Would you like to create it?`, "Create Note", (yes) => {
              if (yes) {
                window.appInstance.actions.openNewNoteModal(id.replace(/-/g, ' '));
              }
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

// EasyMDE initialization
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

        instance.codemirror.on("change", () => {
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

// Destroy EasyMDE
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

// Property type resolution
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

// Add/Delete properties
function addMetaProp(tab, getState, setState) {
  if (window.showPrompt) {
    window.showPrompt("Property name:", "", (key) => {
      if (key && !key.startsWith('_')) {
        const tabs = getState('openTabs', []);
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

        const form = document.getElementById(`metadata-form-${tab.id}`);
        if (form) {
          form.classList.remove('collapsed');
        }
      }
    });
  }
}

function deleteMetaProp(tab, key, getState, setState) {
  const tabs = getState('openTabs', []);
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
  const tabs = getState('openTabs', []);
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

// Escape HTML utility
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Synced tabs rendering
export function renderEditor(container, app) {
  const { getState, setState } = app;
  const openTabs = getState('openTabs', []);
  const activeTabId = getState('activeTabId', 'explorer');
  
  // 1. Create containers for tabs if they don't exist
  openTabs.forEach(tab => {
    let tabEl = document.getElementById(`editor-tab-container-${tab.id}`);
    if (!tabEl) {
      tabEl = document.createElement('div');
      tabEl.id = `editor-tab-container-${tab.id}`;
      tabEl.className = 'editor-instance-container';
      tabEl.innerHTML = `
        <div id="inbox-banner-${tab.id}" class="inbox-banner hidden"></div>
        <div id="metadata-form-${tab.id}" class="metadata-form collapsed">
          <div class="meta-header" id="meta-header-${tab.id}">
            <span class="material-symbols-rounded meta-toggle-icon">expand_more</span>
            <span class="meta-title">Properties</span>
            <button class="btn-add-prop hidden" id="btn-add-prop-${tab.id}">Add Property</button>
          </div>
          <div class="meta-fields-container" id="meta-fields-${tab.id}"></div>
        </div>
        <pre class="print-only-metadata" id="print-meta-${tab.id}"><code id="print-code-${tab.id}"></code></pre>
        <div class="print-only-body-viewer" id="print-body-${tab.id}"></div>
        <div class="editor-body-container" id="body-container-${tab.id}"></div>
        <div id="raw-editor-container-${tab.id}" class="raw-editor-container hidden">
          <textarea class="full-raw-editor" id="raw-textarea-${tab.id}" placeholder="Edit raw markdown file..."></textarea>
        </div>
      `;
      container.appendChild(tabEl);
    }
  });
  
  // 2. Clean up closed tabs
  Array.from(container.children).forEach(child => {
    const id = child.id.replace('editor-tab-container-', '');
    if (!openTabs.find(t => t.id === id)) {
      const closedTab = { id };
      destroyEasyMDE(closedTab);
      child.remove();
    }
  });
  
  // 3. Render and sync active / inactive states
  openTabs.forEach(tab => {
    const tabEl = document.getElementById(`editor-tab-container-${tab.id}`);
    if (!tabEl) return;
    
    const isActive = tab.id === activeTabId;
    const isRawMode = isActive ? getState('activeTabRawMode', false) : (tab.isRawMode || false);
    const isEdit = isActive ? getState('activeTabEditMode', false) : (tab.isEditMode || false);
    
    if (isActive) {
      tabEl.style.display = 'flex';
      tabEl.className = `editor-instance-container active ${!isEdit ? 'readonly-mode' : ''}`;
    } else {
      tabEl.style.display = 'none';
      tabEl.className = 'editor-instance-container inactive';
      return; // Do not do further rendering updates for hidden inactive tabs
    }
    
    // Toggling Visual vs Raw mode
    const rawContainer = tabEl.querySelector(`#raw-editor-container-${tab.id}`);
    const metadataForm = tabEl.querySelector(`#metadata-form-${tab.id}`);
    const bodyContainer = tabEl.querySelector(`#body-container-${tab.id}`);
    const inboxBanner = tabEl.querySelector(`#inbox-banner-${tab.id}`);
    
    if (isRawMode) {
      rawContainer.classList.remove('hidden');
      metadataForm.classList.add('hidden');
      bodyContainer.classList.add('hidden');
      inboxBanner.classList.add('hidden');
      
      const rawTextarea = tabEl.querySelector(`#raw-textarea-${tab.id}`);
      if (rawTextarea.value !== tab.rawFullContent) {
        rawTextarea.value = tab.rawFullContent || '';
      }
      
      rawTextarea.oninput = (e) => {
        const updatedTabs = getState('openTabs', []).map(t => {
          if (t.id === tab.id) {
            return { ...t, rawFullContent: e.target.value };
          }
          return t;
        });
        setState('openTabs', updatedTabs);
        if (window.saveSessionState) window.saveSessionState();
      };
      
      if (tab.lastRenderedMode !== 'raw') {
        destroyEasyMDE(tab);
        tab.lastRenderedMode = 'raw';
      }
      return;
    }
    
    // Visual Mode updates
    rawContainer.classList.add('hidden');
    metadataForm.classList.remove('hidden');
    bodyContainer.classList.remove('hidden');
    
    // 3a. Inbox Banner
    if (tab.metadata && tab.metadata._inbox) {
      inboxBanner.classList.remove('hidden');
      inboxBanner.innerHTML = `
        <span class="material-symbols-rounded" style="color: var(--md-sys-color-primary); margin-right: 0.5rem;">inbox</span>
        <span style="flex: 1; font-weight: 500;">This note is in your Inbox (unprocessed).</span>
        <button class="btn-process-inbox" id="btn-process-inbox-${tab.id}">Mark Processed</button>
      `;
      inboxBanner.querySelector(`#btn-process-inbox-${tab.id}`).onclick = (e) => {
        e.stopPropagation();
        if (window.appInstance) {
          window.appInstance.actions.processInboxNote(tab.id);
        }
      };
    } else {
      inboxBanner.classList.add('hidden');
    }
    
    // 3b. Print layouts
    const printMeta = tabEl.querySelector(`#print-meta-${tab.id}`);
    const printCode = tabEl.querySelector(`#print-code-${tab.id}`);
    const printBody = tabEl.querySelector(`#print-body-${tab.id}`);
    
    const cleanMeta = Object.fromEntries(
      Object.entries(tab.metadata || {}).filter(([k]) => !k.startsWith('_'))
    );
    
    if (Object.keys(cleanMeta).length > 0) {
      printMeta.style.display = '';
      printCode.textContent = jsyaml.dump(cleanMeta, { sortKeys: true }).trim();
    } else {
      printMeta.style.display = 'none';
    }
    
    printBody.innerHTML = renderMarkdown(tab.content || "");
    
    // 3c. Metadata form panel collapse toggling
    metadataForm.className = `metadata-form ${!isEdit ? 'view-only' : ''} ${!tab.metaVisible ? 'collapsed' : ''}`;
    
    const metaHeader = tabEl.querySelector(`#meta-header-${tab.id}`);
    metaHeader.onclick = (e) => {
      const currentTab = getState('openTabs', []).find(t => t.id === tab.id) || tab;
      const nextVisible = !currentTab.metaVisible;
      
      const updatedTabs = getState('openTabs', []).map(t => {
        if (t.id === tab.id) {
          return { ...t, metaVisible: nextVisible };
        }
        return t;
      });
      setState('openTabs', updatedTabs);
      if (window.saveSessionState) window.saveSessionState();
      
      metadataForm.classList.toggle('collapsed', !nextVisible);
      addPropBtn.classList.toggle('hidden', !(nextVisible && isEdit));
    };
    
    const addPropBtn = tabEl.querySelector(`#btn-add-prop-${tab.id}`);
    addPropBtn.className = `btn-add-prop ${tab.metaVisible && isEdit ? '' : 'hidden'}`;
    addPropBtn.onclick = (e) => {
      e.stopPropagation();
      addMetaProp(tab, getState, setState);
    };
    
    // 3d. Metadata inputs rendering
    const fieldsContainer = tabEl.querySelector(`#meta-fields-${tab.id}`);
    const activeElement = document.activeElement;
    const isFocusInside = fieldsContainer.contains(activeElement);
    
    if (isFocusInside && activeElement.tagName === 'INPUT') {
      const currentEditingKey = activeElement.dataset.key;
      fieldsContainer.querySelectorAll('.meta-field').forEach(fieldDiv => {
        const key = fieldDiv.dataset.key;
        const input = fieldDiv.querySelector('.meta-input');
        if (key !== currentEditingKey && input) {
          const val = cleanMeta[key];
          const isCheckbox = input.type === 'checkbox';
          if (isCheckbox) {
            input.checked = !!val;
          } else {
            input.value = val === null || val === undefined ? '' : val;
          }
        }
      });
    } else {
      fieldsContainer.innerHTML = '';
      Object.entries(cleanMeta).forEach(([key, val]) => {
        const inputType = getInputType(key, val, tab.class || tab.type, getState);
        const isCheckbox = inputType === 'checkbox';
        const displayVal = val === null || val === undefined ? '' : val;
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'meta-field';
        fieldDiv.dataset.key = key;
        
        const labelEl = document.createElement('label');
        labelEl.className = 'meta-label';
        labelEl.textContent = key + ':';
        fieldDiv.appendChild(labelEl);
        
        const inputEl = document.createElement('input');
        inputEl.type = inputType;
        inputEl.dataset.key = key;
        inputEl.className = 'meta-input' + (inputType === 'number' ? ' meta-input-number' : inputType === 'date' ? ' meta-input-date' : '');
        if (!isEdit) {
          inputEl.readOnly = true;
          inputEl.disabled = true;
        }
        if (isCheckbox) {
          inputEl.checked = !!val;
        } else {
          inputEl.value = inputType === 'date' && typeof displayVal === 'string' ? displayVal.split('T')[0] : displayVal;
        }
        
        inputEl.onchange = (e) => {
          if (isEdit) {
            updateMetaProp(tab, key, e, getState, setState);
          }
        };
        fieldDiv.appendChild(inputEl);
        
        if (isEdit) {
          const delBtn = document.createElement('button');
          delBtn.className = 'delete-prop btn-delete-prop';
          delBtn.textContent = '✕';
          delBtn.onclick = () => deleteMetaProp(tab, key, getState, setState);
          fieldDiv.appendChild(delBtn);
        }
        
        fieldsContainer.appendChild(fieldDiv);
      });
    }
    
    // 3e. Visual Editor Content Body
    if (isEdit) {
      let textarea = bodyContainer.querySelector(`#textarea-editor-${tab.id}`);
      if (!textarea) {
        bodyContainer.innerHTML = `<textarea id="textarea-editor-${tab.id}" style="display: none;"></textarea>`;
      }
      
      if (tab.lastRenderedMode !== 'edit') {
        destroyEasyMDE(tab);
        tab.lastRenderedMode = 'edit';
      }
      
      initEasyMDE(tab);
      if (mdeInstances[tab.id]) {
        mdeInstances[tab.id].codemirror.refresh();
      }
    } else {
      let viewer = bodyContainer.querySelector(`#view-content-${tab.id}`);
      if (!viewer) {
        bodyContainer.innerHTML = `<div id="view-content-${tab.id}" class="body-viewer"></div>`;
        viewer = bodyContainer.querySelector(`#view-content-${tab.id}`);
      }
      
      const contentChanged = tab.lastRenderedContent !== tab.content;
      const modeChanged = tab.lastRenderedMode !== 'view';
      const isEmpty = !viewer.innerHTML;
      
      if (modeChanged || contentChanged || isEmpty) {
        if (tab.lastRenderedMode === 'edit') {
          destroyEasyMDE(tab);
        }
        tab.lastRenderedMode = 'view';
        tab.lastRenderedContent = tab.content;
        renderMarkdownView(tab);
      }
    }
  });
}
