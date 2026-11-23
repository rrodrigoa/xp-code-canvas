import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import type {ReviewAction,ReviewThread} from '../../review/reviewTypes';
import {validateTarget} from '../../review/reviewProjection';
const KEY='xpCodeCanvas.reviewThreads.v1';
const VIEWED='xpCodeCanvas.reviewedFiles.v1';
/** Local notes are independent of GitHub and not silently published or committed to the project. */
export class LocalReviewNotes {
  constructor(private readonly state:vscode.Memento){}
  list(reviewKey:string):ReviewThread[]{
    const entries=this.state.get<Record<string,ReviewThread[]>>(KEY,{})[reviewKey]??[];
    return entries.filter(t=>t.origin==='local'&&Array.isArray(t.comments)).slice(-1000);
  }
  listReviewed(reviewKey:string):string[]{return this.state.get<Record<string,string[]>>(VIEWED,{})[reviewKey]??[];}
  async markReviewed(reviewKey:string,path:string,reviewed:boolean):Promise<string[]>{
    if(!path||path.length>2048)throw Error('Invalid review file path');
    const all=this.state.get<Record<string,string[]>>(VIEWED,{});const next=new Set(all[reviewKey]??[]);
    if(reviewed)next.add(path);else next.delete(path);
    if(next.size>20000)throw Error('Review file selection limit exceeded');
    const values=[...next];await this.state.update(VIEWED,{...all,[reviewKey]:values});return values;
  }
  async markPublished(reviewKey:string,id:string,url:string):Promise<ReviewThread[]>{
    if(!/^https:\/\/github\.com\//.test(url))throw Error('Invalid GitHub comment URL');
    const all=this.state.get<Record<string,ReviewThread[]>>(KEY,{}),threads=this.list(reviewKey);
    const index=threads.findIndex(t=>t.id===id);if(index<0)throw Error('Local note not found');
    threads[index]={...threads[index],publishedUrl:url,isDraft:false};
    await this.state.update(KEY,{...all,[reviewKey]:threads});return threads;
  }
  async apply(reviewKey:string,action:ReviewAction):Promise<ReviewThread[]>{
    const all=this.state.get<Record<string,ReviewThread[]>>(KEY,{}),threads=[...this.list(reviewKey)];
    const now=new Date().toISOString();
    if(action.action==='add'){
      const body=action.body.trim();if(!body||body.length>16000)throw Error('Comment must be 1–16,000 characters');
      const target=validateTarget(action.target);
      threads.push({id:crypto.randomUUID(),origin:'local',status:'open',target,isDraft:true,
        comments:[{id:crypto.randomUUID(),author:'You (local)',body,createdAt:now}]});
    }else if(action.action==='reply'||action.action==='resolve'||action.action==='reopen'||action.action==='delete'){
      const index=threads.findIndex(t=>t.id===action.threadId);
      if(index<0)throw Error('Local review thread not found');
      if(action.action==='delete')threads.splice(index,1);
      else if(action.action==='resolve'||action.action==='reopen')threads[index]={...threads[index],status:action.action==='resolve'?'resolved':'open'};
      else if(action.action==='reply'){const body=action.body.trim();if(!body||body.length>16000)throw Error('Reply must be 1–16,000 characters');
        threads[index]={...threads[index],comments:[...threads[index].comments,{id:crypto.randomUUID(),author:'You (local)',body,createdAt:now}]};}
    }else throw Error('Unsupported local review action');
    if(threads.length>1000)throw Error('Review thread limit reached');
    await this.state.update(KEY,{...all,[reviewKey]:threads});return threads;
  }
}
