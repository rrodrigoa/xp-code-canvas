import React from 'react';
import type { BlameResult } from '../../shared/blame';
export function BlameSummary({result,compact=false}:{result:BlameResult;compact?:boolean}){
  if(result.status!=='clean')return <div className="blame-status" role="status"><i className="codicon codicon-info"/>{result.message??'Blame unavailable'} <span>Basis: HEAD</span></div>;
  const summary=result.summary;
  if(!summary?.lines)return <div className="blame-status">No attributable lines in Git HEAD</div>;
  return <section className={`blame-summary ${compact?'is-compact':''}`} aria-label="Git blame line-attribution summary">
    <div className="blame-title"><span><i className="codicon codicon-git-commit"/> LAST-MODIFIED ATTRIBUTION</span><span>{summary.uniqueCommits} commits · {summary.lines} lines</span></div>
    <div className="blame-bars" aria-label="Share of source lines last modified by contributor">
      {summary.authors.map((a,i)=><span key={a.author} className={`blame-bar blame-bar-${i%6}`} style={{flex:a.lines}} title={`${a.author}: ${a.lines} lines (${Math.round(a.share*100)}%)`}/>)}
    </div>
    {!compact&&<div className="blame-authors">
      {summary.authors.slice(0,5).map((a,i)=><div key={a.author} className="blame-author"><i className={`blame-dot blame-dot-${i%6}`}/><span>{a.author}</span><b>{Math.round(a.share*100)}%</b></div>)}
    </div>}
    {!compact&&summary.latest&&<div className="blame-latest" title={summary.latest.summary}>Most recent attributed change: <strong>{summary.latest.author}</strong> · {new Date(summary.latest.timestamp*1000).toLocaleDateString()}</div>}
    {!compact&&<small className="blame-qualification">Git blame records the last modifying commit for each HEAD line; it does not establish original authorship or ownership.</small>}
  </section>;
}
