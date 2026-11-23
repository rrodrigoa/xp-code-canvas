import type {GraphNode, SourceGraph, GraphEdge} from '../shared/types';
import type {ReviewFile,ReviewSnapshot} from './reviewTypes';

/** V7.2: deterministic structural comparisons, not AI summaries or proof of runtime behavior. */
export type ComparisonFrame='before'|'delta'|'after';
export type TransformationKind='added'|'removed'|'signature'|'decorator'|'base-class'|'call-added'|'call-removed'|'control-flow'|'body-changed'|'moved-candidate';
export interface Transformation {
  id:string;symbolId:string;kind:TransformationKind;title:string;before?:string;after?:string;
  uri:string;line:number;confidence:'source-backed'|'candidate';
  /** Only a source-backed observable fact; no claim about runtime effects. */
  evidence:'declaration'|'static-edge'|'ast-region'|'structural-fingerprint';
}
export interface GraphView { nodes:GraphNode[];edges:GraphEdge[] }
export interface ComparisonModel {
  before:GraphView;
  transformations:Transformation[];
  truncated:boolean;
  /** Revision names for display, not user-provided Git arguments. */
  beforeLabel:string;afterLabel:string;
}
const index=(nodes:GraphNode[])=>new Map(nodes.map(n=>[n.id,n]));
const key=(e:GraphEdge)=>`${e.source}|${e.target}|${e.kind}|${e.confidence}`;
const edgeKey=(items:GraphEdge[])=>new Map(items.map(e=>[key(e),e]));
const location=(n:GraphNode)=>({uri:n.uri,line:n.range.startLine});
function normalize(text:string):string{return text.replace(/\s+/g,' ').trim();}
function mk(node:GraphNode,kind:TransformationKind,title:string,before?:string,after?:string,evidence:Transformation['evidence']='declaration',confidence:Transformation['confidence']='source-backed'):Transformation{
  return {id:`${node.id}:${kind}:${normalize(before??'')}:${normalize(after??'')}`,symbolId:node.id,kind,title,before,after,...location(node),evidence,confidence};
}
function controlSignature(n:GraphNode):string {
  return (n.anatomy??[]).map(a=>`${a.kind}:${a.depth}:${a.label}`).join('|');
}
function collect(node:GraphNode,previous:GraphNode|undefined,out:Transformation[]):void{
  if(!previous){out.push(mk(node,'added','Declaration added',undefined,node.signature||node.qualifiedName));return;}
  if(previous.signature!==node.signature)out.push(mk(node,'signature','Signature changed',previous.signature,node.signature));
  const oldDecorators=previous.decorators.join(', '),newDecorators=node.decorators.join(', ');
  if(oldDecorators!==newDecorators)out.push(mk(node,'decorator','Decorators changed',oldDecorators,newDecorators));
  const basesBefore=previous.bases.join(', '),basesAfter=node.bases.join(', ');
  if(basesBefore!==basesAfter)out.push(mk(node,'base-class','Declared bases changed',basesBefore,basesAfter));
  const oldControl=controlSignature(previous),newControl=controlSignature(node);
  if(oldControl!==newControl)out.push(mk(node,'control-flow','AST control regions changed',oldControl,newControl,'ast-region'));
  if(previous.structuralHash!==node.structuralHash && !out.some(t=>t.symbolId===node.id)) {
    out.push(mk(node,'body-changed','Source structure changed',previous.structuralHash?.slice(0,12),node.structuralHash?.slice(0,12),'structural-fingerprint'));
  }
}
/** Bounded: a huge AI PR must remain navigable; truncation is visibly reported. */
export function buildComparison(before:SourceGraph,after:SourceGraph,beforeLabel:string,afterLabel:string,limit=3000):ComparisonModel {
  const b=index(before.nodes),a=index(after.nodes);
  const transformations:Transformation[]=[];
  for(const n of after.nodes){if(!b.has(n.id)||b.get(n.id)?.structuralHash!==n.structuralHash||b.get(n.id)?.signature!==n.signature)collect(n,b.get(n.id),transformations);}
  for(const n of before.nodes)if(!a.has(n.id))transformations.push(mk(n,'removed','Declaration removed',n.signature||n.qualifiedName,undefined));
  // Same short name and fingerprint across different identities suggests a move.
  // This is intentionally a candidate, never an asserted refactor.
  const vanished=before.nodes.filter(n=>!a.has(n.id));
  const appeared=after.nodes.filter(n=>!b.has(n.id));
  for(const old of vanished){
    const candidates=appeared.filter(n=>n.name===old.name&&n.kind===old.kind&&n.structuralHash===old.structuralHash);
    if(candidates.length===1)transformations.push(mk(candidates[0],'moved-candidate','Possible declaration move',old.uri,candidates[0].uri,'structural-fingerprint','candidate'));
  }
  const oldEdges=edgeKey(before.edges),newEdges=edgeKey(after.edges);
  for(const [id,edge] of newEdges)if(!oldEdges.has(id)){
    const source=a.get(edge.source);if(source){const fact=mk(source,'call-added',`${edge.kind} relationship added`,undefined,`${source.qualifiedName} → ${a.get(edge.target)?.qualifiedName??edge.target}`,'static-edge',edge.confidence==='resolved'&&edge.evidence.length>0?'source-backed':'candidate');
      fact.uri=edge.evidence[0]?.uri??source.uri;fact.line=edge.evidence[0]?.range.startLine??source.range.startLine;transformations.push(fact);}
  }
  for(const [id,edge] of oldEdges)if(!newEdges.has(id)){
    const source=b.get(edge.source);if(source){const fact=mk(source,'call-removed',`${edge.kind} relationship removed`,`${source.qualifiedName} → ${b.get(edge.target)?.qualifiedName??edge.target}`,undefined,'static-edge',edge.confidence==='resolved'&&edge.evidence.length>0?'source-backed':'candidate');
      fact.uri=edge.evidence[0]?.uri??source.uri;fact.line=edge.evidence[0]?.range.startLine??source.range.startLine;transformations.push(fact);}
  }
  transformations.sort((l,r)=>l.uri.localeCompare(r.uri)||l.line-r.line||l.id.localeCompare(r.id));
  return {before:{nodes:before.nodes.map(n=>({...n,source:''})),edges:before.edges},transformations:transformations.slice(0,limit),truncated:transformations.length>limit,beforeLabel,afterLabel};
}
/** Always preserve identity and layout coordinates; only visibility/properties change. */
export function comparisonFrame(review:ReviewSnapshot,frame:ComparisonFrame):GraphView {
  if(frame==='delta'||!review.comparison)return review.graph;
  const before=review.comparison.before;
  if(frame==='before')return {nodes:before.nodes,edges:before.edges};
  return {nodes:review.graph.nodes.filter(n=>n.change!=='REMOVED'&&!n.baselineOnly),
    edges:review.graph.edges.filter(e=>e.change!=='REMOVED')};
}
export interface EvidenceSummary {
  sourceChanges:number;relationshipChanges:number;ambiguousRelations:number;
  changedTestFiles:ReviewFile[];changedDocs:ReviewFile[];changedConfig:ReviewFile[];
  testExecution:'not-provided';reviewThreads:number;unresolvedThreads:number;
}
/** No test-pass claim can be inferred from changed test files. */
export function evidenceSummary(review:ReviewSnapshot):EvidenceSummary{
  const lower=(file:ReviewFile)=>file.path.toLowerCase();
  const tests=review.files.filter(f=>/(^|\/)(tests?|specs?)(\/|_)|(^|\/).*(_test|\.test|\.spec)\.[^.]+$/i.test(lower(f)));
  const docs=review.files.filter(f=>/(^|\/)(docs?\/|readme|changelog)|\.mdx?$|\.rst$/i.test(lower(f)));
  const config=review.files.filter(f=>/(^|\/)(\.github\/|pyproject\.toml|package(-lock)?\.json|.*\.ya?ml$|.*\.toml$|.*\.ini$)/i.test(lower(f)));
  return {sourceChanges:review.graph.nodes.filter(n=>n.change&&n.change!=='UNCHANGED'&&n.change!=='IMPACTED').length,
    relationshipChanges:review.graph.edges.filter(e=>e.change==='ADDED'||e.change==='REMOVED').length,
    ambiguousRelations:review.graph.edges.filter(e=>e.confidence!=='resolved').length,
    changedTestFiles:tests,changedDocs:docs,changedConfig:config,testExecution:'not-provided',
    reviewThreads:review.threads.length,unresolvedThreads:review.threads.filter(t=>t.status==='open').length};
}
