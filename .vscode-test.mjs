import { defineConfig } from '@vscode/test-cli';
export default defineConfig({
  files: process.env.XP_MULTIROOT_WORKSPACE ? 'dist/test/extension/multiRoot.test.js' : process.env.XP_UNBORN_REPO ? 'dist/test/extension/unbornReview.test.js' : process.env.XP_REAL_REPO ? 'dist/test/extension/realRepository.test.js' : ['dist/test/extension/extension.test.js','dist/test/extension/inlineEditV71.test.js'],
  workspaceFolder: process.env.XP_MULTIROOT_WORKSPACE || process.env.XP_UNBORN_REPO || process.env.XP_REAL_REPO || './tests/fixtures/sample_project',
  launchArgs:['--disable-workspace-trust'],
  mocha: { timeout: process.env.XP_REAL_REPO ? 120000 : 30000 },
});
