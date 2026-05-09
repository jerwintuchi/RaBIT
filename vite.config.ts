import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
// Tauri expects the dev server on a fixed port (1420) and listens to it in tauri.conf.json.
export default defineConfig(async () => ({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@state': path.resolve(__dirname, 'src/state'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@render': path.resolve(__dirname, 'src/render'),
      '@bridge': path.resolve(__dirname, 'src/bridge'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@assets': path.resolve(__dirname, 'src/assets'),
    },
  },

  // Tauri uses a fixed port for the dev server; HMR goes over the same port.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Don't re-bundle on Rust changes — Tauri CLI handles that.
      ignored: ['**/src-tauri/**'],
    },
  },

  // Target matches the Tauri 2 WebView baselines (Chrome 105+ on WebView2, Safari 13+, WebKitGTK).
  build: {
    target: ['es2022', 'chrome105', 'safari13'],
    minify: 'esbuild',
    sourcemap: true,
  },

  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]__[hash:base64:5]',
    },
  },

  envPrefix: ['VITE_', 'TAURI_'],

  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'happy-dom',
  },
}));
