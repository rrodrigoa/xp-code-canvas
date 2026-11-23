import * as vscode from 'vscode';
import {suite,test} from 'mocha';
import * as assert from 'node:assert/strict';
import {GitReviewEngine} from '../../src/extension/review/GitReviewEngine';
import {LocalReviewNotes} from '../../src/extension/review/LocalReviewNotes';
import {IndexCoordinator} from '../../src/extension/services/IndexCoordinator';
suite('Unborn Git review',()=>{
 test('reviews real index, untracked documentation and unsaved buffers without requiring HEAD',async()=>{
  assert.ok(process.env.XP_UNBORN_REPO,'Use the isolated unborn-repository runner');
  const extension=vscode.extensions.getExtension('xp-libs.xp-code-canvas')!;await extension.activate();
  const context={asAbsolutePath:(name:string)=>`${extension.extensionPath}/${name}`} as vscode.ExtensionContext;
  const notes=new LocalReviewNotes({get:(_key:string,fallback:unknown)=>fallback,update:async()=>{}} as unknown as vscode.Memento);
  const index=new IndexCoordinator(context),engine=new GitReviewEngine(context,notes);
  await index.initialize();
  try{
   const uri=vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'agent.py'),doc=await vscode.workspace.openTextDocument(uri),original=doc.getText();
   const edit=new vscode.WorkspaceEdit();edit.insert(uri,doc.positionAt(original.length),'\n\ndef unsaved_probe():\n    return 2\n');await vscode.workspace.applyEdit(edit);index.schedule(uri);await index.flush();
   const staged=await engine.open('staged',index.graph),working=await engine.open('working',index.graph),unstaged=await engine.open('unstaged',index.graph);
   assert.equal(staged.baseline,'EMPTY');assert.equal(staged.files.length,2);assert.ok(staged.graph.nodes.some(n=>n.name==='staged_probe'&&n.change==='ADDED'));
   assert.ok(!staged.graph.nodes.some(n=>n.name==='unsaved_probe'));assert.ok(working.graph.nodes.some(n=>n.name==='unsaved_probe'&&n.change==='ADDED'));
   assert.ok(working.files.some(f=>f.path==='untracked docs.md'));assert.ok(unstaged.files.some(f=>f.path==='agent.py'));
   assert.ok(unstaged.graph.nodes.some(n=>n.name==='unsaved_probe'&&n.change==='ADDED'));
   const restore=new vscode.WorkspaceEdit();restore.replace(uri,new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)),original);await vscode.workspace.applyEdit(restore);
  }finally{index.dispose();}
 });
});
