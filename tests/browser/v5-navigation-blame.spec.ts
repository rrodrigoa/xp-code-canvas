import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const graph=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false,lens:'uml'};
async function boot(page:import('@playwright/test').Page){
  await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(message:any)=>(window as any).__messages.push(message),getState:()=>undefined,setState:()=>{}});});
  await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  await page.evaluate(data=>window.postMessage({type:'graph',...data},'*'),{graph,state});
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
test('exploration has back/forward controls and retains the single editor surface',async({page})=>{
  await boot(page);
  const nodes=page.locator('.react-flow__node');
  await nodes.nth(0).click();
  await nodes.nth(1).click();
  await expect(page.getByRole('button',{name:'Go back to previous symbol'})).toBeEnabled();
  await page.getByRole('button',{name:'Go back to previous symbol'}).click();
  await expect(page.getByRole('button',{name:'Go forward to next symbol'})).toBeEnabled();
  await expect(page.locator('.sankey-lens')).toHaveCount(0);
});
test('blame loads only on request and shows provenance rather than guessed authorship',async({page})=>{
  await boot(page);
  await page.locator('.react-flow__node').first().click();
  await page.locator('.react-flow__node.selected').getByRole('button',{name:/More actions for/}).click();
  await page.getByRole('menuitem',{name:'Inspect Git blame'}).click();
  const msg=await page.evaluate(()=>(window as any).__messages.findLast((m:any)=>m.type==='getGitBlame'));
  expect(msg.nodeId).toBeTruthy();
  await page.evaluate(id=>window.postMessage({type:'gitBlame',result:{nodeId:id,status:'clean',basis:'HEAD',lines:[{line:1,originalLine:1,hash:'a'.repeat(40),author:'Ada',timestamp:1730000000,summary:'Refactor parsing',file:'sample.py'}],summary:{lines:1,uniqueCommits:1,authors:[{author:'Ada',lines:1,share:1}],latest:{line:1,originalLine:1,hash:'a'.repeat(40),author:'Ada',timestamp:1730000000,summary:'Refactor parsing',file:'sample.py'}}}},'*'),msg.nodeId);
  await expect(page.getByRole('dialog',{name:/Inspect /}).getByText(/last-modified attribution/i)).toBeVisible();
  await expect(page.getByText(/does not establish original authorship/i)).toBeVisible();
});
test('functions can reveal source-derived control blocks without generating inferred paths',async({page})=>{
  const fresh=JSON.parse(JSON.stringify(graph));
  const target=fresh.nodes.find((n:any)=>n.kind==='function');
  expect(target).toBeTruthy();
  target.anatomy=[{id:'branch:5:4',kind:'branch',label:'if item',depth:0,range:{startLine:5,startCharacter:4,endLine:7,endCharacter:0}}];
  await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(m:any)=>(window as any).__messages.push(m),getState:()=>undefined,setState:()=>{}});});
  await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  await page.evaluate(data=>window.postMessage({type:'graph',...data},'*'),{graph:fresh,state:{...state,zoom:1.42,viewport:{x:0,y:0,zoom:1.42},selectedNode:target.id}});
  await expect(page.locator('.function-anatomy')).toBeVisible();
  await page.getByRole('button',{name:/branch: if item/i}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.findLast((m:any)=>m.type==='openSourceRegion')?.regionId)).toBe('branch:5:4');
});
