import * as vscode from 'vscode';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import type { TextInput } from './PythonWorkerClient';
import type { DocumentSnapshot } from '../../core/contracts/graph.v2';
const hash = (content: string) => crypto.createHash('sha256').update(content).digest('hex');

export interface SourceRecord { input: TextInput; snapshot: DocumentSnapshot; }
/** VS Code remains the only authority for source content and unsaved buffers. */
export class VsCodeSourceRepository {
  readonly snapshots = new Map<string,SourceRecord>();
  constructor(private readonly workspaceId: string) {}

  async discover(): Promise<vscode.Uri[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (!folders.length) return [];
    const exclusion = '**/{.git,.venv,venv,node_modules,__pycache__,build,dist,.tox,.mypy_cache,.pytest_cache,.ruff_cache}/**';
    const uris = await vscode.workspace.findFiles('**/*.py', exclusion);
    const excluded = vscode.workspace.getConfiguration('xpCodeCanvas').get<string[]>('excludeGlobs') ?? [];
    // Common glob directory exclusion, without converting URIs to local filesystem paths.
    const names = new Set(excluded.filter(x => x.includes('/')).map(x => x.replace(/\*/g,'').replace(/\//g,'').trim()).filter(Boolean));
    return uris.filter(uri => !uri.path.split('/').some(segment => names.has(segment))).sort((a,b) => a.toString().localeCompare(b.toString()));
  }

  private rootFor(uri: vscode.Uri): string {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return uri.with({path:uri.path.substring(0,uri.path.lastIndexOf('/'))}).toString();
    const src = vscode.Uri.joinPath(folder.uri, 'src');
    // VS Code file discovery may normalize Windows drive-letter casing while
    // workspace URIs retain it. Filesystem-relative paths preserve one module
    // root for live buffers and immutable Git snapshots.
    if(uri.scheme==='file'){
      const relative=path.relative(src.fsPath,uri.fsPath);
      if(relative&&relative!=='..'&&!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative))return src.toString();
      return folder.uri.toString();
    }
    if (uri.path.startsWith(src.path + '/')) return src.toString();
    return folder.uri.toString();
  }

  async capture(uri: vscode.Uri): Promise<SourceRecord> {
    const open = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
    let content:string;
    if(open)content=open.getText();
    else {
      const bytes=await vscode.workspace.fs.readFile(uri);
      try {content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
      catch {content=(await vscode.workspace.openTextDocument(uri)).getText();}
    }
    const version = open?.version ?? 0;
    const sourceOrigin = open ? 'open-buffer' as const : 'disk' as const;
    const root = this.rootFor(uri);
    const input: TextInput = { uri:uri.toString(),root,text:content,version };
    const snapshot: DocumentSnapshot = {workspaceId:this.workspaceId,uri:uri.toString(),language:'python', sourceOrigin,
      documentVersion:version, contentHash:hash(content)};
    const record = {input,snapshot};
    this.snapshots.set(uri.toString(),record);
    return record;
  }
  remove(uri: vscode.Uri): void { this.snapshots.delete(uri.toString()); }
  find(uri: string): SourceRecord | undefined { return this.snapshots.get(uri); }
  async currentHash(uri: vscode.Uri): Promise<string> {
    const open = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
    if (open) return hash(open.getText());
    return hash(new TextDecoder('utf-8',{fatal:true}).decode(await vscode.workspace.fs.readFile(uri)));
  }
}
