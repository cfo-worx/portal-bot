// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/', // Set to '/client/' since you're serving it from /client/ in Nginx
  plugins: [react()],
  build: {
    outDir: 'dist', // Ensure this matches your Nginx root
    assetsDir: 'assets', // Ensure assets are placed in the 'assets' folder
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000', // Proxy API requests to your backend
    },
  },
});
