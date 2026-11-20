import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const graph=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false,lens:'uml',flowKind:'calls'};
async function boot(page:import('@playwright/test').Page){
  await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(m:any)=>(window as any).__messages.push(m),getState:()=>undefined,setState:()=>{}});});
  await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  await page.evaluate(data=>window.postMessage({type:'graph',...data},'*'),{graph,state});
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
test('V4 shares one surface for UML and Sankey and preserves source graph',async({page})=>{
  await boot(page);
  await expect(page.locator('.semantic-key')).toBeVisible();
  await page.getByRole('button',{name:'Flow'}).click();
  await expect(page.getByTestId('sankey-lens')).toBeVisible();
  await expect(page.getByText(/not runtime frequency/i)).toBeVisible();
  await page.getByLabel('Sankey relationship type').selectOption('imports');
  await expect(page.locator('.sankey-lens')).toBeVisible();
  await page.getByRole('button',{name:'Return to UML diagram'}).click();
  await expect(page.getByTestId('sankey-lens')).toHaveCount(0);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
});
test('colored structure is revealed at higher magnification without automatic editor splits',async({page})=>{
  await boot(page);
  const classCard=page.locator('.uml-node.uml-class').first();
  await expect(classCard).toBeVisible();
  await page.getByRole('button',{name:'Zoom in'}).click({clickCount:3});
  await expect(page.locator('.structure-map.structure-blocks').first()).toHaveCount(0); // structure is a nested block collection
  await expect(page.locator('.structure-map .structure-block').first()).toBeVisible();
  await expect(page.locator('.sankey-lens')).toHaveCount(0);
});
