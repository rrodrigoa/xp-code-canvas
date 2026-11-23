import {expect,test} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const graph=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false};
async function boot(page:any){
  await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(msg:any)=>(window as any).__messages.push(msg),setState:()=>{},getState:()=>undefined});});
  await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  await page.evaluate((d:{graph:typeof graph;state:typeof state})=>window.postMessage({type:'graph',...d},'*'),{graph,state});
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
test('semantic zoom rail exposes three draggable keyboard-adjustable stops',async({page})=>{
  await boot(page);await page.getByRole('button',{name:/Detail zoom/}).click();
  const sliders=page.getByRole('slider');await expect(sliders).toHaveCount(3);
  await sliders.nth(1).focus();await page.keyboard.press('ArrowUp');
  await expect(sliders.nth(1)).toHaveAttribute('aria-valuenow','116');
});
test('inline edits are explicit and emit guarded edit requests, never auto-publish',async({page})=>{
  await boot(page);
  const node=page.locator('[data-testid="symbol-function"]').first();
  await node.getByRole('button',{name:/More actions for/}).click();await page.getByRole('menuitem',{name:'Expand to source'}).click();
  // Browser fixture supplies the exact code snapshot that the real host sends.
  const id=await node.getAttribute('data-nodeid');const symbol=graph.nodes.find((n:any)=>n.id===id);
  await page.evaluate(({id,hash})=>window.postMessage({type:'sourcePreview',requestId:'test',nodeId:id,contentHash:hash,source:'def demo():\n    return 1',stale:false,truncated:false},'*'),{id,hash:symbol.contentHash??''});
  await node.getByRole('button',{name:/Edit here/}).click();
  const source=node.getByRole('textbox',{name:'Editable Python source inside UML node'});
  await source.fill('def demo():\n    return 2');
  await node.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.some((m:any)=>m.type==='applyInlineEdit'))).toBe(true);
});
