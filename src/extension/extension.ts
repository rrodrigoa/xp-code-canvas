import * as vscode from 'vscode';
import { CanvasController } from './controllers/CanvasController';
import { CANVAS_VIEW_TYPE } from './controllers/WebviewHost';
export { CanvasController } from './controllers/CanvasController';

export function activate(context: vscode.ExtensionContext): void {
  const controller = new CanvasController(context);
  context.subscriptions.push(controller, ...controller.registerCommands());
  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(CANVAS_VIEW_TYPE, {
    async deserializeWebviewPanel(panel) {
      controller.attach(panel);
      void controller.refresh();
    },
  }));
}

export function deactivate(): void { /* vscode disposes subscriptions */ }
