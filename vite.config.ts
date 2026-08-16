// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Bekend bundelprobleem met deze package; laat Vite hem met rust.
    exclude: ['lucide-react'],
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    rollupOptions: {
      output: {
        // Firebase en React veranderen zelden en zijn samen het grootste deel
        // van de bundel. Apart houden scheelt de gebruiker een download bij
        // elke deploy van de app zelf.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'formulier-vendor': ['react-hook-form', 'yup', '@hookform/resolvers/yup'],
        },
      },
    },
  },
  server: {
    headers: {
      'Cache-Control': 'no-cache',
    },
  },
});
