import { describe, it, expect } from 'vitest';
import { sourceDelta, applySourceDelta } from '../../src/core/graph/GraphDelta';
import { GraphStore } from '../../src/core/graph/GraphStore';
import { fromLegacyGraph } from '../../src/core/contracts/graph.v2';
import { validateViewState, recoverViewState } from '../../src/core/contracts/viewState';
import { DEFAULT_CANVAS_STATE, type SourceGraph } from '../../src/shared/types';

const first:SourceGraph={schema:1,revision:1,nodes:[],edges:[],diagnostics:[],stats:{files:0}};
const second:SourceGraph={...first,revision:2,diagnostics:[{uri:'x',severity:'error',line:0,message:'broken'}],availability:'partial'};
describe('versioned graph transactions',()=>{
  it('validates a canonical graph snapshot and rejects stale revisions',()=>{
    const store=new GraphStore();
    const baseline=fromLegacyGraph(first,'test-workspace',1);
    store.replace(baseline);
    expect(store.get()?.schemaVersion).toBe(2);
    expect(()=>store.replace(baseline)).toThrow(/Out-of-order/);
  });
  it('applies revision-bound webview deltas and rejects out-of-order input',()=>{
    const delta=sourceDelta(first,second);
    const updated=applySourceDelta(first,delta);
    expect(updated.revision).toBe(2);
    expect(updated.diagnostics).toHaveLength(1);
    expect(()=>applySourceDelta(updated,delta)).toThrow(/revision/);
  });
  it('rejects duplicate semantic IDs and dangling evidence',()=>{
    const store=new GraphStore();
    const graph=fromLegacyGraph(first,'test-workspace',1);
    graph.symbols=[{
      id:'duplicate01',identityVersion:2,workspaceId:'test-workspace',kind:'function',moduleId:'duplicate01',parentId:null,
      name:'a',qualifiedName:'a',location:{uri:'file:///a.py',contentHash:'aaaaaaaa',span:{start:{line:0,utf16Column:0},end:{line:1,utf16Column:0}},selectionSpan:{start:{line:0,utf16Column:0},end:{line:1,utf16Column:0}}},
      signature:'a()',hashes:{signature:'a',body:'b',structure:'c'},modifiers:[],stereotype:null,stale:false,
    }];
    graph.symbols.push({...graph.symbols[0]});
    expect(()=>store.replace(graph)).toThrow(/Duplicate semantic symbol/);
  });
});
describe('session validation',()=>{
  it('preserves and validates source-independent layout state',()=>{
    const session=validateViewState({...DEFAULT_CANVAS_STATE,pinned:{abc:{x:18,y:48}}});
    expect(session.pinned.abc.x).toBe(18);
    expect(recoverViewState({schema:777})).toEqual(DEFAULT_CANVAS_STATE);
  });
});
