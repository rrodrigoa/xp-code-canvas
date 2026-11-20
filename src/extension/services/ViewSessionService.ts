import * as vscode from 'vscode';
import { recoverViewState, validateViewState } from '../../core/contracts/viewState';
import type { CanvasState } from '../../shared/types';
/** Single durable view owner. The webview holds an optimistic replica only. */
export class ViewSessionService {
  private readonly key:string;
  private current:CanvasState;
  private revision=0;
  constructor(private readonly context:vscode.ExtensionContext,workspaceId:string) {
    this.key=`xpCodeCanvas.viewState.v2.${workspaceId}`;
    this.current=recoverViewState(context.workspaceState.get<unknown>(this.key) ??
      context.workspaceState.get<unknown>('xpCodeCanvas.viewState.v1'));
  }
  get value():CanvasState {return this.current;}
  get stateRevision():number{return this.revision;}
  update(next:CanvasState):number {
    this.current=validateViewState(next);
    this.revision+=1;
    void this.context.workspaceState.update(this.key,this.current);
    return this.revision;
  }
}
