import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  root: path.resolve('src/webview'), base: './', plugins: [react()],
  // Discover worker dependencies before the first graph; late optimization
  // reloads otherwise discard an in-flight host graph during development/tests.
  optimizeDeps:{include:['elkjs/lib/elk-api.js','elkjs/lib/elk-worker.min.js']},
  build: {
    // The extension host loads one CSS entry; lazy renderer styles must be included.
    cssCodeSplit:false,
    outDir: path.resolve('dist/webview'), emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'assets/app.js', assetFileNames: asset => asset.names?.some(name => name.endsWith('.css')) ? 'assets/app.css' : 'assets/[name][extname]' } },
  },
});
