/* Dependency-light contract smoke for V3 and V4 pure UI algorithms.
 * Uses the project's TypeScript dev dependency, not a browser or VS Code. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ts=require('typescript');
function load(relative){
  const file=path.join(__dirname,'..',relative);
  const source=fs.readFileSync(file,'utf8');
  const output=ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  const fakeRequire=(name)=>{
    if(name==='elkjs/lib/elk.bundled.js')return {__esModule:true,default:class ELK{async layout(){return {children:[]};}}};
    if(name.startsWith('.'))return load(path.relative(path.join(__dirname,'..'),path.resolve(path.dirname(file),name)+'.ts'));
    throw new Error(`Unexpected runtime dependency in visual smoke: ${name}`);
  };
  new Function('module','exports','require',output)(module,module.exports,fakeRequire);
  return module.exports;
}
const {zoomAroundPointer,zoomFactor,isZoomGesture}=load('src/webview/interaction.ts');
const {parseGitLog,layoutGitLanes}=load('src/shared/gitHistory.ts');
const {placeEdgeLabel}=load('src/webview/edgeLabels.ts');
const {focusedLaneLayout,calculateLayout,nodeSize}=load('src/webview/elkLayout.ts');
const {detailForZoom,detailForNode,createStructureIndex,summarizeStructure,scopeFrames}=load('src/shared/semanticVisuals.ts');
const {buildFlowLens,layoutFlowLens}=load('src/shared/flowLens.ts');
assert.deepEqual([.4,.7,1.3,2.0].map(z=>detailForZoom(z)),[0,1,2,3]);
assert.equal(detailForNode(2.2,false,false),2);
assert.equal(detailForNode(2.2,false,true),3);
assert.equal(detailForNode(.55,true,false),3);
const mk=(id,kind,parentId,line)=>({id,kind,name:id,qualifiedName:id,uri:'file:///agent.py',root:'/',module:'agent',moduleId:'m',parentId,range:{startLine:line,endLine:line+3},attributes:[],operations:[]});
const srcGraph={nodes:[mk('m','module',null,0),mk('cls','class','m',10),mk('exec','method','cls',15),mk('dep','function','m',30)],edges:[
 {id:'e1',source:'exec',target:'dep',kind:'calls',confidence:'resolved',evidence:[{uri:'file:///agent.py',range:{startLine:16,startCharacter:2,endLine:16,endCharacter:9}}]},
 {id:'e2',source:'dep',target:'exec',kind:'calls',confidence:'resolved',evidence:[]},
]};
assert.deepEqual(summarizeStructure(srcGraph.nodes[0],srcGraph).parts.map(p=>p.id),['cls','dep']);
const structureIndex=createStructureIndex(srcGraph);
assert.deepEqual(summarizeStructure(srcGraph.nodes[0],srcGraph,18,structureIndex),summarizeStructure(srcGraph.nodes[0],srcGraph));
assert.deepEqual(summarizeStructure(srcGraph.nodes[1],srcGraph).parts.map(p=>p.id),['exec']);
assert.equal(scopeFrames([{id:'a',uri:'a',x:0,y:0,width:50,height:50},{id:'b',uri:'a',x:80,y:70,width:50,height:50}]).length,1);
const model=buildFlowLens(srcGraph,'calls','exec');
assert.equal(model.inboundTotal,1);assert.equal(model.outboundTotal,1);
const geometry=layoutFlowLens(model);
assert.equal(geometry.ribbons.length,2);
assert(geometry.ribbons.every(r=>r.thickness>0&&r.path.endsWith(' Z')));
const prev={x:120,y:-80,zoom:1.1},at={x:300,y:250},now=zoomAroundPointer(prev,at,1.4);
assert(Math.abs((at.x-prev.x)/prev.zoom-(at.x-now.x)/now.zoom)<1e-8);
assert(Math.abs((at.y-prev.y)/prev.zoom-(at.y-now.y)/now.zoom)<1e-8);
assert(zoomFactor(-120)>1);
assert(isZoomGesture({ctrlKey:true,metaKey:false}));
assert(!isZoomGesture({ctrlKey:false,metaKey:false}));
const a='a'.repeat(40),b='b'.repeat(40),c='c'.repeat(40);
const commits=parseGitLog(`${a}\x1f${b} ${c}\x1fMerge\x1fAda\x1f2026-11-19T00:00:00Z\x1fHEAD -> main\x1e`);
assert.equal(commits.length,1);
assert.equal(layoutGitLanes(commits)[0].segments.filter(s=>s.active).length,2);
const placed=placeEdgeLabel({x:0,y:120},{x:480,y:120},[{x:170,y:70,width:135,height:120}]);
assert(placed);
assert(placed.x<170-48||placed.x>305+48||placed.y<70-24||placed.y>190+24);
const node=(id,uri,line)=>({id,kind:'function',name:id,uri,range:{startLine:line},attributes:[],operations:[]});
const graph={nodes:[node('first','file:///agent.py',0),node('second','file:///agent.py',100),node('caller','file:///api.py',0)],edges:[{id:'e',source:'caller',target:'first'}]};
const state={focusedFile:'file:///agent.py',pinned:{first:{x:888,y:777}},manualPositions:{},expanded:['first'],zoom:1,selectedNode:null};
const pos=focusedLaneLayout(graph,state);
assert.equal(pos.first.x,pos.second.x);
assert(pos.second.y>=pos.first.y+nodeSize(graph.nodes[0],state).height);
assert(pos.caller.x<pos.first.x);
(async()=>{
  const layout=await calculateLayout(graph,state);
  assert.deepEqual(layout.first,{x:888,y:777});
  console.log('V3/V4 visual contracts: PASS (wheel, Git lanes, file focus, structure tiers, Sankey values and geometry)');
})().catch(error=>{console.error(error);process.exitCode=1;});
