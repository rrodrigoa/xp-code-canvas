import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const graph = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'), 'utf8'));
const initialState = { schema: 1, altitude: 'code', focusedFile: graph.nodes.find((n: any) => n.module === 'agent' && n.kind === 'module').uri,
  selectedNode: null, zoom: 1, viewport: { x: 0, y: 0, zoom: 1 }, expanded: [], pinned: {}, manualPositions: {}, edgeKinds: ['calls','imports','inherits','creates'], trace: 'all', traceDepth: 2, history: [], historyIndex: -1, explodeMethods: false };
async function boot(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as any).acquireVsCodeApi = () => ({
      postMessage: (data: any) => (window as any).__messages.push(data),
      setState: (s: any) => ((window as any).__lastState = s),
      getState: () => undefined,
    });
    (window as any).__messages = [];
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__messages.some((m: any) => m.type === 'ready'));
  await page.evaluate(data => window.postMessage({ type: 'graph', ...data }, '*'), { graph, state: initialState });
  await expect(page.getByRole('main', { name: 'Interactive Python UML graph' }).locator('.react-flow__node').first()).toBeVisible();
}

test('renders actual classes, functions, calls and four altitudes', async ({ page }) => {
  await boot(page);
  await expect(page.getByText('Agent', { exact: true }).first()).toBeVisible();
  // Horizontal SVG paths have zero-height DOM bounds even when visibly stroked.
  const connector=page.locator('.react-flow__edge-path').first();
  await expect(connector).toHaveAttribute('d', /^M.+L/);
  expect(await connector.evaluate((path:SVGPathElement)=>path.getTotalLength())).toBeGreaterThan(0);
  await expect(connector).not.toHaveCSS('stroke','none');
  for (const altitude of ['Architecture','Packages','Modules','Code']) {
    await page.getByRole('button', { name: altitude, exact: true }).click();
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
  }
});

test('opens source in native editor via explicit node control, never side panel', async ({ page }) => {
  await boot(page);
  await page.locator('[data-testid="symbol-class"]').first().getByRole('button',{name:/More actions for/}).click();
  await page.getByRole('menuitem',{name:'Expand to source'}).click();
  await expect(page.locator('.source-preview').first()).toBeVisible();
  await page.locator('[data-testid="symbol-class"]').first().getByRole('button', { name: /Open .* in VS Code editor/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__messages.some((m: any) => m.type === 'openNode'))).toBe(true);
});

test('file focus, graph drag and persisted pinned position', async ({ page }) => {
  await boot(page);
  const node = page.locator('[data-testid="symbol-class"]').first();
  const bbox = await node.boundingBox();
  expect(bbox).not.toBeNull();
  await page.mouse.move(bbox!.x + 28, bbox!.y + 23);
  await page.mouse.down();
  await page.mouse.move(bbox!.x + 75, bbox!.y + 82, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => Object.keys((window as any).__lastState?.layoutPositions?.file ?? {}).length)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Relationship filters'}).click();
  await page.getByRole('button',{name:'Reset all manual positions'}).click();
  await expect.poll(()=>page.evaluate(()=>Object.keys((window as any).__lastState?.layoutPositions??{}).length)).toBe(0);
});
