import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const repository=path.resolve('.validation-runtime/temp/flask');
const revision='49943b5a94413a530761350f04e896f76e8d620e';
if(!fs.existsSync(path.join(repository,'.git'))){
 fs.mkdirSync(path.dirname(repository),{recursive:true});
 execFileSync('git',['clone','https://github.com/pallets/flask.git',repository],{stdio:'inherit'});
}
const git=(...args)=>execFileSync('git',['-C',repository,...args],{encoding:'utf8'}).trim();
if(git('status','--porcelain'))throw Error('Temporary Flask clone must be clean before integration testing');
if(git('rev-parse','HEAD')!==revision)execFileSync('git',['-C',repository,'checkout','--detach',revision],{stdio:'inherit'});
// Desktop launchers may strip empty GIT_CONFIG_VALUE_n variables while retaining
// their count. The isolated fixture uses its own repository configuration.
const env={...process.env,GIT_CONFIG_COUNT:'0',XP_REAL_REPO:repository,XP_EVIDENCE_DIR:path.resolve('test-results/real-repository')};
const npm=process.platform==='win32'?'npm.cmd':'npm';
const run=(args)=>{
 const result=spawnSync(npm,args,{env,stdio:'inherit',shell:process.platform==='win32'});
 if(result.status!==0)process.exit(result.status||1);
};
run(['run','test:extension']);
run(['exec','--','extest','setup-and-run','--config','extester.real.config.json']);
if(git('status','--porcelain'))throw Error('Integration testing left the temporary clone dirty');
