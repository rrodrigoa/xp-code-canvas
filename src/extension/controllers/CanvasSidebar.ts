/** Native VS Code Activity Bar navigation. The UML remains in a normal editor tab. */
import * as vscode from 'vscode';
import type { GraphNode, SourceGraph } from '../../shared/types';
import { GitHistoryService } from '../services/GitHistoryService';
import type { GitCommit } from '../../shared/gitHistory';

const symbolIcons: Record<string,string> = {
  module:'file-code',class:'symbol-class',function:'symbol-function',
  method:'symbol-method',property:'symbol-property',external:'symbol-interface',
};

export class SymbolTreeProvider implements vscode.TreeDataProvider<GraphNode> {
  private readonly emitter = new vscode.EventEmitter<GraphNode|undefined>();
  readonly onDidChangeTreeData=this.emitter.event;
  private graph:SourceGraph={schema:1,nodes:[],edges:[],diagnostics:[]};
  private readonly children=new Map<string,GraphNode[]>();
  update(graph:SourceGraph):void {
    this.graph=graph;
    this.children.clear();
    const nodes=graph.nodes.filter(n=>n.kind!=='external');
    const modules=nodes.filter(n=>n.kind==='module');
    const moduleIds=new Set(modules.map(n=>n.id));
    const ids=new Set(nodes.map(n=>n.id));
    for(const n of nodes){
      if(n.kind==='module')continue;
      const parent=n.parentId&&ids.has(n.parentId)?n.parentId:moduleIds.has(n.moduleId)?n.moduleId:null;
      if(parent){const list=this.children.get(parent)??[];list.push(n);this.children.set(parent,list);}
    }
    for(const list of this.children.values())list.sort((a,b)=>a.range.startLine-b.range.startLine||a.name.localeCompare(b.name));
    this.emitter.fire(undefined);
  }
  getTreeItem(node:GraphNode):vscode.TreeItem {
    const hasChildren=(this.children.get(node.id)?.length??0)>0;
    const item=new vscode.TreeItem(node.name==='__root__'?node.module:node.name,
      hasChildren?vscode.TreeItemCollapsibleState.Collapsed:vscode.TreeItemCollapsibleState.None);
    item.id=node.id;
    item.description=node.kind==='module'?`${this.children.get(node.id)?.length??0} symbols`:node.kind;
    item.iconPath=new vscode.ThemeIcon(symbolIcons[node.kind]??'symbol-misc');
    item.tooltip=`${node.qualifiedName}\n${node.uri}:${node.range.startLine+1}`;
    item.contextValue=node.kind==='module'?'xpCanvasModule':'xpCanvasSymbol';
    item.command={command:'xpCodeCanvas.focusSymbol',title:'Reveal in UML Canvas',arguments:[node.id]};
    return item;
  }
  getChildren(node?:GraphNode):GraphNode[] {
    return node ? this.children.get(node.id)??[] : this.graph.nodes.filter(n=>n.kind==='module').sort((a,b)=>a.module.localeCompare(b.module));
  }
  dispose():void {this.emitter.dispose();}
}

export class GitTreeProvider implements vscode.TreeDataProvider<GitCommit> {
  private readonly emitter=new vscode.EventEmitter<GitCommit|undefined>();
  readonly onDidChangeTreeData=this.emitter.event;
  private commits:GitCommit[]=[];
  private readonly service=new GitHistoryService();
  private loadId=0;
  async refresh():Promise<void> {
    const id=++this.loadId;
    try {const commits=await this.service.list(60);if(id===this.loadId)this.commits=commits;}
    catch {if(id===this.loadId)this.commits=[];} // no git repository: empty welcome view
    if(id===this.loadId)this.emitter.fire(undefined);
  }
  getTreeItem(commit:GitCommit):vscode.TreeItem {
    const item=new vscode.TreeItem(commit.subject,vscode.TreeItemCollapsibleState.None);
    item.description=commit.hash.slice(0,8);
    item.tooltip=`${commit.subject}\n${commit.author} · ${commit.date}\n${commit.hash}`;
    item.iconPath=new vscode.ThemeIcon('git-commit');
    item.contextValue='xpCanvasCommit';
    item.command={command:'xpCodeCanvas.compareCommit',title:'Compare commit in UML',arguments:[commit.hash]};
    return item;
  }
  getChildren():GitCommit[] {return this.commits;}
  dispose():void {this.emitter.dispose();}
}

type ReviewEntry = {label:string;detail:string;icon:string;command:string};
class ReviewEntryProvider implements vscode.TreeDataProvider<ReviewEntry> {
  private readonly entries:ReviewEntry[]=[
    {label:'Review working changes',detail:'HEAD → editor',icon:'git-compare',command:'xpCodeCanvas.reviewWorking'},
    {label:'Review unstaged changes',detail:'INDEX → editor',icon:'edit',command:'xpCodeCanvas.reviewUnstaged'},
    {label:'Review staged changes',detail:'HEAD → index',icon:'git-commit',command:'xpCodeCanvas.reviewStaged'},
    {label:'Review branch',detail:'Compare to merge base',icon:'git-branch',command:'xpCodeCanvas.reviewBranch'},
    {label:'Review GitHub pull request',detail:'Compare commits and discussions',icon:'git-pull-request',command:'xpCodeCanvas.reviewPR'},
  ];
  getTreeItem(entry:ReviewEntry):vscode.TreeItem {
    const item=new vscode.TreeItem(entry.label,vscode.TreeItemCollapsibleState.None);
    item.description=entry.detail;item.iconPath=new vscode.ThemeIcon(entry.icon);
    item.command={command:entry.command,title:entry.label};return item;
  }
  getChildren():ReviewEntry[]{return this.entries;}
}

class ExploreEntryProvider implements vscode.TreeDataProvider<ReviewEntry>{
  private readonly entries:ReviewEntry[]=[
    {label:'Open 2D UML',detail:'Traditional editable Python architecture map',icon:'type-hierarchy',command:'xpCodeCanvas.open'},
    {label:'Open 3D UML',detail:'Orbit, folder clusters, connectivity & code review',icon:'globe',command:'xpCodeCanvas.open3D'},
    {label:'Spread and recover',detail:'Restore a crowded 2D layout',icon:'layout',command:'xpCodeCanvas.spreadGraph'},
    {label:'Review working changes',detail:'Inspect changed architecture',icon:'git-compare',command:'xpCodeCanvas.reviewWorking'},
    {label:'Review staged changes',detail:'HEAD to Git index',icon:'git-commit',command:'xpCodeCanvas.reviewStaged'},
  ];
  getTreeItem(entry:ReviewEntry):vscode.TreeItem{
    const item=new vscode.TreeItem(entry.label,vscode.TreeItemCollapsibleState.None);
    item.description=entry.detail;item.iconPath=new vscode.ThemeIcon(entry.icon);
    item.command={command:entry.command,title:entry.label};return item;
  }
  getChildren():ReviewEntry[]{return this.entries;}
}

/** Two useful native trees, rather than an Activity Bar shortcut that just opens a webview. */
export class CanvasSidebar implements vscode.Disposable {
  private readonly symbols=new SymbolTreeProvider();
  private readonly git=new GitTreeProvider();
  private readonly reviewEntries=new ReviewEntryProvider();
  private readonly exploreEntries=new ExploreEntryProvider();
  private readonly subscriptions:vscode.Disposable[]=[];
  constructor(private readonly controller:{onDidGraph:vscode.Event<SourceGraph>;graphSnapshot:SourceGraph;refresh():Promise<void>}) {
    this.symbols.update(controller.graphSnapshot);
    this.subscriptions.push(this.symbols,this.git);
    this.subscriptions.push(controller.onDidGraph(graph=>this.symbols.update(graph)));
    const explore=vscode.window.createTreeView('xpCodeCanvas.explore',{treeDataProvider:this.exploreEntries});
    const structure=vscode.window.createTreeView('xpCodeCanvas.structure',{treeDataProvider:this.symbols,showCollapseAll:true});
    const history=vscode.window.createTreeView('xpCodeCanvas.history',{treeDataProvider:this.git});
    const reviews=vscode.window.createTreeView('xpCodeCanvas.reviews',{treeDataProvider:this.reviewEntries});
    this.subscriptions.push(explore,structure,history,reviews);
    structure.onDidChangeVisibility(event=>{if(event.visible && !controller.graphSnapshot.nodes.length)void controller.refresh();},null,this.subscriptions);
    history.onDidChangeVisibility(event=>{if(event.visible)void this.git.refresh();},null,this.subscriptions);
    if(structure.visible&&!controller.graphSnapshot.nodes.length)void controller.refresh();
    if(history.visible)void this.git.refresh();
    this.subscriptions.push(vscode.commands.registerCommand('xpCodeCanvas.refreshSidebar',()=>{void this.controller.refresh();void this.git.refresh();}));
  }
  dispose():void {for(const subscription of this.subscriptions)subscription.dispose();}
}
