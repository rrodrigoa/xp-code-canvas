/** Line-level evidence from a Git baseline compared with the current VS Code
 * document. Neither execution frequency nor AI reasoning is inferred. */
export interface ReviewLineOverlay {
  nodeId:string;sourceHash:string;addedLines:number[];removedCount:number;addedCount:number;baseline:string;message?:string;
}
