const {execFileSync}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xp-review-'));
try{
  let ts;
  try{ts=require('typescript');}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
  const content=fs.readFileSync('src/review/reviewProjection.ts','utf8');
  const javascript=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  fs.mkdirSync(path.join(temp,'review'),{recursive:true});
  fs.writeFileSync(path.join(temp,'review/reviewProjection.js'),javascript);
  const {decorateReview,matchThreadToNodes,reviewMetrics}=require(path.join(temp,'review/reviewProjection.js'));
  function node(id,change,start=0,parentId=null){return {id,change,kind:'function',uri:'file:///repo/example.py',range:{startLine:start,endLine:start+5},parentId};}
  const graph={nodes:[node('changed','MODIFIED',0),node('caller','IMPACTED',20)],edges:[{id:'link',source:'caller',target:'changed',kind:'calls',change:'ADDED'}],diagnostics:[]};
  const review={graph,threads:[{id:'1',status:'open',target:{uri:'example.py',line:2},comments:[{id:'c',body:'Review this'}]}],files:[{path:'example.py',status:'modified'}]};
  const projection=decorateReview(review);assert(projection.direct.has('changed'));assert(projection.affected.has('caller'));
  assert.equal(projection.counts.get('changed').open,1);assert.equal(matchThreadToNodes(review.threads[0],graph)[0],'changed');
  assert.equal(reviewMetrics(review).linksChanged,1);
  console.log('PASS: review changed/impact projection, source-line anchors, badges and metrics');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
