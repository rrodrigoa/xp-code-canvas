import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const graph=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},
 expanded:[],pinned:{},manualPositions:{},layoutMode:'architecture',layoutPositions:{},
 edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false,lens:'uml'};
async function boot(page:import('@playwright/test').Page){
 await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({
  postMessage:(m:any)=>(window as any).__messages.push(m),getState:()=>undefined,setState:(s:any)=>(window as any).__persistedState=s,
 });});
 await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
 await page.evaluate(data=>window.postMessage({type:'graph',...data},'*'),{graph,state});
 await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
test('V6 symbol search and named layouts keep the same editor surface',async({page})=>{
 await boot(page);
 await page.getByLabel('Choose graph layout').selectOption('investigation');
 await expect(page.locator('.graph-context-meta')).toContainText('Investigation layout');
 const search=page.getByRole('combobox',{name:'Find Python symbol'});
 await search.fill('Agent');
 await expect(page.getByRole('listbox',{name:'Matching code symbols'})).toBeVisible();
 await search.press('Enter');
 await expect(page.locator('.graph-context-title')).toContainText('agent');
 await expect(page.locator('.uml-node.selected[data-testid="symbol-class"]')).toBeVisible();
 const region=await page.locator('.graph-region').boundingBox();
 await page.mouse.move(region!.x+30,region!.y+400);await page.mouse.wheel(0,1500);
 await expect(page.locator('.uml-node.selected')).not.toBeInViewport();
 await search.fill('Agent');await search.press('Enter');
 await expect(page.locator('.uml-node.selected[data-testid="symbol-class"]')).toBeInViewport();
 await expect(page.locator('.graph-region')).toHaveCount(1);
});
test('V6 separates Git commands without opening an extra permanent editor',async({page})=>{
 await boot(page);
 await page.getByRole('button',{name:'Git history'}).click();
 const commands=page.getByRole('dialog',{name:'Git exploration'});
 await expect(commands).toBeVisible();
 await commands.getByRole('button',{name:'History'}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__messages.some((m:any)=>m.type==='getGitHistory'))).toBe(true);
 await expect(page.getByRole('dialog',{name:'Git history and semantic comparison'})).toBeVisible();
});
test('V6 responsive screenshot evidence: dark/light, high contrast, display scaling',async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await boot(page);
 for(const [width,height] of [[1440,900],[960,720]] as const){
  await page.setViewportSize({width,height});
  await expect(page.getByRole('main',{name:'Interactive Python UML graph'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
  expect(overflow).toBe(false);
  for(const theme of ['dark','light'] as const){
   await page.evaluate(theme=>{
    const color=theme==='dark'?'#171d25':'#f6f8fb';
    document.documentElement.style.setProperty('--xp-surface-0',color);
    document.documentElement.style.setProperty('--xp-surface-1',theme==='dark'?'#1e2631':'#fff');
    document.documentElement.style.setProperty('--xp-text',theme==='dark'?'#dde4ed':'#283240');
   },theme);
   await page.waitForTimeout(270);
   await testInfo.attach(`v6-${theme}-${width}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  }
 }
 await page.emulateMedia({forcedColors:'active'});
 await expect(page.getByLabel('Choose graph layout')).toBeVisible();
 await testInfo.attach('v6-high-contrast',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
});
for(const scale of [1.25,1.5,2])test(`V6 browser device scale ${scale} preserves accessible controls`,async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:960,height:720},deviceScaleFactor:scale,reducedMotion:'reduce'});
 try{
  const page=await context.newPage();await boot(page);
  expect(await page.evaluate(()=>window.devicePixelRatio)).toBe(scale);
  await page.getByRole('combobox',{name:'Find Python symbol'}).focus();
  await expect(page.getByRole('combobox',{name:'Find Python symbol'})).toBeFocused();
  await page.keyboard.type('Agent');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(page.locator('.graph-context-title')).toContainText('agent');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);
  await info.attach(`browser-scale-${scale}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 }finally{await context.close();}
});
test('V6 source expansion uses measured cards without overlap',async({page})=>{
 await boot(page);
 const card=page.locator('[data-testid="symbol-class"]').first();
 const before=(await card.boundingBox())!.height;
 await card.getByRole('button',{name:/More actions for/}).click();
 await page.getByRole('menuitem',{name:'Expand to source'}).click();
 await expect(card.locator('.source-preview')).toBeVisible();
 await expect.poll(async()=>Math.round((await card.boundingBox())!.height)).toBeGreaterThan(Math.round(before));
 await expect.poll(async()=>page.locator('.uml-node').evaluateAll(cards=>{
  const boxes=cards.map(card=>card.getBoundingClientRect());
  return boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1));
 })).toBe(false);
});
