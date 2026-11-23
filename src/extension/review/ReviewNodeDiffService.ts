import * as vscode from 'vscode';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type {ReviewSnapshot} from '../../review/reviewTypes';
import type {GraphNode} from '../../shared/types';
import type {ReviewLineOverlay} from '../../shared/reviewLineOverlay';
const exec=promisify(execFile);
/** Green rows are lines added to the current document versus the selected Git
 * baseline. A replacement has both added and removed lines. This is static
 * line evidence, not a semantic or runtime explanation. */
function parseUnifiedZeroDiff(text:string,start:number,end:number){
  const added=new Set<number>();let removedCount=0;
  for(const match of text.matchAll(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/gm)){
    const newStart=Number(match[3]),newCount=match[4]===undefined?1:Number(match[4]);
    const oldCount=match[2]===undefined?1:Number(match[2]);
    const relevant=newCount?Math.max(newStart,start+1)<=Math.min(newStart+newCount-1,end+1):newStart>=start&&newStart<=end+2;
    if(!relevant)continue;
    removedCount+=Math.max(0,oldCount);
    for(let line=newStart;line<newStart+newCount;line++)if(line>=start+1&&line<=end+1)added.add(line-1);
  }
  return {addedLines:[...added].sort((a,b)=>a-b),removedCount};
}
const sha=(text:string)=>crypto.createHash('sha256').update(text).digest('hex');
export class ReviewNodeDiffService {
  async lines(node:GraphNode,review:ReviewSnapshot):Promise<ReviewLineOverlay> {
    if(!vscode.workspace.isTrusted||node.baselineOnly||node.stale)throw Error('Review line overlays require live, trusted source.');
    const uri=vscode.Uri.parse(node.uri),folder=vscode.workspace.getWorkspaceFolder(uri);
    if(uri.scheme!=='file'||!folder||folder.uri.scheme!=='file')throw Error('Only local Git-backed Python files can show line overlays.');
    const document=await vscode.workspace.openTextDocument(uri);
    const current=document.getText();
    if(node.contentHash!==sha(current))throw Error('Source differs from the review snapshot; use native diff to inspect this historical change.');
    const rel=path.relative(folder.uri.fsPath,uri.fsPath).replace(/\\/g,'/');
    if(!rel||rel.startsWith('../')||path.isAbsolute(rel)||rel.includes('\0'))throw Error('Invalid source path.');
    const base=review.baseline;
    if(base!=='EMPTY'&&base!=='INDEX'&&base!=='HEAD'&&!/^[0-9a-f]{7,64}$/i.test(base))throw Error('Historical baseline must be HEAD, INDEX, EMPTY, or a commit SHA.');
    let before='';
    try{
      const spec=base==='INDEX'?`:${rel}`:`${base}:${rel}`;
      if(base!=='EMPTY'){
        const {stdout}=await exec('git',['show',spec],{cwd:folder.uri.fsPath,encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:8*1024*1024});
        before=stdout;
      }
    }catch{
      if(!review.files.some(f=>f.path===rel&&['added','untracked'].includes(f.status)))throw Error('Could not read the baseline source for this file.');
    }
    const temp=await fs.mkdtemp(path.join(os.tmpdir(),'xp-uml-review-'));
    try{
      const oldFile=path.join(temp,'before.txt'),newFile=path.join(temp,'after.txt');
      await Promise.all([fs.writeFile(oldFile,before,'utf8'),fs.writeFile(newFile,current,'utf8')]);
      let diff='';
      try{const result=await exec('git',['diff','--no-index','--unified=0','--',oldFile,newFile],{cwd:folder.uri.fsPath,encoding:'utf8',windowsHide:true,shell:false,timeout:15000,maxBuffer:4*1024*1024});diff=result.stdout;}
      catch(e){const error=e as Error&{code?:number;stdout?:string};if(error.code!==1)throw e;diff=error.stdout??'';}
      const hunks=parseUnifiedZeroDiff(diff,node.range.startLine,node.range.endLine);
      return {nodeId:node.id,sourceHash:node.contentHash!,baseline:base,addedLines:hunks.addedLines,addedCount:hunks.addedLines.length,removedCount:hunks.removedCount};
    } finally {await fs.rm(temp,{recursive:true,force:true});}
  }
}
