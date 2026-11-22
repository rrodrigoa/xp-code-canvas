import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import {suite,test,suiteSetup,suiteTeardown} from 'mocha';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {IndexCoordinator} from '../../src/extension/services/IndexCoordinator';
import {GitBlameService} from '../../src/extension/services/GitBlameService';
import {GitHistoryService} from '../../src/extension/services/GitHistoryService';
import {GitCompareService} from '../../src/extension/services/GitCompareService';
import {SourcePreviewService} from '../../src/extension/services/SourcePreviewService';
import {NativeEditorNavigator} from '../../src/extension/controllers/NativeEditorNavigator';
import {SymbolTreeProvider,GitTreeProvider} from '../../src/extension/controllers/CanvasSidebar';
import {snapshotGit} from '../../src/extension/gitSnapshot';
import type {GraphNode} from '../../src/shared/types';

const exec=promisify(execFile);
suite('Real Flask repository integration',()=>{
 let root:string,index:IndexCoordinator,context:vscode.ExtensionContext;
 let config:GraphNode,module:GraphNode,original:Buffer;
 const evidence:Record<string,unknown>={};
 const git=async(...args:string[])=>(await exec('git',args,{cwd:root,windowsHide:true,maxBuffer:32*1024*1024})).stdout;
 suiteSetup(async()=>{
  assert.ok(process.env.XP_REAL_REPO,'Use the dedicated real-repository runner');
  root=path.resolve(process.env.XP_REAL_REPO);
  assert.equal(vscode.workspace.workspaceFolders?.[0].uri.fsPath.toLowerCase(),root.toLowerCase());
  assert.equal(vscode.workspace.isTrusted,true);
  assert.equal((await git('status','--porcelain')).trim(),'','Temporary clone must start clean');
  const extension=vscode.extensions.getExtension('xp-libs.xp-code-canvas')!;
  context={asAbsolutePath:(name:string)=>path.join(extension.extensionPath,name)} as vscode.ExtensionContext;
  index=new IndexCoordinator(context);
  const started=Date.now();await index.initialize();
  config=index.graph.nodes.find(n=>n.kind==='class'&&n.name==='Config'&&n.uri.endsWith('/src/flask/config.py'))!;
  module=index.graph.nodes.find(n=>n.kind==='module'&&n.uri===config?.uri)!;
  assert.ok(config&&module,'Real Flask Config declarations must be indexed');
  assert.equal(config.qualifiedName,'flask.config.Config','Live and Git source roots must agree');
  original=await fs.readFile(vscode.Uri.parse(config.uri).fsPath);
  evidence.repository={url:'https://github.com/pallets/flask',head:(await git('rev-parse','HEAD')).trim(),commits:Number(await git('rev-list','--count','HEAD'))};
  evidence.index={nodes:index.graph.nodes.length,edges:index.graph.edges.length,files:index.sources.snapshots.size,milliseconds:Date.now()-started,diagnostics:index.graph.diagnostics.length};
 });
 suiteTeardown(async()=>{
  index?.dispose();
  if(root){assert.equal((await git('status','--porcelain')).trim(),'','Integration tests must leave the clone clean');}
  if(process.env.XP_EVIDENCE_DIR){await fs.mkdir(process.env.XP_EVIDENCE_DIR,{recursive:true});await fs.writeFile(path.join(process.env.XP_EVIDENCE_DIR,'extension-results.json'),JSON.stringify(evidence,null,2));}
 });
 test('indexes real declarations and previews exact source without executing Flask',async()=>{
  assert.ok(index.graph.nodes.length>500);assert.ok(index.graph.edges.length>100);
  assert.ok(index.graph.nodes.some(n=>n.kind==='class'&&n.name==='Flask'));
  const preview=await new SourcePreviewService().get(config,config.contentHash!);
  assert.equal(preview.stale,false);assert.ok(preview.source?.startsWith('class Config('));
  evidence.preview={name:config.qualifiedName,characters:preview.source?.length,stale:preview.stale};
 });
 test('matches actual Git history, parents, subjects and authors',async()=>{
  const commits=await new GitHistoryService().list(100,config.uri);
  const raw=(await git('log','--topo-order','--max-count=100','--format=%H')).trim().split('\n');
  assert.deepEqual(commits.map(c=>c.hash),raw);
  for(const commit of commits.slice(0,8)){
   assert.equal(commit.subject,(await git('show','-s','--format=%s',commit.hash)).trim());
   assert.equal(commit.author,(await git('show','-s','--format=%an',commit.hash)).trim());
   assert.deepEqual(commit.parents,(await git('show','-s','--format=%P',commit.hash)).trim().split(' ').filter(Boolean));
  }
  evidence.history={count:commits.length,merges:commits.filter(c=>c.parents.length>1).length,first:commits[0]};
 });
 test('populates native structure and history trees from real Flask source and Git',async()=>{
  const symbols=new SymbolTreeProvider(),history=new GitTreeProvider();
  try{
   symbols.update(index.graph);
   assert.ok(symbols.getChildren().some(n=>n.id===module.id));
   assert.ok(symbols.getChildren(module).some(n=>n.id===config.id));
   const method=symbols.getChildren(config).find(n=>n.kind==='method')!;assert.ok(method);
   assert.deepEqual(symbols.getTreeItem(method).command?.arguments,[method.id]);
   await history.refresh();
   assert.equal(history.getChildren().length,60);
   const first=history.getChildren()[0];
   assert.equal(first.hash,(await git('rev-parse','HEAD')).trim());
   assert.deepEqual(history.getTreeItem(first).command?.arguments,[first.hash]);
   evidence.sidebar={modules:symbols.getChildren().length,configMembers:symbols.getChildren(config).length,commits:history.getChildren().length};
  }finally{symbols.dispose();history.dispose();}
 });
 test('attributes clean class and whole-file lines to real HEAD commits',async()=>{
  const service=new GitBlameService();
  for(const node of [config,module]){
   const result=await service.get(node);assert.equal(result.status,'clean',result.message);
   const raw=await git('blame','--line-porcelain','--follow','-L',`${node.range.startLine+1},${result.lines.at(-1)!.line}`,'HEAD','--','src/flask/config.py');
   const expected=[...raw.matchAll(/^([0-9a-f]{40}) (\d+) (\d+)(?: \d+)?$/gm)].map(m=>({hash:m[1],line:Number(m[3])}));
   assert.deepEqual(result.lines.map(l=>({hash:l.hash,line:l.line})),expected);
   assert.ok(result.summary!.uniqueCommits>1);assert.ok(result.summary!.authors.length>1);
   const first=result.lines[0];
   evidence[`blame-${node.kind}`]={lines:result.lines.length,commits:result.summary!.uniqueCommits,authors:result.summary!.authors.length,
    historicalPaths:[...new Set(result.lines.map(l=>l.file))],first:{hash:first.hash,line:first.line,author:first.author,summary:first.summary}};
  }
 });
 test('compares HEAD, index and a real historical code revision without changing the live graph',async()=>{
  const before=JSON.stringify(index.graph),service=new GitCompareService(context);
  for(const revision of ['HEAD','INDEX']){
   const result=await service.compare(revision,index.graph);
   assert.equal(result.nodes.filter(n=>n.change&&n.change!=='UNCHANGED').length,0,`${revision} must match the clean tree`);
  }
  const commit=(await git('log','-1','--format=%H','--','src/flask/config.py')).trim();
  const baseline=`${commit}^`;
  const snapshot=await snapshotGit(baseline);
  const source=snapshot.find(f=>f.uri===config.uri)!;
  assert.equal(source.text,await git('show',`${baseline}:src/flask/config.py`));
  const overlay=await service.compare(baseline,index.graph);
  const changes=overlay.nodes.filter(n=>n.change&&n.change!=='UNCHANGED');
  assert.ok(changes.some(n=>n.uri===config.uri));assert.equal(JSON.stringify(index.graph),before);
  evidence.comparison={baseline,files:snapshot.length,changes:changes.length,kinds:[...new Set(changes.map(n=>n.change))]};
 });
 test('rejects dirty and unsaved attribution, updates real buffers incrementally and recovers after save',async()=>{
  const uri=vscode.Uri.parse(config.uri),doc=await vscode.workspace.openTextDocument(uri),text=doc.getText();
  const service=new GitBlameService();
  try{
   const edit=new vscode.WorkspaceEdit();edit.insert(uri,doc.positionAt(text.length),'\n\ndef xp_canvas_validation_probe():\n    return 123\n');
   assert.equal(await vscode.workspace.applyEdit(edit),true);assert.equal(doc.isDirty,true);
   assert.equal((await service.get(config)).status,'dirty');
   assert.equal((await new SourcePreviewService().get(config,config.contentHash!)).stale,true);
   index.schedule(uri);await index.flush();
   assert.ok(index.graph.nodes.some(n=>n.name==='xp_canvas_validation_probe'));
   await doc.save();assert.equal((await service.get(config)).status,'dirty');
  }finally{
   const restore=new vscode.WorkspaceEdit();restore.replace(uri,new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)),text);
   await vscode.workspace.applyEdit(restore);await doc.save();
   assert.deepEqual(await fs.readFile(uri.fsPath),original,'Restored editor content must preserve original bytes');
   index.schedule(uri);await index.flush();
  }
  assert.equal((await service.get(config)).status,'clean');
  evidence.dirtyBuffers={unsaved:'dirty',savedEdits:'dirty',stalePreviewRejected:true,incrementalSymbolObserved:true,restored:'clean'};
 });
 test('handles staged renames and untracked source without inventing attribution',async()=>{
  const old='src/flask/config.py',renamed='src/flask/xp_canvas_renamed_config.py',untracked='src/flask/xp_canvas_untracked_probe.py';
  try{
   await git('mv',old,renamed);
   const renamedNode={...config,uri:vscode.Uri.file(path.join(root,renamed)).toString()};
   assert.equal((await new GitBlameService().get(renamedNode)).status,'dirty');
   assert.ok((await snapshotGit('INDEX')).some(f=>f.uri===renamedNode.uri));
   await fs.writeFile(path.join(root,untracked),'def xp_canvas_untracked_probe():\n    return 42\n');
   const newNode={...config,uri:vscode.Uri.file(path.join(root,untracked)).toString()};
   assert.equal((await new GitBlameService().get(newNode)).status,'untracked');
  }finally{
   await git('mv',renamed,old);await fs.unlink(path.join(root,untracked)).catch(()=>{});
  }
  evidence.renames={stagedRename:'dirty',indexUsesRenamedPath:true,untracked:'untracked'};
 });
 test('opens exact source and anatomy in the requested editor group',async()=>{
  const navigator=new NativeEditorNavigator();
  assert.equal(await navigator.open(config,vscode.ViewColumn.Two),true);
  assert.equal(vscode.window.activeTextEditor?.viewColumn,vscode.ViewColumn.Two);
  assert.equal(vscode.window.activeTextEditor?.selection.active.line,config.selectionRange.startLine);
  const anatomical=index.graph.nodes.find(n=>n.uri===config.uri&&n.anatomy?.length)!;
  assert.ok(anatomical);assert.equal(await navigator.openRegion(anatomical,anatomical.anatomy![0],vscode.ViewColumn.Two),true);
  assert.equal(vscode.window.activeTextEditor?.selection.active.line,anatomical.anatomy![0].range.startLine);
  evidence.navigation={group:2,declarationLine:config.selectionRange.startLine,anatomyLine:anatomical.anatomy![0].range.startLine};
 });
});
