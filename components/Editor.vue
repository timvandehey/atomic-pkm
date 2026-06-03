<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { Crepe } from '@milkdown/crepe';
import { editorViewOptionsCtx } from '@milkdown/core';
import { store } from '../store.js';
import yaml from 'js-yaml';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';

// Import Crepe CSS
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/nord.css';

// Map dataviewjs to javascript for highlighting
Prism.languages.dataviewjs = Prism.languages.javascript;

const props = defineProps(['note']);

const editorRef = ref(null);
const isRawMode = ref(false);
const rawFullContent = ref("");
let crepeInstance = null;

// Helper to assemble full MD string
const getFullMarkdown = () => {
    const frontmatter = yaml.dump(props.note.metadata);
    return `---\n${frontmatter}---\n\n${props.note.content}`;
};

// Helper to parse full MD string
const parseFullMarkdown = (raw) => {
    try {
        const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
        if (match) {
            return {
                metadata: yaml.load(match[1]),
                content: match[2].trim()
            };
        }
    } catch (e) {
        console.error("YAML Parse Error", e);
    }
    return null;
};

// --- Dataview Renderer Logic ---
async function fetchDataview(script, container) {
    try {
        console.log("[Dataview] Fetching for script:", script.substring(0, 30) + "...");
        container.innerHTML = '<div class="dv-loading">Executing query...</div>';
        const res = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script })
        });
        const data = await res.json();
        if (data.success) {
            container.innerHTML = data.html || '<div class="dv-empty">No results</div>';
            // Handle links
            container.querySelectorAll('.dv-link').forEach(link => {
                link.onclick = () => {
                    const id = link.getAttribute('data-id');
                    const target = store.objects.find(o => o.id === id);
                    if (target) store.openTab(target);
                };
            });
        } else {
            container.innerHTML = `<div class="dv-error">Error: ${data.error}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="dv-error">Fetch Error: ${err.message}</div>`;
    }
}

const dataviewPlugin = (ctx) => {
    return () => {
        ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            nodeViews: {
                ...prev.nodeViews,
                code_block: (node, view, getPos) => {
                    const lang = node.attrs.language;
                    if (lang !== 'dataviewjs') return null;

                    console.log("[Dataview] Creating new node view instance");

                    const dom = document.createElement('div');
                    dom.classList.add('dataview-block');

                    const code = document.createElement('pre');
                    code.classList.add('dv-code-part');
                    dom.appendChild(code);

                    const resultContainer = document.createElement('div');
                    resultContainer.classList.add('dv-container');
                    resultContainer.setAttribute('contenteditable', 'false'); // Only result is non-editable
                    dom.appendChild(resultContainer);
                    
                    // Initial fetch
                    fetchDataview(node.textContent, resultContainer);

                    let debounceTimer;
                    let lastContent = node.textContent;

                    return {
                        dom,
                        contentDOM: code,
                        update: (newNode) => {
                            if (newNode.type.name !== node.type.name) return false;
                            
                            if (newNode.textContent !== lastContent) {
                                console.log("[Dataview] Content changed, debouncing fetch...");
                                lastContent = newNode.textContent;
                                clearTimeout(debounceTimer);
                                debounceTimer = setTimeout(() => {
                                    fetchDataview(newNode.textContent, resultContainer);
                                }, 1000);
                            }
                            return true;
                        },
                        selectNode: () => {
                            dom.classList.add('prose-selection');
                        },
                        deselectNode: () => {
                            dom.classList.remove('prose-selection');
                        },
                        ignoreMutation: (mutation) => {
                            // If the mutation is selection, we definitely don't want to ignore it
                            if (mutation.type === 'selection') return false;
                            // If it's a mutation in our code container, let ProseMirror handle it
                            if (code.contains(mutation.target)) return false;
                            // Ignore everything else (like the result rendering)
                            return true;
                        },
                        stopEvent: (event) => {
                            // Only stop events from the result container
                            if (resultContainer.contains(event.target)) return true;
                            // Let editor handle selection/typing in the code part
                            return false;
                        }
                    };
                }
            }
        }));
    };
};

onMounted(async () => {
    if (editorRef.value) {
        crepeInstance = new Crepe({
            root: editorRef.value,
            defaultValue: props.note.content || "",
        });

        // Inject dataview plugin
        crepeInstance.editor.use(dataviewPlugin);

        // Register listener for changes
        crepeInstance.on((listener) => {
            listener.markdownUpdated((ctx, markdown) => {
                props.note.content = markdown;
            });
        });

        await crepeInstance.create();

        // Set initial readonly state after creation
        crepeInstance.setReadonly(!props.note.isEditMode);
    }
});

onBeforeUnmount(() => {
    if (crepeInstance) {
        crepeInstance.destroy();
    }
});

// Toggle editor status when props.note.isEditMode changes
watch(() => props.note.isEditMode, (isEdit) => {
    if (crepeInstance) {
        crepeInstance.setReadonly(!isEdit);
    }
});

const saveNote = async () => {
    if (isRawMode.value) {
        const parsed = parseFullMarkdown(rawFullContent.value);
        if (!parsed) return alert("Invalid Markdown format. Ensure you have --- frontmatter blocks.");
        props.note.metadata = parsed.metadata;
        props.note.content = parsed.content;
    } else if (crepeInstance) {
        props.note.content = crepeInstance.getMarkdown();
    }

    const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            id: props.note.id, 
            content: props.note.content, 
            metadata: props.note.metadata 
        })
    });
    if (res.ok) {
        store.fetchObjects();
        if (isRawMode.value) isRawMode.value = false;
        props.note.isEditMode = false;
    }
};

const toggleRawMode = () => {
    if (isRawMode.value) {
        const parsed = parseFullMarkdown(rawFullContent.value);
        if (parsed) {
            props.note.metadata = parsed.metadata;
            props.note.content = parsed.content;
            isRawMode.value = false;
            if (crepeInstance) {
                crepeInstance.setMarkdown(props.note.content);
            }
        } else {
            alert("Invalid Markdown format. Cannot switch back.");
        }
    } else {
        if (crepeInstance) {
            props.note.content = crepeInstance.getMarkdown();
        }
        rawFullContent.value = getFullMarkdown();
        isRawMode.value = true;
    }
};

const getInputType = (key, value) => {
    const schema = store.schemas[props.note.type] || {};
    if (schema[key]) return schema[key];
    const k = key.toLowerCase();
    if (k.includes('date') || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) return 'date';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    return 'text';
};

const addMetaProp = () => {
    const key = prompt("Property name:");
    if (key && !key.startsWith('_')) {
        props.note.metadata[key] = "";
        props.note.metaVisible = true;
    }
};
</script>

<template>
  <div class="editor-instance-container" :class="{ 'readonly-mode': !props.note.isEditMode }">
    <div class="editor-header">
        <!-- Edit/View Toggle -->
        <button 
            class="header-btn" 
            :class="{ 'btn-primary': props.note.isEditMode }" 
            :title="props.note.isEditMode ? 'View Mode' : 'Edit Mode'"
            @click="props.note.isEditMode = !props.note.isEditMode"
        >
            <span class="material-symbols-rounded">{{ props.note.isEditMode ? 'visibility' : 'edit' }}</span>
        </button>

        <button v-if="props.note.isEditMode || isRawMode" class="btn-primary header-btn" title="Save" @click="saveNote">
            <span class="material-symbols-rounded">save</span>
        </button>

        <button 
            v-if="props.note.isEditMode || isRawMode"
            class="header-btn" 
            :class="{ active: isRawMode }"
            title="Toggle Raw Markdown"
            @click="toggleRawMode" 
        >
            <span class="material-symbols-rounded">code</span>
        </button>
    </div>

    <!-- Raw Editor Mode -->
    <div v-show="isRawMode" class="raw-editor-container">
        <textarea 
            class="full-raw-editor"
            v-model="rawFullContent"
            placeholder="Edit raw markdown file..."
        ></textarea>
    </div>

    <div v-show="!isRawMode" class="visual-editor-container">
        <div class="metadata-form" :class="{ 'view-only': !props.note.isEditMode }">
            <div class="meta-header" @click="props.note.metaVisible = !props.note.metaVisible">
                <h2 class="meta-title">
                    <span 
                        class="material-symbols-rounded meta-toggle-icon" 
                        :style="{ transform: props.note.metaVisible ? 'rotate(0deg)' : 'rotate(-90deg)' }"
                    >expand_more</span>
                    <span>Properties</span>
                </h2>
                <button v-if="props.note.isEditMode" class="btn-add-prop" @click.stop="() => { const key = prompt('Property name:'); if (key && !key.startsWith('_')) props.note.metadata[key] = ''; }">
                    <span class="material-symbols-rounded" style="font-size: 1rem">add</span>
                    <span> Property</span>
                </button>
            </div>
            <div 
                id="fields-container" 
                v-show="props.note.metaVisible"
            >
                <template v-for="(value, key) in props.note.metadata" :key="key">
                    <div v-if="!key.startsWith('_')" class="meta-field">
                        <label class="meta-label">{{ key }}:</label>
                        <input 
                            :type="getInputType(key, value)" 
                            class="meta-input"
                            :readonly="!props.note.isEditMode"
                            :value="getInputType(key, value) === 'date' && typeof props.note.metadata[key] === 'string' ? props.note.metadata[key].split('T')[0] : props.note.metadata[key]"
                            :checked="getInputType(key, value) === 'checkbox' ? !!props.note.metadata[key] : undefined"
                            @input="e => {
                                if (!props.note.isEditMode) return;
                                if (e.target.type === 'checkbox') props.note.metadata[key] = e.target.checked;
                                else if (e.target.type === 'number') props.note.metadata[key] = Number(e.target.value);
                                else props.note.metadata[key] = e.target.value;
                            }"
                        >
                        <button v-if="props.note.isEditMode" class="delete-prop btn-delete-prop" @click="delete props.note.metadata[key]">✕</button>
                    </div>
                </template>
            </div>
        </div>

        <div class="crepe-container">
            <div ref="editorRef" class="crepe-editor"></div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.editor-instance-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    min-width: 0;
}

.visual-editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.crepe-container {
    flex: 1;
    overflow-y: auto;
    background: var(--md-sys-color-surface);
}

.crepe-editor {
    height: auto;
    min-height: 100%;
}

.full-raw-editor {
    width: 100%;
    height: 100%;
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: 'Fira Code', monospace;
    font-size: 1rem;
    padding: 2rem;
    border: none;
    outline: none;
    resize: none;
    line-height: 1.5;
}

.raw-editor-container {
    flex: 1;
    overflow: hidden;
    height: 100%;
}

/* Ensure code blocks don't overflow horizontally */
:deep(.milkdown-code-block) {
    white-space: pre-wrap !important;
    word-break: break-all !important;
    max-width: 100%;
    overflow-x: auto;
}

/* Ensure Crepe fills width */
:deep(.milkdown) {
    max-width: 55rem !important;
    margin: 0 auto !important;
    width: 100%;
}

.readonly-mode :deep(.milkdown .editor) {
    cursor: default;
}

/* Dataview Block Styles */
:deep(.dataview-block) {
    margin: 1rem 0;
    border: 0.0625rem solid var(--md-sys-color-outline-variant);
    border-radius: 0.5rem;
    overflow: hidden;
    background: white;
}

/* Hide the code source in readonly mode */
.readonly-mode :deep(.dataview-block .dv-code-part) {
    display: none !important;
}

/* Style the code part in edit mode */
:deep(.dataview-block .dv-code-part) {
    background: color-mix(in srgb, var(--md-sys-color-primary) 5%, #f8f9fa);
    padding: 1rem;
    border-bottom: 0.0625rem solid var(--md-sys-color-outline-variant);
    font-family: 'Fira Code', monospace;
    font-size: 0.85rem;
    margin: 0;
    white-space: pre-wrap !important;
    word-break: break-all !important;
    cursor: text !important;
    min-height: 1.5em;
    outline: none;
    user-select: text !important;
}

:deep(.dataview-block .dv-code-part:focus) {
    background: color-mix(in srgb, var(--md-sys-color-primary) 8%, #ffffff);
}

:deep(.dv-container) {
    padding: 1rem;
}
</style>
