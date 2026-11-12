import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the built site live at any path (GitHub Pages subfolder, etc.)
export default defineConfig({ base: './', plugins: [react()], build: { target: 'es2020', chunkSizeWarningLimit: 900 } });
