import React, { useMemo, useEffect, useState } from 'react';
import { Handle, Position, NodeResizeControl, useUpdateNodeInternals, useReactFlow } from '@xyflow/react';
import { portForRelationship, portOffset } from '../graph/EdgeRoutingService';
import { UmlCardHeader } from './ui/UmlCardHeader';
import type {MemberPort} from '../graph/MemberPortProjection';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import type { NodeProps, Node } from '@xyflow/react';
import type { GraphNode,EdgeKind,SourceCursor,NodeDimensions } from '../../shared/types';
import { request } from '../bridge';
import { useCanvasStore } from '../store';
import { StructureMap } from './StructureMap';
import { FunctionAnatomy } from './FunctionAnatomy';
import { BlameSummary } from './BlameSummary';
import type { BlameResult } from '../../shared/blame';
import { semanticRole, type StructureSummary, type SemanticDetail } from '../../shared/semanticVisuals';
import { selectionToSourceCursor } from '../sourceCursor';

export type UmlNodeData = {
  symbol: GraphNode; members: GraphNode[]; summary:StructureSummary; detail:SemanticDetail;
  onExpand: (id:string)=>void; onInspectPart:(id:string)=>void; expanded:boolean; pinned:boolean; portKinds?:EdgeKind[];memberPorts?:MemberPort[];cardWidth?:number;
};
export type UmlFlowNode = Node<UmlNodeData,'uml'>;
const changeLabel:Record<string,string>={ADDED:'Added',MODIFIED:'Modified',REMOVED:'Removed',IMPACTED:'Impacted',AMBIGUOUS:'Uncertain'};
function visibility(name:string):string{
  if(name.startsWith('__')&&!name.endsWith('__'))return '-';
  if(name.startsWith('_')&&!name.startsWith('__'))return '#';
  return '+';
}
function HighlightedCode({code,startLine,startCharacter,blame,onCaret}:{code:string;startLine:number;startCharacter:number;blame?:BlameResult;onCaret:(cursor:SourceCursor|null)=>void}){
  const source=useMemo(()=>code.slice(0,20000).replace(/\r\n/g,'\n').split('\n'),[code]);
  const attributed=useMemo(()=>new Map((blame?.status==='clean'?blame.lines:[]).map(line=>[line.line,line])),[blame]);
  const authors=useMemo(()=>new Map((blame?.summary?.authors??[]).map((a,i)=>[a.author,i%6])),[blame]);
  const [inspectLine,setInspectLine]=useState<number|null>(null);
  const active=inspectLine===null?undefined:attributed.get(inspectLine);
  const sourceRef=React.useRef<HTMLDivElement>(null);
  const rememberSelection=()=>{
    const selection=window.getSelection();
    const container=sourceRef.current;
    // Use currentTarget rather than a document-level selection to avoid attributing other cards.
    if(!selection||!container)return;
    const cursor=selectionToSourceCursor(container,selection,startLine,startCharacter);
    onCaret(cursor??null);
  };
  return <div ref={sourceRef} className="source-preview source-with-gutter nodrag nowheel nopan" tabIndex={0} role="region" aria-label="Read-only selectable Python source with line numbers and Git attribution" onPointerDown={()=>onCaret(null)} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onWheel={e=>{if(!e.ctrlKey&&!e.metaKey)e.stopPropagation();}}>
    {active&&<div className="source-attribution-card nodrag nopan" role="status"><div><i className="codicon codicon-git-commit"/> Line {active.line} Â· {active.author}</div>
      <p>{active.summary} Â· {new Date(active.timestamp*1000).toLocaleDateString()} Â· <code>{active.hash.slice(0,10)}</code></p>
      <button type="button" className="source-attribution-close" onClick={()=>setInspectLine(null)} aria-label="Close line attribution"><i className="codicon codicon-close"/></button>
      <button type="button" className="source-compare-commit" onClick={()=>request({type:'gitDiff',baseline:active.hash})}>Compare workspace against commit</button>
    </div>}
    {source.map((line,i)=>{
      const lineNumber=startLine+i+1, git=attributed.get(lineNumber);
      return <div className="source-code-row" data-source-line={lineNumber} key={i}>
        <span className="source-line-number" aria-hidden="true">{lineNumber}</span>
        {git?<button type="button" className={`source-blame-mark has-blame blame-dot-${authors.get(git.author)??0} nodrag nopan`} title={`${git.author} Â· ${git.summary} Â· ${git.hash.slice(0,8)}`} aria-label={`Inspect Git attribution for line ${lineNumber}`} onClick={()=>setInspectLine(lineNumber)}/>:<span className="source-blame-mark" aria-hidden="true"/>}
        <code className="language-python source-text-segment" data-source-length={line.length} dangerouslySetInnerHTML={{__html:Prism.highlight(line||' ',Prism.languages.python,'python')}} />
      </div>;
    })}
  </div>;
}
export function UmlNodeComponent({id,data,selected}:NodeProps<UmlFlowNode>){
  const {symbol:n,members,summary,detail,expanded,pinned,onExpand,onInspectPart}=data;
  const unpin=useCanvasStore(s=>s.unpin), pin=useCanvasStore(s=>s.pin);
  const preview=useCanvasStore(s=>s.previews[id]);
  const blame=useCanvasStore(s=>s.blames[id]);
  const flow=useReactFlow();
  const updateInternals=useUpdateNodeInternals();
  const preferredSize=useCanvasStore(s=>s.state.nodeSizes?.[id]);
  const [resizeDraft,setResizeDraft]=useState<NodeDimensions|null>(null);
  const [selectedCaret,setSelectedCaret]=useState<SourceCursor|null>(null);
  useEffect(()=>setSelectedCaret(null),[n.contentHash,n.version,id]);
  useEffect(()=>{updateInternals(id);},[id,detail,expanded,blame,data.portKinds?.join(','),data.memberPorts?.map(p=>p.id).join(','),updateInternals]);
  const codeLevel=detail>=3, isClass=n.kind==='class', isModule=n.kind==='module';
  const role=semanticRole(n.kind);
  useEffect(()=>{
    if(!codeLevel||n.baselineOnly)return;
    request({type:'getSourcePreview',nodeId:id,requestId:`${id}:${n.contentHash??n.version}`,expectedHash:n.contentHash??''});
  },[id,codeLevel,n.contentHash,n.version,n.baselineOnly]);
  const open=()=>request({type:'openNode',nodeId:n.id});
  const getBlame=()=>request({type:'getGitBlame',nodeId:n.id});
  const editSource=()=>request({type:'openNode',nodeId:n.id,cursor:selectedCaret??{line:n.range.startLine,character:0}});
  const saveSize=(size:NodeDimensions)=>{
    const store=useCanvasStore.getState();
    store.change({nodeSizes:{...store.state.nodeSizes,[id]:size}});
    setResizeDraft(null);
    requestAnimationFrame(()=>updateInternals(id));
  };
  const sized=codeLevel?(resizeDraft??preferredSize):undefined;
  const status=n.change&&n.change!=='UNCHANGED'?n.change:null;
  const portKinds:EdgeKind[]=data.portKinds?.length?data.portKinds:['calls'];
  return <div className={`uml-node role-${role} ${isClass?'uml-class':''} ${isModule?'uml-module':''} ${selected?'selected':''} ${detail===0?'uml-compact':''} ${detail===2?'uml-anatomy':''} ${codeLevel?'uml-expanded':''} ${n.stale?'stale-symbol':''} ${n.baselineOnly?'baseline-ghost':''} ${n.confidence!=='resolved'?'uncertain-symbol':''} ${status?`change-${status.toLowerCase()}`:''}`}
    data-testid={`symbol-${n.kind}`} data-nodeid={id} role="group" tabIndex={0} style={{width:sized?.width??data.cardWidth,height:codeLevel?sized?.height??820:undefined,maxWidth:codeLevel?'none':'min(550px,85vw)'}}
    aria-label={`UML ${n.kind} ${n.qualifiedName}${status?`, Git ${changeLabel[status]}`:''}`}>
    {portKinds.map(kind=><React.Fragment key={kind}>
      <Handle id={portForRelationship(kind,'target')} type="target" position={Position.Left} className={`handle target-handle port-${kind}`} style={{top:`${portOffset(kind)}%`}}/>
      <Handle id={portForRelationship(kind,'source')} type="source" position={Position.Right} className={`handle source-handle port-${kind}`} style={{top:`${portOffset(kind)}%`}}/>
    </React.Fragment>)}
    {(data.memberPorts??[]).map(port=>{
      const siblings=(data.memberPorts??[]).filter(p=>p.side===port.side);
      const idx=siblings.findIndex(p=>p.id===port.id);
      const pct=25+(idx+1)/(siblings.length+1)*53;
      const member=members.find(m=>m.id===port.memberId);
      return <Handle key={port.id} id={port.id} type={port.side} position={port.side==='source'?Position.Right:Position.Left}
        className={`handle member-port member-port-${port.kind}`} style={{top:`${pct}%`}} title={`${port.side==='source'?'From':'To'} ${member?.name??'method'} Â· ${port.kind}`}/>;
    })}
    {codeLevel&&<NodeResizeControl className="xp-source-resize nodrag nopan" position="bottom-right" minWidth={340} maxWidth={1400} minHeight={260} maxHeight={1600}
      onResize={(_event,params)=>setResizeDraft({width:Math.round(params.width),height:Math.round(params.height)})}
      onResizeEnd={(_event,params)=>saveSize({width:Math.round(params.width),height:Math.round(params.height)})}>
      <i className="codicon codicon-arrow-both" aria-hidden="true"/>
    </NodeResizeControl>}
    <UmlCardHeader symbol={n} expanded={expanded} pinned={pinned} onExpand={()=>onExpand(id)} onBlame={getBlame}
      onPin={()=>pinned?unpin(id):pin(id,flow.getNode(id)?.position??{x:0,y:0})} onOpen={open}/>
    <div className={codeLevel?'uml-source-context nodrag nowheel nopan':undefined}>
    {detail===0&&summary.parts.length>0&&<div className="compact-structure"><StructureMap summary={summary} variant="minimap" onSelect={onInspectPart}/></div>}
    {status&&<div className="node-status-line" role="status"><span className="status-dot"/><span>{changeLabel[status]}</span>{n.baselineOnly&&<span>Â· Historical</span>}</div>}
    {n.stale&&<div className="node-status-line stale-label"><i className="codicon codicon-warning"/> Analysis from last valid edit</div>}
    {detail===1&&<>
      {isClass&&<>
        <div className="uml-compartment" aria-label="Class attributes">
          <span className="compartment-title">ATTRIBUTES <span>{n.attributes.length}</span></span>
          {n.attributes.length===0?<span className="empty-compartment">No declared attributes</span>:n.attributes.slice(0,12).map(a=><div className="uml-member" key={a.name} title={`Python naming-convention visibility: ${a.visibility}`}><span className="visibility">{visibility(a.name)}</span><span>{a.name}</span>{a.type&&<span className="member-type">: {a.type}</span>}</div>)}
          {n.attributes.length>12&&<span className="empty-compartment">+ {n.attributes.length-12} more</span>}
        </div>
        <div className="uml-compartment" aria-label="Class operations">
          <span className="compartment-title">OPERATIONS <span>{members.filter(m=>['method','property'].includes(m.kind)).length}</span></span>
          {members.filter(m=>['method','property'].includes(m.kind)).slice(0,14).map(m=><button key={m.id} type="button" className="uml-member operation nodrag nopan" title={`Open ${m.name} in the standard editor`} onClick={e=>{e.stopPropagation();request({type:'openNode',nodeId:m.id});}}><span className="visibility">{visibility(m.name)}</span><span className="member-signature">{m.signature||m.name}</span>{m.async_&&<span className="async-pill">async</span>}</button>)}
        </div>
      </>}
      {!isClass&&n.signature&&<div className="uml-compartment signature" title={n.signature}><span className="compartment-title">SIGNATURE</span><code>{n.signature}</code></div>}
      {!isClass&&n.docstring&&<div className="uml-compartment docstring">{n.docstring}</div>}
    </>}
    {detail>=2&&summary.total>0&&<StructureMap summary={summary} variant="blocks" onSelect={onInspectPart}/>}
    {detail>=2&&n.anatomy&&n.anatomy.length>0&&<FunctionAnatomy symbol={n}/>}
    {blame&&detail>=1&&<BlameSummary result={blame} compact={detail<3}/>}
    {detail===2&&summary.total===0&&<div className="structure-summary-empty">{n.kind==='function'||n.kind==='method'?'Function body Â· select to read source':'No nested declarations indexed'}</div>}
    {detail>=2&&isClass&&n.attributes.length>0&&<section className="field-strip" aria-label="Indexed class fields">
      <div className="field-caption"><i className="codicon codicon-symbol-field"/> FIELDS <span>{n.attributes.length} indexed</span></div>
      <div className="field-tokens">{n.attributes.slice(0,14).map(a=><span key={a.name} className="field-token" title={`${a.name}: ${a.type??'type unknown'} â€” indexed attribute; source range not independently resolved`}>{a.name}</span>)}
        {n.attributes.length>14&&<span className="field-more">+{n.attributes.length-14}</span>}</div>
    </section>}
    </div>
    {codeLevel&&<div className="uml-source">
      <div className="source-heading nodrag nopan" title="Read-only source preview">
        <span className="codicon codicon-code"/><span className="source-heading-file">{n.uri.split('/').pop()}</span>
        <span className="read-only-label">PREVIEW</span>
        <button type="button" onClick={e=>{e.stopPropagation();editSource();}} className="open-code nodrag nopan" title="Edit at selected source cursor in VS Code">Edit <i className="codicon codicon-arrow-right"/></button>
      </div>
      {preview?.source?<HighlightedCode code={preview.source} startLine={n.range.startLine} startCharacter={n.range.startCharacter} blame={blame} onCaret={setSelectedCaret}/>:<div className="source-preview source-placeholder nodrag" role="status">{preview?.error??'Loading source previewâ€¦'}</div>}
    </div>}
    <footer className="uml-footer"><span><i className="codicon codicon-file-code" aria-hidden="true"/> {n.uri.split('/').pop()}</span><span>L{n.range.startLine+1}{n.count&&n.count>1?` Â· ${n.count} refs`:''}</span></footer>

  </div>;
}
