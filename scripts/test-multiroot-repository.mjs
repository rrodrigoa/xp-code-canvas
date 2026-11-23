import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fs.mkdtempSync(path.resolve('.validation-runtime/multiroot-'));
for(const name of ['one','two']){fs.mkdirSync(path.join(root,name));fs.writeFileSync(path.join(root,name,'agent.py'),'class Agent:\n    def execute(self):\n        return 1\n');}
const workspace=path.join(root,'validation.code-workspace');fs.writeFileSync(workspace,JSON.stringify({folders:[{path:'one'},{path:'two'}]}));
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','test:extension'],{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,GIT_CONFIG_COUNT:'0',XP_MULTIROOT_WORKSPACE:workspace}});
process.exitCode=result.status??1;
