import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const fixture=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},
  expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,
  history:[],historyIndex:-1,explodeMethods:false};
async function ready(page:import('@playwright/test').Page){
  await page.addInitScript(()=>{
    (window as any).__messages=[];
    (window as any).acquireVsCodeApi=()=>({
      postMessage:(message:any)=>(window as any).__messages.push(message),
      getState:()=>undefined,setState:(next:any)=>(window as any).__canvasState=next,
    });
  });
  await page.goto('/');
  await page.waitForFunction(()=>(window as any).__messages.some((item:any)=>item.type==='ready'));
  await page.evaluate(value=>window.postMessage({type:'graph',graph:value.graph,state:value.state},'*'),
    {graph:{...fixture,revision:1,nodes:fixture.nodes.map((n:any)=>({...n,source:''}))},state});
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
test('lazy UML source preview asks host for bounded real source',async({page})=>{
  await ready(page);
  const node=page.locator('[data-testid="symbol-function"]').first();
  await node.getByRole('button',{name:/More actions for/}).click();
  await page.getByRole('menuitem',{name:'Expand to source'}).click();
  const id=await node.getAttribute('data-nodeid');
  await expect.poll(()=>page.evaluate((id:string|null)=>(window as any).__messages.some((m:any)=>m.type==='getSourcePreview'&&m.nodeId===id),id)).toBe(true);
  await page.evaluate(id=>window.postMessage({type:'sourcePreview',nodeId:id,requestId:'test',contentHash:'',source:'def example():\n    return 42',stale:false},'*'),id);
  await expect(node.getByText('return 42')).toBeVisible();
});
test('out-of-order graph delta triggers full snapshot recovery',async({page})=>{
  await ready(page);
  await page.evaluate(()=>window.postMessage({type:'graphDelta',delta:{baseRevision:999,nextRevision:1000,
    upsertNodes:[],removeNodeIds:[],upsertEdges:[],removeEdgeIds:[],diagnostics:[]}},'*'));
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.filter((m:any)=>m.type==='ready').length)).toBeGreaterThan(1);
});
