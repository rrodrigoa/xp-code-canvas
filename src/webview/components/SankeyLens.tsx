import React, {useMemo, useState} from 'react';
import type { SourceGraph } from '../../shared/types';
import {buildFlowLens,layoutFlowLens,type FlowKind} from '../../shared/flowLens';
import {semanticRole} from '../../shared/semanticVisuals';
export interface SankeyLensProps {
  graph:SourceGraph; selectedId:string|null; kind:FlowKind;
  onKind:(kind:FlowKind)=>void; onSelect:(nodeId:string)=>void; onBack:()=>void;
}
const choices:{id:FlowKind;label:string}[]=[
  {id:'calls',label:'Calls'},{id:'imports',label:'Imports'},{id:'references',label:'References'},{id:'creates',label:'Creates'},
];
const format=(v:number)=>Math.round(v*100);
/** A separate navigational lens, not a replacement for UML edges.
 * Its ribbon widths encode counts of static code relationships, never runtime execution. */
export function SankeyLens({graph,selectedId,kind,onKind,onSelect,onBack}:SankeyLensProps){
  const [hovered,setHovered]=useState<string|null>(null);
  const model=useMemo(()=>buildFlowLens(graph,kind,selectedId),[graph,kind,selectedId]);
  const geometry=useMemo(()=>layoutFlowLens(model),[model]);
  const focus=model.focus;
  return <section className="sankey-lens" aria-label="Source relationships Sankey diagram" data-testid="sankey-lens">
    <header className="sankey-topbar">
      <div className="sankey-heading">
        <span className="sankey-kicker"><i className="codicon codicon-type-hierarchy"/> RELATIONSHIP FLOW</span>
        <h2>{focus?focus.qualifiedName:'No connections in this view'}</h2>
        <p>Ribbons show <strong>static source relationships</strong>, not runtime frequency, data volume or performance.</p>
      </div>
      <div className="sankey-actions">
        <label>Relationship
          <select aria-label="Sankey relationship type" value={kind} onChange={e=>onKind(e.target.value as FlowKind)}>
            {choices.map(choice=><option value={choice.id} key={choice.id}>{choice.label}</option>)}
          </select>
        </label>
        <button type="button" className="button-primary" onClick={onBack} aria-label="Return to UML diagram"><i className="codicon codicon-type-hierarchy"/> UML map</button>
      </div>
    </header>
    <div className="flow-metrics" aria-live="polite">
      <div><strong>{model.inboundTotal}</strong><span>Incoming · {format(model.inboundShare)}% of workspace relationships</span></div>
      <div><strong>{model.outboundTotal}</strong><span>Outgoing · {format(model.outboundShare)}% of workspace relationships</span></div>
      <div><strong>{model.workspaceTotal}</strong><span>{model.weightLabel} in this graph view</span></div>
    </div>
    {focus&&(model.inbound.length||model.outbound.length)?<div className="sankey-diagram-wrap">
      <svg className="sankey-diagram" viewBox="0 0 1100 590" role="group" aria-label={`Static ${kind} Sankey focused on ${focus.name}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="flow-in" x1="0" x2="1"><stop offset="0%" stopColor="var(--xp-flow-in)" stopOpacity=".27"/><stop offset="100%" stopColor="var(--xp-flow-in)" stopOpacity=".75"/></linearGradient>
          <linearGradient id="flow-out" x1="0" x2="1"><stop offset="0%" stopColor="var(--xp-flow-out)" stopOpacity=".75"/><stop offset="100%" stopColor="var(--xp-flow-out)" stopOpacity=".28"/></linearGradient>
        </defs>
        <text x="76" y="56" className="sankey-column-label">{kind==='imports'?'IMPORTERS':'CALLERS / USERS'}</text>
        <text x="484" y="56" className="sankey-column-label">FOCUSED CONSTRUCT</text>
        <text x="864" y="56" className="sankey-column-label">DEPENDENCIES / USES</text>
        <line x1="350" y1="75" x2="350" y2="537" className="sankey-divider"/>
        <line x1="766" y1="75" x2="766" y2="537" className="sankey-divider"/>
        {geometry.ribbons.map(r=><path key={r.id} d={r.path}
          className={`flow-ribbon ${r.side} ${r.confidence!=='resolved'?'flow-unresolved':''} ${hovered&&hovered!==r.peerId?'flow-dimmed':''}`}
          fill={`url(#flow-${r.side==='incoming'?'in':'out'})`}
          onMouseEnter={()=>setHovered(r.peerId)} onMouseLeave={()=>setHovered(null)}>
          <title>{`${r.side==='incoming'?'Incoming':'Outgoing'}: ${r.weight} static ${kind} relation${r.weight===1?'':'s'}`}</title>
        </path>)}
        <rect x={geometry.center.x} y={geometry.center.y} width={geometry.center.width} height={geometry.center.height} rx="12" className={`sankey-center role-${semanticRole(focus.kind)}`}/>
        <text x={geometry.center.x+geometry.center.width/2} y={geometry.center.y+geometry.center.height/2-11} textAnchor="middle" className="sankey-center-name">{focus.name.slice(0,19)}</text>
        <text x={geometry.center.x+geometry.center.width/2} y={geometry.center.y+geometry.center.height/2+11} textAnchor="middle" className="sankey-center-kind">{focus.kind.toUpperCase()}</text>
        {geometry.bars.map(bar=><g key={`${bar.side}:${bar.id}`} className={`sankey-peer ${hovered===bar.id?'flow-is-hovered':''}`} onMouseEnter={()=>setHovered(bar.id)} onMouseLeave={()=>setHovered(null)}>
          <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="7" className={`sankey-bar role-${semanticRole(bar.kind)}`}/>
          <text x={bar.x+12} y={bar.y+Math.max(14,bar.height/2)+4} className="sankey-bar-text">{bar.label.slice(0,21)}</text>
          <text x={bar.x+bar.width-9} y={bar.y+Math.max(14,bar.height/2)+4} textAnchor="end" className="sankey-bar-count">{bar.weight}</text>
          {!bar.synthetic&&<rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="7" fill="transparent" tabIndex={0} role="button" aria-label={`Focus ${bar.label}, ${bar.weight} static ${kind} relationships`}
            onClick={()=>onSelect(bar.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(bar.id);}}}><title>{`Focus ${bar.label}`}</title></rect>}
        </g>)}
      </svg>
    </div>:<div className="sankey-empty"><i className="codicon codicon-git-merge"/><strong>No source-backed {kind} connections</strong><span>Choose another relationship type, abstraction level, or select a UML construct.</span></div>}
    <footer className="sankey-footnote">
      <span><i className="codicon codicon-info"/> Each side is independent; an incoming relationship does not prove an end-to-end execution path.</span>
      <span>{model.recursive>0?`${model.recursive} self-references not drawn · `:''}{model.truncated?'Lower-volume nodes combined into “more” · ':''}Dashed/transparent flow = uncertain resolution</span>
    </footer>
    <table className="sr-only" aria-label="Accessible static relationship data"><thead><tr><th>Direction</th><th>Symbol</th><th>Reference count</th></tr></thead>
      <tbody>{[...model.inbound.map(p=>({...p,side:'Incoming'})),...model.outbound.map(p=>({...p,side:'Outgoing'}))].map(p=><tr key={`${p.side}:${p.id}`}><td>{p.side}</td><td>{p.label}</td><td>{p.weight}</td></tr>)}</tbody>
    </table>
  </section>;
}
