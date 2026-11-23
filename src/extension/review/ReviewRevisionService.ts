import * as vscode from 'vscode';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {snapshotGit} from '../gitSnapshot';
import {analyzePython} from '../pythonWorker';
import type {SourceGraph} from '../../shared/types';
import type {ReviewSnapshot} from '../../review/reviewTypes';
const run=promisify(execFile);
/** Bounded on-demand history navigation. Never checks out, resets, or mutates a repository. */
export class ReviewRevisionService {
  private cached=new Map<string,SourceGraph>();
  constructor(private readonly context:vscode.ExtensionContext){}
  private root():string {
    if(!vscode.workspace.isTrusted)throw Error('Revision inspection requires a trusted workspace');
    const roots=vscode.workspace.workspaceFolders?.filter(f=>f.uri.scheme==='file')??[];
    if(roots.length!==1)throw Error('Use a single local Git workspace for revision inspection');
    return roots[0].uri.fsPath;
  }
  private async git(...args:string[]):Promise<string>{
    const result=await run('git',args,{cwd:this.root(),shell:false,windowsHide:true,timeout:20000,maxBuffer:512*1024});
    return String(result.stdout);
  }
  async list(review:ReviewSnapshot):Promise<string[]> {
    if(!review.analysisAvailable)return [];
    if(review.scope!=='branch'&&review.scope!=='pr')return [review.baseline,review.head];
    // Only direct SHA values derived by the local review engine are used.
    if(!/^[a-f0-9]{40}$/.test(review.baseline)||!/^[a-f0-9]{40}$/.test(review.head))return [];
    const lines=(await this.git('rev-list','--first-parent','--max-count=22',review.head,`^${review.baseline}`)).trim().split(/\r?\n/).filter(v=>/^[a-f0-9]{40}$/.test(v)).reverse();
    const commits=[review.baseline,...lines,review.head];
    return [...new Set(commits)].slice(0,24);
  }
  async get(review:ReviewSnapshot,revision:string):Promise<SourceGraph>{
    if(!/^[a-f0-9]{40}$/.test(revision)||!(await this.list(review)).includes(revision))throw Error('Revision is not part of the selected review');
    const id=`${review.reviewKey}:${revision}`;
    const cached=this.cached.get(id);if(cached)return cached;
    const graph=await analyzePython(this.context,await snapshotGit(revision));
    if(this.cached.size>=3)this.cached.delete(this.cached.keys().next().value!);
    this.cached.set(id,graph);
    return graph;
  }
}
