import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import * as assert from 'node:assert/strict';
import {NativeEditorNavigator} from '../../src/extension/controllers/NativeEditorNavigator';
import type {GraphNode} from '../../src/shared/types';

suite('XP Code Canvas VS Code Extension Host', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('xp-libs.xp-code-canvas');
    assert.ok(extension, 'extension must be installed in the test host');
    await extension.activate();
  });
  test('registers required navigation commands', async () => {
    const commands = new Set(await vscode.commands.getCommands(true));
    for (const cmd of ['xpCodeCanvas.open', 'xpCodeCanvas.focusCurrentFile', 'xpCodeCanvas.focusFile', 'xpCodeCanvas.returnToCanvas', 'xpCodeCanvas.alignFocusedFile','xpCodeCanvas.spreadGraph','xpCodeCanvas.focusSymbol','xpCodeCanvas.showHistory','xpCodeCanvas.showChanges','xpCodeCanvas.showBlame','xpCodeCanvas.compareCommit','xpCodeCanvas.refreshSidebar']) {
      assert.equal(commands.has(cmd), true, `${cmd} missing`);
    }
  });
  test('registers native trees and navigates exact preview cursors in the native editor',async()=>{
    const manifest=vscode.extensions.getExtension('xp-libs.xp-code-canvas')!.packageJSON;
    assert.deepEqual(manifest.contributes.views['xpCodeCanvas-sidebar'].map((v:{id:string})=>v.id),['xpCodeCanvas.structure','xpCodeCanvas.history']);
    const doc=await vscode.workspace.openTextDocument(vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri,'agent.py'));
    const node={id:'cursor-test',uri:doc.uri.toString(),range:{startLine:12,startCharacter:4,endLine:14,endCharacter:27},selectionRange:{startLine:12,startCharacter:8,endLine:12,endCharacter:15}} as GraphNode;
    const navigator=new NativeEditorNavigator();
    await navigator.open(node,vscode.ViewColumn.One,{line:13,character:17});
    assert.equal(vscode.window.activeTextEditor!.selection.active.line,13);
    assert.equal(vscode.window.activeTextEditor!.selection.active.character,17);
    await navigator.open(node,vscode.ViewColumn.One,{line:12,character:0});
    assert.equal(vscode.window.activeTextEditor!.selection.active.character,0);
    await navigator.open(node,vscode.ViewColumn.One,{line:0,character:0});
    assert.equal(vscode.window.activeTextEditor!.selection.active.character,8,'Outside preview falls back to declaration');
  });
  test('opens actual Python document without altering source', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'fixture workspace required');
    const file = vscode.Uri.joinPath(folder.uri, 'agent.py');
    const doc = await vscode.workspace.openTextDocument(file);
    const original = doc.getText();
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('xpCodeCanvas.focusCurrentFile');
    assert.equal(doc.getText(), original);
    await vscode.commands.executeCommand('xpCodeCanvas.returnToCanvas');
    assert.equal(doc.getText(), original);
  });
});
