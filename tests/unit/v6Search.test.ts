import {describe,it,expect} from 'vitest';
import {rankSymbols} from '../../src/webview/navigation/symbolRanking';
import type {GraphNode} from '../../src/shared/types';
const n=(name:string)=>({id:name,name,qualifiedName:`Agent.${name}`,uri:`file:///a/${name}.py`,range:{startLine:0}} as GraphNode);
describe('V6 symbol search',()=>{
 it('prefers an exact-case class name over a lowercase module name',()=>{
  expect(rankSymbols([n('config'),n('Config'),n('ConfigAttribute')],'Config').map(x=>x.name)).toEqual(['Config','config','ConfigAttribute']);
 });
 it('ranks exact/prefix matches before incidental ones',()=>{
  const names=rankSymbols([n('executeSync'),n('callback'),n('execute'),n('preexecute')],'execute').map(x=>x.name);
  expect(names).toEqual(['execute','executeSync','preexecute']);
 });
 it('limits results for large workspaces',()=>{expect(rankSymbols(Array.from({length:30},(_,i)=>n(`task${i}`)),'task',5)).toHaveLength(5);});
});
