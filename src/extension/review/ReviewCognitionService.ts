import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import {applyCognition,recoverCognition,type CognitionAction,type ReviewCognitionState} from '../../review/reviewReasoning';
const KEY='xpCodeCanvas.reviewCognition.v72';
/** No source content or AI verdicts; local workspace state only. */
export class ReviewCognitionService {
  constructor(private readonly state:vscode.Memento){}
  load(reviewKey:string,head:string):ReviewCognitionState {
    const saved=this.state.get<Record<string,ReviewCognitionState>>(KEY,{})[reviewKey];
    return recoverCognition(saved,reviewKey,head);
  }
  async apply(reviewKey:string,head:string,action:CognitionAction):Promise<ReviewCognitionState> {
    const all=this.state.get<Record<string,ReviewCognitionState>>(KEY,{});
    const previous=recoverCognition(all[reviewKey],reviewKey,head);
    const next=applyCognition(previous,action,new Date().toISOString(),crypto.randomUUID());
    // Avoid unbounded workspace storage across hundreds of PRs.
    const entries=Object.entries({...all,[reviewKey]:next}).slice(-120);
    await this.state.update(KEY,Object.fromEntries(entries));
    return next;
  }
}
