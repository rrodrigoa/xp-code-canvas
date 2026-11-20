/** CSP and asset ownership is kept outside workflow/navigation controllers. */
import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
export const CANVAS_VIEW_TYPE='xpCodeCanvas.canvas';
export function canvasHtml(extensionUri:vscode.Uri,webview:vscode.Webview):string {
  const nonce=crypto.randomBytes(24).toString('base64');
  const asset=(name:string)=>webview.asWebviewUri(vscode.Uri.joinPath(extensionUri,'dist','webview','assets',name));
  const js=asset('app.js');
  const css=asset('app.css');
  const csp=`default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'strict-dynamic'; worker-src blob:; connect-src 'none'`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>`+
    `<meta http-equiv="Content-Security-Policy" content="${csp}"/><link rel="stylesheet" href="${css}"/>`+
    `<title>Python UML Canvas</title></head><body><div id="root"></div><script type="module" nonce="${nonce}" src="${js}"></script></body></html>`;
}
