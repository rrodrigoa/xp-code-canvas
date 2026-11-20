import * as esbuild from 'esbuild';
import fs from 'node:fs';
fs.mkdirSync('dist/extension', { recursive: true });
const options = {
  entryPoints: ['src/extension/extension.ts'], outfile: 'dist/extension/extension.js',
  bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode'],
  sourcemap: true, minify: false,
};
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch(); console.log('Watching extension host...');
} else { await esbuild.build(options); }
