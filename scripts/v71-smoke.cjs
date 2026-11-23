const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'xp-v71-'));
function compile(file){const text=fs.readFileSync(path.join(root,file),'utf8');const result=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},fileName:file});
const target=path.join(dir,file.replace(/\.tsx?$/,'.js'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,result.outputText);return target;}
try {
  const zoom=require(compile('src/shared/semanticZoom.ts'));
  const semantic=require(compile('src/shared/semanticVisuals.ts'));
  const atlas=require(compile('src/review/reviewAtlas.ts'));
  assert.deepEqual([.4,.8,1.4,2.1].map(x=>semantic.detailForZoom(x)),[0,1,2,3]);
  assert.deepEqual([.4,.8,1.4,2.1].map(x=>semantic.detailForZoom(x,false,[.9,1.6,2.4])),[0,0,1,2]);
  assert.equal(semantic.detailForNode(2.2,false,true,[.9,1.6,2.4]),2);
  assert.equal(semantic.detailForNode(2.5,false,true,[.9,1.6,2.4]),3);
  assert.equal(zoom.updateSemanticZoomStop([.6,1.1,1.8],1,99)[1],1.72);
  for(const val of [.28,.5,1,2.8])assert.ok(Math.abs(zoom.zoomFromTrackFraction(zoom.zoomTrackFraction(val))-val)<1e-10);
  const range={startLine:0,startCharacter:0,endLine:8,endCharacter:0};
  const node=(id,uri,change)=>({id,uri,change,range,kind:'function',qualifiedName:id,name:id});
  const graph={nodes:[node('foo','file:///src/foo.py','MODIFIED'),node('bar','file:///src/bar.py','ADDED'),node('caller','file:///src/use.py','IMPACTED')],
    edges:[{source:'foo',target:'bar',change:'ADDED',kind:'calls'},{source:'caller',target:'foo',kind:'calls'}]};
  const input={graph,files:[{path:'src/foo.py',status:'modified'},{path:'src/bar.py',status:'added'},{path:'README.md',status:'modified'},{path:'tests/test_foo.py',status:'added'}],threads:[]};
  const output=atlas.buildReviewAtlas(input);
  assert.equal(output.directCount,2);assert.equal(output.impactedCount,1);
  assert.equal(output.chapters.filter(x=>x.kind==='source').length,1);
  assert.equal(output.chapters.find(x=>x.kind==='source').relationshipChanges,1);
  assert.equal(output.docFiles[0].path,'README.md');
  assert.equal(output.testFiles[0].path,'tests/test_foo.py');
  // Scale test: changes partitioned into reviewable chapters rather than one giant list.
  const large={...input,graph:{nodes:Array.from({length:5000},(_,i)=>node(`n${i}`,`file:///src/f${i}.py`,'MODIFIED')),edges:[]},files:[],threads:[]};
  const start=performance.now(),result=atlas.buildReviewAtlas(large),ms=performance.now()-start;
  assert.equal(result.directCount,5000);assert.equal(result.chapters.filter(x=>x.kind==='source').length,5000);
  console.log(`V7.1 deterministic semantic zoom + Change Atlas smoke PASS; 5,000-symbol case ${ms.toFixed(1)}ms`);
} finally {fs.rmSync(dir,{recursive:true,force:true});}
