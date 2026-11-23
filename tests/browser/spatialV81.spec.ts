import {test,expect} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const graph=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const state={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false,layoutMode:'folder',spatialLayout:'folder',lens:'uml'};
async function boot(page:any){
 await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(m:any)=>(window as any).__messages.push(m),getState:()=>undefined,setState:()=>undefined});});
 await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
 await page.evaluate((d:any)=>window.postMessage({type:'graph',...d},'*'),{graph,state});
 await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
test('3D supports all partition options and professional camera controls',async({page})=>{
 await boot(page);await page.getByRole('button',{name:'3D',exact:true}).click();
 await expect(page.locator('[data-testid="spatial-3d"]')).toBeVisible();
 for(const kind of ['class','community','review','dependency','hub','force','size','folder']){
   await page.getByRole('combobox',{name:'3D graph organization'}).selectOption(kind);
   await expect.poll(()=>page.evaluate(()=>{const m=(window as any).__messages.filter((m:any)=>m.type==='state');return m.at(-1)?.state.spatialLayout;})).toBe(kind);
 }
 for(const name of ['Zoom in 3D graph','Zoom out 3D graph'])await expect(page.getByRole('button',{name})).toBeVisible();
 for(const name of ['Camera angle presets','3D camera navigation'])await expect(page.getByRole('group',{name})).toBeVisible();
 for(const action of ['Front','Top','Side','Isometric','Fit all'])await expect(page.getByRole('button',{name:action})).toBeVisible();
});
test('2D keeps its complete view and provides the matching partitions',async({page})=>{
 await boot(page);for(const mode of ['class','community','review']){
  await page.getByLabel('Choose graph layout').selectOption(mode);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
 }
 await page.getByRole('button',{name:'3D',exact:true}).click();
 await page.getByRole('button',{name:'UML',exact:true}).click();
 await expect(page.locator('.react-flow__node').first()).toBeVisible();
});
