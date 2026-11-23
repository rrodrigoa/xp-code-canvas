/* Dependency-light executable contract smoke for shared V8.1 graph visualization.
 * Full Three.js/React/VS Code runtime gates must still execute after npm install. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript');
function loadPure(file){const code=fs.readFileSync(file,'utf8');
 const js=ts.transpileModule(code,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};new Function('exports','require',js)(exports,require);return exports;
}
const spatial=loadPure('src/shared/spatialGraph.ts'),styles=loadPure('src/shared/visualLanguage.ts');
const graph=(n)=>({schema:1,nodes:Array.from({length:n},(_,i)=>({id:`n${i.toString().padStart(5,'0')}`,root:'file:///repo',uri:`file:///repo/pkg${Math.floor(i/20)}/m${Math.floor(i/5)}.py`,
  moduleId:`module${Math.floor(i/5)}`,kind:i%5===0?'class':'method',parentId:i%5?`n${String(i-i%5).padStart(5,'0')}`:null,
  range:{startLine:i,endLine:i+10},change:i%17===0?'MODIFIED':i%17===1?'IMPACTED':undefined})),
 edges:Array.from({length:n-1},(_,i)=>({id:`edge${i}`,source:`n${String(i).padStart(5,'0')}`,target:`n${String(i+1).padStart(5,'0')}`,kind:i%3===0?'inherits':'calls',count:i%3+1})),diagnostics:[]});
const g=graph(584),started=performance.now();
for(const kind of Object.keys(spatial.SPATIAL_LAYOUT_NAMES)){
 const opts={focusId:'n00025',maxIterations:3};
 const p=spatial.layoutSpatialGraph(g,kind,opts);
 assert.equal(Object.keys(p).length,584,kind);
 assert(Object.values(p).every(point=>Object.values(point).every(Number.isFinite)),kind);
 assert.deepEqual(spatial.layoutSpatialGraph({...g,nodes:[...g.nodes].reverse(),edges:[...g.edges].reverse()},kind,opts),p,kind);
 console.log('V8.1 spatial mode',kind,'584 nodes passed');
}
assert.equal(new Set(spatial.classPartitions(g).values()).size,117);
const classParts=spatial.classPartitions(g);assert.equal(classParts.get('n00002'),classParts.get('n00000'));
assert.equal(spatial.communityPartitions(g).size,584);
const reviewParts=spatial.reviewPartitions(g);assert.equal(reviewParts.get('n00000'),'1-direct:MODIFIED');
assert.equal(reviewParts.get('n00001'),'2-potential-impact');
assert.equal(reviewParts.get('n00002'),'3-unchanged-context');
for(const kind of ['class','community','review','folder','hub']){
 assert.equal(Object.keys(spatial.flattenSpatialLayout(g,kind)).length,584);
}
const huge=graph(5000),p=spatial.layoutSpatialGraph(huge,'class');assert.equal(Object.keys(p).length,5000);
const inher=styles.edgeAppearance({kind:'inherits',confidence:'resolved'});
const impl=styles.edgeAppearance({kind:'realizes',confidence:'resolved'});
assert.equal(inher.dashed,false);assert.equal(inher.marker,'hollow-triangle');
assert.equal(impl.dashed,true);assert.equal(impl.marker,'hollow-triangle');
for(const kind of ['imports','calls','creates','realizes','references','contains']){
 assert(styles.edgeAppearance({kind,confidence:'resolved'}).dashed);
}
assert(styles.edgeAppearance({kind:'inherits',confidence:'ambiguous'}).dashed);
assert.equal(styles.edgeAppearance({kind:'calls',confidence:'resolved',change:'REMOVED'}).colorToken,'--xp-removed');
assert(styles.spatialDetail(3000,[.64,1.13,1.88])<styles.spatialDetail(70,[.64,1.13,1.88]));
console.log('V8.1 shared visual semantics + 584/5000 symbols passed in',Math.round(performance.now()-started),'ms');

// Guard selected source cursor from the 3D syntax-highlighted inspector.
const cursorMod=loadPure('src/webview/components/spatial/spatialSourceCursor.ts');
const node={};const selection={focusNode:node,focusOffset:2};
const root={contains:n=>n===node,ownerDocument:{createRange:()=>({selectNodeContents(){},setEnd(){},toString(){return 'def f():\n    result';}})}};
assert.deepEqual(cursorMod.spatialSourceCursor(root,selection,7,4),{line:8,character:10});
