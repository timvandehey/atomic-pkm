<script setup>
import { store } from '../store.js';

const typeIcons = {
  note: 'description',
  task: 'check_circle',
  template: 'dashboard_customize',
  query: 'search',
  golf: 'sports_golf',
  meeting: 'groups'
};

const getTypeIcon = (type) => typeIcons[type] || 'draft';

const getMetadata = (obj) => {
  if (typeof obj.metadata === 'string') {
    try {
      return JSON.parse(obj.metadata);
    } catch {
      return {};
    }
  }
  return obj.metadata || {};
};
</script>

<template>
  <div id="note-list">
    <article 
      v-for="obj in store.objects" 
      :key="obj.id" 
      :id="'card-' + obj.id" 
      class="card"
      @click="store.openTab(obj)"
    >
      <div class="card-type-row">
        <span class="material-symbols-rounded card-icon">{{ getTypeIcon(obj.type) }}</span>
        <span class="card-type">{{ obj.type }}</span>
      </div>
      <h3>{{ obj.title }}</h3>
      
      <div v-if="obj.type === 'golf'" class="card-score">
        <strong>Score: {{ getMetadata(obj).score || 'N/A' }}</strong>
      </div>
      <div v-else class="card-content">
        {{ (obj.content || '').substring(0, 100) }}{{ (obj.content || '').length > 100 ? '...' : '' }}
      </div>
      
      <div class="card-location">
        📍 {{ getMetadata(obj).location || 'Unknown' }}
      </div>
    </article>
  </div>
</template>
