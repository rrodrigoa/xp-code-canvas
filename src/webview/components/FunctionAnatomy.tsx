import React from 'react';
import type { CodeRegion, GraphNode } from '../../shared/types';
import { request } from '../bridge';
const ICONS:Record<CodeRegion['kind'],string>={branch:'split-horizontal',loop:'sync',exception:'warning',context:'lock',return:'arrow-left',raise:'error'};
/** Syntax-derived anatomy; never claim that blocks encode runtime reachability or profiling. */
export function FunctionAnatomy({symbol}:{symbol:GraphNode}){
  const regions=symbol.anatomy??[];
  if(!regions.length)return null;
  const total=Math.max(1,symbol.range.endLine-symbol.range.startLine+1);
  return <section className="function-anatomy" aria-label={`Control structures inside ${symbol.name}`}>
    <div className="anatomy-title"><span><i className="codicon codicon-symbol-structure"/> CODE ANATOMY</span><span>{regions.length} regions · static syntax</span></div>
    <div className="anatomy-regions nodrag nopan" role="group" aria-label="Source control regions">
      {regions.map(region=>{
        const length=Math.max(1,region.range.endLine-region.range.startLine+1);
        const width=Math.max(12,Math.min(100,Math.round(length/total*100)));
        return <button type="button" key={region.id} className={`anatomy-region anatomy-${region.kind} nodrag nopan`}
          onClick={e=>{e.stopPropagation();request({type:'openSourceRegion',nodeId:symbol.id,regionId:region.id});}}
          title={`${region.label} · L${region.range.startLine+1}–${region.range.endLine+1} · open source in editor`}
          aria-label={`${region.kind}: ${region.label}, line ${region.range.startLine+1}; open in native editor`}>
          <span className={`codicon codicon-${ICONS[region.kind]}`} aria-hidden="true"/>
          <span className="anatomy-region-body"><span className="anatomy-region-label">{region.label}</span>
            <span className="anatomy-track"><i style={{width:`${width}%`,marginLeft:`${region.depth*4}%`}}/></span></span>
          <span className="anatomy-region-line">L{region.range.startLine+1}</span>
        </button>;
      })}
    </div>
    <div className="anatomy-footnote">Block lengths represent source lines, not execution weight.</div>
  </section>;
}
