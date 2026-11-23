/** Dependency-light build-independent smoke runner for 3D layout.
 * It uses the project's existing TypeScript transpiler and Node assert.
 * The full Vitest/Playwright suites remain separate release gates.
 */
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
const req=createRequire(import.meta.url);
let ts;
try{ts=req('typescript');}catch{if(!process.env.NODE_PATH)throw Error('Install npm devDependencies or set NODE_PATH for global TypeScript');ts=req(`${process.env.NODE_PATH}/typescript`);}
const content=readFileSync('src/shared/spatialGraph.ts','utf8');
const js=ts.transpileModule(content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('exports','require',js)(exports,req);
const nodes=Array.from({length:584},(_,i)=>({id:`n${i}`,uri:`file:///repo/pkg${Math.floor(i/24)}/f${i}.py`,root:'file:///repo',range:{startLine:1,endLine:(i%40)+5}}));
const edges=nodes.slice(1).map((n,i)=>({id:`e${i}`,source:nodes[i%13].id,target:n.id,kind:'calls',count:1}));
const graph={schema:1,nodes,edges,diagnostics:[]};
for(const kind of ['force','hub','folder','dependency','size']){
 const started=performance.now();const p=exports.layoutSpatialGraph(graph,kind,{focusId:'n12',maxIterations:8});
 assert.equal(Object.keys(p).length,584);
 assert(Object.values(p).every(v=>Object.values(v).every(Number.isFinite)));
 assert.deepEqual(exports.layoutSpatialGraph({...graph,nodes:[...nodes].reverse()},kind,{focusId:'n12',maxIterations:8}),p);
 console.log(`${kind}: 584 symbols, ${Math.round(performance.now()-started)}ms`);
}
const large={...graph,nodes:Array.from({length:5000},(_,i)=>({...nodes[i%584],id:`big-${i}`})),edges:[]};
const started=performance.now();const p=exports.layoutSpatialGraph(large,'folder');
assert.equal(Object.keys(p).length,5000);
console.log(`folder: 5000 symbols, ${Math.round(performance.now()-started)}ms`);
console.log('V8 deterministic spatial smoke checks passed.');
