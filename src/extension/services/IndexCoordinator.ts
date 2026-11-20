import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import type { SourceGraph } from '../../shared/types';
import { fromLegacyGraph } from '../../core/contracts/graph.v2';
import { GraphStore } from '../../core/graph/GraphStore';
import { canonicalDelta, sourceDelta, type SourceGraphDelta } from '../../core/graph/GraphDelta';
import type { TextInput } from '../adapters/PythonWorkerClient';
import { PythonWorkerClient } from '../adapters/PythonWorkerClient';
import { VsCodeSourceRepository } from '../adapters/VsCodeSourceRepository';

/** Serial source updates; parser caches unchanged files in persistent worker. */
export class IndexCoordinator implements vscode.Disposable {
  readonly canonical = new GraphStore();
  readonly sources: VsCodeSourceRepository;
  readonly worker: PythonWorkerClient;
  private current: SourceGraph = { schema:1,nodes:[],edges:[],diagnostics:[] };
  private revision = 0;
  private sequence: Promise<void> = Promise.resolve();
  private disposed = false;
  private handlers: Array<(graph: SourceGraph,delta:SourceGraphDelta|null)=>void> = [];
  private known = new Set<string>();
  private queued = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private fullIndexDone = false;
  readonly workspaceId: string;
  constructor(context: vscode.ExtensionContext) {
    this.workspaceId = crypto.createHash('sha256').update((vscode.workspace.workspaceFolders??[]).map(f=>f.uri.toString()).sort().join('|')||'untitled').digest('hex').slice(0,20);
    this.sources = new VsCodeSourceRepository(this.workspaceId);
    this.worker = new PythonWorkerClient(context,()=>[...this.sources.snapshots.values()].map(r=>r.input));
  }
  get graph(): SourceGraph { return this.current; }
  onGraph(handler: (graph: SourceGraph,delta:SourceGraphDelta|null) => void): vscode.Disposable {
    this.handlers.push(handler);
    return {dispose: () => { this.handlers = this.handlers.filter(h=>h!==handler); }};
  }
  /** All worker messages are serialized. Never overwrite a newer graph with an older result. */
  private run(fn:()=>Promise<void>):Promise<void> {
    const operation = this.sequence.then(fn);
    this.sequence = operation.catch(()=>{});
    return operation;
  }
  async initialize(onProgress?: (done:number,total:number)=>void):Promise<void> {
    const uris = await this.sources.discover();
    const active = vscode.window.activeTextEditor?.document.uri.toString();
    uris.sort((a,b)=>Number(b.toString()===active)-Number(a.toString()===active));
    const initial = new Set(uris.map(u=>u.toString()));
    const removed = [...this.known].filter(uri=>!initial.has(uri));
    this.known = initial;
    for (let offset=0; offset<uris.length || (offset===0 && removed.length); offset+=64) {
      const batch=uris.slice(offset,offset+64);
      const inputs:TextInput[]=[];
      for (const uri of batch) {
        try {
          const doc=await this.sources.capture(uri);
          inputs.push(doc.input);
        } catch(error) {
          // Individual inaccessible files cannot invalidate the whole project.
          console.warn(`XP Canvas cannot read ${uri.toString()}: ${String(error)}`);
        }
      }
      await this.run(()=>this.commit(inputs,offset===0?removed:[]));
      onProgress?.(Math.min(offset+batch.length,uris.length),uris.length);
    }
    this.fullIndexDone=true;
  }
  schedule(uri: vscode.Uri): void {
    if (this.disposed || !uri.path.endsWith('.py')) return;
    this.queued.add(uri.toString());
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(()=>{ this.timer=undefined; void this.flush().catch(err=>console.error('XP Canvas indexing',err)); },220);
  }
  async flush():Promise<void> {
    const names=[...this.queued]; this.queued.clear();
    if (!names.length) return;
    const changed:TextInput[]=[];
    const removed:string[]=[];
    for (const name of names) {
      const uri=vscode.Uri.parse(name);
      try {
        const record=await this.sources.capture(uri);
        this.known.add(name); changed.push(record.input);
      } catch {
        if (this.known.has(name)) removed.push(name);
        this.known.delete(name); this.sources.remove(uri);
      }
    }
    await this.run(()=>this.commit(changed,removed));
  }
  async remove(uri:vscode.Uri):Promise<void> {
    const name=uri.toString();
    this.sources.remove(uri); this.known.delete(name);
    await this.run(()=>this.commit([],[name]));
  }
  private async commit(changes:TextInput[], removed:string[]):Promise<void> {
    if (this.disposed || (!changes.length && !removed.length)) return;
    let candidate:SourceGraph;
    try {candidate=await this.worker.index(changes,removed);}
    catch(error) {
      if(this.disposed)throw error;
      // One bounded worker restart; a persistent failure is surfaced, not hidden.
      await new Promise(resolve=>setTimeout(resolve,350));
      candidate=await this.worker.index(changes,removed);
    }
    if (this.disposed) return;
    // Ignore stale worker replies for documents that changed while indexing.
    for (const doc of changes) {
      const active=vscode.workspace.textDocuments.find(d=>d.uri.toString()===doc.uri);
      if (active && active.version!==doc.version) {
        this.schedule(active.uri); return;
      }
    }
    const previous=this.canonical.get();
    candidate.revision=++this.revision;
    const canonical=fromLegacyGraph(candidate,this.workspaceId,this.revision);
    if(previous)this.canonical.apply(canonicalDelta(previous,canonical));
    else this.canonical.replace(canonical);
    const delta=this.current.revision!==undefined?sourceDelta(this.current,candidate):null;
    this.current=candidate;
    for (const handler of this.handlers) handler(candidate,delta);
  }
  isReady():boolean { return this.fullIndexDone; }
  dispose():void { this.disposed=true; if(this.timer)clearTimeout(this.timer); this.worker.dispose(); this.handlers=[]; }
}
