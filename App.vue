<script setup>
import { store } from './store.js';
import Sidebar from './components/Sidebar.vue';
import TabContainer from './components/TabContainer.vue';
import CreateNoteView from './components/CreateNoteView.vue';
import Resizer from './components/Resizer.vue';

// Initial data fetch
store.fetchObjects();
store.fetchSettings();
store.fetchTypes();
store.fetchSchemas();
</script>

<template>
  <div id="app-root">
    <CreateNoteView v-if="store.isCreatingNote" />
    <div 
      v-else 
      class="app-container" 
      :class="{ 'show-editor': store.openTabs.length > 0, 'mobile-sidebar-open': store.mobileSidebarOpen }"
      :style="{ gridTemplateColumns: store.sidebarWidth + 'px 12px minmax(0, 1fr)' }"
    >
      <Sidebar />
      <Resizer />
      <TabContainer />
    </div>
  </div>
</template>

<style scoped>
#app-root {
  height: 100%;
  width: 100%;
}
</style>
