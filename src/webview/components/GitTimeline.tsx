import React, { useMemo } from 'react';
import { layoutGitLanes, type GitCommit } from '../../shared/gitHistory';

interface Props {
  commits: GitCommit[];
  selected: string;
  loading: boolean;
  error: string;
  onSelect: (revision: string) => void;
  onCompare: (revision: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}
const COLORS = ['var(--xp-lane-0)', 'var(--xp-lane-1)', 'var(--xp-lane-2)', 'var(--xp-lane-3)', 'var(--xp-lane-4)', 'var(--xp-lane-5)'];
const laneColor = (lane:number) => COLORS[lane % COLORS.length];
const STEP=15;
function LanePlot({row, maxLanes}:{row:ReturnType<typeof layoutGitLanes>[number];maxLanes:number}) {
  const width=Math.max(35,maxLanes*STEP+12);
  return <svg className="git-lane-plot" width={width} height="65" viewBox={`0 0 ${width} 65`} aria-hidden="true">
    {row.segments.map((seg,i) => {
      const x1=9+STEP*seg.from, x2=9+STEP*seg.to;
      return <path key={`${seg.from}-${seg.to}-${i}`} d={seg.from===seg.to?`M${x1} 0V65`:`M${x1} 0 C${x1} 30 ${x2} 35 ${x2} 65`} fill="none" stroke={laneColor(seg.from)} strokeWidth="2.2" strokeLinecap="round" opacity={seg.active?1:.8}/>;
    })}
    <circle cx={9+row.lane*STEP} cy="29" r="5.4" fill="var(--xp-surface-1)" stroke={laneColor(row.lane)} strokeWidth="2.6"/>
  </svg>;
}

export function GitTimeline({commits,selected,loading,error,onSelect,onCompare,onClose,onRefresh}:Props){
  const rows=useMemo(()=>layoutGitLanes(commits),[commits]);
  const maxLanes=Math.max(1,...rows.map(r=>Math.max(r.before.length,r.after.length)));
  return <section className="git-drawer" role="dialog" aria-modal="false" aria-label="Git history and semantic comparison">
    <header className="git-drawer-header">
      <div><span className="drawer-eyebrow">REPOSITORY</span><h2><i className="codicon codicon-git-branch" aria-hidden="true"/> Git history</h2></div>
      <div className="drawer-actions">
        <button className="icon-button" title="Refresh commit history" aria-label="Refresh Git history" onClick={onRefresh}><i className="codicon codicon-refresh"/></button>
        <button className="icon-button" title="Close Git history" aria-label="Close Git history" onClick={onClose}><i className="codicon codicon-close"/></button>
      </div>
    </header>
    <div className="git-drawer-intro">Select a commit to choose a comparison baseline. The graph shows source-backed semantic changes, not guessed dependencies.{maxLanes>10&&<span> Wide branch history: scroll the timeline horizontally to inspect every lane.</span>}</div>
    <div className="git-rows" role="list" aria-label="Recent commits">
      {loading && <p className="empty-inline" role="status">Loading commit history…</p>}
      {error && <p className="empty-inline" role="alert">{error}</p>}
      {!loading && !error && !rows.length && <p className="empty-inline">No Git history is available in this workspace.</p>}
      {rows.map(row=> <div role="listitem" key={row.commit.hash} className="git-commit-item"><button type="button" style={{minWidth:Math.max(400,maxLanes*STEP+220)}} aria-current={selected===row.commit.hash?'true':undefined} className={`git-commit-row ${selected===row.commit.hash?'is-current':''}`} onClick={()=>onSelect(row.commit.hash)} onDoubleClick={()=>onCompare(row.commit.hash)} title="Select as baseline; double-click to compare">
        <LanePlot row={row} maxLanes={maxLanes}/>
        <span className="git-commit-text">
          <span className="git-subject" title={row.commit.subject}>{row.commit.subject}</span>
          <span className="git-metadata"><code>{row.commit.hash.slice(0,8)}</code><span>{row.commit.author}</span><time dateTime={row.commit.date}>{row.commit.date.slice(0,10)}</time></span>
          {row.commit.refs.length>0 && <span className="git-refs">{row.commit.refs.map(ref=><span key={ref} className={`git-ref ${ref.includes('HEAD')?'head':''}`}>{ref}</span>)}</span>}
        </span>
        {selected===row.commit.hash && <i className="codicon codicon-check" aria-label="Selected"/>}
      </button></div>)}
    </div>
    <footer className="git-drawer-footer">
      <span className="git-baseline-label">Baseline <code>{selected.length>12?selected.slice(0,8):selected}</code></span>
      <button className="button-primary" disabled={!selected} onClick={()=>onCompare(selected)}><i className="codicon codicon-git-compare"/> Compare</button>
    </footer>
  </section>;
}
