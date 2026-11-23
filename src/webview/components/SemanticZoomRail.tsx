import React, {useRef, useState} from 'react';
import { DEFAULT_SEMANTIC_ZOOM_STOPS,updateSemanticZoomStop,zoomFromTrackFraction,zoomTrackFraction,
  type SemanticZoomStops } from '../../shared/semanticZoom';
import './semanticZoomRail.css';
const labels=['Detailed UML appears','Code anatomy appears','Source appears'];
const percent=(z:number)=>`${Math.round(z*100)}%`;
/** Visual zoom boundaries are interactive controls, not a second canvas zoom.
 * Keyboard arrows adjust by 3% and pointer drags work inside VS Code webviews. */
export function SemanticZoomRail({zoom,stops,onChange}:{zoom:number;stops:SemanticZoomStops;onChange:(next:SemanticZoomStops)=>void}){
  const [open,setOpen]=useState(false);const rail=useRef<HTMLDivElement>(null);
  const move=(index:number,clientY:number)=>{
    const bounds=rail.current?.getBoundingClientRect();if(!bounds||bounds.height<=0)return;
    const fraction=1-(clientY-bounds.top)/bounds.height;
    onChange(updateSemanticZoomStop(stops,index,zoomFromTrackFraction(fraction)));
  };
  return <div className={`semantic-zoom-panel ${open?'is-open':''}`} aria-label="Adjust semantic zoom transitions">
    <button type="button" className="semantic-zoom-toggle" title="Adjust where UML, anatomy and source detail appear" aria-expanded={open} aria-controls="xp-zoom-rail" onClick={()=>setOpen(v=>!v)}>
      <i className="codicon codicon-settings-gear" aria-hidden="true"/> <span>Detail zoom</span>
    </button>
    {open&&<div className="semantic-zoom-body" id="xp-zoom-rail">
      <strong>Semantic zoom</strong><small>Drag the three markers to decide when detail is revealed. Ctrl+wheel still changes actual zoom.</small>
      <div className="semantic-zoom-layout">
        <div className="semantic-zoom-track" ref={rail}>
          <span className="semantic-current" style={{bottom:`${zoomTrackFraction(zoom)*100}%`}} title={`Current canvas zoom: ${percent(zoom)}`}/>
          {stops.map((stop,i)=><button type="button" key={i} className={`semantic-stop semantic-stop-${i}`} role="slider"
            aria-label={labels[i]} aria-valuemin={Math.round((i===0?0.36:stops[i-1]+0.08)*100)} aria-valuemax={Math.round((i===2?2.72:stops[i+1]-0.08)*100)} aria-valuenow={Math.round(stop*100)} aria-valuetext={percent(stop)}
            style={{bottom:`${zoomTrackFraction(stop)*100}%`}}
            onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);move(i,event.clientY);}}
            onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))move(i,event.clientY);}}
            onKeyDown={event=>{
              const direction=event.key==='ArrowUp'||event.key==='ArrowRight'?1:event.key==='ArrowDown'||event.key==='ArrowLeft'?-1:0;
              if(direction){event.preventDefault();onChange(updateSemanticZoomStop(stops,i,stop+direction*.03));}
              if(event.key==='Home'||event.key==='End'){event.preventDefault();onChange(updateSemanticZoomStop(stops,i,event.key==='Home'?.28:2.8));}
            }}><span>{i+1}</span></button>)}
        </div>
        <div className="semantic-zoom-names">
          {[2,1,0].map(i=><div key={i}><span>{labels[i]}</span><strong>{percent(stops[i])}</strong></div>)}
          <div><span>Compact UML</span><strong>28%</strong></div>
        </div>
      </div>
      <button type="button" className="semantic-zoom-reset" onClick={()=>onChange([...DEFAULT_SEMANTIC_ZOOM_STOPS])}>Restore defaults</button>
    </div>}
  </div>;
}
