<script setup>
import { ref, watch, computed } from 'vue';
import { useEditor, Milkdown } from '@milkdown/vue';
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, commandsCtx } from '@milkdown/core';
import { nord } from '@milkdown/theme-nord';
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInHeadingCommand } from '@milkdown/preset-commonmark';
import { gfm, insertTableCommand } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { prism } from '@milkdown/plugin-prism';
import { indent } from '@milkdown/plugin-indent';
import { clipboard } from '@milkdown/plugin-clipboard';
import { store } from '../store.js';
import yaml from 'js-yaml';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';

// Map dataviewjs to javascript for highlighting
Prism.languages.dataviewjs = Prism.languages.javascript;

const props = defineProps(['note']);

const isRawMeta = ref(false);
const rawMeta = ref("");

// Initialize rawMeta
watch(() => props.note.metadata, (newMeta) => {
    if (!isRawMeta.value) {
        rawMeta.value = yaml.dump(newMeta);
    }
}, { immediate: true, deep: true });

const { get } = useEditor((root) =>
    Editor.make()
        .config((ctx) => {
            ctx.set(rootCtx, root);
            ctx.set(defaultValueCtx, props.note.content || "");
            ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
                props.note.content = markdown;
            });
        })
        .config(nord)
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(prism)
        .use(indent)
        .use(clipboard)
);

const call = (command) => {
    const editor = get();
    if (editor) {
        editor.action((ctx) => {
            try {
                // In v7, commands are called via the command manager in commandsCtx
                const manager = ctx.get(commandsCtx);
                manager.call(command.key);
            } catch (e) {
                console.error("Command execution failed:", command, e);
            }
        });
    }
};

const saveNote = async () => {
    if (isRawMeta.value) {
        try {
            props.note.metadata = yaml.load(rawMeta.value);
            isRawMeta.value = false;
        } catch (e) {
            return alert("Invalid YAML: " + e.message);
        }
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
    }
};

const toggleRawMeta = () => {
    if (isRawMeta.value) {
        try {
            props.note.metadata = yaml.load(rawMeta.value);
            isRawMeta.value = false;
        } catch (e) {
            alert("Invalid YAML: " + e.message);
        }
    } else {
        rawMeta.value = yaml.dump(props.note.metadata);
        isRawMeta.value = true;
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
  <div class="editor-instance-container">
    <div class="editor-header">
        <button class="header-btn" title="Close" @click="store.closeTab(props.note.id)">
            <span class="material-symbols-rounded">close</span>
        </button>
        <button class="btn-primary header-btn" title="Save" @click="saveNote">
            <span class="material-symbols-rounded">save</span>
            <span class="btn-text">Save</span>
        </button>
        
        <div class="custom-toolbar">
            <button class="toolbar-btn" title="Bold" @click="call(toggleStrongCommand)">
                <span class="material-symbols-rounded">format_bold</span>
            </button>
            <button class="toolbar-btn" title="Italic" @click="call(toggleEmphasisCommand)">
                <span class="material-symbols-rounded">format_italic</span>
            </button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" title="Heading 1" @click="call(wrapInHeadingCommand(1))">H1</button>
            <button class="toolbar-btn" title="Heading 2" @click="call(wrapInHeadingCommand(2))">H2</button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" title="Bullet List" @click="call(wrapInBulletListCommand)">
                <span class="material-symbols-rounded">format_list_bulleted</span>
            </button>
            <button class="toolbar-btn" title="Numbered List" @click="call(wrapInOrderedListCommand)">
                <span class="material-symbols-rounded">format_list_numbered</span>
            </button>
            <button class="toolbar-btn" title="Table" @click="call(insertTableCommand)">
                <span class="material-symbols-rounded">table_chart</span>
            </button>
        </div>

        <div style="margin-left: auto; display: flex; gap: 0.5rem">
             <button 
                class="header-btn" 
                :class="{ active: isRawMeta }"
                title="Toggle Raw YAML"
                @click="toggleRawMeta" 
            >
                <span class="material-symbols-rounded">code</span>
            </button>
        </div>
    </div>

    <div class="metadata-form">
        <div class="meta-header" @click="props.note.metaVisible = !props.note.metaVisible">
            <h2 class="meta-title">
                <span 
                    class="material-symbols-rounded meta-toggle-icon" 
                    :style="{ transform: props.note.metaVisible ? 'rotate(0deg)' : 'rotate(-90deg)' }"
                >expand_more</span>
                <span>Properties</span>
            </h2>
            <button v-if="!isRawMeta" class="btn-add-prop" @click.stop="addMetaProp">
                <span class="material-symbols-rounded" style="font-size: 1rem">add</span>
                <span> Property</span>
            </button>
        </div>
        <div 
            id="fields-container" 
            v-show="props.note.metaVisible"
        >
            <textarea 
                v-if="isRawMeta"
                class="raw-meta-editor"
                v-model="rawMeta"
                placeholder="Enter YAML metadata..."
            ></textarea>
            <template v-else>
                <div v-for="(value, key) in props.note.metadata" :key="key" v-show="!key.startsWith('_')" class="meta-field">
                    <label class="meta-label">{{ key }}:</label>
                    <input 
                        :type="getInputType(key, value)" 
                        class="meta-input"
                        v-model="props.note.metadata[key]"
                        :checked="getInputType(key, value) === 'checkbox' ? !!props.note.metadata[key] : undefined"
                        @input="e => {
                            if (e.target.type === 'checkbox') props.note.metadata[key] = e.target.checked;
                            else if (e.target.type === 'number') props.note.metadata[key] = Number(e.target.value);
                        }"
                    >
                    <button class="delete-prop btn-delete-prop" @click="delete props.note.metadata[key]">✕</button>
                </div>
            </template>
        </div>
    </div>

    <div class="milkdown-scroll-wrapper">
        <Milkdown />
    </div>
  </div>
</template>
