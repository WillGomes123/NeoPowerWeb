import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
    // Otimizações de bundle
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs em produção
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // Manual chunking para melhor cache
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          // Charts separado (grande)
          'charts': ['recharts'],
          // Map separado
          'maps': ['leaflet', 'react-leaflet'],
        },
        // Nomes consistentes para melhor cache
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Aumentar limite de warning
    chunkSizeWarningLimit: 1000,
    // Source maps para produção (útil para debug)
    sourcemap: false,
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    open: true,
    proxy: {
      '/api': {
        // Apontar para o base_ocpp CSMS (porta 8080)
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});