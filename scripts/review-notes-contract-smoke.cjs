/* Runs the actual local Memento note store with a deterministic fake VS Code workspaceState. */
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const {execFileSync}=require('node:child_process');
let ts;try{ts=require('typescript');}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
function load(file,fakes={}){
  const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const target=new Module(file,module);target.filename=path.resolve(file);target.paths=module.paths;
  const original=target.require.bind(target);
  target.require=id=>id==='vscode'?{}:Object.prototype.hasOwnProperty.call(fakes,id)?fakes[id]:original(id);
  target._compile(compiled,target.filename);return target.exports;
}
const notesPath='src/extension/review/LocalReviewNotes.ts';
const projection=load('src/review/reviewProjection.ts');
const {LocalReviewNotes}=load(notesPath,{'../../review/reviewProjection':projection});
const memory=new Map();const memento={get:(key,defaultValue)=>memory.get(key)??defaultValue,update:async(key,value)=>{memory.set(key,value);}};
(async()=>{
  const notes=new LocalReviewNotes(memento);
  assert.equal(notes.list('review-1').length,0);
  const threads=await notes.apply('review-1',{action:'add',target:{nodeId:'agent.execute',uri:'file:///repo/agent.py',line:12},body:'Does this break the caller?'});
  assert.equal(threads.length,1);const id=threads[0].id;
  await notes.apply('review-1',{action:'reply',threadId:id,body:'Regression test required'});
  assert.equal(notes.list('review-1')[0].comments.length,2);
  await notes.apply('review-1',{action:'resolve',threadId:id});assert.equal(notes.list('review-1')[0].status,'resolved');
  await notes.apply('review-1',{action:'reopen',threadId:id});assert.equal(notes.list('review-1')[0].status,'open');
  await notes.markReviewed('review-1','agent.py',true);assert.deepEqual(notes.listReviewed('review-1'),['agent.py']);
  await notes.markPublished('review-1',id,'https://github.com/org/repo/pull/3#issuecomment-9');assert.equal(notes.list('review-1')[0].isDraft,false);
  const afterReload=new LocalReviewNotes(memento);assert.equal(afterReload.list('review-1')[0].comments.length,2);
  assert.equal(afterReload.list('review-2').length,0);
  await notes.apply('review-1',{action:'delete',threadId:id});assert.equal(notes.list('review-1').length,0);
  console.log('PASS: local review comments, replies, resolve/reopen, marked-files, publish metadata, isolation and persistence');
})().catch(error=>{console.error(error);process.exitCode=1});
