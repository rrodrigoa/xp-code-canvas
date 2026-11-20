/** Deterministic local Git source snapshot service; no checkout, no execution of project code. */
import * as vscode from 'vscode';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { TextInput } from './adapters/PythonWorkerClient';
import { parseGitTree, parseGitIndex, type GitBlob } from '../core/graph/GitTree';
const exec = promisify(execFile);
const MAX_BLOB_BYTES = 16 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 128 * 1024 * 1024;

function safeRevision(value:string):string {
  if(!value || value.length>120 || value.startsWith('-') || value.includes('..') || !/^[\w./~^{}-]+$/.test(value)) {
    throw Error('Invalid Git revision; choose HEAD, HEAD~1, a branch, or a commit hash');
  }
  return value;
}
async function git(root:string,...args:string[]):Promise<string> {
  const result=await exec('git',args,{cwd:root,shell:false,timeout:10000,maxBuffer:16*1024*1024,windowsHide:true});
  return result.stdout;
}
/** One bounded cat-file --batch process for many blobs, instead of one Git process per file. */
async function readBlobs(root:string, blobs:GitBlob[]):Promise<Map<string,string>> {
  const unique=[...new Set(blobs.map(b=>b.oid))];
  if(!unique.length) return new Map();
  const child=spawn('git',['cat-file','--batch'],{cwd:root,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  const chunks:Buffer[]=[];
  let bytes=0;
  let error='';
  const outcome=new Promise<Buffer>((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(Error('Git batch timed out'));},30000);
    child.stdout.on('data',(chunk:Buffer)=>{
      bytes+=chunk.length;
      if(bytes>MAX_SNAPSHOT_BYTES+unique.length*100){child.kill();return;}
      chunks.push(chunk);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data',(piece:string)=>error=(error+piece).slice(-2048));
    child.on('error',e=>{clearTimeout(timer);reject(e);});
    child.on('close',code=>{
      clearTimeout(timer);
      if(code!==0||bytes>MAX_SNAPSHOT_BYTES+unique.length*100) reject(Error(`Git batch failed (${code}): ${error || 'size budget exceeded'}`));
      else resolve(Buffer.concat(chunks));
    });
  });
  child.stdin.end(unique.join('\n')+'\n');
  const response=await outcome;
  const decoded=new Map<string,string>();
  let cursor=0;
  for(const requested of unique) {
    const end=response.indexOf(10,cursor);
    if(end===-1)throw Error('Truncated git cat-file header');
    const header=response.toString('ascii',cursor,end);
    cursor=end+1;
    const match=/^([a-f0-9]{40,64}) blob (\d+)$/.exec(header);
    if(!match || match[1]!==requested)throw Error('Unexpected object in Git batch');
    const size=Number(match[2]);
    if(!Number.isSafeInteger(size)||size>MAX_BLOB_BYTES)throw Error('Git source file exceeds maximum allowed blob size');
    if(cursor+size>=response.length)throw Error('Truncated Git blob');
    const content=new TextDecoder('utf-8',{fatal:true}).decode(response.subarray(cursor,cursor+size));
    decoded.set(requested,content);
    cursor+=size+1;
  }
  return decoded;
}

export async function snapshotGit(baseline:string,maxFiles=20000):Promise<TextInput[]> {
  const roots=vscode.workspace.workspaceFolders ?? [];
  const documents:TextInput[]=[];
  for(const folder of roots) {
    if(folder.uri.scheme!=='file') continue;
    const root=folder.uri.fsPath;
    const index=baseline==='INDEX';
    const revision=index?null:safeRevision(baseline);
    if(revision) await git(root,'rev-parse','--verify',`${revision}^{commit}`);
    const listing=await git(root,...(index?['ls-files','--stage','-z']:['ls-tree','-rz','--full-tree',revision!]));
    const tracked=index?parseGitIndex(listing):parseGitTree(listing);
    if(documents.length+tracked.length>maxFiles)throw Error(`Git snapshot contains more than ${maxFiles} Python files; narrow the project or increase the configured bound`);
    const contents=await readBlobs(root,tracked);
    for(const blob of tracked) {
      const content=contents.get(blob.oid);
      if(content===undefined)continue;
      documents.push({uri:vscode.Uri.joinPath(folder.uri,...blob.path.split('/')).toString(),
        root:blob.path.startsWith('src/') ? vscode.Uri.joinPath(folder.uri,'src').toString() : folder.uri.toString(),text:content,version:0});
    }
  }
  return documents;
}
