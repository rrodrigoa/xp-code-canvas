import * as vscode from 'vscode';
import type {ReviewComment,ReviewPR,ReviewThread} from '../../review/reviewTypes';
type ThreadPage={repository:{pullRequest:{reviewThreads:{pageInfo:{hasNextPage:boolean;endCursor:string|null};nodes:Array<{
  id:string;isResolved:boolean;isOutdated:boolean;path:string;line:number|null;diffSide:'LEFT'|'RIGHT';comments:{nodes:Array<{id:string;databaseId:number;body:string;createdAt:string;url:string;author:{login:string}|null}>}
}>}}}};
/** All GitHub mutations are explicit, user-triggered operations. Tokens are never persisted or logged. */
export class GitHubReviewClient {
  private async token():Promise<string>{
    const session=await vscode.authentication.getSession('github',['repo'],{createIfNone:true});
    if(!session)throw Error('Sign in to GitHub in VS Code to review pull requests');return session.accessToken;
  }
  private async request<T>(method:string,path:string,body?:unknown):Promise<T>{
    if(!path.startsWith('/')||path.includes('://'))throw Error('Invalid GitHub API path');
    const token=await this.token();
    const response=await fetch(`https://api.github.com${path}`,{
      method,redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),
    });
    if(!response.ok)throw Error(`GitHub ${method} failed (${response.status}): ${(await response.text()).slice(0,600)}`);
    return response.status===204?undefined as T:await response.json() as T;
  }
  private async graphql<T>(query:string,variables:Record<string,unknown>):Promise<T>{
    const result=await this.request<{data?:T;errors?:{message:string}[]}>('POST','/graphql',{query,variables});
    if(result.errors?.length)throw Error(result.errors.map(e=>e.message).join('; ').slice(0,600));
    if(!result.data)throw Error('GitHub GraphQL returned no data');return result.data;
  }
  async getPR(owner:string,repo:string,number:number):Promise<ReviewPR>{
    if(!/^[a-z\d_.-]{1,100}$/i.test(owner)||!/^[a-z\d_.-]{1,100}$/i.test(repo)||!Number.isInteger(number)||number<1)throw Error('Invalid PR reference');
    const pr=await this.request<{title:string;html_url:string;state:string;draft:boolean;base:{sha:string};head:{sha:string}}>('GET',`/repos/${owner}/${repo}/pulls/${number}`);
    return {owner,repo,number,title:pr.title,url:pr.html_url,state:pr.state,draft:pr.draft,baseSha:pr.base.sha,headSha:pr.head.sha};
  }
  async threads(pr:ReviewPR):Promise<ReviewThread[]>{
    const query=`query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$after){pageInfo{hasNextPage endCursor}nodes{id isResolved isOutdated path line startLine diffSide comments(first:100){nodes{id databaseId body createdAt url author{login}}}}}}}}`;
    const threads:ReviewThread[]=[];let after:string|null=null;
    for(let page=0;page<10;page++){
      const result:ThreadPage=await this.graphql<ThreadPage>(query,{owner:pr.owner,repo:pr.repo,number:pr.number,after});
      const data=result.repository?.pullRequest?.reviewThreads;if(!data)throw Error('Pull request review threads not found');
      for(const t of data.nodes){const comments:ReviewComment[]=t.comments.nodes.map(c=>({id:`db:${c.databaseId}`,author:c.author?.login??'unknown',body:c.body,createdAt:c.createdAt,url:c.url}));
        threads.push({id:t.id,remoteId:t.id,origin:'github',status:t.isOutdated?'outdated':t.isResolved?'resolved':'open',
          target:{uri:t.path,line:t.line===null?undefined:t.line-1,side:t.diffSide},comments,replyToId:t.comments.nodes[0]?.databaseId});
      }
      if(!data.pageInfo.hasNextPage)break;after=data.pageInfo.endCursor;if(!after)break;
    }
    return threads;
  }
  async reply(pr:ReviewPR,commentId:number,body:string):Promise<void>{
    if(!Number.isInteger(commentId)||commentId<1||!body.trim()||body.length>16000)throw Error('Invalid reply');
    await this.request('POST',`/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments/${commentId}/replies`,{body});
  }
  async resolve(remoteId:string,resolved:boolean):Promise<void>{
    if(!/^[-_A-Za-z0-9=]{8,300}$/.test(remoteId))throw Error('Invalid GitHub thread id');
    const name=resolved?'resolveReviewThread':'unresolveReviewThread';
    await this.graphql(`mutation($id:ID!){${name}(input:{threadId:$id}){thread{id isResolved}}}`,{id:remoteId});
  }
  async edit(pr:ReviewPR,commentId:number,body:string):Promise<void>{
    if(!Number.isInteger(commentId)||commentId<1||!body.trim())throw Error('Invalid comment edit');
    await this.request('PATCH',`/repos/${pr.owner}/${pr.repo}/pulls/comments/${commentId}`,{body});
  }
  async delete(pr:ReviewPR,commentId:number):Promise<void>{
    if(!Number.isInteger(commentId)||commentId<1)throw Error('Invalid comment id');
    await this.request('DELETE',`/repos/${pr.owner}/${pr.repo}/pulls/comments/${commentId}`);
  }
  async postGeneralComment(pr:ReviewPR,body:string):Promise<string>{
    if(!body.trim()||body.length>16000)throw Error('Invalid PR discussion comment');
    const result=await this.request<{html_url:string}>('POST',`/repos/${pr.owner}/${pr.repo}/issues/${pr.number}/comments`,{body});
    return result.html_url;
  }
  async postThread(pr:ReviewPR,path:string,line:number,body:string,side:'LEFT'|'RIGHT'='RIGHT'):Promise<void>{
    if(!path||path.length>2048||!Number.isInteger(line)||line<1||!body.trim())throw Error('Invalid PR inline review comment');
    await this.request('POST',`/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments`,{commit_id:pr.headSha,path,line,side,body});
  }
  /** A review is published only after the reviewer explicitly chooses its event. */
  async submit(pr:ReviewPR,event:'COMMENT'|'APPROVE'|'REQUEST_CHANGES',body:string):Promise<void>{
    await this.request('POST',`/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/reviews`,{event,body,commit_id:pr.headSha});
  }
}
