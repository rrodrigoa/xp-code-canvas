import React,{useMemo,useState} from 'react';
import type {GraphNode} from '../../../shared/types';
import {rankSymbols} from '../../navigation/symbolRanking';
export {rankSymbols} from '../../navigation/symbolRanking';
export interface SymbolSearchProps {symbols:readonly GraphNode[];value:string;onValue:(s:string)=>void;onPick:(id:string)=>void}
export function SymbolSearch({symbols,value,onValue,onPick}:SymbolSearchProps){
  const [open,setOpen]=useState(false),[active,setActive]=useState(0);
  const matches=useMemo(()=>rankSymbols(symbols,value),[symbols,value]);
  const choose=(id:string)=>{onPick(id);onValue('');setOpen(false);setActive(0);};
  return <div className="symbol-search">
    <label className="search-field"><i className="codicon codicon-search" aria-hidden="true"/>
      <input type="search" role="combobox" aria-label="Find Python symbol" aria-autocomplete="list" aria-expanded={open&&matches.length>0} aria-controls="xp-symbol-results"
        placeholder="Find symbol…" value={value} onFocus={()=>setOpen(true)} onChange={e=>{onValue(e.target.value);setActive(0);setOpen(true);}}
        onKeyDown={e=>{
          if(e.key==='Escape'){setOpen(false);onValue('');}
          else if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(matches.length-1,i+1));setOpen(true);}
          else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1));}
          else if(e.key==='Enter'&&matches.length){e.preventDefault();choose(matches[active]?.id??matches[0].id);}
        }} />
      {value&&<button type="button" aria-label="Clear symbol search" className="input-clear" onClick={()=>{onValue('');setOpen(false);}}><i className="codicon codicon-close"/></button>}
    </label>
    {open&&value&&<div id="xp-symbol-results" className="symbol-search-results" role="listbox" aria-label="Matching code symbols">
      {matches.length===0?<div className="symbol-search-empty">No matching Python symbols</div>:matches.map((n,i)=><button type="button" key={n.id} role="option" aria-selected={i===active} className={i===active?'active':''}
        onMouseDown={e=>e.preventDefault()} onClick={()=>choose(n.id)}>
        <i className={`codicon codicon-symbol-${n.kind==='method'?'method':n.kind==='property'?'property':n.kind==='class'?'class':n.kind==='module'?'module':'function'}`} aria-hidden="true"/>
        <span><strong>{n.qualifiedName}</strong><small>{n.uri.split('/').pop()}:{n.range.startLine+1}</small></span>
      </button>)}
    </div>}
  </div>;
}
