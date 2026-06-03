<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { Crepe } from '@milkdown/crepe';
import { store } from '../store.js';
import yaml from 'js-yaml';

// Import Crepe CSS
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/nord.css';

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

onMounted(async () => {
    if (editorRef.value) {
        crepeInstance = new Crepe({
            root: editorRef.value,
            defaultValue: props.note.content || "",
            features: {
                // Enable/disable features as needed
            }
        });

        // Set to readonly if not in edit mode initially
        crepeInstance.setReadonly(!props.note.isEditMode);

        await crepeInstance.create();

        // Sync changes back to props
        crepeInstance.onShare((markdown) => {
            props.note.content = markdown;
        });
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
            // Update crepe content if we switch back
            if (crepeInstance) {
                // Crepe doesn't have a simple setMarkdown, we usually have to destroy and recreate 
                // or use internal milkdown editor. For now, let's keep it simple.
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
    <div v-if="isRawMode" class="raw-editor-container">
        <textarea 
            class="full-raw-editor"
            v-model="rawFullContent"
            placeholder="Edit raw markdown file..."
        ></textarea>
    </div>

    <template v-else>
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
    </template>
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

/* Ensure Crepe fills width */
:deep(.milkdown) {
    max-width: 55rem !important;
    margin: 0 auto !important;
    width: 100%;
}

.readonly-mode :deep(.milkdown .editor) {
    cursor: default;
}
</style>
