<script setup>
import { store } from '../store.js';

const startResize = (e) => {
  document.body.style.cursor = 'col-resize';
  
  const handleMouseMove = (e) => {
    let newWidth = e.clientX;
    if (newWidth < 250) newWidth = 250;
    if (newWidth > 600) newWidth = 600;
    store.sidebarWidth = newWidth;
  };
  
  const handleMouseUp = () => {
    document.body.style.cursor = 'default';
    store.saveSidebarWidth(store.sidebarWidth);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
  
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
};
</script>

<template>
  <div id="sidebar-resizer" class="resizer" @mousedown="startResize"></div>
</template>
