import React,{useState} from 'react';
import type {GraphNode} from '../../../shared/types';

const icons:Record<string,string>={module:'symbol-module',class:'symbol-class',function:'symbol-function',method:'symbol-method',property:'symbol-property',external:'question'};
export interface UmlCardHeaderProps {
  symbol:GraphNode;expanded:boolean;pinned:boolean;
  onExpand:()=>void;onBlame:()=>void;onPin:()=>void;onOpen:()=>void;
}
/** Code identity is always visible. Secondary actions are accessible through a single
 * overflow button; the editor action remains a direct button at every detail tier. */
export function UmlCardHeader({symbol:n,expanded,pinned,onExpand,onBlame,onPin,onOpen}:UmlCardHeaderProps){
  const [menu,setMenu]=useState(false);
  const title=n.name==='__root__'?n.module:n.name;
  return <div className="uml-heading">
    <span className={`uml-kind-icon codicon codicon-${icons[n.kind]??'symbol-misc'}`} aria-hidden="true"/>
    <div className="uml-identity" title={n.qualifiedName}>
      <span className="uml-eyebrow">«{n.kind==='module'?'module':n.stereotype||n.kind}»{n.async_?' · async':''}</span>
      <strong className="uml-title">{title}</strong>
    </div>
    <div className="node-actions nodrag nopan" role="toolbar" aria-label={`Actions for ${n.qualifiedName}`}>
      <button type="button" className="icon-button node-action" aria-label={`Open ${n.name} in VS Code editor`} title="Open in VS Code editor" onClick={e=>{e.stopPropagation();onOpen();}}><i className="codicon codicon-go-to-file"/></button>
      <div className="node-overflow" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as HTMLElement|null))setMenu(false);}}>
        <button type="button" aria-label={`More actions for ${n.name}`} aria-expanded={menu} title="More symbol actions" className="icon-button node-action node-overflow-trigger" onClick={e=>{e.stopPropagation();setMenu(v=>!v);}}><i className="codicon codicon-ellipsis"/></button>
        {menu&&<div className="node-menu" role="menu" aria-label={`Actions for ${n.name}`} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setMenu(false);}}}>
          <button role="menuitem" onClick={e=>{e.stopPropagation();onExpand();setMenu(false);}}><i className={`codicon codicon-${expanded?'chevron-up':'code'}`}/>{expanded?'Collapse details':'Expand to source'}</button>
          <button role="menuitem" onClick={e=>{e.stopPropagation();onBlame();setMenu(false);}}><i className="codicon codicon-git-commit"/>Inspect Git blame</button>
          <button role="menuitem" onClick={e=>{e.stopPropagation();onPin();setMenu(false);}}><i className={`codicon codicon-${pinned?'pinned':'pin'}`}/>{pinned?'Unpin position':'Pin position'}</button>
        </div>}
      </div>
    </div>
  </div>;
}
