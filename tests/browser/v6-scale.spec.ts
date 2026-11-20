import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/sample-graph.json','utf8'));
for(const count of [100,1000,5000])test(`V6 ${count} symbols complete all four layouts`,async({page},info)=>{
  test.setTimeout(240000);
  const prototype=fixture.nodes.find((n:any)=>n.kind==='function');
  const nodes=Array.from({length:count},(_,i)=>({...prototype,id:`scale-${i}`,name:`function_${i}`,qualifiedName:`scale.function_${i}`,parentId:null,anatomy:[],attributes:[],operations:[],change:i%5===0?'MODIFIED':'UNCHANGED',range:{...prototype.range,startLine:i*4,endLine:i*4+2}}));
  const edges=nodes.map((n,i)=>({...fixture.edges[0],id:`cycle-${i}`,source:n.id,target:nodes[(i+1)%count].id,kind:'calls'}));
  await page.addInitScript(()=>{(window as any).__messages=[];(window as any).acquireVsCodeApi=()=>({postMessage:(m:any)=>(window as any).__messages.push(m),getState:()=>undefined,setState:()=>{}});});
  await page.goto('/');
  await page.waitForFunction(()=>(window as any).__messages.some((m:any)=>m.type==='ready'));
  const start=Date.now();
  await page.evaluate(data=>window.postMessage({type:'graph',...data},'*'),{graph:{...fixture,nodes,edges},state:{schema:1,altitude:'code',focusedFile:prototype.uri,selectedNode:nodes[0].id,zoom:1,viewport:{x:0,y:0,zoom:1},expanded:[],pinned:{},manualPositions:{},layoutMode:'change',layoutPositions:{},edgeKinds:['calls'],trace:'all',traceDepth:2,history:[],historyIndex:-1,explodeMethods:false}});
  const main=page.getByRole('main',{name:'Interactive Python UML graph'});
  await expect(page.locator('.graph-context-meta')).toContainText(`${count} symbols`);
  const timings:Record<string,number>={};
  for(const mode of ['change','file','investigation','architecture']){
    const before=Date.now();
    console.log(`scale ${count}: starting ${mode}`);
    await page.getByLabel('Choose graph layout').selectOption(mode);
    await expect(main).toHaveAttribute('aria-busy','false',{timeout:180000});
    await expect(page.locator('.react-flow__node').first()).toBeAttached({timeout:30000});
    timings[mode]=Date.now()-before;
    console.log(`scale ${count}: ${mode} ${timings[mode]}ms`);
  }
  await info.attach('layout-timings.json',{body:JSON.stringify({count,totalMs:Date.now()-start,timings}),contentType:'application/json'});
});
