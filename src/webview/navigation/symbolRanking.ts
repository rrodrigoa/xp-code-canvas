import type {GraphNode} from '../../shared/types';
/** Keyboard-accessible, local, deterministic symbol search. No agent or network. */
export function rankSymbols(nodes:readonly GraphNode[],query:string,limit=12):GraphNode[] {
  const exact=query.trim(),q=exact.toLocaleLowerCase();if(!q)return [];
  const score=(n:GraphNode)=>{
    const name=n.name.toLocaleLowerCase(),qualified=n.qualifiedName.toLocaleLowerCase(),uri=n.uri.toLocaleLowerCase();
    return name===q?(n.name===exact?0:.5):name.startsWith(q)?1:qualified.startsWith(q)?2:name.includes(q)?3:qualified.includes(q)?4:uri.includes(q)?5:99;
  };
  return nodes.map(n=>({n,rank:score(n)})).filter(x=>x.rank<99).sort((a,b)=>a.rank-b.rank||a.n.qualifiedName.localeCompare(b.n.qualifiedName))
    .slice(0,limit).map(x=>x.n);
}
