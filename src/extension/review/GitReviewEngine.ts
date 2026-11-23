import * as vscode from 'vscode';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import {snapshotGit} from '../gitSnapshot';
import {analyzePython} from '../pythonWorker';
import {overlayChanges} from '../../shared/semanticDiff';
import {buildComparison} from '../../review/changeCognition';
import type {SourceGraph} from '../../shared/types';
import type {ReviewScope,ReviewFile,ReviewPR,ReviewSnapshot} from '../../review/reviewTypes';
import {LocalReviewNotes} from './LocalReviewNotes';
const exec=promisify(execFile);
const safeRef=(value:string)=>{
  if(!value||value.length>120||value.startsWith('-')||!/^[-\w./^~{}]+$/.test(value)||value.includes('..'))throw Error('Invalid Git revision');
  return value;
};
function parseNameStatus(input:Buffer):ReviewFile[]{
  const fields=input.toString('utf8').split('\0');const files:ReviewFile[]=[];
  for(let i=0;i<fields.length;){const status=fields[i++];if(!status)break;
    if(!/^[AMDRC][0-9]*$/.test(status))throw Error('Unrecognized Git change status');
    const oldPath=fields[i++];if(!oldPath)break;
    const isRename=status.startsWith('R')||status.startsWith('C');const filePath=isRename?fields[i++]:oldPath;
    if(!filePath)break;
    files.push({path:filePath,oldPath:isRename?oldPath:undefined,
      status:status.startsWith('A')?'added':status.startsWith('D')?'deleted':isRename?'renamed':'modified'});
  }
  return files;
}
/** Executes local Git ONLY with argument arrays, bounded output, and no repository mutations. */
export class GitReviewEngine {
  constructor(private readonly extension:vscode.ExtensionContext,private readonly notes:LocalReviewNotes){}
  private get root():string {
    const folder=vscode.workspace.workspaceFolders?.find(f=>f.uri.scheme==='file');
    if(!folder)throw Error('Review requires a local Git workspace');return folder.uri.fsPath;
  }
  private async git(...args:string[]):Promise<string>{
    const {stdout}=await exec('git',args,{cwd:this.root,windowsHide:true,shell:false,timeout:20000,maxBuffer:4*1024*1024});
    return stdout;
  }
  private async statusFiles(args:string[]):Promise<ReviewFile[]>{
    const {stdout}=await exec('git',args,{cwd:this.root,windowsHide:true,shell:false,encoding:'buffer',timeout:20000,maxBuffer:8*1024*1024});
    return parseNameStatus(stdout as Buffer);
  }
  async open(scope:ReviewScope,live:SourceGraph,options:{base?:string;pr?:ReviewPR}={}):Promise<ReviewSnapshot>{
    if(!vscode.workspace.isTrusted)throw Error('Review requires a trusted workspace');
    if((vscode.workspace.workspaceFolders??[]).filter(f=>f.uri.scheme==='file').length!==1)throw Error('Select a single Git workspace folder for source-accurate review; multi-root review is not supported yet');
    let head='';
    try{head=(await this.git('rev-parse','--verify','HEAD')).trim();}catch{
      // An initialized repository can have a valid index before its first commit.
      await this.git('rev-parse','--git-dir');
    }
    const branch=(await this.git('branch','--show-current')).trim()||head.slice(0,12);
    let baseline='',target='',before:SourceGraph,after:SourceGraph,files:ReviewFile[]=[];
    let title='';let analysisAvailable=true;let message: string|undefined;
    if(scope==='working'||scope==='unstaged'){
      baseline=scope==='working'?(head?'HEAD':'EMPTY'):'INDEX';target='WORKTREE';
      before=baseline==='EMPTY'?{schema:1,nodes:[],edges:[],diagnostics:[]}:await analyzePython(this.extension,await snapshotGit(baseline));after=live;
      files=scope==='working'&&!head?(await this.git('ls-files','-z')).split('\0').filter(Boolean).map(path=>({path,status:'added' as const})):
        await this.statusFiles(scope==='working'?['diff','HEAD','--name-status','-z','-M']:['diff','--name-status','-z','-M']);
      const untracked=(await this.git('ls-files','--others','--exclude-standard','-z')).split('\0').filter(Boolean);
      for(const path of untracked)if(!files.some(f=>f.path===path))files.push({path,status:'untracked'});
      for(const doc of vscode.workspace.textDocuments){
        if(!doc.isDirty||doc.uri.scheme!=='file')continue;
        const relative=path.relative(this.root,doc.uri.fsPath).replace(/\\/g,'/');
        if(relative&&!relative.startsWith('../')&&!path.isAbsolute(relative)&&!files.some(f=>f.path===relative))files.push({path:relative,status:'modified'});
      }
      title=scope==='working'?'Working changes · HEAD → editor':'Unstaged changes · INDEX → editor';
    }else if(scope==='staged'){
      baseline=head?'HEAD':'EMPTY';target='INDEX';
      before=head?await analyzePython(this.extension,await snapshotGit('HEAD')):{schema:1,nodes:[],edges:[],diagnostics:[]};
      after=await analyzePython(this.extension,await snapshotGit('INDEX'));
      files=await this.statusFiles(['diff','--cached','--name-status','-z','-M']);
      title='Staged changes · HEAD → index';
    }else if(scope==='branch'){
      const base=safeRef(options.base??'main');
      baseline=(await this.git('merge-base',base,'HEAD')).trim();target=head;
      before=await analyzePython(this.extension,await snapshotGit(baseline));
      after=await analyzePython(this.extension,await snapshotGit('HEAD'));
      files=await this.statusFiles(['diff','--name-status','-z','-M',baseline,head]);
      title=`Branch changes · ${base} → ${branch}`;
    }else{
      if(!options.pr)throw Error('Select a pull request before opening PR review');
      const pr=options.pr;baseline=pr.baseSha;target=pr.headSha;title=`PR #${pr.number} · ${pr.title}`;
      try{
        // GitHub PR analysis is only claimed when BOTH exact Git objects exist locally.
        await this.git('cat-file','-e',`${baseline}^{commit}`);
        await this.git('cat-file','-e',`${target}^{commit}`);
        // A PR is a three-dot comparison: use the common ancestor to avoid
        // attributing unrelated updates to the base branch to the PR author.
        baseline=(await this.git('merge-base',pr.baseSha,pr.headSha)).trim();
        before=await analyzePython(this.extension,await snapshotGit(baseline));
        after=await analyzePython(this.extension,await snapshotGit(target));
        files=await this.statusFiles(['diff','--name-status','-z','-M',baseline,target]);
      }catch{
        analysisAvailable=false;
        message='PR commits are not available locally. Fetch/check out the PR to enable source-backed visual impact analysis; remote threads remain accessible.';
        before=live;after=live;
      }
    }
    const reviewKey=crypto.createHash('sha256').update(`${this.root}|${scope}|${branch}|${options.pr?.number??''}`).digest('hex').slice(0,28);
    const graph=overlayChanges(before!,after!);
    const comparison=analysisAvailable?buildComparison(before!,after!,baseline,target):undefined;
    return {reviewKey,scope,title,baseline,head:target,graph,files,threads:this.notes.list(reviewKey),pr:options.pr,
      analysisAvailable,message,comparison,createdAt:new Date().toISOString()};
  }
}
