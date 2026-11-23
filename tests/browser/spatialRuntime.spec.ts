import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import fixture from '../fixtures/sample-graph.json';
import type {SourceGraph} from '../../src/shared/types';
const base={schema:1,altitude:'code',focusedFile:null,selectedNode:null,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},edgeKinds:['calls','imports','inherits','realizes','creates','contains','references'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:true,layoutMode:'spread',spatialLayout:'folder',lens:'spatial'};
async function boot(page:Page,graph:SourceGraph,state={}){
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(m:unknown)=>(window as any).__messages.push(m),getState:()=>undefined,setState:()=>undefined});});
  await page.goto('/');await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  await page.evaluate(d=>window.postMessage({type:'graph',...d},'*'),{graph,state:{...base,...state}});
  return errors;
}
function graphOf(count:number):SourceGraph{
  const template=fixture.nodes.find(n=>n.kind==='function')!;
  return {schema:1,diagnostics:[],nodes:Array.from({length:count},(_,i)=>({...template,id:`n${i}`,name:`symbol_${i}`,qualifiedName:`pkg.symbol_${i}`,kind:'function',parentId:null,uri:`file:///repo/pkg${Math.floor(i/50)}/file.py`,root:'file:///repo',moduleId:`m${Math.floor(i/50)}`,change:i%97===0?'MODIFIED':i%97===1?'IMPACTED':undefined} as SourceGraph['nodes'][number])),edges:Array.from({length:count*2},(_,i)=>({id:`e${i}`,source:`n${i%count}`,target:`n${(i%count+1+Math.floor(i/count)*13)%count}`,kind:['calls','imports','inherits','realizes','creates','contains','references'][i%7] as SourceGraph['edges'][number]['kind'],confidence:i%19?'resolved':'ambiguous',change:i%103===0?'ADDED':undefined,evidence:[]}))};
}
test('WebGL disabled explicitly retains 2D fallback and canonical source',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:any,...args:any[]){return String(kind).startsWith('webgl')?null:(original as any).call(this,kind,...args);} as any;});
  const errors=await boot(page,fixture as SourceGraph);
  await expect(page.getByRole('heading',{name:'3D rendering is unavailable'})).toBeVisible();
  await page.getByRole('button',{name:'UML',exact:true}).click();
  await expect(page.locator('.uml-node').first()).toBeVisible();expect(errors).toEqual([]);
});
test('WebGL1-only environments fall back safely because the bundled renderer requires WebGL2',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:any,...args:any[]){return kind==='webgl2'?null:(original as any).call(this,kind,...args);} as any;});
  const errors=await boot(page,fixture as SourceGraph);await expect(page.getByRole('heading',{name:'3D rendering is unavailable'})).toBeVisible();expect(errors).toEqual([]);
});
test('3D inspector maps UTF-16 source cursors and resizes without losing selection or filters',async({page})=>{
  const node=fixture.nodes.find(n=>n.kind==='function')!;
  const errors=await boot(page,fixture as SourceGraph,{selectedNode:node.id,explodeMethods:false,edgeKinds:['calls']});
  const inspector=page.getByTestId('spatial-inspector');await expect(inspector).toBeVisible();
  await page.evaluate(n=>window.postMessage({type:'sourcePreview',requestId:'3d-test',nodeId:n.id,contentHash:'',source:'def example():\r\n    value = "😀"; return 42\r\n',stale:false,truncated:false},'*'),node);
  const source=inspector.locator('.spatial-source');await expect(source).toContainText('return 42');
  await source.evaluate(pre=>{
    const code=pre.querySelector('code')!,walker=document.createTreeWalker(code,NodeFilter.SHOW_TEXT);
    let node=walker.nextNode();let offset=code.textContent!.indexOf('value')+19;
    while(node&&offset>node.textContent!.length){offset-=node.textContent!.length;node=walker.nextNode();}
    const range=document.createRange();range.setStart(node!,offset);range.collapse(true);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);pre.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  });
  await inspector.getByRole('button',{name:/Edit L/}).click();
  const request=await page.evaluate(()=>(window as any).__messages.filter((m:any)=>m.type==='openNode').at(-1));
  expect(request.nodeId).toBe(node.id);expect(request.cursor.line).toBe(node.range.startLine+1);expect(request.cursor.character).toBe(23);
  const before=await inspector.boundingBox();await inspector.evaluate(el=>{el.style.width='500px';el.style.height='420px';});
  expect((await inspector.boundingBox())!.height).not.toBe(before!.height);
  await page.getByRole('button',{name:'UML',exact:true}).click();await expect(page.locator('.uml-node.selected')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.filter((m:any)=>m.type==='state').at(-1)?.state.lens)).toBe('uml');
  const state=await page.evaluate(()=>(window as any).__messages.filter((m:any)=>m.type==='state').at(-1).state);
  expect(state.selectedNode).toBe(node.id);expect(state.edgeKinds).toEqual(['calls']);expect(errors).toEqual([]);
});
test('WebGL context loss releases the view and preserves the complete UML fallback',async({page})=>{
  const errors=await boot(page,fixture as SourceGraph);
  const canvas=page.getByTestId('spatial-3d').locator('canvas');await expect(canvas).toBeVisible();
  await canvas.evaluate(element=>{const canvas=element as HTMLCanvasElement;const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');gl?.getExtension('WEBGL_lose_context')?.loseContext();});
  await expect(page.getByRole('heading',{name:'3D rendering is unavailable'})).toBeVisible();
  await page.getByRole('button',{name:'UML',exact:true}).click();await expect(page.locator('.uml-node').first()).toBeVisible();expect(errors).toEqual([]);
});
for(const count of [50,584,1000,5000,10000])test(`WebGL runtime profile ${count} cyclic symbols`,async({page},info)=>{
  test.setTimeout(180000);
  const started=Date.now(),errors=await boot(page,graphOf(count));
  const root=page.getByTestId('spatial-3d');
  await expect(root.locator('canvas')).toBeVisible({timeout:60000});
  await expect(root).toHaveAttribute('data-rendered-nodes',String(count),{timeout:60000});
  await page.getByRole('button',{name:'Fit all',exact:true}).click();
  const sample=await page.evaluate(async()=>{
    const frames:number[]=[];const start=performance.now();let previous=start;
    await new Promise<void>(resolve=>{function tick(now:number){frames.push(now-previous);previous=now;if(now-start<2000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
    const root=document.querySelector('[data-testid="spatial-3d"]') as HTMLElement;
    return {fps:frames.length*1000/(previous-start),worstFrameMs:Math.max(...frames),gpuTextures:root.dataset.gpuTextures,drawCalls:root.dataset.drawCalls,gpuGeometries:root.dataset.gpuGeometries,gpuRenderer:root.dataset.gpuRenderer,estimatedTextureBytes:root.dataset.estimatedTextureBytes,jsHeapBytes:(performance as any).memory?.usedJSHeapSize};
  });
  const before=await page.evaluate(()=>(window as any).__messages.filter((m:any)=>m.type==='state').at(-1)?.state.spatialCamera);
  await page.getByRole('button',{name:'Side',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__messages.filter((m:any)=>m.type==='state').at(-1)?.state.spatialCamera),{timeout:20000}).not.toEqual(before);
  expect(errors).toEqual([]);expect(Number(sample.gpuTextures)).toBeLessThanOrEqual(340);
  const record={count,relations:count*2,loadMs:Date.now()-started,...sample,errors};
  fs.mkdirSync('.validation-runtime/evidence',{recursive:true});fs.writeFileSync(`.validation-runtime/evidence/spatial-${count}.json`,JSON.stringify(record,null,2));
  await page.screenshot({path:`.validation-runtime/evidence/spatial-${count}.png`});
  await info.attach('runtime-profile',{body:JSON.stringify(record),contentType:'application/json'});
});
