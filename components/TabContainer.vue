<script setup>
import { MilkdownProvider } from '@milkdown/vue';
import { store } from '../store.js';
import Editor from './Editor.vue';
</script>

<template>
  <main class="editor-view">
    <div v-if="store.openTabs.length === 0" class="empty-state">
      <button class="mobile-menu-btn empty-state-menu" @click="store.mobileSidebarOpen = true">
        <span class="material-symbols-rounded">menu</span>
      </button>
      <div class="empty-state-content">
        <span class="empty-state-icon">📝</span>
        <p>Select a note from the sidebar to start editing</p>
      </div>
    </div>
    
    <div v-else id="editor-container">
      <div class="tab-bar">
        <button class="mobile-menu-btn" @click="store.mobileSidebarOpen = true">
          <span class="material-symbols-rounded">menu</span>
        </button>
        <div 
          v-for="tab in store.openTabs" 
          :key="tab.id" 
          class="tab-item" 
          :class="{ active: store.activeTabId === tab.id }"
          @click="store.activeTabId = tab.id"
        >
          <span class="tab-title">{{ tab.title }}</span>
          <span class="material-symbols-rounded tab-close" @click.stop="store.closeTab(tab.id)">close</span>
        </div>
      </div>
      
      <div class="tab-content">
        <MilkdownProvider v-for="tab in store.openTabs" :key="tab.id">
            <Editor 
              v-show="store.activeTabId === tab.id"
              :note="tab"
            />
        </MilkdownProvider>
      </div>
    </div>
  </main>
</template>
