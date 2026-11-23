import * as vscode from 'vscode';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as crypto from 'node:crypto';
import type {ReviewSnapshot} from '../../review/reviewTypes';
const exec=promisify(execFile);
/** Exposes immutable review snapshots to VS Code's NATIVE diff editor, never writing project files. */
export class ReviewDiffService implements vscode.TextDocumentContentProvider,vscode.Disposable {
  private readonly docs=new Map<string,string>();
  private readonly registration:vscode.Disposable;
  constructor(){this.registration=vscode.workspace.registerTextDocumentContentProvider('xp-canvas-review',this);}
  provideTextDocumentContent(uri:vscode.Uri):string{return this.docs.get(uri.toString())??'';}
  private virtual(content:string,label:string):vscode.Uri{
    const uri=vscode.Uri.from({scheme:'xp-canvas-review',path:'/'+crypto.randomUUID()+'/'+encodeURIComponent(label)});
    if(this.docs.size>24)this.docs.clear();this.docs.set(uri.toString(),content);return uri;
  }
  private async gitSource(root:string,ref:string,path:string,allowMissing=false):Promise<string>{
    if(ref==='EMPTY')return '';
    const lookup=ref==='INDEX'?`:${path}`:`${ref}:${path}`;
    try{const {stdout}=await exec('git',['show',lookup],{cwd:root,shell:false,windowsHide:true,timeout:10000,maxBuffer:2*1024*1024});return stdout;}
    catch(error){if(allowMissing)return '';throw Error(`Cannot read ${ref} version of ${path}: ${String(error).slice(0,300)}`);}
  }
  async open(review:ReviewSnapshot,path:string):Promise<void>{
    const file=review.files.find(f=>f.path===path);
    if(!file)throw Error('File not present in current review');
    const root=vscode.workspace.workspaceFolders?.find(f=>f.uri.scheme==='file');
    if(!root)throw Error('No local Git workspace');
    if(path.startsWith('/')||path.split('/').some(part=>part==='..'||part==='.')||path.includes('\\'))throw Error('Invalid review file path');
    const oldPath=file.oldPath??file.path;
    const before=await this.gitSource(root.uri.fsPath,review.baseline,oldPath,file.status==='added'||file.status==='untracked');
    const left=this.virtual(before,'before-'+path);
    let right:vscode.Uri;
    if(review.head==='WORKTREE'){
      right=vscode.Uri.joinPath(root.uri,...path.split('/'));
      // Keep the native source document and its unsaved changes authoritative.
      try{await vscode.workspace.openTextDocument(right);}catch{right=this.virtual('', 'missing-'+path);}
    }else{
      const after=await this.gitSource(root.uri.fsPath,review.head,path,file.status==='deleted');
      right=this.virtual(after,'after-'+path);
    }
    await vscode.commands.executeCommand('vscode.diff',left,right,`Code review · ${path}`,{preview:false});
  }
  dispose():void{this.registration.dispose();this.docs.clear();}
}
