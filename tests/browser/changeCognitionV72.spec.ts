import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const graph=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false,layoutMode:'architecture'};
async function boot(page:any){
  await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(m:any)=>(window as any).__messages.push(m),getState:()=>undefined,setState:()=>undefined});});
  await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  await page.evaluate((d:any)=>window.postMessage({type:'graph',...d},'*'),{graph,state});
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
async function openReview(page:any){
  await boot(page);await page.getByRole('button',{name:'Open architecture review'}).click();
  const old=JSON.parse(JSON.stringify(graph));const current=JSON.parse(JSON.stringify(graph));
  const first=current.nodes.find((n:any)=>n.kind==='function')??current.nodes[0];
  const older=old.nodes.find((n:any)=>n.id===first.id);older.signature='def previous():';
  first.signature='def updated():';first.change='MODIFIED';
  const review={reviewKey:'v72test',scope:'working',title:'Local changes',baseline:'HEAD',head:'WORKTREE',graph:current,files:[{path:'README.md',status:'modified'},{path:'tests/test_agent.py',status:'modified'}],
    threads:[],analysisAvailable:true,createdAt:'2026-11-21T01:00:00Z',
    comparison:{before:{nodes:old.nodes,edges:old.edges},beforeLabel:'HEAD',afterLabel:'WORKTREE',truncated:false,
      transformations:[{id:'change-1',symbolId:first.id,kind:'signature',title:'Signature changed',before:'def previous():',after:'def updated():',uri:first.uri,line:first.range.startLine,evidence:'declaration',confidence:'source-backed'}]},
    cognition:{reviewKey:'v72test',head:'hash1',records:{},bookmarks:[],shelf:[],revisionChanged:false}};
  await page.evaluate((payload:any)=>window.postMessage({type:'reviewSnapshot',review:payload},'*'),review);
  await page.getByRole('button',{name:'Understand'}).click();
  await expect(page.getByRole('region',{name:'Understand architectural changes'})).toBeVisible();
  return first;
}
test('Before/Delta/After uses the existing UML while showing structural evidence',async({page})=>{
  await openReview(page);
  await expect(page.getByRole('region',{name:'Structural change facts'})).toContainText('Signature changed');
  await page.getByRole('group',{name:'Comparison frame'}).getByRole('button',{name:'Before'}).click();
  await expect(page.getByRole('group',{name:'Comparison frame'}).getByRole('button',{name:'Before'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('group',{name:'Comparison frame'}).getByRole('button',{name:'Δ changes'}).click();
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await expect(page.getByRole('region',{name:'Review evidence map'})).toContainText('unknown');
});
test('review status and questions remain explicitly reviewer driven',async({page})=>{
  const first=await openReview(page);
  // Pick changed symbol from the current graph.
  const node=page.locator(`[data-nodeid="${first.id}"]`).first();await node.click();
  await page.getByRole('group',{name:'Review status for selected symbol'}).getByRole('button',{name:'Reviewed'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.some((m:any)=>m.type==='reviewCognition'&&m.action.status==='reviewed'))).toBe(true);
  await page.getByLabel('What remains uncertain?').fill('Which tests verify this new signature?');
  await page.getByRole('button',{name:'Record question'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.some((m:any)=>m.type==='reviewCognition'&&m.action.action==='question'))).toBe(true);
});
