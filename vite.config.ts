import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Change 'cyberpink-christmas' to your actual GitHub repository name
  base: '/cyberpink-christmas/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});