import * as vscode from 'vscode';
import {suite,test} from 'mocha';
import * as assert from 'node:assert/strict';
import {IndexCoordinator} from '../../src/extension/services/IndexCoordinator';
import {GitReviewEngine} from '../../src/extension/review/GitReviewEngine';
import {LocalReviewNotes} from '../../src/extension/review/LocalReviewNotes';
import {folderOf,layoutSpatialGraph} from '../../src/shared/spatialGraph';
suite('Multi-root source identity',()=>{
 test('indexes identical qualified symbols separately and partitions them by their actual roots',async()=>{
  assert.ok(process.env.XP_MULTIROOT_WORKSPACE);assert.equal(vscode.workspace.workspaceFolders?.length,2);
  const extension=vscode.extensions.getExtension('xp-libs.xp-code-canvas')!;await extension.activate();
  const context={asAbsolutePath:(name:string)=>`${extension.extensionPath}/${name}`} as vscode.ExtensionContext,index=new IndexCoordinator(context);await index.initialize();
  try{
   const classes=index.graph.nodes.filter(n=>n.kind==='class'&&n.name==='Agent');assert.equal(classes.length,2);assert.notEqual(classes[0].id,classes[1].id);assert.notEqual(folderOf(classes[0]),folderOf(classes[1]));
   const points=layoutSpatialGraph(index.graph,'folder');assert.ok(Math.hypot(points[classes[0].id].x-points[classes[1].id].x,points[classes[0].id].y-points[classes[1].id].y,points[classes[0].id].z-points[classes[1].id].z)>200);
   const notes=new LocalReviewNotes({get:(_key:string,fallback:unknown)=>fallback,update:async()=>{}} as unknown as vscode.Memento);
   await assert.rejects(new GitReviewEngine(context,notes).open('working',index.graph),/single Git workspace folder/);
  }finally{index.dispose();}
 });
});
