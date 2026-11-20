import React from 'react';
import type { StructurePart, StructureSummary } from '../../shared/semanticVisuals';

interface StructureMapProps {
  summary:StructureSummary;
  variant:'minimap'|'blocks';
  onSelect:(id:string)=>void;
}
const glyph:Record<string,string>={class:'symbol-class',module:'symbol-module',function:'symbol-function',method:'symbol-method',property:'symbol-property',external:'question'};
/** Construct blocks are derived exclusively from parsed declarations and source spans. */
export function StructureMap({summary,variant,onSelect}:StructureMapProps){
  if(summary.total===0)return <div className="structure-empty">No indexed child declarations</div>;
  const totalLines=Math.max(1,summary.parts.reduce((sum,part)=>sum+part.lineSpan,0));
  return <section className={`structure-map structure-${variant}`} aria-label="Source-backed code structure">
    <div className="structure-caption">
      <span><i className="codicon codicon-symbol-structure" aria-hidden="true"/> STRUCTURE</span>
      <span>{summary.total} constructs · {summary.connections} links</span>
    </div>
    <div className="structure-blocks" role="list" aria-label="Contained code declarations">
      {summary.parts.map((part:StructurePart)=>{
        const weight=Math.min(4,Math.max(1,Math.round(1+3*Math.sqrt(part.lineSpan/totalLines))));
        const contents=<><span className={`structure-glyph codicon codicon-${glyph[part.kind]??'symbol-misc'}`} aria-hidden="true"/>
          <span className="structure-name">{part.name}</span>
          {variant==='blocks'&&<span className="structure-metric">{part.linkCount>0?`${part.linkCount} links`:`${part.lineSpan} lines`}</span>}
          {part.change&&part.change!=='UNCHANGED'&&<i className="structure-diff-dot" title={`Git: ${part.change}`}/>}</>;
        const cls=`structure-block role-${part.role} ${part.change&&part.change!=='UNCHANGED'?`part-${part.change.toLowerCase()}`:''}`;
        const style={'--part-weight':String(weight)} as React.CSSProperties;
        return variant==='minimap'?<span key={part.id} role="listitem" className={cls} title={`${part.name}: ${part.kind}`} style={style} aria-hidden="true"/>:
          <button type="button" key={part.id}
          className={`${cls} nodrag nopan`}
          title={`${part.name} · ${part.kind} · ${part.lineSpan} source lines · ${part.linkCount} graph relationships`}
          onClick={e=>{e.stopPropagation();onSelect(part.id);}}
          aria-label={`Inspect ${part.kind} ${part.name}; ${part.linkCount} relationships`}
          style={style}>
          {contents}
        </button>;
      })}
      {summary.hidden>0&&<span className="structure-overflow" title={`${summary.hidden} more indexed declarations not displayed`}>+{summary.hidden} more</span>}
    </div>
  </section>;
}
