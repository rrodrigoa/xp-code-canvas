import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { parseBlamePorcelain, summarizeBlame, type BlameResult } from '../../shared/blame';
import type { GraphNode } from '../../shared/types';
const exec=promisify(execFile);

/** Git's HEAD snapshot is the only attribution basis; never map it onto edited source lines. */
export class GitBlameService {
  private readonly cache=new Map<string,BlameResult>();
  async get(node:GraphNode):Promise<BlameResult> {
    const unsupported=(status:BlameResult['status'],message:string):BlameResult=>({nodeId:node.id,sourceHash:node.contentHash,status,basis:'HEAD',message,lines:[]});
    if(!vscode.workspace.isTrusted)return unsupported('unavailable','Git blame requires a trusted workspace');
    const uri=vscode.Uri.parse(node.uri);
    if(uri.scheme!=='file')return unsupported('unavailable','Git blame is available for local files only');
    const folder=vscode.workspace.getWorkspaceFolder(uri);
    if(!folder)return unsupported('unavailable','File is not inside the current workspace');
    const options={cwd:folder.uri.fsPath,windowsHide:true,shell:false,timeout:12000,maxBuffer:12*1024*1024};
    try {
      const {stdout:repoText}=await exec('git',['rev-parse','--show-toplevel'],options);
      const repo=path.resolve(repoText.trim());
      const file=path.resolve(uri.fsPath);
      const relative=path.relative(repo,file).replace(/\\/g,'/');
      if(!relative||relative.startsWith('..')||path.isAbsolute(relative))return unsupported('unavailable','File is outside this Git repository');
      const gitOpts={...options,cwd:repo};
      // -- separates revisions from paths. Never interpolate a user-supplied value into a shell.
      const {stdout:tracked}=await exec('git',['ls-files','--error-unmatch','--',relative],gitOpts).catch(()=>({stdout:''}));
      if(!tracked.trim())return unsupported('untracked','File is not tracked in Git HEAD');
      const document=await vscode.workspace.openTextDocument(uri);
      // HEAD matches only if both the disk and VS Code buffer are clean.
      const {stdout:dirty}=await exec('git',['status','--porcelain=v1','--untracked-files=no','--',relative],gitOpts);
      if(dirty.trim()||document.isDirty||node.stale||(node.contentHash&&crypto.createHash('sha256').update(document.getText()).digest('hex')!==node.contentHash))return unsupported('dirty','Working tree or editor differs from HEAD; blame line mapping is deliberately disabled');
      const {stdout:head}=await exec('git',['rev-parse','HEAD'],gitOpts);
      const headHash=head.trim();
      const key=`${repo}|${relative}|${headHash}|${node.range.startLine}:${node.range.endLine}|${node.contentHash}`;
      const cached=this.cache.get(key);
      if(cached)return cached;
      const start=Math.max(1,node.range.startLine+1);
      const end=Math.max(start,node.range.endLine+1);
      // Restrict output before spawning Git: a node may contain a huge generated file.
      if(end-start>6000)return unsupported('unavailable','Source span exceeds the 6,000-line blame limit');
      const {stdout}=await exec('git',['blame','--line-porcelain','--follow','-L',`${start},${end}`,'HEAD','--',relative],gitOpts);
      const lines=parseBlamePorcelain(stdout);
      const result:BlameResult={nodeId:node.id,sourceHash:node.contentHash,status:'clean',basis:'HEAD',lines,summary:summarizeBlame(lines)};
      if(this.cache.size>160)this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key,result);
      return result;
    } catch(error) {
      return unsupported('unavailable',error instanceof Error ? error.message.slice(0,220) : String(error));
    }
  }
}
