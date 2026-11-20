/** Views are derived; changing layout never changes the canonical source graph. */
import type { CanvasState, SourceGraph } from '../../shared/types';
import { visibleGraph } from '../../shared/graph';
export function projectGraph(source: SourceGraph, view: CanvasState): SourceGraph {
  return visibleGraph(source, view);
}
