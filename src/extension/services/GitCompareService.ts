import * as vscode from 'vscode';
import { snapshotGit } from '../gitSnapshot';
import { analyzePython } from '../pythonWorker';
import { overlayChanges } from '../../shared/semanticDiff';
import type { SourceGraph } from '../../shared/types';
/** Immutable Git baseline, never writes or replaces the live graph. */
export class GitCompareService {
  constructor(private readonly context:vscode.ExtensionContext) {}
  async compare(baseline:string,current:SourceGraph):Promise<SourceGraph> {
    if(!vscode.workspace.isTrusted)throw Error('Git comparison requires a trusted workspace.');
    const files=await snapshotGit(baseline);
    const previous=await analyzePython(this.context,files);
    for(const node of previous.nodes)node.source='';
    return overlayChanges(previous,current);
  }
}
