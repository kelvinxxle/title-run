/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Plugin: intercept *.css?raw before vitest's css-disable/css-empty-post plugins.
// The virtual module ID must NOT end with ".css" (or any CSS extension) to avoid
// being overwritten by vitest's CSSEnablerPlugin transform hooks.
// We base64-encode the absolute path so the ID has no extension.
const cssRawTextPlugin = {
  name: 'css-raw-text',
  enforce: 'pre' as const,
  resolveId(id: string, importer?: string) {
    if (/\.css\?raw$/.test(id)) {
      const file = id.replace(/\?raw$/, '');
      const abs = resolve(dirname(importer ?? ''), file);
      // Encode path to avoid ".css" in the virtual module ID
      const encoded = Buffer.from(abs).toString('base64');
      return '\x00css-raw-text:' + encoded;
    }
    return undefined;
  },
  load(id: string) {
    if (id.startsWith('\x00css-raw-text:')) {
      const encoded = id.slice('\x00css-raw-text:'.length);
      const file = Buffer.from(encoded, 'base64').toString('utf-8');
      const text = readFileSync(file, 'utf-8');
      return 'export default ' + JSON.stringify(text) + ';';
    }
    return undefined;
  },
};

export default defineConfig({
  base: '/title-run/',
  plugins: [cssRawTextPlugin, react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
