import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const fixture=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/sample-graph.json'),'utf8'));
const base={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','creates'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false};
async function boot(page:any,graph=fixture){
 await page.addInitScript(()=>{
  (window as any).__messages=[];
  (window as any).acquireVsCodeApi=()=>({postMessage:(message:any)=>(window as any).__messages.push(message),setState:(state:any)=>((window as any).__lastState=state),getState:()=>undefined});
 });
 await page.goto('/');
 await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
 await page.evaluate(({g,state}:any)=>window.postMessage({type:'graph',graph:g,state},'*'),{g:graph,state:base});
 await expect(page.locator('.react-flow__node').first()).toBeVisible();
}
test('Spread recovery moves symbols into multiple columns and preserves graph node count',async({page})=>{
 const nodes=Array.from({length:584},(_,i)=>({...fixture.nodes[0],kind:'function',parentId:undefined,id:`recovery-${i}`,name:`func_${i}`,qualifiedName:`func_${i}`,uri:`file:///p/f${Math.floor(i/32)}.py`,module:`f${Math.floor(i/32)}`}));
 await boot(page,{...fixture,nodes,edges:[]});
 await page.getByRole('button',{name:/Spread & recover graph/}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__lastState?.layoutMode)).toBe('spread');
 await expect(page.getByRole('combobox',{name:'Choose graph layout'})).toHaveValue('spread');
 await expect(page.getByRole('button',{name:'Toggle minimap'})).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.evaluate(()=>(window as any).__lastState?.zoom)).toBeGreaterThanOrEqual(.7);
 expect(await page.evaluate(()=>(window as any).__lastState.pinned)).toEqual({});
});
test('syntax preview selection carries the exact UTF-16 editor cursor on Edit',async({page})=>{
 await boot(page);
 const node=page.locator('[data-testid="symbol-class"]').first();
 await node.getByRole('button',{name:/More actions for/}).click();
 await page.getByRole('menuitem',{name:'Expand to source'}).click();
 await expect.poll(()=>page.evaluate(()=>((window as any).__messages as any[]).some(m=>m.type==='getSourcePreview'))).toBe(true);
 const req=await page.evaluate(()=>((window as any).__messages as any[]).filter(m=>m.type==='getSourcePreview').at(-1));
 expect(req?.nodeId).toBeTruthy();
 const symbol=fixture.nodes.find((n:any)=>n.id===req.nodeId);
 await page.evaluate(({id,hash}:any)=>window.postMessage({type:'sourcePreview',requestId:'test',nodeId:id,contentHash:hash??'',source:'class Example:\r\n    value = "😀"; return 42\r\n',stale:false},'*'),{id:req.nodeId,hash:symbol?.contentHash});
 await expect(node.locator('.source-text-segment').first()).toBeVisible();
 await expect(node.locator('.xp-source-resize')).toBeVisible();
 await node.locator('.source-code-row').nth(1).locator('code').evaluate(code=>{
  const walker=document.createTreeWalker(code,NodeFilter.SHOW_TEXT);
  let text=walker.nextNode();let remaining=19;
  while(text&&remaining>text.textContent!.length){remaining-=text.textContent!.length;text=walker.nextNode();}
  const selection=window.getSelection()!,range=document.createRange();
  range.setStart(text!,remaining);range.collapse(true);
  selection.removeAllRanges();selection.addRange(range);
  code.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
 });
 await node.getByRole('button',{name:/Edit/}).click();
 const out=await page.evaluate(()=>((window as any).__messages as any[]).filter(m=>m.type==='openNode').at(-1));
 expect(out.nodeId).toBe(req.nodeId);
 expect(out.cursor.line).toBe(symbol.range.startLine+1);
 expect(out.cursor.character).toBe(19);
 await page.getByRole('button',{name:'Fit canvas',exact:true}).click();
 await page.waitForTimeout(500); // Finish the explicit viewport animation before dragging its grip.
 const before=await node.boundingBox();const handle=node.locator('.xp-source-resize');
 const grip=(await handle.boundingBox())!;
 await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
 await page.mouse.down();await page.mouse.move(grip.x+grip.width/2+110,grip.y+grip.height/2+65,{steps:8});await page.mouse.up();
 await expect.poll(()=>page.evaluate((id)=>(window as any).__lastState?.nodeSizes?.[id]?.width,req.nodeId)).toBeGreaterThan(550);
 const resized=await node.boundingBox();expect(resized!.width).toBeGreaterThan(before!.width+50);
 const saved=await page.evaluate((id)=>(window as any).__lastState.nodeSizes[id],req.nodeId);
 await node.getByRole('button',{name:/More actions for/}).click();
 await page.getByRole('menuitem',{name:'Collapse details'}).click();
 await expect(node.locator('.xp-source-resize')).toHaveCount(0);
 await node.getByRole('button',{name:/More actions for/}).click();
 await page.getByRole('menuitem',{name:'Expand to source'}).click();
 expect(await node.evaluate(n=>Math.round(parseFloat((n as HTMLElement).style.width)))).toBe(saved.width);
 await page.screenshot({path:'test-results/v61-source-resize.png'});
});
