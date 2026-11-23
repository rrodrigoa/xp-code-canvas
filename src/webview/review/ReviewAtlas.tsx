import React,{useMemo,useState} from 'react';
import type {ReviewSnapshot} from '../../review/reviewTypes';
import {buildReviewAtlas,type ReviewChapter} from '../../review/reviewAtlas';
import {request} from '../bridge';
import './atlas.css';
const short=(s:string,max=22)=>s.length>max?s.slice(0,max-1)+'…':s;
/** Tiny graph topology is illustrative of the exact changed symbol set;
 * it does NOT imply execution order or measured runtime flows. */
function ChapterMap({chapter,review}:{chapter:ReviewChapter;review:ReviewSnapshot}){
  const nodes=chapter.symbolIds.slice(0,6).map(id=>review.graph.nodes.find(n=>n.id===id)).filter((n):n is NonNullable<typeof n>=>!!n);
  const visible=new Set(nodes.map(n=>n.id));
  const links=chapter.changeEdges.filter(e=>visible.has(e.source)&&visible.has(e.target));
  const positions=new Map(nodes.map((n,i)=>[n.id,{x:65+(i%2)*135,y:25+Math.floor(i/2)*52}]));
  const height=Math.max(65,Math.ceil(nodes.length/2)*52+8);
  return <svg className="atlas-mini-map" viewBox={`0 0 284 ${height}`} role="img" aria-label={`${nodes.length} changed symbols and ${links.length} changed relationships displayed`}>
    {links.map((edge,i)=>{const a=positions.get(edge.source)!,b=positions.get(edge.target)!;return <path key={i} d={`M${a.x} ${a.y} L${b.x} ${b.y}`} stroke={edge.change==='REMOVED'?'var(--xp-removed)':'var(--xp-accent)'} strokeWidth="1.8" strokeDasharray={edge.change==='REMOVED'?'4 3':undefined} fill="none"/>;})}
    {nodes.map(n=>{const at=positions.get(n.id)!;return <g key={n.id}>
      <rect x={at.x-60} y={at.y-16} width="120" height="32" rx="6" className={`atlas-mini-node atlas-${n.change?.toLowerCase()}`}/>
      <text x={at.x} y={at.y+4} textAnchor="middle" fill="var(--xp-text)" fontSize="10">{short(n.name,18)}</text>
    </g>;})}
  </svg>;
}
export function ReviewAtlas({review,onPickSymbol}:{review:ReviewSnapshot;onPickSymbol:(id:string)=>void}){
  const atlas=useMemo(()=>buildReviewAtlas(review),[review]);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [visibleCount,setVisibleCount]=useState(24);
  const reviewed=new Set(review.reviewedFiles??[]);
  return <div className="review-dock-scroll review-atlas" role="region" aria-label="Visual change atlas">
    <div className="atlas-headline"><i className="codicon codicon-type-hierarchy"/><div><strong>Change Atlas</strong><small>Source-backed review groups, not AI-generated explanations</small></div></div>
    <div className="atlas-summary-strip"><span><strong>{atlas.directCount}</strong> changed symbols</span><span><strong>{atlas.relationChanges}</strong> relationship changes</span><span><strong>{atlas.impactedCount}</strong> possibly affected</span></div>
    <p className="review-section-caption">Start with groups of related changes, then follow their edges or inspect the actual diff. Grouping is based on file ownership and static graph relationships; it does not assert a runtime execution order.</p>
    {atlas.chapters.slice(0,visibleCount).map((chapter,i)=>{
      const isExpanded=expanded===chapter.id;
      const done=chapter.files.length>0&&chapter.files.every(path=>reviewed.has(path));
      return <section key={chapter.id} className={`atlas-chapter ${isExpanded?'expanded':''}`}>
        <button type="button" className="atlas-chapter-heading" onClick={()=>setExpanded(isExpanded?null:chapter.id)} aria-expanded={isExpanded}>
          <span className="atlas-chapter-number">{String(i+1).padStart(2,'0')}</span>
          <span className="atlas-chapter-title"><strong>{chapter.title}</strong><small>{chapter.changedSymbols} direct · {chapter.potentialCallers} possibly affected · {chapter.relationshipChanges} link changes</small></span>
          {done&&<i className="codicon codicon-check atlas-inspected" title="All files locally marked inspected"/>}
          <i className={`codicon codicon-chevron-${isExpanded?'up':'down'}`}/>
        </button>
        {isExpanded&&<div className="atlas-chapter-body">
          {chapter.symbolIds.length>0&&<ChapterMap chapter={chapter} review={review}/>}
          <div className="atlas-chapter-metrics"><span>+{chapter.addedSymbols} new</span><span>{chapter.modifiedSymbols} modified</span><span>−{chapter.removedSymbols} removed</span>{chapter.openThreads>0&&<span>{chapter.openThreads} open threads</span>}</div>
          {chapter.symbolIds.map(id=>{const symbol=review.graph.nodes.find(n=>n.id===id);return symbol&&<button key={id} type="button" className="atlas-symbol-link" onClick={()=>onPickSymbol(id)}><i className="codicon codicon-symbol-method"/><span>{symbol.qualifiedName}</span><small>{symbol.change}</small></button>;})}
          {chapter.files.map(file=><button type="button" key={file} className="atlas-file-link" onClick={()=>request({type:'reviewDiff',path:file})}><i className="codicon codicon-diff"/> {file.split('/').pop()} <span>View actual diff</span></button>)}
        </div>}
      </section>;
    })}
    {visibleCount<atlas.chapters.length&&<button type="button" className="atlas-load-more" onClick={()=>setVisibleCount(v=>v+24)}>Show more review groups ({atlas.chapters.length-visibleCount} remaining)</button>}
    <section className="atlas-adjacent"><strong>Cross-cutting review material</strong>
      <small>Changed files outside the Python UML remain visible. A changed test file is not proof tests passed.</small>
      {!atlas.testFiles.length&&<div className="atlas-review-signal"><i className="codicon codicon-info"/> No test files changed in this scope. This says nothing about whether tests ran or passed.</div>}
      {[{name:'Tests',items:atlas.testFiles,icon:'beaker'},{name:'Documentation',items:atlas.docFiles,icon:'book'},{name:'Configuration',items:atlas.configFiles,icon:'settings-gear'}].map(group=><div className="atlas-material" key={group.name}>
        <div><i className={`codicon codicon-${group.icon}`}/><strong>{group.name}</strong><small>{group.items.length} changed</small></div>
        {group.items.slice(0,6).map(f=><button key={f.path} onClick={()=>request({type:'reviewDiff',path:f.path})}>{f.path}<i className="codicon codicon-arrow-right"/></button>)}
      </div>)}
    </section>
  </div>;
}
