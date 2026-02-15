import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5190,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
