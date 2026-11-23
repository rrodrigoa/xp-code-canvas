import * as esbuild from 'esbuild';
import fs from 'node:fs';
fs.mkdirSync('dist/test/extension', { recursive: true });
await esbuild.build({
  entryPoints: fs.readdirSync('tests/extension').filter(name=>name.endsWith('.test.ts')).map(name=>`tests/extension/${name}`), outdir: 'dist/test/extension',
  bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode', 'mocha'], sourcemap: true,
});
