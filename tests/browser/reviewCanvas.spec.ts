import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const graph=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false,layoutMode:'architecture'};
async function boot(page:any){
  await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(m:any)=>(window as any).__messages.push(m),getState:()=>undefined,setState:()=>undefined});});
  await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  await page.evaluate((data:any)=>window.postMessage({type:'graph',...data},'*'),{graph,state});
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
test('launches visual review without losing UML canvas',async({page})=>{
  await boot(page);
  await page.getByRole('button',{name:'Open architecture review'}).click();
  await expect(page.getByRole('dialog',{name:'Visual code review'})).toBeVisible();
  await expect(page.locator('#review-scope')).toBeVisible();
});
test('requests staged comparison and renders changed + impact metrics',async({page})=>{
  await boot(page);await page.getByRole('button',{name:'Open architecture review'}).click();
  await page.locator('#review-scope').selectOption('staged');
  await page.getByRole('button',{name:'Review',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.some((m:any)=>m.type==='reviewOpen'&&m.scope==='staged'))).toBe(true);
  const changed=JSON.parse(JSON.stringify(graph));const item=changed.nodes.find((n:any)=>n.kind==='class');
  item.change='MODIFIED';const other=changed.nodes.find((n:any)=>n.kind==='function');if(other)other.change='IMPACTED';
  await page.evaluate((review:any)=>window.postMessage({type:'reviewSnapshot',review},'*'),{reviewKey:'t',scope:'staged',title:'Review staged',baseline:'HEAD',head:'INDEX',graph:changed,files:[{path:'agent.py',status:'modified'}],threads:[],analysisAvailable:true,createdAt:'2026-11-21T00:00:00Z'});
  await expect(page.locator('.review-pulse')).toContainText('Changed');
  await expect(page.getByRole('button',{name:'End review · restore live graph'})).toBeVisible();
});
