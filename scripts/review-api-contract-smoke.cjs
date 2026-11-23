/* Runs the actual GitHubReviewClient against deterministic mocked network and VS Code authentication. */
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const {execFileSync}=require('node:child_process');const path=require('node:path');
let ts;try{ts=require('typescript');}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
const code=ts.transpileModule(fs.readFileSync('src/extension/review/GitHubReviewClient.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleForTest=new Module('GitHubReviewClient.js',module);
moduleForTest.filename='GitHubReviewClient.js';
moduleForTest.paths=module.paths;
moduleForTest.require=id=>id==='vscode'?{authentication:{getSession:async()=>({accessToken:'test-only-token'})}}:require(id);
moduleForTest._compile(code,moduleForTest.filename);
const {GitHubReviewClient}=moduleForTest.exports;
const seen=[];const previousFetch=global.fetch;
const response=(status,value)=>({ok:status>=200&&status<300,status,json:async()=>value,text:async()=>JSON.stringify(value)});
global.fetch=async(url,options)=>{
  assert.equal(new URL(url).hostname,'api.github.com');
  assert.equal(options.headers.Authorization,'Bearer test-only-token');
  assert.equal(options.redirect,'error');
  const name=new URL(url).pathname;seen.push({method:options.method,path:name,body:options.body?JSON.parse(options.body):undefined});
  if(name==='/graphql'){
    if(options.body.includes('reviewThreads')) {
      const comment = {id:'C1', databaseId:50, body:'Please verify',createdAt:'2026-11-21T00:00:00Z',url:'https://github.com/org/repo/pull/9#comment',author:{login:'reviewer'}};
      const thread = {id:'PRRT_12345',isResolved:false,isOutdated:false,path:'src/agent.py',line:7,diffSide:'RIGHT',comments:{nodes:[comment]}};
      const reviewThreads = {pageInfo:{hasNextPage:false,endCursor:null},nodes:[thread]};
      return response(200,{data:{repository:{pullRequest:{reviewThreads}}}});
    }
    return response(200,{data:{resolveReviewThread:{thread:{id:'PRRT_12345',isResolved:true}}}});
  }
  if(name.endsWith('/pulls/9')&&options.method==='GET')return response(200,{title:'Review agent changes',html_url:'https://github.com/org/repo/pull/9',state:'open',draft:false,base:{sha:'a'.repeat(40)},head:{sha:'b'.repeat(40)}});
  if(options.method==='DELETE')return response(204,null);
  if(name.endsWith('/issues/9/comments'))return response(201,{html_url:'https://github.com/org/repo/pull/9#issuecomment-1'});
  return response(200,{});
};
(async()=>{
  try{
    const client=new GitHubReviewClient();const pr=await client.getPR('org','repo',9);
    assert.equal(pr.number,9);
    const threads=await client.threads(pr);assert.equal(threads.length,1);assert.equal(threads[0].target.line,6);assert.equal(threads[0].replyToId,50);
    await client.reply(pr,50,'Can you check this?');
    await client.resolve('PRRT_12345',true);
    await client.postThread(pr,'src/agent.py',7,'Review this');
    await client.postGeneralComment(pr,'Graph-level concern');
    await client.submit(pr,'REQUEST_CHANGES','Please address it');
    await client.edit(pr,50,'Updated question');
    await client.delete(pr,50);
    assert(seen.some(x=>x.path.endsWith('/pulls/9/reviews')&&x.body.event==='REQUEST_CHANGES'));
    assert(seen.some(x=>x.path==='/graphql'&&x.body.query.includes('resolveReviewThread')));
    assert(seen.some(x=>x.path.endsWith('/pulls/9/comments')&&x.body.line===7&&x.body.side==='RIGHT'));
    console.log(`PASS: GitHub PR metadata, GraphQL threads/resolution, replies, inline/general comments, review submission, edits/deletes (${seen.length} mocked calls)`);
  }finally{global.fetch=previousFetch;}
})().catch(error=>{console.error(error);process.exitCode=1});
