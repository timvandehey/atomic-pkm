<script setup>
import { store } from '../store.js';
import Gallery from './Gallery.vue';
</script>

<template>
  <aside id="sidebar" class="sidebar">
    <div id="sidebar-header" class="sidebar-header">
      <div id="menu-container" class="menu-container">
        <button id="btn-menu" title="Menu" @click="store.menuOpen = !store.menuOpen">
          <span class="material-symbols-rounded">menu</span>
        </button>
        <div id="menu-dropdown" class="dropdown-content" :class="{ hidden: !store.menuOpen }">
          <button id="btn-sync" title="Sync Files" @click="store.handleSync()">
            <span class="material-symbols-rounded">sync</span>
            <span> Sync Data</span>
          </button>
        </div>
      </div>
      
      <button id="btn-new" title="New Note" @click="store.isCreatingNote = true">
        <span class="material-symbols-rounded">add</span>
      </button>

      <button id="btn-close-sidebar" class="mobile-only" v-if="store.openTabs.length > 0" title="Back to Editor" @click="store.mobileSidebarOpen = false">
        <span class="material-symbols-rounded">arrow_forward</span>
      </button>
      
      <div id="search-container" class="search-container">
        <div id="search-main" class="search-main">
          <div id="search-input-wrapper" class="search-input-wrapper">
            <input id="search-bar" type="text" placeholder="Search..." v-model="store.searchQuery">
            <button id="btn-clear-search" class="btn-clear-search" :class="{ hidden: !store.searchQuery }" title="Clear" @click="store.searchQuery = ''">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <button id="btn-toggle-advanced" title="Toggle Advanced Search" @click="store.advancedSearchOpen = !store.advancedSearchOpen">
            <span class="material-symbols-rounded">tune</span>
          </button>
        </div>
        
        <div id="advanced-search" class="advanced-search" :class="{ hidden: !store.advancedSearchOpen }">
          <select id="type-filter" v-model="store.searchType">
            <option value="">All Types</option>
            <option v-for="t in store.types" :key="t" :value="t">{{ t.charAt(0).toUpperCase() + t.slice(1) }}</option>
          </select>
          <input id="tag-filter" type="text" placeholder="Filter by #tag" v-model="store.searchTag">
        </div>
      </div>
    </div>
    
    <Gallery />
  </aside>
</template>
