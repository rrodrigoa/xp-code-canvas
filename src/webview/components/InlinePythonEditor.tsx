import React,{useEffect,useMemo,useRef,useState} from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import type {SourceCursor} from '../../shared/types';
import {request} from '../bridge';
import './inlinePythonEditor.css';
/** Small dependency-free editor: native textarea owns keyboard/selection/IME/undo,
 * Prism renders the passive syntax mirror. All saves go through guarded WorkspaceEdit. */
export function InlinePythonEditor({nodeId,initialSource,hash,startLine,startCharacter,onClose,result,initialDraft,onDraftChange}:
  {nodeId:string;initialSource:string;hash:string;startLine:number;startCharacter:number;onClose:()=>void;
    initialDraft?:{originalSource:string;updatedSource:string;expectedHash:string};onDraftChange:(text:string)=>void;
    result?:{ok:boolean;error?:string;sequence:number}}){
  const [text,setText]=useState((initialDraft?.updatedSource??initialSource).replace(/\r\n/g,'\n'));
  const [submitting,setSubmitting]=useState(false);
  const textarea=useRef<HTMLTextAreaElement>(null),highlight=useRef<HTMLPreElement>(null);
  const [cursor,setCursor]=useState<SourceCursor>({line:startLine,character:startCharacter});
  const original=initialDraft?.originalSource??initialSource;
  const expectedHash=initialDraft?.expectedHash??hash;
  const baseline=original.replace(/\r\n/g,'\n');
  const dirty=text!==baseline;
  const html=useMemo(()=>Prism.highlight(text+'\n',Prism.languages.python,'python'),[text]);
  const previousSequence=useRef(result?.sequence??0);
  useEffect(()=>{
    if(!result||result.sequence<=previousSequence.current)return;
    previousSequence.current=result.sequence;setSubmitting(false);
    if(result.ok)onClose();
  },[result,onClose]);
  useEffect(()=>{textarea.current?.focus();},[]);
  const setCursorFromSelection=(nextText?:string)=>{
    const el=textarea.current;if(!el)return;
    const offset=el.selectionStart;
    const prefix=(nextText??text).slice(0,offset),lines=prefix.split('\n');
    setCursor({line:startLine+lines.length-1,character:(lines.length===1?startCharacter:0)+lines[lines.length-1].length});
  };
  const handleKeyDown=(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
    e.stopPropagation();
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
      e.preventDefault();submit();return;
    }
    if(e.key==='Tab'&&!e.shiftKey){
      e.preventDefault();const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;
      const updated=text.slice(0,start)+'    '+text.slice(end);
      setText(updated);onDraftChange(updated);
      requestAnimationFrame(()=>{el.setSelectionRange(start+4,start+4);setCursorFromSelection();});
    }
  };
  const submit=()=>{
    if(!dirty||submitting)return;
    setSubmitting(true);
    request({type:'applyInlineEdit',nodeId,expectedHash,originalSource:original,updatedSource:text});
  };
  return <div className="inline-python-editor nodrag nopan nowheel" data-testid="inline-python-editor" onKeyDown={e=>e.stopPropagation()}>
    <div className="inline-editor-controls">
      <span><i className="codicon codicon-edit"/> Inline editing · local document</span>
      <span className="inline-editor-loc">L{cursor.line+1}:{cursor.character+1}</span>
      <button type="button" onClick={()=>request({type:'openNode',nodeId,cursor})} title="Continue editing at this caret in native VS Code">Native editor ↗</button>
      <button type="button" onClick={onClose} disabled={submitting}>Discard</button>
      <button type="button" className="inline-save" disabled={!dirty||submitting} onClick={submit}>{submitting?'Saving…':'Save'}</button>
    </div>
    <div className="inline-edit-surface" onWheel={event=>{if(!event.ctrlKey&&!event.metaKey)event.stopPropagation();}}>
      <pre className="inline-edit-highlight" ref={highlight} aria-hidden="true"><code dangerouslySetInnerHTML={{__html:html}}/></pre>
      <textarea ref={textarea} value={text} disabled={submitting} aria-label="Editable Python source inside UML node" spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off"
        onChange={e=>{setText(e.target.value);onDraftChange(e.target.value);setCursorFromSelection(e.target.value);}} onSelect={()=>setCursorFromSelection()} onKeyUp={()=>setCursorFromSelection()}
        onKeyDown={handleKeyDown} onScroll={e=>{if(highlight.current){highlight.current.scrollTop=e.currentTarget.scrollTop;highlight.current.scrollLeft=e.currentTarget.scrollLeft;}}}/>
    </div>
    <div className="inline-edit-status" role="status">
      {result?.error&&!submitting?<span className="inline-edit-error">{result.error} · Draft retained.</span>:dirty?'Unsaved draft · Save uses VS Code undo history; never stages or publishes changes.':'No edits made'}
    </div>
  </div>;
}
