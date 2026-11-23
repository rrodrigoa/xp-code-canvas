import React from 'react';
export type GitVisualMode='changes'|'blame'|'history';
interface Props {selectedName?:string;mode:GitVisualMode|null;onMode:(mode:GitVisualMode)=>void;onClose:()=>void;hasBaseline:boolean}
/** Contextual Git operations, not a permanent editor column. */
export function GitCommandStrip({selectedName,mode,onMode,onClose,hasBaseline}:Props){
  return <div className="git-command-popover" role="dialog" aria-label="Git exploration">
    <div className="git-command-header"><span className="codicon codicon-git-branch"/> <strong>Git inspection</strong><button type="button" className="icon-button" onClick={onClose} aria-label="Close Git commands"><i aria-hidden="true" className="codicon codicon-close"/></button></div>
    <div className="git-mode-switch" role="group" aria-label="Git information mode">
      <button type="button" className={mode==='changes'?'active':''} aria-pressed={mode==='changes'} title="Compare semantic changes against Git HEAD" onClick={()=>onMode('changes')}><i aria-hidden="true" className="codicon codicon-git-compare"/>Changes</button>
      <button type="button" className={mode==='blame'?'active':''} aria-pressed={mode==='blame'} disabled={!selectedName} title="Show Git attribution for the selected symbol" onClick={()=>onMode('blame')}><i aria-hidden="true" className="codicon codicon-git-commit"/>Blame</button>
      <button type="button" className={mode==='history'?'active':''} aria-pressed={mode==='history'} title="Inspect commit history and branches" onClick={()=>onMode('history')}><i aria-hidden="true" className="codicon codicon-git-branch"/>History</button>
    </div>
    <p className="git-command-help">{mode==='changes'?'Changes are direct edits; downstream impact is a separate static estimate.':mode==='blame'?'Attribution records the last modifying commit for each HEAD line.':mode==='history'?'Commits and branch lanes are derived from local Git history.':`Select a mode${selectedName?` for ${selectedName}`:''}.`}</p>
    {hasBaseline&&<div className="git-command-active"><i aria-hidden="true" className="codicon codicon-check"/> Semantic comparison active</div>}
  </div>;
}
