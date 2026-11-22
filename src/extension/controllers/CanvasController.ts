import * as vscode from 'vscode';
import type { CanvasState, SourceGraph, ToWebview } from '../../shared/types';
import { IndexCoordinator } from '../services/IndexCoordinator';
import { SourcePreviewService } from '../services/SourcePreviewService';
import { NativeEditorNavigator } from './NativeEditorNavigator';
import { enrichSelected } from '../adapters/VsCodeLanguageProvider';
import { ViewSessionService } from '../services/ViewSessionService';
import { GitCompareService } from '../services/GitCompareService';
import { GitHistoryService } from '../services/GitHistoryService';
import { GitBlameService } from '../services/GitBlameService';
import { fromWebviewSchema } from '../../core/contracts/viewState';
import { CANVAS_VIEW_TYPE, canvasHtml } from './WebviewHost';
import { useDelta } from '../../core/graph/GraphDelta';

const EMPTY: SourceGraph = { schema: 1, nodes: [], edges: [], diagnostics: [] };

export class CanvasController implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  private graph: SourceGraph = EMPTY;
  private readonly graphEmitter=new vscode.EventEmitter<SourceGraph>();
  readonly onDidGraph=this.graphEmitter.event;
  get graphSnapshot(): SourceGraph { return this.graph; }
  private readonly session: ViewSessionService;
  private readonly git: GitCompareService;
  private readonly gitHistory = new GitHistoryService();
  private readonly blame = new GitBlameService();
  private get state():CanvasState {return this.session.value;}
  private isReady = false;
  private pendingActions:import('../../shared/types').ToWebview[]=[];
  private readonly index: IndexCoordinator;
  private readonly previews = new SourcePreviewService();
  private readonly navigator = new NativeEditorNavigator();
  private enriched = new Map<string,import('../../shared/types').GraphEdge[]>();
  private hadEnrichedOverlay = false;
  private activeGitBaseline: string | null = null;
  private refreshPromise?:Promise<void>;
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  constructor(private readonly context: vscode.ExtensionContext) {
    this.index = new IndexCoordinator(context);
    this.session = new ViewSessionService(context,this.index.workspaceId);
    this.git = new GitCompareService(context);
    this.status.name = 'Python UML Canvas';
    this.status.command = 'xpCodeCanvas.open';
    this.status.text = '$(type-hierarchy) UML Canvas';
    this.status.tooltip = 'Open Python UML Canvas';
    this.status.show();
    this.subscriptions.push(this.status, this.index, this.index.onGraph((graph,delta) => {
      this.graph = graph;
      this.graphEmitter.fire(graph);
      this.enriched.clear();
      this.status.text = `$(type-hierarchy) UML: ${graph.nodes.length} symbols`;
      if(delta && !this.activeGitBaseline && !this.hadEnrichedOverlay && useDelta(delta,graph)) this.send({type:'graphDelta',delta});
      else this.send({type:'graph',graph,state:this.state});
      this.activeGitBaseline=null;
      this.hadEnrichedOverlay=false;
    }));
    this.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.languageId === 'python' || event.document.uri.path.endsWith('.py')) this.index.schedule(event.document.uri);
    }));
    this.subscriptions.push(vscode.workspace.onDidCreateFiles(e => {for (const file of e.files) this.index.schedule(file);}));
    this.subscriptions.push(vscode.workspace.onDidDeleteFiles(e => {for (const file of e.files) void this.index.remove(file);}));
    this.subscriptions.push(vscode.workspace.onDidRenameFiles(e => {for (const file of e.files) {void this.index.remove(file.oldUri); this.index.schedule(file.newUri);}}));
    this.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor?.document.uri.path.endsWith('.py')) this.setState({...this.state,focusedFile:editor.document.uri.toString()});
    }));
    const watcher=vscode.workspace.createFileSystemWatcher('**/*.py');
    this.subscriptions.push(watcher,watcher.onDidChange(uri=>this.index.schedule(uri)),
      watcher.onDidCreate(uri=>this.index.schedule(uri)),watcher.onDidDelete(uri=>void this.index.remove(uri)));
    this.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => void this.refresh()));
  }

  registerCommands(): vscode.Disposable[] {
    const commands: [string, (...args: any[]) => unknown][] = [
      ['xpCodeCanvas.open', () => this.open()],
      ['xpCodeCanvas.spreadGraph', () => this.spreadGraph()],
      ['xpCodeCanvas.focusSymbol', (item: string | import('../../shared/types').GraphNode) => this.focusSymbol(typeof item==='string'?item:item?.id)],
      ['xpCodeCanvas.showHistory', () => this.showHistory()],
      ['xpCodeCanvas.showChanges', () => this.showChanges()],
      ['xpCodeCanvas.showBlame', () => this.showBlame()],
      ['xpCodeCanvas.compareCommit', (item: string | import('../../shared/gitHistory').GitCommit) => this.compareCommit(typeof item==='string'?item:item?.hash)],
      ['xpCodeCanvas.focusCurrentFile', () => this.focusActive()],
      ['xpCodeCanvas.focusFile', (uri: vscode.Uri) => this.focusFile(uri)],
      ['xpCodeCanvas.returnToCanvas', () => this.returnToCanvas()],
      ['xpCodeCanvas.openNodeInEditor', (id?: string) => this.openNode(id ?? this.state.selectedNode ?? '')],
      ['xpCodeCanvas.alignFocusedFile', () => this.requestAlign()],
      ['xpCodeCanvas.resetLayout', () => this.requestReset()],
      ['xpCodeCanvas.fitView', () => this.requestFit()],
      ['xpCodeCanvas.toggleExplodedMethods', () => this.setState({ ...this.state, explodeMethods: !this.state.explodeMethods })],
    ];
    return commands.map(([command, callback]) => vscode.commands.registerCommand(command, callback));
  }

  private updateContext(has: boolean): void {
    void vscode.commands.executeCommand('setContext', 'xpCodeCanvas.hasCanvas', has);
  }

  async open(): Promise<void> {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri?.path.endsWith('.py')) {
      this.setState({...this.state,focusedFile:activeUri.toString()});
    }
    if (this.panel) { this.panel.reveal(this.panel.viewColumn); return; }
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    const panel = vscode.window.createWebviewPanel(CANVAS_VIEW_TYPE, 'Python UML Canvas', column, {
      enableScripts: true, retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
    });
    this.attach(panel);
    await this.refresh();
  }

  attach(panel: vscode.WebviewPanel): void {
    this.panel = panel;
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')] };
    this.isReady = false;
    this.updateContext(true);
    panel.iconPath = { light: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.svg'), dark: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.svg') };
    panel.webview.html = canvasHtml(this.context.extensionUri,panel.webview);
    const messageSub = panel.webview.onDidReceiveMessage(async (untrusted: unknown) => {
      try {
        const message = fromWebviewSchema.parse(untrusted);
        if (message.type === 'ready') { this.isReady = true; this.send({ type: 'graph', graph: this.graph, state: this.state }); for(const action of this.pendingActions.splice(0))this.send(action); }
        if (message.type === 'openNode' && typeof message.nodeId === 'string') await this.openNode(message.nodeId,message.cursor);
        if (message.type === 'selectNode' && typeof message.nodeId === 'string') void this.resolveSelected(message.nodeId);
        if (message.type === 'focusFile' && typeof message.uri === 'string') await this.focusFile(vscode.Uri.parse(message.uri));
        if (message.type === 'state') { this.setState(message.state); this.send({type:'stateAck',revision:this.session.stateRevision}); }
        if (message.type === 'getSourcePreview' && typeof message.nodeId === 'string' && typeof message.requestId === 'string') {
          const symbol=this.graph.nodes.find(n => n.id===message.nodeId);
          const preview=symbol ? await this.previews.get(symbol,message.expectedHash) : {stale:true,error:'Unknown symbol'};
          this.send({type:'sourcePreview',requestId:message.requestId,nodeId:message.nodeId,contentHash:symbol?.contentHash ?? '',...preview});
        }
        if (message.type === 'command') {
          if (message.command === 'reload') await this.refresh();
          if (message.command === 'explode') this.setState({ ...this.state, explodeMethods: !this.state.explodeMethods });
          if (message.command === 'align') this.requestAlign();
          if (message.command === 'reset') this.requestReset();
          if (message.command === 'fit') this.requestFit();
        }
        if (message.type === 'gitDiff') await this.gitDiff(message.baseline);
        if (message.type === 'getGitBlame') {
          const node=this.graph.nodes.find(n=>n.id===message.nodeId);
          if(node)this.send({type:'gitBlame',result:await this.blame.get(node)});
          else this.send({type:'gitBlame',result:{nodeId:message.nodeId,status:'unavailable',basis:'HEAD',lines:[],message:'No current source is available for this historical or removed UML node'}});
        }
        if(message.type === 'openSourceRegion') {
          const node=this.graph.nodes.find(n=>n.id===message.nodeId);
          const region=node?.anatomy?.find(r=>r.id===message.regionId);
          if(node&&region)await this.navigator.openRegion(node,region,this.panel?.viewColumn??vscode.ViewColumn.Active);
        }
        if (message.type === 'getGitHistory') {
          try { this.send({type:'gitHistory',commits:await this.gitHistory.list(message.limit,this.state.focusedFile??undefined)}); }
          catch(e) { this.send({type:'gitHistory',commits:[],error:e instanceof Error ? e.message : String(e)}); }
        }
      } catch (error) { this.showError(error); }
    });
    const disposeSub = panel.onDidDispose(() => {
      if (this.panel !== panel) return;
      this.panel = undefined;
      this.isReady = false;
      this.updateContext(false);
      messageSub.dispose(); disposeSub.dispose();
    });
  }

  private sendOrQueue(message:ToWebview):void {
    if(!this.send(message))this.pendingActions.push(message);
  }
  private send(message: ToWebview): boolean {
    if (!this.panel || !this.isReady) return false;
    void this.panel.webview.postMessage(message);
    return true;
  }

  refresh(): Promise<void> {
    if(!this.refreshPromise)this.refreshPromise=this.refreshNow().finally(()=>{this.refreshPromise=undefined;});
    return this.refreshPromise;
  }
  private async refreshNow(): Promise<void> {
    this.status.text = '$(sync~spin) Indexing Pythonâ€¦';
    try {
      await this.index.initialize((done, total) => {
        this.status.text = `$(sync~spin) Indexing Pythonâ€¦ ${done}/${total}`;
      });
      this.graph = this.index.graph;
      this.graphEmitter.fire(this.graph);
      this.status.text = `$(type-hierarchy) UML: ${this.graph.nodes.length} symbols`;
      this.send({type:'graph',graph:this.graph,state:this.state});
    } catch (error) {
      this.status.text = '$(warning) UML Canvas';
      this.showError(error);
    }
  }

  private setState(state: CanvasState): void {
    this.session.update(state);
  }

  async focusActive(): Promise<void> {
    const uri = vscode.window.activeTextEditor?.document.uri;
    if (uri?.path.endsWith('.py')) await this.focusFile(uri);
    else await this.open();
  }

  async focusFile(uri: vscode.Uri): Promise<void> {
    if (!uri.path.endsWith('.py')) return;
    this.setState({ ...this.state, focusedFile: uri.toString() });
    if (!this.panel) await this.open();
    this.panel?.reveal(this.panel.viewColumn);
    this.send({ type: 'focus', file: uri.toString() });
  }

  /** Explicit escape from oversized file columns: clears stale manual positioning and fits the reflowed spread. */
  async spreadGraph():Promise<void> {
    if(!this.panel)await this.open();
    this.panel?.reveal(this.panel.viewColumn);
    this.sendOrQueue({type:'action',action:'spread'});
  }
  async focusSymbol(id:string|undefined):Promise<void> {
    if(!id)return;
    const node=this.graph.nodes.find(n=>n.id===id);
    if(!node)return;
    this.setState({...this.state,selectedNode:id,focusedFile:node.uri,altitude:'code',layoutMode:'investigation'});
    if(!this.panel)await this.open();
    this.panel?.reveal(this.panel.viewColumn);
    this.sendOrQueue({type:'revealSymbol',file:node.uri,nodeId:id});
  }
  async showHistory():Promise<void> {
    if(!this.panel)await this.open();
    this.panel?.reveal(this.panel.viewColumn);
    this.sendOrQueue({type:'action',action:'history'});
  }
  async showChanges():Promise<void> {
    if(!this.panel)await this.open();
    await this.gitDiff('HEAD');
  }
  async showBlame():Promise<void> {
    const id=this.state.selectedNode??this.navigator.fromCursor(this.graph)?.id;
    const node=id?this.graph.nodes.find(n=>n.id===id):undefined;
    if(!node){void vscode.window.showInformationMessage('Select a Python symbol on the canvas or place the editor cursor in a Python function to inspect blame.');return;}
    await this.focusSymbol(node.id);
    const result=await this.blame.get(node);
    this.sendOrQueue({type:'gitBlame',result});
  }
  async compareCommit(hash:string|undefined):Promise<void> {
    if(!hash||!/^[a-f0-9]{40,64}$/i.test(hash))return;
    if(!this.panel)await this.open();
    await this.gitDiff(hash);
  }
  async openNode(id: string,cursor?:import('../../shared/types').SourceCursor): Promise<void> {
    const node = this.graph.nodes.find(n => n.id === id);
    if (!node) { void vscode.window.showWarningMessage('UML symbol is no longer available. Refresh the graph.'); return; }
    this.setState({ ...this.state, selectedNode: id, focusedFile: node.uri });
    await this.navigator.open(node, this.panel?.viewColumn ?? vscode.ViewColumn.Active,cursor);
  }

  async returnToCanvas(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const selected = this.navigator.fromCursor(this.graph);
    if (selected) this.setState({ ...this.state, focusedFile: selected.uri, selectedNode: selected.id ?? null });
    if (!this.panel) await this.open();
    this.panel?.reveal(editor?.viewColumn ?? this.panel.viewColumn);
    this.send({type:'focus',file:this.state.focusedFile ?? undefined,node:this.state.selectedNode ?? undefined});
  }

  private requestAlign(): void { this.send({ type: 'action', action:'align' }); }
  private requestReset(): void { this.send({ type: 'action', action:'reset' }); }
  private requestFit(): void { this.send({ type: 'action', action:'fit' }); }

  /** Optional semantic enrichment is a separate, source-backed overlay, not a replacement for the AST. */
  private async resolveSelected(id:string):Promise<void> {
    const snapshot=this.graph;
    if(this.enriched.has(id))return;
    const edges=await enrichSelected(snapshot,id);
    if(snapshot!==this.graph)return;
    this.enriched.set(id,edges);
    if(edges.length) {
      const old=new Set(this.graph.edges.map(e=>`${e.source}|${e.target}|${e.kind}`));
      const additions=edges.filter(e=>!old.has(`${e.source}|${e.target}|${e.kind}`));
      if(additions.length){this.hadEnrichedOverlay=true;this.send({type:'graph',graph:{...this.graph,edges:[...this.graph.edges,...additions]},state:this.state});}
    }
  }

  private async gitDiff(baseline: string): Promise<void> {
    this.send({ type: 'status', message: `Comparing with ${baseline}â€¦` });
    const base=this.graph;
    const overlay=await this.git.compare(baseline,base);
    if(base!==this.graph)throw Error('Live graph changed during Git comparison; retry against the latest source');
    this.activeGitBaseline=baseline;
    this.sendOrQueue({type:'diff',graph:overlay,baseline});
  }

  private showError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.send({ type: 'status', message });
    void vscode.window.showErrorMessage(`Python UML Canvas: ${message}`);
  }

  dispose(): void {
    this.panel?.dispose();
    this.subscriptions.forEach(d => d.dispose());
    this.graphEmitter.dispose();
  }
}
