// 1. Bundle the player (inlined into every HTML file the CLI writes).
// 2. Bundle the CLI into one dependency-free file with the player inlined.
import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const viewer = await build({
  entryPoints: ['src/viewer/standalone.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  write: false,
  legalComments: 'none',
});
const viewerJs = viewer.outputFiles[0].text;
mkdirSync('dist/cli', { recursive: true });
await build({
  entryPoints: ['src/cli/index.ts'],
  outfile: 'dist/cli/codelapse.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  define: { __VIEWER_JS__: JSON.stringify(viewerJs), __VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'info',
});
console.log(`viewer: ${(viewerJs.length / 1024).toFixed(0)} KB`);
