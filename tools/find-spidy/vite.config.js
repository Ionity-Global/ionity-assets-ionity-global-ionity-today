import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works when loaded from file:// inside Electron / Capacitor.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: Number(process.env.PORT) || 5173 },
  build: { outDir: 'dist' },
});
