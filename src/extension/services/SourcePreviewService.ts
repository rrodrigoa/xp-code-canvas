import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import type { GraphNode } from '../../shared/types';

/** Source bytes never travel with the graph. Request bounded, verified snippets on demand. */
export class SourcePreviewService {
  async get(node: GraphNode, expectedHash: string):Promise<{source?:string;stale:boolean;truncated?:boolean;error?:string}> {
    if (node.baselineOnly) return {stale:true,error:'Removed Git baseline symbol has no live source'};
    if (node.stale) return {stale:true,error:'Temporarily invalid source: last-known-good symbol is stale'};
    const uri = vscode.Uri.parse(node.uri);
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const hash = crypto.createHash('sha256').update(doc.getText()).digest('hex');
      if (node.contentHash && hash!==node.contentHash) return {stale:true,error:'Document changed; waiting for an updated graph'};
      if (expectedHash && node.contentHash && expectedHash!==node.contentHash) return {stale:true,error:'Requested symbol revision is outdated'};
      const {startLine,startCharacter,endLine,endCharacter}=node.range;
      if (startLine >= doc.lineCount || endLine >= doc.lineCount) return {stale:true,error:'Source span no longer exists'};
      const span = new vscode.Range(startLine,startCharacter,endLine,endCharacter);
      if (span.isEmpty && node.kind!=='module') return {stale:true,error:'Invalid source span'};
      const full = node.kind==='module' ? doc.getText() : doc.getText(span);
      const source=full.slice(0,20000);
      return {source,stale:false,truncated:full.length>20000};
    } catch(error) {return {stale:true,error:String(error)};}
  }
}
