/* Executable source-level V6 contracts. No network, React, or VS Code process required.
 * Does not replace the full Playwright + extension-host test suites. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const ts=require('typescript');
const base=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){
 const file=path.resolve(base,relative);if(cache.has(file))return cache.get(file).exports;
 const source=fs.readFileSync(file,'utf8');
 const output=ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const m={exports:{}};cache.set(file,m);
 function requireLocal(id){
  if(id==='elkjs/lib/elk.bundled.js')return {__esModule:true,default:class ELK{async layout(){return {children:[]};}}};
  if(id.startsWith('.')){const f=path.resolve(path.dirname(file),id);return load(path.relative(base,`${f}.ts`));}
  throw new Error(`unexpected external import: ${id}`);
 }
 new Function('module','exports','require',output)(m,m.exports,requireLocal);return m.exports;
}
const layout=load('src/webview/layout/LayoutOrchestrator.ts');
const edge=load('src/webview/graph/EdgeRoutingService.ts');
const ports=load('src/webview/graph/MemberPortProjection.ts');
const search=load('src/webview/navigation/symbolRanking.ts');
const graph={nodes:[{id:'focus',uri:'f',kind:'function',range:{startLine:1},attributes:[],operations:[],name:'focus',qualifiedName:'focus'},
  {id:'caller',uri:'a',kind:'function',range:{startLine:2},attributes:[],operations:[],name:'caller',qualifiedName:'caller'},
  {id:'dep',uri:'b',kind:'function',range:{startLine:3},attributes:[],operations:[],name:'dep',qualifiedName:'dep'}],
  edges:[{id:'e1',source:'caller',target:'focus',kind:'calls',confidence:'resolved',evidence:[]},
    {id:'e2',source:'focus',target:'dep',kind:'calls',confidence:'resolved',evidence:[]}],diagnostics:[],schema:1};
const positions=layout.investigationLayout(graph,'focus',()=>({width:280,height:140}));
assert(positions.caller.x<positions.focus.x&&positions.dep.x>positions.focus.x);
const placed=layout.settleMeasuredLayout([{id:'focus',x:100,y:0,width:250,height:220},
  {id:'other',x:100,y:90,width:250,height:180},{id:'far',x:850,y:30,width:260,height:140}],'focus');
assert(placed.other.y>=250);assert.deepEqual(placed.far,{x:850,y:30});
const labels=edge.allocateEdgeLabels([{id:'1',text:'calls',priority:2,start:{x:0,y:100},end:{x:700,y:100}},
 {id:'2',text:'calls',priority:1,start:{x:0,y:100},end:{x:700,y:100}}],[],2);
assert.equal(labels.length,2);
assert.notDeepEqual([labels[0].x,labels[0].y],[labels[1].x,labels[1].y]);
assert.notEqual(edge.portForRelationship('calls','source'),edge.portForRelationship('imports','source'));
assert.equal(ports.memberPortId('source','calls','my_method').startsWith('source-member-calls'),true);
const rawEdges=[{id:'a',source:'ma',target:'dep',kind:'calls',confidence:'resolved',evidence:[]},
 {id:'b',source:'mb',target:'dep',kind:'calls',confidence:'resolved',evidence:[]}];
const original={nodes:[{id:'cls',kind:'class'},{id:'ma',kind:'method',parentId:'cls'},
 {id:'mb',kind:'method',parentId:'cls'},{id:'dep',kind:'function'}],edges:rawEdges};
const shown={...original,nodes:original.nodes.filter(n=>n.id!=='ma'&&n.id!=='mb'),
 edges:rawEdges.map(e=>({...e,source:'cls',memberEdgeIds:[e.id]}))};
const bundled=edge.bundleProjectedEdges(shown.edges,.7);
assert.equal(bundled.length,1);
assert.equal(ports.projectMemberPorts({...shown,edges:bundled},original).edges.get('a').sourceHandle,'source-calls');

assert.deepEqual(search.rankSymbols([{id:'1',name:'fooBar',qualifiedName:'Agent.fooBar',uri:'a'},
  {id:'2',name:'foo',qualifiedName:'Agent.foo',uri:'b'}],'foo').map(n=>n.name),['foo','fooBar']);
const cards=Array.from({length:1500},(_,i)=>({id:`${i}`,x:70,y:145*i,width:260,height:170}));
const start=performance.now(),corrected=layout.settleMeasuredLayout(cards,null,20),duration=Math.round(performance.now()-start);
const sorted=Object.values(corrected).map(p=>p.y).sort((a,b)=>a-b);
assert(sorted.every((y,i)=>i===0||y>=sorted[i-1]+190));
console.log(`V6 visual algorithms PASS: investigation/change layout, measured collision settling, source-based ports, edge labels, ranked search, 1500 nodes (${duration}ms)`);
