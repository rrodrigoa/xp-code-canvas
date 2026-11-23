/* Dependency-light executable V7.2 contract tests. Requires the repo TypeScript dev dependency. */
const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const ts=require('typescript');
function load(relative){const filename=path.resolve(__dirname,'..',relative);const source=fs.readFileSync(filename,'utf8');
  const code=ts.transpileModule(source,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};const wrap=vm.runInThisContext('(function(require,module,exports){'+code+'\n})',{filename});
  wrap(require,m,m.exports);return m.exports;}
const {buildComparison,comparisonFrame,evidenceSummary}=load('src/review/changeCognition.ts');
const {emptyCognition,applyCognition,recoverCognition,reviewCoverage}=load('src/review/reviewReasoning.ts');
const range={startLine:0,startCharacter:0,endLine:8,endCharacter:0};
const node=(i,hash)=>({id:`n${i}`,kind:'function',name:`n${i}`,qualifiedName:`n${i}`,uri:`file:///repo/m${Math.floor(i/10)}.py`,root:'file:///repo',module:'repo',moduleId:'root',parentId:null,range,selectionRange:range,version:1,visibility:'public',decorators:[],signature:`def n${i}():`,docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',structuralHash:hash,confidence:'resolved'});
const before={schema:1,nodes:Array.from({length:5000},(_,i)=>node(i,'old')),edges:[],diagnostics:[]};
const after={schema:1,nodes:Array.from({length:5000},(_,i)=>node(i,i%20===0?'new':'old')),edges:[],diagnostics:[]};
const model=buildComparison(before,after,'baseline','WORKTREE');
assert.equal(model.transformations.length,250);assert.equal(model.truncated,false);
const review={reviewKey:'x',scope:'working',title:'review',baseline:'HEAD',head:'WORKTREE',graph:{...after,nodes:[...after.nodes,{...node(5001,'gone'),baselineOnly:true,change:'REMOVED'}]},comparison:model,files:[{path:'tests/test_demo.py',status:'modified'}],threads:[],analysisAvailable:true,createdAt:''};
assert.equal(comparisonFrame(review,'before').nodes.length,5000);assert.equal(comparisonFrame(review,'after').nodes.length,5000);assert.equal(comparisonFrame(review,'delta').nodes.length,5001);
assert.equal(evidenceSummary(review).testExecution,'not-provided');
let s=emptyCognition('key','head1');s=applyCognition(s,{action:'status',key:'n0',status:'reviewed'});assert.equal(reviewCoverage(s,['n0','n1']).reviewed,1);
assert.equal(recoverCognition(s,'key','head2').records.n0.status,'stale');
console.log('V7.2 executable logic smoke: passed, 5,000 symbols, 250 changed structures, historical frames and stale review invalidation');
