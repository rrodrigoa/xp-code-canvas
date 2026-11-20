import React, {useState} from 'react';
import {SymbolSearch} from './ui/SymbolSearch';
import type { Altitude, EdgeKind, GraphNode, CanvasState, LayoutMode } from '../../shared/types';
const levels:{key:Altitude;name:string;icon:string}[]=[
  {key:'architecture',name:'Architecture',icon:'type-hierarchy-super'},
  {key:'package',name:'Packages',icon:'package'},
  {key:'module',name:'Modules',icon:'files'},
  {key:'code',name:'Code',icon:'symbol-method'},
];
const edgeKinds:EdgeKind[]=['calls','imports','inherits','creates','references','contains','realizes'];
export interface ToolbarProps {
  state:CanvasState; files:GraphNode[];symbols:GraphNode[]; search:string; setSearch:(s:string)=>void;onPick:(id:string)=>void;
  baseline:string; setBaseline:(s:string)=>void; gitOpen:boolean; filterOpen:boolean;
  onGoto:(level:Altitude)=>void; onFocusFile:(uri:string)=>void; onAlign:()=>void; onReflow:()=>void; onReset:()=>void;
  onFit:()=>void; onExplode:()=>void; onCompare:()=>void; onHistory:()=>void; onFilter:()=>void;
  onFiltersChange:(edges:EdgeKind[])=>void; onTraceChange:(trace:CanvasState['trace'])=>void;
  onDepthChange:(depth:number)=>void; onRefresh:()=>void; onHelp:()=>void;
  onBack:()=>void; onForward:()=>void;
  onLens:(lens:'uml'|'sankey')=>void; onLayout:(mode:LayoutMode)=>void;
}
function IconButton({icon,title,onClick,active=false}:{icon:string;title:string;onClick:()=>void;active?:boolean}){
  return <button type="button" className={`icon-button ${active?'is-active':''}`} onClick={onClick} aria-label={title} title={title} aria-pressed={active}>
    <i className={`codicon codicon-${icon}`} aria-hidden="true"/>
  </button>;
}
export function CanvasToolbar(p:ToolbarProps){
  const [advanced,setAdvanced]=useState(false);
  return <div className="canvas-chrome">
    <header className={`toolbar ${advanced?'is-advanced':''}`} role="toolbar" aria-label="UML canvas controls">
      <div className="navigation-back-forward" role="group" aria-label="Exploration history">
        <button type="button" className="icon-button" aria-label="Go back to previous symbol" title="Back · Alt+Left" disabled={p.state.historyIndex<=0} onClick={p.onBack}><i className="codicon codicon-arrow-left"/></button>
        <button type="button" className="icon-button" aria-label="Go forward to next symbol" title="Forward · Alt+Right" disabled={p.state.historyIndex>=p.state.history.length-1} onClick={p.onForward}><i className="codicon codicon-arrow-right"/></button>
      </div>
      <div className="app-brand" title="XP Python UML Canvas"><span className="brand-mark"><i className="codicon codicon-type-hierarchy"/></span><span className="brand-label"><strong>XP Canvas</strong><small>PYTHON UML</small></span></div>
      <div className="toolbar-separator"/>
      <nav className="altitude-toolbar" aria-label="Graph abstraction level">
        {levels.map(l=><button type="button" key={l.key} className={p.state.altitude===l.key?'active':''} aria-pressed={p.state.altitude===l.key} onClick={()=>p.onGoto(l.key)} title={`${l.name} view`}><i className={`codicon codicon-${l.icon}`} aria-hidden="true"/><span>{l.name}</span></button>)}
      </nav>
      <div className="toolbar-separator hide-compact"/>
      <label className="select-field focus-select"><i className="codicon codicon-target" aria-hidden="true"/><select aria-label="Focus Python file" value={p.state.focusedFile??''} onChange={e=>p.onFocusFile(e.target.value)}><option value="">Entire workspace</option>{p.files.map(file=><option key={file.id} value={file.uri}>{file.module}</option>)}</select><i className="codicon codicon-chevron-down select-arrow"/></label>
      <SymbolSearch symbols={p.symbols} value={p.search} onValue={p.setSearch} onPick={p.onPick}/>
      <div className="toolbar-spacer"/>
      <label className="canvas-layout-chooser" title="Graph layout"><i className="codicon codicon-layout" aria-hidden="true"/><select aria-label="Choose graph layout" value={p.state.layoutMode??(p.state.focusedFile?'file':'architecture')} onChange={e=>p.onLayout(e.target.value as LayoutMode)}>
        <option value="architecture">Architecture</option><option value="file">File focus</option><option value="investigation">Investigation</option><option value="change">Changes</option>
      </select></label>
      <div className="canvas-lens-switch" role="group" aria-label="Canvas visualization">
        <button type="button" aria-pressed={(p.state.lens??'uml')==='uml'} className={(p.state.lens??'uml')==='uml'?'active':''} onClick={()=>p.onLens('uml')} title="UML source graph"><i className="codicon codicon-type-hierarchy"/> UML</button>
        <button type="button" aria-pressed={p.state.lens==='sankey'} className={p.state.lens==='sankey'?'active':''} onClick={()=>p.onLens('sankey')} title="Source relationship Sankey"><i className="codicon codicon-graph"/> Flow</button>
      </div>
      <div className="toolbar-action-group">
        <IconButton icon="list-tree" title="Align focused file" onClick={p.onAlign}/>
        <IconButton icon="layout" title="Auto-layout graph" onClick={p.onReflow}/>
        <IconButton icon="screen-full" title="Fit graph to view" onClick={p.onFit}/>
        <IconButton icon="git-branch" title="Git history" onClick={p.onHistory} active={p.gitOpen}/>
        <IconButton icon="settings-gear" title="Relationship filters" onClick={p.onFilter} active={p.filterOpen}/>
        <IconButton icon="ellipsis" title="Advanced graph, Git, and trace controls" onClick={()=>setAdvanced(v=>!v)} active={advanced}/>
        <IconButton icon="question" title="Mouse and keyboard controls" onClick={p.onHelp}/>
      </div>
    </header>
    <div className="filterbar" role="toolbar" aria-label="Relationship and Git comparisons">
      <span className="section-eyebrow"><i className="codicon codicon-symbol-interface"/> CONNECTIONS</span>
      <span className="active-filter-summary">{p.state.edgeKinds.length} types visible</span>
      <span className="filter-divider"/>
      <label className="inline-select"><span>Trace</span><select aria-label="Dependency trace" value={p.state.trace} onChange={e=>p.onTraceChange(e.target.value as CanvasState['trace'])}><option value="all">All relationships</option><option value="incoming">Callers · incoming</option><option value="outgoing">Dependencies · outgoing</option></select></label>
      <label className="inline-select depth-select"><span>Depth</span><select aria-label="Trace depth" value={p.state.traceDepth} onChange={e=>p.onDepthChange(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={5}>5</option><option value={20}>20</option></select></label>
      <span className="toolbar-spacer"/>
      <span className="git-section-label"><i className="codicon codicon-git-commit"/> GIT DIFF</span>
      <input aria-label="Git revision or INDEX" className="baseline-input" value={p.baseline} onChange={e=>p.setBaseline(e.target.value)} placeholder="HEAD" title="Git commit, ref or INDEX"/>
      <button type="button" className="button-compare" title="Compare selected Git baseline to current source" onClick={p.onCompare}><i className="codicon codicon-git-compare"/> Compare</button>
      <IconButton icon="refresh" title="Re-index Python workspace" onClick={p.onRefresh}/>
    </div>
    {p.filterOpen&&<div className="filter-menu" role="dialog" aria-label="Graph display filters">
      <div className="filter-menu-heading"><strong>Graph appearance</strong><button type="button" className="icon-button" aria-label="Close graph filters" onClick={p.onFilter}><i className="codicon codicon-close"/></button></div>
      <p>Show source-backed relationships</p>
      <div className="filter-grid">{edgeKinds.map(kind=><label key={kind} className={`filter-option filter-${kind}`}><input type="checkbox" checked={p.state.edgeKinds.includes(kind)} onChange={e=>p.onFiltersChange(e.target.checked?[...p.state.edgeKinds,kind]:p.state.edgeKinds.filter(v=>v!==kind))}/><span className="filter-color"/>{kind}</label>)}</div>
      <div className="filter-menu-divider"/>
      <button type="button" className="menu-row-button" onClick={p.onExplode}><i className="codicon codicon-symbol-method"/> {p.state.explodeMethods?'Collapse':'Expand'} method nodes</button>
      <button type="button" className="menu-row-button" onClick={p.onReset}><i className="codicon codicon-discard"/> Reset all manual positions</button>
    </div>}
  </div>;
}
