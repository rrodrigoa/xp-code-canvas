import type {ReviewSnapshot,ReviewFile} from './reviewTypes';
import type {GraphNode} from '../shared/types';

/** Review chapters are deterministic connected groups of directly changed Python symbols.
 * The model never asserts a runtime path, AI intention, or actual test coverage. */
export interface ReviewChapter {
  id:string;title:string;symbolIds:string[];changedSymbols:number;addedSymbols:number;removedSymbols:number;
  modifiedSymbols:number;relationshipChanges:number;potentialCallers:number;openThreads:number;
  files:string[];changeEdges:Array<{source:string;target:string;kind:string;change:string}>;
  kind:'source'|'unmapped';
}
export interface ReviewAtlas {
  chapters:ReviewChapter[];
  docFiles:ReviewFile[];testFiles:ReviewFile[];configFiles:ReviewFile[];otherFiles:ReviewFile[];
  directCount:number;impactedCount:number;relationChanges:number;
}
const active=(n:GraphNode)=>Boolean(n.change&&n.change!=='UNCHANGED'&&n.change!=='IMPACTED');
const fileName=(path:string)=>path.replace(/\\/g,'/').split('/').pop()||path;
const matchesGitPath=(uri:string,gitPath:string):boolean=>{
  let decoded=uri;try{decoded=decodeURIComponent(uri);}catch{return false;}
  const normalized=decoded.replace(/\\/g,'/').replace(/^file:\/\//,'').toLowerCase();
  const relative=gitPath.replace(/\\/g,'/').replace(/^\//,'').toLowerCase();
  return normalized.endsWith('/'+relative)||normalized===relative;
};
const isTest=(f:string)=>/(^|\/)(tests?|__tests__)(\/|$)|(^|\/)test_[^/]+\.py$|_test\.py$/i.test(f);
const isDocs=(f:string)=>/\.(md|mdx|rst|adoc|txt)$/i.test(f)||/(^|\/)(docs?|readme)(\/|$)/i.test(f);
const isConfig=(f:string)=>/(^|\/)(\.github|configs?|scripts)(\/|$)|\.(toml|ya?ml|json|ini|cfg|lock)$/i.test(f);
/** Makes high-density PRs reviewable without hiding README, test, or config edits. */
export function buildReviewAtlas(review:ReviewSnapshot):ReviewAtlas {
  const nodes=review.graph.nodes,edges=review.graph.edges;
  const direct=nodes.filter(active),byId=new Map(nodes.map(n=>[n.id,n]));
  const directSet=new Set(direct.map(n=>n.id));
  const parent=new Map(direct.map(n=>[n.id,n.id]));
  const find=(id:string):string=>{const p=parent.get(id)??id;if(p===id)return p;const root=find(p);parent.set(id,root);return root;};
  const join=(a:string,b:string)=>{const x=find(a),y=find(b);if(x!==y)parent.set(x<y?y:x,x<y?x:y);};
  // Same-file edits and direct code dependencies form review groups. Do not use
  // all callers: doing so would collapse most medium repositories into one component.
  const firstByFile=new Map<string,string>();
  for(const n of direct){const first=firstByFile.get(n.uri);if(first)join(n.id,first);else firstByFile.set(n.uri,n.id);}
  for(const e of edges){if(directSet.has(e.source)&&directSet.has(e.target))join(e.source,e.target);}
  const components=new Map<string,GraphNode[]>();
  for(const n of direct){const group=find(n.id);components.set(group,[...(components.get(group)??[]),n]);}
  const result:ReviewChapter[]=[];
  const changedEdges=edges.filter(e=>e.change&&e.change!=='UNCHANGED'&&e.change!=='IMPACTED');
  const threadByNode=new Map<string,number>();
  for(const thread of review.threads)if(thread.status==='open'){
    const id=thread.target.nodeId;if(id)threadByNode.set(id,(threadByNode.get(id)??0)+1);
  }
  for(const component of components.values()){
    component.sort((a,b)=>a.uri.localeCompare(b.uri)||a.range.startLine-b.range.startLine||a.id.localeCompare(b.id));
    // Cap each visible chapter at 14 nodes, but preserve all changed nodes across chapters.
    for(let start=0;start<component.length;start+=14){
      const batch=component.slice(start,start+14),ids=new Set(batch.map(n=>n.id));
      const related=changedEdges.filter(e=>ids.has(e.source)||ids.has(e.target));
      const affected=new Set(edges.filter(e=>ids.has(e.source)||ids.has(e.target))
        .map(e=>ids.has(e.source)?e.target:e.source).filter(id=>!ids.has(id)&&byId.get(id)?.change==='IMPACTED'));
      const files=[...new Set(review.files.filter(f=>batch.some(n=>matchesGitPath(n.uri,f.path))).map(f=>f.path))].sort();
      const primary=batch.find(n=>n.kind==='class')??batch.find(n=>n.kind==='function'||n.kind==='method')??batch[0];
      const prefix=primary.kind==='module'?fileName(primary.uri):primary.qualifiedName||primary.name;
      const title=start===0?prefix:`${prefix} · part ${Math.floor(start/14)+1}`;
      result.push({id:`chapter:${batch[0].id}`,title,symbolIds:batch.map(n=>n.id),files,kind:'source',
        changedSymbols:batch.length,addedSymbols:batch.filter(n=>n.change==='ADDED').length,
        modifiedSymbols:batch.filter(n=>n.change==='MODIFIED').length,
        removedSymbols:batch.filter(n=>n.change==='REMOVED').length,
        relationshipChanges:related.length,potentialCallers:affected.size,
        openThreads:batch.reduce((sum,n)=>sum+(threadByNode.get(n.id)??0),0),
        changeEdges:related.map(e=>({source:e.source,target:e.target,kind:e.kind,change:e.change??'UNCHANGED'}))});
    }
  }
  result.sort((a,b)=>b.relationshipChanges-a.relationshipChanges||b.changedSymbols-a.changedSymbols||a.title.localeCompare(b.title));
  const sortedFiles=[...review.files].sort((a,b)=>a.path.localeCompare(b.path));
  const testFiles=sortedFiles.filter(f=>isTest(f.path)),docFiles=sortedFiles.filter(f=>isDocs(f.path)&&!isTest(f.path));
  const configFiles=sortedFiles.filter(f=>isConfig(f.path)&&!isTest(f.path)&&!isDocs(f.path));
  const otherFiles=sortedFiles.filter(f=>!isTest(f.path)&&!isDocs(f.path)&&!isConfig(f.path));
  // Files without an indexed changed Python symbol deserve an explicit place.
  const covered=new Set(result.flatMap(c=>c.files));
  const unmatched=sortedFiles.filter(f=>!covered.has(f.path));
  if(unmatched.length)result.push({id:'chapter:remaining-files',title:'Additional changed files',symbolIds:[],files:unmatched.map(f=>f.path),kind:'unmapped',
    changedSymbols:0,addedSymbols:0,removedSymbols:0,modifiedSymbols:0,relationshipChanges:0,potentialCallers:0,openThreads:0,changeEdges:[]});
  return {chapters:result,docFiles,testFiles,configFiles,otherFiles,directCount:direct.length,
    impactedCount:nodes.filter(n=>n.change==='IMPACTED').length,relationChanges:changedEdges.length};
}
