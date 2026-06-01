import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    include: [
      '@milkdown/core',
      '@milkdown/prose',
      '@milkdown/ctx',
      '@milkdown/preset-commonmark',
      '@milkdown/preset-gfm',
      '@milkdown/vue',
      'prismjs',
      'js-yaml'
    ]
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
