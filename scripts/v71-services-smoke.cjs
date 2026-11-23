const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),Module=require('node:module'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'xp-v71-services-'));
const fixture=path.join(temp,'repo');fs.mkdirSync(fixture);const python=path.join(fixture,'agent.py');
fs.writeFileSync(python,'def run():\n    return 1\n');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
let worktreeText=fs.readFileSync(python,'utf8'),edits=0;
class Range{constructor(a,b,c,d){this.start={line:a,character:b};this.end={line:c,character:d};this.isEmpty=a===c&&b===d;}}
const off=(text,p)=>{const lines=text.split('\n');return lines.slice(0,p.line).reduce((a,l)=>a+l.length+1,0)+p.character;};
const vscode={EndOfLine:{LF:1,CRLF:2},Uri:{parse:uri=>({scheme:'file',fsPath:uri.slice(7)})},Range,
  WorkspaceEdit:class{replace(_uri,range,replacement){this.range=range;this.replacement=replacement;}},workspace:{isTrusted:true,getWorkspaceFolder:uri=>uri.fsPath.startsWith(fixture)?{uri:{scheme:'file',fsPath:fixture}}:undefined,
    openTextDocument:async()=>({eol:1,getText:range=>range===undefined?worktreeText:worktreeText.slice(off(worktreeText,range.start),off(worktreeText,range.end)),validateRange:r=>r}),
    applyEdit:async edit=>{edits++;worktreeText=worktreeText.slice(0,off(worktreeText,edit.range.start))+edit.replacement+worktreeText.slice(off(worktreeText,edit.range.end));return true;}}};
const originalLoad=Module._load;Module._load=function(req,...args){if(req==='vscode')return vscode;return originalLoad.call(this,req,...args);};
function compile(file){const source=fs.readFileSync(path.join(root,file),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},fileName:file}).outputText;
const filename=path.join(temp,path.basename(file).replace('.ts','.js'));fs.writeFileSync(filename,js);return require(filename);}
(async()=>{try{
  const {InlineSourceEditService}=compile('src/extension/services/InlineSourceEditService.ts');
  const service=new InlineSourceEditService();let symbol={id:'run',uri:'file://'+python,kind:'function',range:{startLine:0,startCharacter:0,endLine:1,endCharacter:12},contentHash:hash(worktreeText)};
  const good=await service.apply(symbol,{nodeId:'run',expectedHash:symbol.contentHash,originalSource:'def run():\n    return 1',updatedSource:'def run():\n    return 2'});
  assert.equal(good.ok,true);assert.match(worktreeText,/return 2/);assert.equal(edits,1);
  const conflict=await service.apply(symbol,{nodeId:'run',expectedHash:symbol.contentHash,originalSource:'def run():\n    return 1',updatedSource:'def run():\n    return 3'});
  assert.equal(conflict.ok,false);assert.equal(edits,1);
  const old=await service.apply({...symbol,baselineOnly:true},{nodeId:'run',expectedHash:symbol.contentHash,originalSource:'anything',updatedSource:'pass'});
  assert.equal(old.ok,false);assert.equal(edits,1);
  // Real Git baseline diff: read HEAD, compare to unsaved document snapshot, return changed line numbers.
  for(const args of [['init','-q'],['config','user.email','test@example.org'],['config','user.name','Unit Test']])execFileSync('git',args,{cwd:fixture});
  // HEAD refers to the original text on disk; edit remains unsaved in VS Code mock.
  execFileSync('git',['add','agent.py'],{cwd:fixture});execFileSync('git',['commit','-qm','baseline'],{cwd:fixture});
  const {ReviewNodeDiffService}=compile('src/extension/review/ReviewNodeDiffService.ts');
  symbol={...symbol,contentHash:hash(worktreeText)};
  const overlay=await new ReviewNodeDiffService().lines(symbol,{baseline:'HEAD',files:[{path:'agent.py',status:'modified'}]});
  assert.deepEqual(overlay.addedLines,[1]);assert.ok(overlay.removedCount>=1);assert.equal(overlay.baseline,'HEAD');
  console.log('V7.1 guarded WorkspaceEdit and real Git line-overlay smoke PASS');
}finally{Module._load=originalLoad;fs.rmSync(temp,{recursive:true,force:true});}})().catch(err=>{console.error(err);process.exit(1);});
