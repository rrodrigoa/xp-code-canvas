import {ReviewAtlas} from './ReviewAtlas';
import {ChangeCognitionPanel,type ReviewCanvasFrame} from './ChangeCognitionPanel';
import type {ComparisonFrame} from '../../review/changeCognition';
import React, {useMemo,useState} from 'react';
import type {ReviewScope,ReviewSnapshot,ReviewTarget,ReviewThread} from '../../review/reviewTypes';
import {reviewMetrics,matchThreadToNodes} from '../../review/reviewProjection';
import {request} from '../bridge';
const scopes:{id:ReviewScope;label:string;icon:string;hint:string}[]=[
  {id:'working',label:'All work',icon:'git-compare',hint:'HEAD → current editor buffers, including staged changes'},
  {id:'unstaged',label:'Unstaged',icon:'edit',hint:'INDEX → current editor buffers'},
  {id:'staged',label:'Staged',icon:'git-commit',hint:'HEAD → index, excluding unstaged edits'},
  {id:'branch',label:'Branch',icon:'git-branch',hint:'Merge base → current HEAD'},
  {id:'pr',label:'Pull request',icon:'git-pull-request',hint:'Exact GitHub PR base/head (source available locally)'}
];
const stamp=(value:string)=>{try{return new Date(value).toLocaleString();}catch{return value;}};
function ThreadCard({thread,active,onSelect}: {thread:ReviewThread;active:boolean;onSelect:(id:string)=>void}){
  const first=thread.comments[0];
  return <button type="button" className={`review-thread-item ${active?'active':''}`} onClick={()=>onSelect(thread.id)} aria-pressed={active}>
    <span className={`review-thread-state ${thread.status}`}><i aria-hidden="true" className={`codicon codicon-${thread.status==='resolved'?'check':'comment-discussion'}`}/></span>
    <span className="review-thread-item-copy"><strong>{first?.body.slice(0,75)??'Review discussion'}</strong>
      <small>{first?.author??'Unknown'} · {thread.comments.length} message{thread.comments.length!==1?'s':''} · {thread.origin==='github'?'GitHub':'Local'}</small></span>
    {thread.status==='outdated'&&<span className="review-outdated">Old line</span>}
  </button>;
}
export function ReviewDock({review,onClose,onPickSymbol,selectedNode,selectedEdge,pendingTarget,clearPending,error,comparisonFrame,onComparisonFrame,revisions,activeRevision,onLoadRevision}:{
  review:ReviewSnapshot|null;onClose:()=>void;onPickSymbol:(id:string)=>void;selectedNode?:string|null;selectedEdge?:string|null;
  pendingTarget:ReviewTarget|null;clearPending:()=>void;error:string;
  comparisonFrame:ReviewCanvasFrame;onComparisonFrame:(frame:ComparisonFrame)=>void;revisions:string[];activeRevision?:string|null;onLoadRevision:(sha:string)=>void;
}){
  const [scope,setScope]=useState<ReviewScope>('working');
  const [reference,setReference]=useState('main');
  const [tab,setTab]=useState<'atlas'|'changes'|'threads'|'summary'|'cognition'>('atlas');
  const [filter,setFilter]=useState<'all'|'open'|'resolved'>('all');
  const [draft,setDraft]=useState('');
  const [reply,setReply]=useState('');
  const [summary,setSummary]=useState('');
  const [activeId,setActiveId]=useState<string|null>(null);
  const [editing,setEditing]=useState<string|null>(null),[editBody,setEditBody]=useState('');
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const metrics=useMemo(()=>review?reviewMetrics(review):null,[review]);
  const active=review?.threads.find(t=>t.id===activeId);
  const threads=review?.threads.filter(t=>filter==='all'||t.status===filter)??[];
  const target:ReviewTarget=pendingTarget??(selectedEdge?{edgeId:selectedEdge}:selectedNode?{nodeId:selectedNode}:{});
  const historicalFrame=comparisonFrame==='before'||comparisonFrame==='revision';
  const canComment=Boolean(target.nodeId||target.edgeId||target.uri)&&!historicalFrame;
  const submitDraft=()=>{
    if(!draft.trim()||!canComment)return;
    request({type:'reviewAction',action:{action:'add',target,body:draft}});setDraft('');clearPending();setTab('threads');
  };
  const replyTo=()=>{if(!active||!reply.trim())return;
    request({type:'reviewAction',action:{action:active.origin==='github'?'githubReply':'reply',threadId:active.id,body:reply}});
    setReply('');};
  const localAnchor=active?.target;
  return <aside className="review-dock" role="dialog" aria-modal="false" aria-label="Visual code review">
    <header className="review-dock-head"><div className="review-mark"><i aria-hidden="true" className="codicon codicon-git-pull-request"/></div>
      <div className="review-dock-name"><span className="review-eyebrow">XP · CODE INTELLIGENCE</span><strong>Architecture Review</strong></div>
      <button className="icon-button nodrag" title="Close review inspector" aria-label="Close review inspector" onClick={onClose}><i aria-hidden="true" className="codicon codicon-close"/></button>
    </header>
    <section className="review-mode-picker" aria-label="Select review source">
      <label htmlFor="review-scope">Compare</label><div className="review-source-controls">
      <select id="review-scope" value={scope} onChange={e=>{const v=e.target.value as ReviewScope;setScope(v);setReference(v==='pr'?'':v==='branch'?'main':'');}}>
        {scopes.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}
      </select>
      {(scope==='branch'||scope==='pr')&&<input aria-label={scope==='pr'?'GitHub PR owner/repo#number':'Branch base revision'} value={reference} onChange={e=>setReference(e.target.value)} placeholder={scope==='pr'?'owner/repo#123':'main'}/>}
      <button type="button" className="review-primary" onClick={()=>request({type:'reviewOpen',scope,reference:reference.trim()||undefined})}><i aria-hidden="true" className="codicon codicon-play"/> Review</button></div>
      <small>{scopes.find(s=>s.id===scope)?.hint}</small>
    </section>
    {error&&<div className="review-warning" role="alert"><i aria-hidden="true" className="codicon codicon-warning"/>{error}</div>}
    {review?<>
      <section className="review-context" aria-label="Review context">
        <span className="review-live-dot"/><div><strong>{review.title}</strong><small>{review.baseline.slice(0,12)} → {review.head.slice(0,12)}</small></div>
        <button className="icon-button" aria-label="Refresh review comments" title="Refresh review comments" onClick={()=>request({type:'reviewAction',action:{action:'refresh'}})}><i aria-hidden="true" className="codicon codicon-refresh"/></button>
      </section>
      {review.message&&<p className="review-notice" role="status">{review.message}</p>}
      <div className="review-completion"><span>Files inspected locally</span><strong>{review.reviewedFiles?.length??0} / {review.files.length}</strong><div className="review-completion-track"><span style={{width:`${review.files.length?Math.min(100,((review.reviewedFiles?.length??0)/review.files.length)*100):100}%`}}/></div></div>
      <section className="review-pulse" aria-label="Change impact metrics">
        <div><strong>{metrics?.changed}</strong><span>Changed</span></div><div><strong>{metrics?.potentiallyAffected}</strong><span>May be affected</span></div>
        <div><strong>{metrics?.linksChanged}</strong><span>Links Δ</span></div><div><strong>{metrics?.openThreads}</strong><span>Open threads</span></div>
      </section>
      <div className="review-legend"><span><i aria-hidden="true" className="review-swatch direct"/> Direct change</span><span><i aria-hidden="true" className="review-swatch impact"/> Possible impact</span><span><i aria-hidden="true" className="review-swatch muted"/> Unchanged</span></div>
      <nav className="review-tabs" aria-label="Review sections">
        {(['atlas','cognition','changes','threads','summary'] as const).map(t=><button key={t} className={tab===t?'active':''} aria-pressed={tab===t} onClick={()=>setTab(t)}>
          {t==='cognition'?'Understand':t==='atlas'?'Atlas':t==='changes'?`Files ${review.files.length}`:t==='threads'?`Threads ${review.threads.length}`:'Decision'}</button>)}
      </nav>
      {tab==='atlas'&&<ReviewAtlas review={review} onPickSymbol={onPickSymbol}/>}
      {tab==='cognition'&&<ChangeCognitionPanel review={review} selectedId={selectedNode} frame={comparisonFrame} onFrame={onComparisonFrame} onPickSymbol={onPickSymbol} revisions={revisions} activeRevision={activeRevision} onLoadRevision={onLoadRevision}/>}
      {tab==='changes'&&<div className="review-dock-scroll" role="region" aria-label="Changed files">
        <p className="review-section-caption">Select a file to view its native diff. Changed symbols remain emphasized on the canvas.</p>
        {review.files.map(file=><div className="review-file-row" key={file.path}>
          <button type="button" className="review-file-diff" onClick={()=>request({type:'reviewDiff',path:file.path})}><i className={`review-file-status ${file.status}`}>{file.status==='added'?'+':file.status==='deleted'?'−':file.status==='renamed'?'↪':'●'}</i>
          <span>{file.path}<small>{file.oldPath?`from ${file.oldPath}`:file.status}</small></span><i aria-hidden="true" className="codicon codicon-diff"/></button>
          <input type="checkbox" title="Mark file inspected locally" aria-label={`Mark ${file.path} inspected`} checked={(review.reviewedFiles??[]).includes(file.path)} onChange={e=>request({type:'reviewAction',action:{action:e.target.checked?'markReviewed':'unmarkReviewed',path:file.path}})} onClick={e=>e.stopPropagation()}/>
        </div>)}
        {!review.files.length&&<div className="review-empty">No tracked changes in this comparison.</div>}
      </div>}
      {tab==='threads'&&<div className="review-dock-scroll" role="region" aria-label="Review discussions">
        <div className="review-thread-filters">{(['all','open','resolved'] as const).map(f=><button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div>
        {threads.map(thread=><ThreadCard thread={thread} key={thread.id} active={thread.id===activeId} onSelect={id=>{setActiveId(id);setReply('');const first=matchThreadToNodes(thread,review.graph)[0];if(first)onPickSymbol(first);}}/>)}
        {!threads.length&&<div className="review-empty">No matching discussions. Select a UML node or a code line to leave a review note.</div>}
        {active&&<section className="review-conversation" aria-label="Selected discussion">
          <div className="review-conversation-title"><i aria-hidden="true" className="codicon codicon-comment-discussion"/> {active.origin==='github'?'GitHub review thread':'Local review thread'} <span>{active.status}</span></div>
          {active.publishedUrl&&<button className="review-anchor" onClick={()=>request({type:'reviewOpenUrl',url:active.publishedUrl!})}>Published to GitHub PR discussion · Open ↗</button>}
          {active.comments.map(c=><div className="review-message" key={c.id}><strong>{c.author}<time>{stamp(c.createdAt)}</time></strong>
            {editing===c.id?<><textarea aria-label="Edit GitHub review comment" value={editBody} onChange={e=>setEditBody(e.target.value)} rows={3}/><div className="review-message-actions">
              <button disabled={!editBody.trim()} onClick={()=>{request({type:'reviewAction',action:{action:'githubEdit',threadId:active.id,commentId:c.id,body:editBody}});setEditing(null);}}>Save edit</button><button onClick={()=>setEditing(null)}>Cancel</button></div></>:<p>{c.body}</p>}
            {active.origin==='github'&&c.id.startsWith('db:')&&<div className="review-message-actions"><button onClick={()=>{setEditing(c.id);setEditBody(c.body);}}>Edit</button>
              <button onClick={()=>setConfirmDelete(c.id)}>{confirmDelete===c.id?'Confirm delete':'Delete'}</button>
              {confirmDelete===c.id&&<button onClick={()=>{request({type:'reviewAction',action:{action:'githubDelete',threadId:active.id,commentId:c.id}});setConfirmDelete(null);}}>Confirm</button>}</div>}
            {c.url&&<button className="review-anchor" onClick={()=>request({type:'reviewOpenUrl',url:c.url!})} title="Open comment on GitHub">GitHub ↗</button>}</div>)}
          {localAnchor&&(localAnchor.uri||localAnchor.nodeId)&&<div className="review-anchor">{localAnchor.qualifiedName??localAnchor.uri?.split('/').pop()??'Relationship'} {localAnchor.line!==undefined?` · line ${localAnchor.line+1}`:''}</div>}
          <textarea aria-label="Reply to review thread" placeholder="Reply with reasoning, a question, or a fix request…" rows={3} value={reply} onChange={e=>setReply(e.target.value)}/>
          <div className="review-message-actions"><button onClick={replyTo} disabled={!reply.trim()}>Reply</button>
            <button onClick={()=>request({type:'reviewAction',action:{action:active.origin==='github'?(active.status==='resolved'?'githubReopen':'githubResolve'):(active.status==='resolved'?'reopen':'resolve'),threadId:active.id}})}>
              {active.status==='resolved'?'Reopen':'Resolve'}</button>
            {active.origin==='local'&&<button onClick={()=>request({type:'reviewAction',action:{action:'delete',threadId:active.id}})}>Delete</button>}
            {active.origin==='local'&&review.pr&&!active.publishedUrl&&<button className="review-publish" title="Publish this line-anchored draft to GitHub" onClick={()=>request({type:'reviewAction',action:{action:'githubPost',threadId:active.id}})}>Publish</button>}
          </div>
        </section>}
      </div>}
      {tab==='summary'&&<div className="review-dock-scroll review-summary" role="region" aria-label="Review decision">
        <h3>Ready to submit?</h3><p>Make your review decision only after inspecting the code. Local notes are never automatically posted.</p>
        <textarea aria-label="Review summary" value={summary} onChange={e=>setSummary(e.target.value)} rows={5} placeholder="Describe the architectural impact, concerns, and approval rationale…"/>
        {review.pr?<div className="review-decision-actions"><button disabled={!summary.trim()} onClick={()=>request({type:'reviewAction',action:{action:'githubSubmit',event:'COMMENT',body:summary}})}>Comment</button>
          <button disabled={!summary.trim()} onClick={()=>request({type:'reviewAction',action:{action:'githubSubmit',event:'REQUEST_CHANGES',body:summary}})}>Request changes</button>
          <button className="review-primary" onClick={()=>request({type:'reviewAction',action:{action:'githubSubmit',event:'APPROVE',body:summary}})}>Approve</button></div>
          :<div className="review-notice">Local review: notes stay in VS Code workspace storage. Open a GitHub PR for online review submission.</div>}
      </div>}
      {historicalFrame&&<p className="review-notice">Historical comparison is read-only. Switch to Delta or After before anchoring a new source review comment.</p>}
      <section className="review-compose" aria-label="Add local review note"><div className="review-compose-title"><i aria-hidden="true" className="codicon codicon-comment-add"/><strong>New architectural note</strong>
        <span>{canComment?(target.qualifiedName??target.nodeId??target.edgeId??`line ${(target.line??0)+1}`).slice(0,30):'Select a node or edge'}</span></div>
        <textarea aria-label="New review comment" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="What could break? Ask a question or record a design concern…" rows={3}/>
        <button className="review-primary" disabled={!draft.trim()||!canComment} onClick={submitDraft}><i aria-hidden="true" className="codicon codicon-comment"/> Add local note</button>
      </section>
      <button className="review-end" type="button" onClick={()=>{request({type:'reviewClose'});clearPending();setActiveId(null);}}>End review · restore live graph</button>
    </>:<div className="review-get-started"><i aria-hidden="true" className="codicon codicon-git-compare"/><h3>Review the change, not just the diff.</h3>
      <p>Start with staged code, working edits, a branch, or a GitHub PR. See direct changes, callers that may be affected, and inline discussions on the same graph.</p></div>}
  </aside>;
}
