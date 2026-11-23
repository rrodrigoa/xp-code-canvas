const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const fs=require('fs'),path=require('path');
let checked=0,failures=[];
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())visit(full);
  else if(/\.tsx?$/.test(entry.name)){
    const text=fs.readFileSync(full,'utf8');
    const sf=ts.createSourceFile(full,text,ts.ScriptTarget.ES2022,true,full.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    checked++;for(const d of sf.parseDiagnostics)failures.push(`${full}:${sf.getLineAndCharacterOfPosition(d.start).line+1}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
  }
}}
['src','tests'].forEach(visit);
console.log(`Parsed ${checked} TypeScript/TSX files, ${failures.length} errors`);
for(const f of failures)console.error(f);
if(failures.length)process.exit(1);
