import {it,expect} from 'vitest';
import {useCanvasStore} from '../../src/webview/store';
import {DEFAULT_CANVAS_STATE,type SourceGraph} from '../../src/shared/types';
import type {ReviewSnapshot} from '../../src/review/reviewTypes';
import fixture from '../fixtures/sample-graph.json';
it('keeps live worker deltas out of immutable staged and historical review snapshots',()=>{
  const graph={...fixture,revision:1} as SourceGraph;
  const review:ReviewSnapshot={reviewKey:'snapshot',scope:'staged',title:'Staged',baseline:'HEAD',head:'INDEX',graph,files:[],threads:[],analysisAvailable:true,createdAt:'now'};
  const store=useCanvasStore.getState();store.hydrate(graph,DEFAULT_CANVAS_STATE);store.setReview(review);
  const before=JSON.stringify(useCanvasStore.getState().graph);
  expect(useCanvasStore.getState().applyDelta({baseRevision:1,nextRevision:2,upsertNodes:[{...graph.nodes[0],name:'live edit'}],removeNodeIds:[],upsertEdges:[],removeEdgeIds:[],diagnostics:[]})).toBe(false);
  expect(JSON.stringify(useCanvasStore.getState().graph)).toBe(before);
  useCanvasStore.getState().clearReview();useCanvasStore.getState().hydrate({...graph,revision:2});expect(useCanvasStore.getState().graph.revision).toBe(2);
});
