/** Optional language-provider enrichment via public VS Code APIs only. */
import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import type { SourceGraph, GraphEdge, GraphNode } from '../../shared/types';

function definitionLocation(value:vscode.Location|vscode.LocationLink):{uri:vscode.Uri;start:vscode.Position} {
  return 'targetUri' in value ? {uri:value.targetUri,start:(value.targetSelectionRange ?? value.targetRange).start} : {uri:value.uri,start:value.range.start};
}
/** Only link targets whose identity can be reconciled to indexed source declarations. */
export async function enrichSelected(graph:SourceGraph,ownerId:string):Promise<GraphEdge[]> {
  const owner=graph.nodes.find(n=>n.id===ownerId);
  if(!owner || owner.stale)return [];
  const facts=(graph.unresolved ?? []).filter(f=>f.ownerId===ownerId).slice(0,64);
  if(!facts.length)return [];
  const edges:GraphEdge[]=[];
  for(const fact of facts) {
    try {
      const uri=vscode.Uri.parse(owner.uri);
      const pos=new vscode.Position(fact.range.startLine,fact.range.startCharacter);
      const locations=await vscode.commands.executeCommand<Array<vscode.Location|vscode.LocationLink>>('vscode.executeDefinitionProvider',uri,pos);
      if(!locations?.length) continue;
      const candidates=new Set<GraphNode>();
      for(const entry of locations) {
        const {uri:dest,start}=definitionLocation(entry);
        const target=graph.nodes.filter(n=>n.uri===dest.toString() && n.kind!=='module' && !n.stale &&
          n.selectionRange.startLine===start.line && Math.abs(n.selectionRange.startCharacter-start.character)<=3)
          .sort((a,b)=>Math.abs(a.range.startLine-start.line)-Math.abs(b.range.startLine-start.line))[0];
        if(target)candidates.add(target);
      }
      if(candidates.size===0)continue;
      for(const candidate of candidates) {
        const confidence=candidates.size===1?'resolved':'ambiguous';
        edges.push({id:crypto.createHash('sha256').update(`${ownerId}|${candidate.id}|${JSON.stringify(fact.range)}|language`).digest('hex').slice(0,24),
          source:ownerId,target:candidate.id,kind:candidate.kind==='class'?'creates':'calls',confidence,
          evidence:[{uri:owner.uri,range:fact.range,version:owner.version,contentHash:owner.contentHash,language:'python',adapter:'vscode-definition-provider'}]});
      }
    } catch { /* No provider or unsupported document: the AST graph remains functional. */ }
  }
  return edges;
}
