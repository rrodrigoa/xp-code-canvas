import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import * as assert from 'node:assert/strict';

suite('XP Code Canvas VS Code Extension Host', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('xp-libs.xp-code-canvas');
    assert.ok(extension, 'extension must be installed in the test host');
    await extension.activate();
  });
  test('registers required navigation commands', async () => {
    const commands = new Set(await vscode.commands.getCommands(true));
    for (const cmd of ['xpCodeCanvas.open', 'xpCodeCanvas.focusCurrentFile', 'xpCodeCanvas.focusFile', 'xpCodeCanvas.returnToCanvas', 'xpCodeCanvas.alignFocusedFile']) {
      assert.equal(commands.has(cmd), true, `${cmd} missing`);
    }
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
