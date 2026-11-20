import React from 'react';
import type { GraphEdge,GraphNode } from '../../shared/types';
import { request } from '../bridge';
import type { BlameResult } from '../../shared/blame';
import { BlameSummary } from './BlameSummary';
export function CanvasInspector({selected,edges,onClose,onExplore,onClear,blame}:{selected:GraphNode;edges:GraphEdge[];onClose:()=>void;onExplore:(direction:'incoming'|'outgoing')=>void;onClear:()=>void;blame?:BlameResult}){
  return <aside className="floating-popover inspector" role="dialog" aria-modal="false" aria-label={`Inspect ${selected.qualifiedName}`}>
    <div className="inspector-head"><span className="drawer-eyebrow">SYMBOL INSPECTOR</span><button type="button" className="icon-button" aria-label="Close inspector" onClick={onClose}><i className="codicon codicon-close"/></button></div>
    <h2>{selected.qualifiedName}</h2>
    <div className="inspector-location"><i className="codicon codicon-file-code"/>{selected.uri.split('/').pop()} <span>L{selected.range.startLine+1}–{selected.range.endLine+1}</span></div>
    {selected.signature&&<code className="inspector-signature">{selected.signature}</code>}
    <div className="inspector-metrics">
      <div><strong>{edges.filter(e=>e.target===selected.id).length}</strong><small>Incoming edges</small></div>
      <div><strong>{edges.filter(e=>e.source===selected.id).length}</strong><small>Outgoing edges</small></div>
      <div><strong>{Math.max(1,selected.range.endLine-selected.range.startLine+1)}</strong><small>Source lines</small></div>
    </div>
    <div className="inspector-resolution">Relationship resolution: <strong>{selected.confidence}</strong> · Counts reflect static graph edges, not runtime traffic.</div>
    <button type="button" className="button-primary inspector-edit" onClick={()=>request({type:'openNode',nodeId:selected.id})}><i className="codicon codicon-go-to-file"/> Open in Editor</button>
    <div className="inspector-actions"><button onClick={()=>onExplore('incoming')}><i className="codicon codicon-arrow-left"/> Callers</button><button onClick={()=>onExplore('outgoing')}>Dependencies <i className="codicon codicon-arrow-right"/></button><button onClick={onClear}>All</button></div>
    <div className="inspector-blame-action">
      <button type="button" onClick={()=>request({type:'getGitBlame',nodeId:selected.id})}><i className="codicon codicon-git-commit"/> {blame?'Refresh Git attribution':'Inspect Git blame'}</button>
    </div>
    {blame&&<BlameSummary result={blame}/>}
    <div className="inspector-evidence"><div className="drawer-eyebrow">SOURCE EVIDENCE</div><div className="evidence-list">{edges.slice(0,35).map(edge=><div key={edge.id} className="evidence-row"><span className={`evidence-type edge-kind-${edge.kind}`}>{edge.kind}</span><span>{edge.confidence}<small>{edge.evidence.map(x=>`${x.uri.split('/').pop()}:${x.range.startLine+1}`).join(', ')}</small></span></div>)}{!edges.length&&<p className="empty-inline">No visible relationships for this symbol.</p>}</div></div>
  </aside>;
}
