import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { parseGitLog, type GitCommit } from '../../shared/gitHistory';
const run=promisify(execFile);
export class GitHistoryService {
  async list(limit=80,focusedFile?:string):Promise<GitCommit[]> {
    const focused=focusedFile?vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(focusedFile)):undefined;
    const folder=focused?.uri.scheme==='file'?focused:(vscode.workspace.workspaceFolders ?? []).find(f=>f.uri.scheme==='file');
    if (!folder) return [];
    const count=Math.max(1,Math.min(160,Math.trunc(limit)));
    const {stdout}=await run('git',[
      'log','--topo-order','--decorate=short',`--max-count=${count}`,
      '--pretty=format:%H%x1f%P%x1f%s%x1f%an%x1f%aI%x1f%D%x1e'
    ],{cwd:folder.uri.fsPath,shell:false,windowsHide:true,timeout:12000,maxBuffer:1024*1024});
    return parseGitLog(stdout);
  }
}
