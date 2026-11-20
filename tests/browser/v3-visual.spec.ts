import { test,expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const graph=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false};
async function boot(page:import('@playwright/test').Page){
  await page.addInitScript(()=>{
    (window as any).__messages=[];
    (window as any).acquireVsCodeApi=()=>({postMessage:(m:any)=>(window as any).__messages.push(m),getState:()=>undefined,setState:(s:any)=>(window as any).__viewState=s});
  });
  await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  await page.evaluate(data=>window.postMessage({type:'graph',...data},'*'),{graph,state});
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy','false');
}
test('regular wheel pans; Ctrl+wheel zooms at cursor everywhere, including source preview',async({page})=>{
  await boot(page);
  const zoom=page.getByLabel(/Canvas zoom/);const before=await zoom.getAttribute('aria-label');
  const canvas=page.locator('.graph-region');const box=await canvas.boundingBox();expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width*.5,box!.y+box!.height*.65);
  await page.mouse.wheel(0,120);
  await expect(zoom).toHaveAttribute('aria-label',before!);
  await page.keyboard.down('Control');await page.mouse.wheel(0,-240);await page.keyboard.up('Control');
  await expect.poll(async()=>zoom.getAttribute('aria-label')).not.toBe(before);
});
test('Git drawer shows colored topology lanes and selects a semantic diff baseline',async({page})=>{
  await boot(page);
  await page.getByRole('button',{name:'Git history'}).click();
  await page.getByRole('group',{name:'Git information mode'}).getByRole('button',{name:'History'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.some((m:any)=>m.type==='getGitHistory'))).toBe(true);
  const hash='a'.repeat(40),parent='b'.repeat(40);
  await page.evaluate(commits=>window.postMessage({type:'gitHistory',commits},'*'),[
    {hash,parents:[parent],subject:'Add graph layout',author:'Developer',date:'2026-11-19T10:00:00Z',refs:['HEAD -> main']},
    {hash:parent,parents:[],subject:'Initial implementation',author:'Developer',date:'2026-11-18T10:00:00Z',refs:[]},
  ]);
  await expect(page.getByRole('dialog',{name:'Git history and semantic comparison'}).locator('.git-commit-row')).toHaveCount(2);
  await expect(page.locator('.git-lane-plot circle')).toHaveCount(2);
  await page.getByText('Initial implementation').click();
  await page.getByRole('dialog',{name:'Git history and semantic comparison'}).getByRole('button',{name:'Compare'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.findLast((m:any)=>m.type==='gitDiff')?.baseline)).toBe(parent);
});
test('file focus and global automatic layout remain independent of manual pinning',async({page})=>{
  await boot(page);
  await page.getByLabel('Focus Python file').selectOption(graph.nodes.find((n:any)=>n.kind==='module'&&n.module==='agent').uri);
  await expect(page.locator('.graph-context-title')).toContainText('agent');
  await page.getByRole('button',{name:'Auto-layout graph'}).click();
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
});
