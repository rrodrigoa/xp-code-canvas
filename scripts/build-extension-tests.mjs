import * as esbuild from 'esbuild';
import fs from 'node:fs';
fs.mkdirSync('dist/test/extension', { recursive: true });
await esbuild.build({
  entryPoints: ['tests/extension/extension.test.ts','tests/extension/realRepository.test.ts'], outdir: 'dist/test/extension',
  bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode', 'mocha'], sourcemap: true,
});
