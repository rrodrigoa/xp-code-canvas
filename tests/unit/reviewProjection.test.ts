import {describe,it,expect} from 'vitest';
import type {GraphNode,SourceGraph} from '../../src/shared/types';
import {decorateReview,matchThreadToNodes,reviewMetrics,validateTarget} from '../../src/review/reviewProjection';
import type {ReviewSnapshot,ReviewThread} from '../../src/review/reviewTypes';
function node(id:string,kind:'module'|'class'|'method',parentId:string|null,startLine:number,change?:GraphNode['change']):GraphNode {
  return {id,kind,parentId,name:id,qualifiedName:id,uri:'file:///project/agent.py',root:'file:///project',module:'agent',moduleId:'module',
    range:{startLine,startCharacter:0,endLine:startLine+10,endCharacter:0},selectionRange:{startLine,startCharacter:0,endLine:startLine,endCharacter:0},
    version:1,visibility:'public',decorators:[],signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved',change};
}
const graph:SourceGraph={schema:1,nodes:[node('module','module',null,0),node('Agent','class','module',4),node('execute','method','Agent',10,'MODIFIED'),
  {...node('caller','method','Agent',30,'IMPACTED'),range:{startLine:30,startCharacter:0,endLine:40,endCharacter:0}}],
  edges:[{id:'e',source:'caller',target:'execute',kind:'calls',confidence:'resolved',evidence:[],change:'ADDED'}],diagnostics:[]};
const thread:ReviewThread={id:'t',origin:'local',status:'open',target:{uri:'agent.py',line:12},comments:[{id:'c',author:'me',body:'Review contract',createdAt:'2026-11-21T00:00:00Z'}]};
const review:ReviewSnapshot={reviewKey:'key',scope:'staged',title:'Staged',baseline:'HEAD',head:'INDEX',graph,files:[{path:'agent.py',status:'modified'}],threads:[thread],analysisAvailable:true,createdAt:'2026-11-21T00:00:00Z'};
describe('Source-backed review projection',()=>{
  it('separates directly changed from static potential impact',()=>{
    const values=decorateReview(review);
    expect([...values.direct]).toEqual(['execute']);expect([...values.affected]).toEqual(['caller']);
    expect(values.edgeStatus.get('e')).toBe('ADDED');
  });
  it('anchors a line to the narrowest containing symbol and rolls counts up to its class',()=>{
    expect(matchThreadToNodes(thread,graph)).toEqual(['execute']);
    const counts=decorateReview(review).counts;
    expect(counts.get('execute')?.open).toBe(1);expect(counts.get('Agent')?.open).toBe(1);expect(counts.get('module')?.open).toBe(1);
  });
  it('does not fabricate anchors if the source line is no longer present',()=>{
    expect(matchThreadToNodes({...thread,target:{uri:'missing.py',line:12}},graph)).toEqual([]);
  });
  it('handles resolved threads and computes accurate independent metrics',()=>{
    const measured=reviewMetrics({...review,threads:[{...thread,status:'resolved'}]});
    expect(measured.changed).toBe(1);expect(measured.potentiallyAffected).toBe(1);
    expect(measured.linksChanged).toBe(1);expect(measured.resolvedThreads).toBe(1);
  });
  it('rejects empty anchors and invalid line positions',()=>{
    expect(()=>validateTarget({})).toThrow();expect(()=>validateTarget({uri:'agent.py',line:-1})).toThrow();
  });
});
