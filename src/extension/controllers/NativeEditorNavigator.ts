import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import type { GraphNode, SourceGraph, CodeRegion, SourceCursor } from '../../shared/types';
import { symbolAt } from '../../shared/graph';
import { cursorWithinSymbol } from '../../shared/sourceNavigation';
export class NativeEditorNavigator {
  async open(node: GraphNode, target: vscode.ViewColumn, cursor?: SourceCursor):Promise<boolean> {
    if (node.baselineOnly) { void vscode.window.showWarningMessage('This removed Git symbol has no current editor location.'); return false; }
    const doc=await vscode.workspace.openTextDocument(vscode.Uri.parse(node.uri));
    const hash=crypto.createHash('sha256').update(doc.getText()).digest('hex');
    const valid=!node.stale && (!node.contentHash || hash===node.contentHash);
    const options:vscode.TextDocumentShowOptions={viewColumn:target,preview:false,preserveFocus:false};
    if (valid) {
      const requested=cursorWithinSymbol(cursor,node.range)
        ?new vscode.Position(cursor.line,cursor.character):undefined;
      const start=requested?doc.validatePosition(requested):new vscode.Position(node.selectionRange.startLine,node.selectionRange.startCharacter);
      options.selection=new vscode.Range(start,start);
    } else {
      void vscode.window.showWarningMessage('UML source is stale; opened file without selecting an outdated source range. Refresh the graph.');
    }
    const editor=await vscode.window.showTextDocument(doc,options);
    if (valid && options.selection) editor.revealRange(options.selection,vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    return valid;
  }
  async openRegion(node:GraphNode,region:CodeRegion,target:vscode.ViewColumn):Promise<boolean> {
    if(node.baselineOnly || node.stale){
      void vscode.window.showWarningMessage('This source region is historical or stale; refresh the graph before navigating.');
      return false;
    }
    const doc=await vscode.workspace.openTextDocument(vscode.Uri.parse(node.uri));
    const hash=crypto.createHash('sha256').update(doc.getText()).digest('hex');
    if(node.contentHash && node.contentHash!==hash){
      void vscode.window.showWarningMessage('Source changed since graph analysis; refresh before navigating to a region.');
      return false;
    }
    if(region.range.startLine<node.range.startLine||region.range.endLine>node.range.endLine)return false;
    const position=new vscode.Position(region.range.startLine,region.range.startCharacter);
    const editor=await vscode.window.showTextDocument(doc,{viewColumn:target,preview:false,preserveFocus:false,selection:new vscode.Range(position,position)});
    editor.revealRange(new vscode.Range(position,position),vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    return true;
  }
  fromCursor(graph: SourceGraph):{ uri:string; id?:string } | undefined {
    const editor=vscode.window.activeTextEditor;
    if(!editor?.document.uri.path.endsWith('.py'))return undefined;
    const uri=editor.document.uri.toString();
    const node=symbolAt(graph,uri,editor.selection.active.line);
    return {uri,id:node?.id};
  }
}
