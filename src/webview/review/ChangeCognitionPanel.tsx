import React,{useEffect,useMemo,useState} from 'react';
import type {GraphNode} from '../../shared/types';
import type {ReviewSnapshot} from '../../review/reviewTypes';
import {evidenceSummary,type ComparisonFrame} from '../../review/changeCognition';
import {reviewCoverage,type CognitionAction} from '../../review/reviewReasoning';
import {request} from '../bridge';
import './cognition.css';

export type ReviewCanvasFrame=ComparisonFrame|'revision';
export interface CognitionPanelProps {
  review:ReviewSnapshot;selectedId?:string|null;frame:ReviewCanvasFrame;
  onFrame:(frame:ComparisonFrame)=>void;onPickSymbol:(id:string)=>void;
  revisions:string[];activeRevision?:string|null;onLoadRevision:(revision:string)=>void;
}
const visible=(text?:string)=>text?.trim()||'—';
const keyFor=(symbol:GraphNode)=>symbol.id;
export function ChangeCognitionPanel({review,selectedId,frame,onFrame,onPickSymbol,revisions,activeRevision,onLoadRevision}:CognitionPanelProps){
  const evidence=useMemo(()=>evidenceSummary(review),[review]);
  const model=review.comparison;
  const facts=model?.transformations??[];
  const changed=useMemo(()=>review.graph.nodes.filter(n=>n.change&&['ADDED','MODIFIED','REMOVED'].includes(n.change)),[review.graph]);
  const focused=selectedId?review.graph.nodes.find(n=>n.id===selectedId):undefined;
  const old=focused&&model?.before.nodes.find(n=>n.id===focused.id);
  const targetFacts=focused?facts.filter(t=>t.symbolId===focused.id):facts;
  const [showAll,setShowAll]=useState(false);
  const [question,setQuestion]=useState('');
  const [blink,setBlink]=useState(false);
  const [blinkFrame,setBlinkFrame]=useState<ComparisonFrame>('before');
  const [revisionPicker,setRevisionPicker]=useState(0);
  const [progressFilter,setProgressFilter]=useState<'all'|'needs-evidence'|'unseen'|'stale'>('all');
  const cognition=review.cognition;
  const status=focused&&cognition?.records[keyFor(focused)]?.status||'unseen';
  const questions=focused&&cognition?.records[keyFor(focused)]?.questions||[];
  const coverage=useMemo(()=>reviewCoverage(cognition??{reviewKey:'',head:review.head,records:{},bookmarks:[],shelf:[],revisionChanged:false},changed.map(n=>n.id)),[cognition,changed,review.head]);
  const act=(action:CognitionAction)=>request({type:'reviewCognition',action});
  useEffect(()=>{
    if(!blink)return;
    if(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setBlink(false);return;}
    const id=window.setInterval(()=>setBlinkFrame(s=>s==='before'?'after':'before'),950);
    return ()=>window.clearInterval(id);
  },[blink]);
  useEffect(()=>{if(blink)onFrame(blinkFrame);},[blink,blinkFrame,onFrame]);
  useEffect(()=>{if(review.scope==='branch'||review.scope==='pr')request({type:'reviewRevisionsRequest'});},[review.reviewKey,review.head,review.scope]);
  const sourceFacts=targetFacts.filter(t=>['signature','decorator','base-class','control-flow','body-changed','added','removed'].includes(t.kind));
  const relationFacts=targetFacts.filter(t=>['call-added','call-removed'].includes(t.kind));
  const count=changed.length;
  return <div className="review-dock-scroll cognition-panel" role="region" aria-label="Understand architectural changes">
    <header className="cognition-intro"><strong>Change Cognition</strong><small>Compare facts, inspect evidence, and record your own judgment. No AI verdicts.</small></header>
    <section className="cognition-section" aria-label="Graph version comparison">
      <div className="cognition-section-title"><i className="codicon codicon-git-compare"/><strong>Architecture: Before / Delta / After</strong></div>
      <div className="cognition-frame" role="group" aria-label="Comparison frame">
        {(['before','delta','after'] as const).map(f=><button key={f} type="button" aria-pressed={frame===f} className={frame===f?'active':''} onClick={()=>{setBlink(false);onFrame(f);}}>{f==='delta'?'Δ changes':f[0].toUpperCase()+f.slice(1)}</button>)}
      </div>
      <p className="cognition-help">The graph keeps stable symbol positions. Delta displays changed edges; Before shows the original relationships. Current source is never silently substituted for historical code.</p>
      <button className="cognition-minor" type="button" aria-pressed={blink} onClick={()=>{setBlink(v=>!v);if(!blink)setBlinkFrame('before');}}><i className={`codicon codicon-${blink?'debug-pause':'play'}`}/>{blink?'Stop alternating':'Blink Before/After'} <small>Optional · not available with reduced motion</small></button>
      {!model&&<p className="cognition-note">Exact source snapshots are unavailable for this review. Fetch the PR commits or refresh the comparison.</p>}
    </section>
    <section className="cognition-section" aria-label="Structural change facts">
      <div className="cognition-section-title"><i className="codicon codicon-symbol-structure"/><strong>What structurally changed?</strong><span>{targetFacts.length}{model?.truncated?' +':''}</span></div>
      <p className="cognition-help">{focused?`Selected: ${focused.qualifiedName}`:'Select a UML node to focus on its transformations.'} Facts derive from Python AST and static edges; behavior is not proven.</p>
      {focused&&<div className="cognition-signatures"><div><span>Before · signature</span><code>{visible(old?.signature||old?.qualifiedName)}</code></div><div><span>After · signature</span><code>{focused.change==='REMOVED'?'Removed':visible(focused.signature||focused.qualifiedName)}</code></div></div>}
      <div className="cognition-facts">
        {(showAll?targetFacts:targetFacts.slice(0,12)).map(f=><button type="button" className={`cognition-fact fact-${f.kind}`} key={f.id} onClick={()=>onPickSymbol(f.symbolId)} title={`Source: ${f.uri}, line ${f.line+1}`}>
          <i className={`codicon codicon-${f.kind.includes('removed')?'diff-removed':f.kind.includes('added')?'diff-added':'diff-modified'}`}/>
          <span><strong>{f.title}</strong><small>{f.uri.split('/').pop()}:{f.line+1} · {f.confidence}{f.evidence==='static-edge'?' · static relationship':''}</small>
            {f.before!==undefined&&<code className="cognition-before">− {visible(f.before).slice(0,135)}</code>}
            {f.after!==undefined&&<code className="cognition-after">+ {visible(f.after).slice(0,135)}</code>}
          </span></button>)}
        {!targetFacts.length&&<p className="cognition-empty">No structural transformation recorded for this selection. A line-level diff can contain changes beyond the AST facts shown here.</p>}
      </div>
      <div className="cognition-summary"><span>{sourceFacts.length} declaration/structure</span><span>{relationFacts.length} static relationships</span></div>
      {targetFacts.length>12&&<button type="button" className="cognition-minor" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer':`Show all ${targetFacts.length}`}</button>}
    </section>
    <section className="cognition-section" aria-label="Review evidence map">
      <div className="cognition-section-title"><i className="codicon codicon-references"/><strong>Evidence map</strong></div>
      <div className="cognition-evidence-grid">
        <div><strong>{evidence.sourceChanges}</strong><span>Changed symbols</span><small>AST / Git</small></div>
        <div><strong>{evidence.relationshipChanges}</strong><span>Changed edges</span><small>Static analysis</small></div>
        <div><strong>{evidence.ambiguousRelations}</strong><span>Uncertain edges</span><small>Not verified</small></div>
        <div><strong>{evidence.unresolvedThreads}</strong><span>Open discussions</span><small>Review record</small></div>
      </div>
      <p className="cognition-note">Tests executed: <strong>unknown</strong>. A modified test file is not evidence that tests ran or passed.</p>
      {[{title:'Tests changed',items:evidence.changedTestFiles},{title:'Documentation changed',items:evidence.changedDocs},{title:'Configuration changed',items:evidence.changedConfig}].map(group=><details key={group.title} className="cognition-evidence-files"><summary>{group.title} <span>{group.items.length}</span></summary>
        {group.items.slice(0,20).map(file=><button key={file.path} type="button" onClick={()=>request({type:'reviewDiff',path:file.path})}>{file.path}<i className="codicon codicon-diff"/></button>)}
        {!group.items.length&&<p>No changed files identified in this category.</p>}
      </details>)}
    </section>
    <section className="cognition-section" aria-label="Review reasoning">
      <div className="cognition-section-title"><i className="codicon codicon-question"/><strong>Your reasoning</strong></div>
      <p className="cognition-help">Explicit review actions only. Opening a node is not proof it was assessed.</p>
      {focused?<>
        <div className="cognition-status-actions" role="group" aria-label="Review status for selected symbol">
          {([['opened','Opened'],['reviewed','Reviewed'],['needs-evidence','Need evidence'],['unseen','Clear']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={status===value} onClick={()=>act({action:'status',key:keyFor(focused),status:value})}>{label}</button>)}
        </div>
        <div className="cognition-pin-actions"><button type="button" onClick={()=>act({action:'bookmark',key:focused.id,enabled:!cognition?.bookmarks.includes(focused.id)})}><i className="codicon codicon-bookmark"/>{cognition?.bookmarks.includes(focused.id)?'Remove bookmark':'Bookmark symbol'}</button>
          <button type="button" onClick={()=>act({action:'shelf',key:focused.id,enabled:!cognition?.shelf.includes(focused.id)})}><i className="codicon codicon-pinned"/>{cognition?.shelf.includes(focused.id)?'Remove from shelf':'Add to comparison shelf'}</button></div>
        <label className="cognition-question-label" htmlFor="cognition-question">What remains uncertain?</label>
        <textarea id="cognition-question" rows={2} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Record a concrete question before deciding…"/>
        <button type="button" className="cognition-minor" disabled={question.trim().length<2} onClick={()=>{act({action:'question',key:focused.id,body:question});setQuestion('');}}>Record question</button>
        {questions.map(q=><div className="cognition-question" key={q.id}><span>{q.body}</span><button onClick={()=>act({action:'answer',key:focused.id,questionId:q.id,answered:q.status!=='answered'})}>{q.status==='answered'?'Reopen':'Mark answered'}</button></div>)}
      </>:<p className="cognition-empty">Select a changed method or class to record your assessment and questions.</p>}
    </section>
    <section className="cognition-section" aria-label="Review coverage and comparison shelf">
      <div className="cognition-section-title"><i className="codicon codicon-checklist"/><strong>Review coverage</strong><span>{count} changed</span></div>
      {cognition?.revisionChanged&&<p className="cognition-warning">Revision changed since the last review. Earlier completed items are marked stale.</p>}
      <div className="cognition-coverage">
        {([['reviewed','Reviewed'],['opened','Opened only'],['needs-evidence','Need evidence'],['stale','Stale'],['unseen','Not assessed']] as const).map(([key,label])=><div key={key}><strong>{coverage[key]}</strong><span>{label}</span></div>)}
      </div>
      <label className="cognition-question-label">Find unreviewed symbols</label>
      <div className="cognition-frame cognition-coverage-filter" role="group" aria-label="Filter review coverage">
        {(['all','unseen','needs-evidence','stale'] as const).map(f=><button key={f} aria-pressed={progressFilter===f} onClick={()=>setProgressFilter(f)}>{f==='all'?'All':f==='unseen'?'Unseen':f==='needs-evidence'?'Questions':'Stale'}</button>)}
      </div>
      {changed.filter(n=>progressFilter==='all'||(cognition?.records[n.id]?.status??'unseen')===progressFilter).slice(0,12).map(n=><button className="cognition-symbol-link" onClick={()=>onPickSymbol(n.id)} key={n.id}>{n.qualifiedName}<i className="codicon codicon-arrow-right"/></button>)}
      <div className="cognition-section-title cognition-shelf-title"><i className="codicon codicon-pinned"/><strong>Comparison shelf</strong><span>{cognition?.shelf.length??0}/4</span></div>
      <div className="cognition-section-title cognition-shelf-title"><i className="codicon codicon-bookmark"/><strong>Investigation bookmarks</strong><span>{cognition?.bookmarks.length??0}</span></div>
      <div className="cognition-bookmarks">{cognition?.bookmarks.slice(0,20).map(id=><button type="button" key={id} onClick={()=>onPickSymbol(id)}>{review.graph.nodes.find(n=>n.id===id)?.qualifiedName??id}</button>)}{!cognition?.bookmarks.length&&<small>No bookmarks yet.</small>}</div>
      <div className="cognition-shelf">{cognition?.shelf.map(id=>{const n=review.graph.nodes.find(n=>n.id===id);const b=model?.before.nodes.find(n=>n.id===id);return <div key={id}>
        <button type="button" onClick={()=>onPickSymbol(id)}>{n?.qualifiedName??id}</button>
        <code>Before: {visible(b?.signature).slice(0,100)}</code><code>After: {visible(n?.signature).slice(0,100)}</code>
        <button type="button" aria-label="Remove from comparison shelf" onClick={()=>act({action:'shelf',key:id,enabled:false})}>×</button>
      </div>;})}{!cognition?.shelf.length&&<p>Pin up to four symbols to keep their signatures visible while investigating.</p>}</div>
    </section>
    {(review.scope==='branch'||review.scope==='pr')&&<section className="cognition-section" aria-label="Revision time travel">
      <div className="cognition-section-title"><i className="codicon codicon-history"/><strong>Revision scrubber</strong><span>{revisions.length} available</span></div>
      <p className="cognition-help">Load a Git revision without checking it out. The canvas becomes read-only historical architecture. The native diff remains the authoritative line comparison.</p>
      {revisions.length>0&&<>
        <input type="range" min="0" max={Math.max(0,revisions.length-1)} value={Math.min(revisionPicker,revisions.length-1)} onChange={e=>setRevisionPicker(Number(e.target.value))} aria-label="Choose review revision"/>
        <code className="cognition-revision-hash">{revisions[Math.min(revisionPicker,revisions.length-1)]?.slice(0,12)}</code>
        <button className="cognition-minor" onClick={()=>{setBlink(false);onLoadRevision(revisions[Math.min(revisionPicker,revisions.length-1)]);}} disabled={!revisions.length}>Inspect selected revision</button>
        {activeRevision&&<p className="cognition-note">Currently showing historical revision {activeRevision.slice(0,12)}.</p>}
      </>}
    </section>}
  </div>;
}
