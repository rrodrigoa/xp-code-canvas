/** Dependency-light verification of the V6.1 large graph recovery algorithm. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/webview/layout/LayoutOrchestrator.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
const requireStub=name=>{
 if(name==='../elkLayout')return {calculateLayout:async()=>({}),nodeSize:()=>({width:320,height:150})};
 if(name==='../../shared/spatialGraph')return {};
 throw Error('Unexpected dependency '+name);
};
new Function('module','exports','require',compiled)(mod,mod.exports,requireStub);
const {spreadLayout}=mod.exports;
const graph={nodes:Array.from({length:584},(_,i)=>({id:String(i),uri:`test${Math.floor(i/40)}.py`,range:{startLine:i%40}})),edges:[]};
const positions=spreadLayout(graph,()=>({width:320,height:150}),graph.nodes[0].uri);
assert.equal(Object.keys(positions).length,584);
assert.ok(new Set(Object.values(positions).map(p=>p.x)).size>15);
assert.ok(new Set(Object.values(positions).map(p=>p.y)).size<35);
assert.equal(new Set(Object.values(positions).map(p=>`${p.x}:${p.y}`)).size,584);
console.log('PASS: 584-symbol spread: non-overlapping two-dimensional geometry');

const navSource=fs.readFileSync(path.join(__dirname,'../src/shared/sourceNavigation.ts'),'utf8');
const navCompiled=ts.transpileModule(navSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const nav={exports:{}};
new Function('module','exports','require',navCompiled)(nav,nav.exports,()=>{throw Error('navigation helper unexpectedly imported a dependency');});
const span={startLine:6,startCharacter:4,endLine:9,endCharacter:12};
assert.equal(nav.exports.cursorWithinSymbol({line:8,character:17},span),true);
assert.equal(nav.exports.cursorWithinSymbol({line:6,character:0},span),true);
assert.equal(nav.exports.cursorWithinSymbol({line:10,character:0},span),false);
assert.equal(nav.exports.cursorWithinSymbol({line:9,character:13},span),false);
console.log('PASS: edit-cursor guard permits selected UTF-16 offsets, rejects out-of-range source positions');
