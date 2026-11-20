declare module 'elkjs/lib/elk.bundled.js' {
  export interface ElkElement { id: string; x?: number; y?: number; width?: number; height?: number; }
  export interface ElkGraph extends ElkElement {
    layoutOptions?: Record<string, string>;
    children?: ElkElement[];
    edges?: { id: string; sources: string[]; targets: string[] }[];
  }
  export default class ELK { layout(graph: ElkGraph): Promise<ElkGraph>; }
}
