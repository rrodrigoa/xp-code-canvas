import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const gitExec=promisify(execFile);
import type {SourceGraph} from '../../shared/types';
import type {ReviewAction,ReviewPR,ReviewScope,ReviewSnapshot,ReviewThread} from '../../review/reviewTypes';
import {LocalReviewNotes} from './LocalReviewNotes';
import {ReviewCognitionService} from './ReviewCognitionService';
import type {CognitionAction} from '../../review/reviewReasoning';
import {GitReviewEngine} from './GitReviewEngine';
import {GitHubReviewClient} from './GitHubReviewClient';

export class ReviewCoordinator {
  private readonly notes:LocalReviewNotes;
  private readonly cognition:ReviewCognitionService;
  private readonly engine:GitReviewEngine;
  private readonly github=new GitHubReviewClient();
  private current?:ReviewSnapshot;
  constructor(context:vscode.ExtensionContext){this.notes=new LocalReviewNotes(context.workspaceState);this.cognition=new ReviewCognitionService(context.workspaceState);this.engine=new GitReviewEngine(context,this.notes);}
  get snapshot():ReviewSnapshot|undefined{return this.current;}
  private async revisionFingerprint(review:ReviewSnapshot):Promise<string> {
    if(review.head!=='WORKTREE'&&review.head!=='INDEX')return `${review.baseline}:${review.head}`;
    const hash=crypto.createHash('sha256').update(review.head).update(review.baseline);
    for(const node of [...review.graph.nodes].sort((a,b)=>a.id.localeCompare(b.id)))
      hash.update(node.id).update(node.change??'').update(node.contentHash??'').update(node.structuralHash??'');
    const root=vscode.workspace.workspaceFolders?.find(folder=>folder.uri.scheme==='file');
    // Include tracked non-Python changes such as README/config/test files. Local
    // editor buffers are authoritative; staged content uses Git's indexed blob IDs.
    for(const file of [...review.files].sort((a,b)=>a.path.localeCompare(b.path)).slice(0,200)) {
      hash.update(file.path).update(file.status);
      const parts=file.path.split('/');
      if(!root||parts.some(p=>!p||p==='.'||p==='..'||p.includes('\\')))continue;
      try {
        if(review.head==='INDEX') {
          const result=await gitExec('git',['ls-files','--stage','--',file.path],{
            cwd:root.uri.fsPath,shell:false,windowsHide:true,timeout:3000,maxBuffer:4096});
          hash.update(result.stdout);
        }else{
          const uri=vscode.Uri.joinPath(root.uri,...parts);
          const opened=vscode.workspace.textDocuments.find(d=>d.uri.toString()===uri.toString());
          if(opened){const text=opened.getText();hash.update(text.length<=1_000_000?text:'oversized-buffer');}
          else{const stat=await vscode.workspace.fs.stat(uri);
            if(stat.size<=1_000_000)hash.update(await vscode.workspace.fs.readFile(uri));
            else hash.update(`large:${stat.size}:${stat.mtime}`);
          }
        }
      }catch {hash.update('missing-or-inaccessible');}
    }
    return hash.digest('hex');
  }
  async begin(scope:ReviewScope,live:SourceGraph,reference?:string):Promise<ReviewSnapshot>{
    let pr:ReviewPR|undefined;
    if(scope==='pr'){
      const match=/^([\w.-]+)\/([\w.-]+)#([1-9]\d*)$/.exec(reference?.trim()??'');
      if(!match)throw Error('Enter a pull request as owner/repository#number, e.g. org/project#123');
      pr=await this.github.getPR(match[1],match[2],Number(match[3]));
    }
    const result=await this.engine.open(scope,live,{base:scope==='branch'?reference:undefined,pr});
    if(pr){
      try{result.threads=[...result.threads,...await this.github.threads(pr)];}
      catch(error){result.message=[result.message,`GitHub comments unavailable: ${String(error)}`].filter(Boolean).join(' · ');}
    }
    result.reviewedFiles=this.notes.listReviewed(result.reviewKey);
    result.cognition=this.cognition.load(result.reviewKey,await this.revisionFingerprint(result));
    this.current=result;return result;
  }
  close():void{this.current=undefined;}
  async reason(action:CognitionAction):Promise<ReviewSnapshot>{
    if(!this.current)throw Error('Open a review first');
    this.current.cognition=await this.cognition.apply(this.current.reviewKey,this.current.cognition?.head ?? (await this.revisionFingerprint(this.current)),action);
    return {...this.current};
  }
  private findThread(id:string):ReviewThread {
    const thread=this.current?.threads.find(t=>t.id===id);
    if(!thread)throw Error('Review thread not found. Refresh the review to obtain current identifiers.');
    return thread;
  }
  async act(action:ReviewAction):Promise<ReviewSnapshot>{
    const current=this.current;if(!current)throw Error('Open a review before using comment actions');
    if(action.action==='add'||action.action==='reply'||action.action==='resolve'||action.action==='reopen'||action.action==='delete'){
      const locals=await this.notes.apply(current.reviewKey,action);
      current.threads=[...locals,...current.threads.filter(t=>t.origin==='github')];
    }else if(action.action==='markReviewed'||action.action==='unmarkReviewed'){
      if(!current.files.some(f=>f.path===action.path))throw Error('File is not part of this review');
      current.reviewedFiles=await this.notes.markReviewed(current.reviewKey,action.path,action.action==='markReviewed');
    }else if(action.action==='refresh'){
      if(current.pr){const remote=await this.github.threads(current.pr);
        current.threads=[...this.notes.list(current.reviewKey),...remote];}
    }else{
      if(!current.pr)throw Error('This action requires an opened GitHub pull request');
      const pr=current.pr;
      const remote=await this.github.getPR(pr.owner,pr.repo,pr.number);
      if(remote.headSha!==pr.headSha)throw Error('PR head changed since review opened; refresh before publishing comments or approval.');
      if(action.action==='githubSubmit')await this.github.submit(pr,action.event,action.body);
      else if('threadId' in action){
        const thread=this.findThread(action.threadId);
        if(action.action==='githubReply'){
          if(thread.origin!=='github'||!thread.replyToId)throw Error('Cannot reply: GitHub review comment is unavailable');
          await this.github.reply(pr,thread.replyToId,action.body);
        }else if(action.action==='githubResolve'||action.action==='githubReopen'){
          if(thread.origin!=='github'||!thread.remoteId)throw Error('This thread is not published on GitHub');
          await this.github.resolve(thread.remoteId,action.action==='githubResolve');
        }else if(action.action==='githubEdit'||action.action==='githubDelete'){
          if(thread.origin!=='github')throw Error('Only GitHub comments can be edited on GitHub');
          const item=thread.comments.find(c=>c.id===action.commentId);
          if(!item)throw Error('Remote comment not found');
          // REST comment ids are numeric; GraphQL ids are opaque. Expose numeric databaseIds in the client.
          const number=/^db:(\d+)$/.exec(item.id)?.[1];
          if(!number)throw Error('This comment cannot be edited without a REST database id');
          if(action.action==='githubEdit')await this.github.edit(pr,Number(number),action.body??'');
          else await this.github.delete(pr,Number(number));
        }else if(action.action==='githubPost'){
          if(thread.origin!=='local')throw Error('Already published');
          const target=thread.target;
          if(thread.publishedUrl)throw Error('This local review note was already published to GitHub');
          const relative=target.uri?vscode.workspace.asRelativePath(vscode.Uri.parse(target.uri),false).replace(/\\/g,'/'):'';
          const body=thread.comments.map((c,i)=>i===0?c.body:`Reply ${i+1}: ${c.body}`).join('\n\n---\n\n');
          // GitHub requires the line to be part of the PR diff. Never manufacture a diff line.
          if(target.line===undefined||!target.uri){
            const context=target.qualifiedName??target.nodeId??target.edgeId??'Architecture';
            const url=await this.github.postGeneralComment(pr,`**Architecture review · ${context}**\n\n${body}`);
            await this.notes.markPublished(current.reviewKey,thread.id,url);
          }else{
            if(!current.analysisAvailable)throw Error('Fetch/check out the PR source to validate the comment anchor before publishing');
            await this.github.postThread(pr,relative,target.line+1,body,target.side??'RIGHT');
            await this.notes.apply(current.reviewKey,{action:'delete',threadId:thread.id});
          }
        }
      }
      current.threads=[...this.notes.list(current.reviewKey),...await this.github.threads(pr)];
    }
    return {...current,threads:[...current.threads]};
  }
}
