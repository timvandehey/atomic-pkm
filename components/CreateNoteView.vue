<script setup>
import { computed } from 'vue';
import { store } from '../store.js';

const customTypes = computed(() => store.types.filter(t => !['note', 'task', 'template', 'golf'].includes(t)));
const templates = computed(() => store.objects.filter(o => o.type === 'template'));

const cancel = () => {
  store.isCreatingNote = false;
  store.newNoteTitle = '';
  store.newNoteType = 'note';
  store.selectedTemplate = '';
};

const submit = async () => {
  if (!store.newNoteTitle) return alert("Please enter a title.");
  
  const res = await fetch('/api/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      title: store.newNoteTitle, 
      type: store.newNoteType, 
      templateId: store.selectedTemplate, 
      variables: {} 
    })
  });
  
  if (res.ok) {
    const result = await res.json();
    cancel();
    await store.fetchObjects();
    
    const createdObj = store.objects.find(o => o.id === result.id);
    if (createdObj) {
      store.openTab(createdObj);
      const tab = store.openTabs.find(t => t.id === result.id);
      if (tab) tab.isEditMode = true;
    }
  }
};
</script>

<template>
  <div class="create-view">
    <div class="create-form">
      <h2 style="margin-top: 0; text-align: center">New Note</h2>
      <input type="text" id="new-title" placeholder="Title" v-model="store.newNoteTitle">
      
      <div class="create-row">
        <select id="type-select" v-model="store.newNoteType">
          <option value="note">Note</option>
          <option value="task">Task</option>
          <option value="template">Template</option>
          <option value="golf">Golf</option>
          <option v-for="t in customTypes" :key="t" :value="t">{{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
        </select>
        
        <select id="template-select" v-model="store.selectedTemplate">
          <option value="">No Template</option>
          <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem">
        <button class="btn-primary" @click="submit">Create</button>
        <button @click="cancel">Cancel</button>
      </div>
    </div>
  </div>
</template>
