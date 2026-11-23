import {describe,it,expect} from 'vitest';
import {buildReviewAtlas} from '../../src/review/reviewAtlas';
import type {GraphNode,SourceGraph} from '../../src/shared/types';
import type {ReviewSnapshot} from '../../src/review/reviewTypes';
const range={startLine:0,startCharacter:0,endLine:9,endCharacter:0};
const mk=(id:string,uri:string,change:GraphNode['change']):GraphNode=>({id,uri,kind:'function',name:id,qualifiedName:id,root:'/',module:'a',moduleId:'m',parentId:null,
  range,selectionRange:range,version:1,visibility:'public',decorators:[],signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved',change});
const nodes=[mk('api','file:///src/api.py','MODIFIED'),mk('impl','file:///src/impl.py','ADDED'),mk('tests','file:///tests/test_api.py','MODIFIED'),mk('caller','file:///src/consumer.py','IMPACTED'),mk('other','file:///src/other.py','UNCHANGED')];
const graph:SourceGraph={schema:1,nodes,edges:[
  {id:'change',source:'api',target:'impl',kind:'calls',confidence:'resolved',change:'ADDED',evidence:[]},
  {id:'impact',source:'caller',target:'api',kind:'calls',confidence:'resolved',evidence:[]}
],diagnostics:[]};
const review:ReviewSnapshot={reviewKey:'working:a',scope:'working',title:'test',baseline:'HEAD',head:'WORKTREE',graph,
  threads:[],createdAt:'2026-11-21T00:00:00Z',analysisAvailable:true,
  files:[{path:'src/api.py',status:'modified'},{path:'src/impl.py',status:'added'},{path:'tests/test_api.py',status:'modified'},
    {path:'README.md',status:'modified'},{path:'pyproject.toml',status:'modified'}]};
describe('V7.1 code-review atlas',()=>{
  it('groups connected changed symbols but not impact-only callers',()=>{
    const atlas=buildReviewAtlas(review);
    const joined=atlas.chapters.find(c=>c.symbolIds.includes('api'))!;
    expect(joined.symbolIds).toContain('impl');
    expect(joined.symbolIds).not.toContain('caller');
    expect(joined.relationshipChanges).toBe(1);
    expect(joined.potentialCallers).toBe(1);
    expect(atlas.directCount).toBe(3);
    expect(atlas.impactedCount).toBe(1);
  });
  it('retains docs/config/test changes without inventing UML symbols',()=>{
    const atlas=buildReviewAtlas(review);
    expect(atlas.docFiles.map(f=>f.path)).toContain('README.md');
    expect(atlas.configFiles.map(f=>f.path)).toContain('pyproject.toml');
    expect(atlas.testFiles.map(f=>f.path)).toContain('tests/test_api.py');
    expect(atlas.chapters.some(c=>c.kind==='unmapped')).toBe(true);
  });
  it('has stable chapters across repeated runs and never marks a test as passed',()=>{
    const first=buildReviewAtlas(review),second=buildReviewAtlas(structuredClone(review));
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toMatch(/tests passed|runtime call/);
  });
});
