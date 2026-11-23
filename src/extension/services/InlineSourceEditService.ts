import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import type {GraphNode} from '../../shared/types';

export interface InlineEditInput {nodeId:string;expectedHash:string;originalSource:string;updatedSource:string}
export interface InlineEditResult {ok:boolean;error?:string}
const digest=(text:string)=>crypto.createHash('sha256').update(text).digest('hex');
const normalized=(value:string)=>value.replace(/\r\n/g,'\n');
/** Edit only a source-backed, live callable/class span. All writes are explicit,
 * revision-guarded WorkspaceEdits, so VS Code undo and unsaved buffers work normally.
 * This does not modify Git INDEX, create commits or publish PR comments. */
export class InlineSourceEditService {
  async apply(node:GraphNode|undefined,input:InlineEditInput):Promise<InlineEditResult>{
    try{
      if(!vscode.workspace.isTrusted)throw Error('Trust this workspace before editing Python source.');
      if(!node||node.id!==input.nodeId||node.baselineOnly||node.stale)throw Error('This symbol is historical, stale, or no longer available.');
      if(!['class','function','method','property'].includes(node.kind))throw Error('Open the native editor to edit modules or external symbols.');
      if(input.originalSource.length>20000||input.updatedSource.length>20000)throw Error('Source span is too large for inline editing; use the native editor.');
      if(!/^[a-f0-9]{64}$/.test(input.expectedHash)||node.contentHash!==input.expectedHash)throw Error('Source revision has changed; refresh the UML before saving.');
      const uri=vscode.Uri.parse(node.uri);
      if(uri.scheme!=='file'||!vscode.workspace.getWorkspaceFolder(uri))throw Error('Only local Python documents inside the opened workspace are editable.');
      const doc=await vscode.workspace.openTextDocument(uri);
      // Hash the current VS Code document (including unsaved edits), not the disk file.
      if(digest(doc.getText())!==input.expectedHash)throw Error('The Python document changed since this UML preview. Your inline draft was not applied.');
      const range=doc.validateRange(new vscode.Range(node.range.startLine,node.range.startCharacter,node.range.endLine,node.range.endCharacter));
      if(range.isEmpty)throw Error('Invalid or empty source span.');
      if(normalized(doc.getText(range))!==normalized(input.originalSource))throw Error('The source range no longer matches this preview; nothing was written.');
      if(input.updatedSource.includes('\0'))throw Error('NUL characters are not allowed in Python source.');
      if(normalized(input.originalSource)===normalized(input.updatedSource))return {ok:true};
      const replacement=doc.eol===vscode.EndOfLine.CRLF?normalized(input.updatedSource).replace(/\n/g,'\r\n'):normalized(input.updatedSource);
      const edit=new vscode.WorkspaceEdit();edit.replace(uri,range,replacement);
      if(!await vscode.workspace.applyEdit(edit))throw Error('VS Code rejected the edit. No change was applied.');
      return {ok:true};
    }catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
  }
}
