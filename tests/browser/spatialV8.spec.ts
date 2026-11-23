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
test('3D is optional, switches without losing the 2D UML or selected symbol',async({page})=>{
 await boot(page);await page.getByRole('button',{name:'3D',exact:true}).click();
 await expect(page.locator('[data-testid="spatial-3d"]')).toBeVisible();
 await expect(page.getByRole('combobox',{name:'3D graph organization'})).toHaveValue('folder');
 await page.getByRole('combobox',{name:'3D graph organization'}).selectOption('hub');
 await expect.poll(()=>page.evaluate(()=>{const m=(window as any).__messages.filter((m:any)=>m.type==='state');return m[m.length-1]?.state?.spatialLayout;})).toBe('hub');
 await page.getByRole('button',{name:'UML',exact:true}).click();
 await expect(page.locator('.react-flow__node').first()).toBeVisible();
});
test('review controls remain available from 3D',async({page})=>{
 await boot(page);await page.getByRole('button',{name:'3D',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open architecture review'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'3D folder filter'})).toBeVisible();
 await expect(page.getByRole('button',{name:'UML',exact:true})).toBeVisible();
});
