import * as vscode from 'vscode';
import {suite,test} from 'mocha';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import type {GraphNode} from '../../src/shared/types';
import {InlineSourceEditService} from '../../src/extension/services/InlineSourceEditService';
const range=(start:number,end:number)=>({startLine:start,startCharacter:0,endLine:end,endCharacter:0});
suite('V7.1 Inline UML edit guard',()=>{
  test('rejects stale document hashes and never mutates source',async()=>{
    const root=vscode.workspace.workspaceFolders?.[0];assert.ok(root,'fixture folder required');
    const uri=vscode.Uri.joinPath(root.uri,'agent.py');const doc=await vscode.workspace.openTextDocument(uri);
    const original=doc.getText();const node:GraphNode={id:'sample',uri:uri.toString(),kind:'function',name:'execute',qualifiedName:'execute',module:'agent',moduleId:'m',root:root.uri.toString(),parentId:null,
      range:range(0,1),selectionRange:range(0,0),version:doc.version,visibility:'public',decorators:[],signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved',contentHash:crypto.createHash('sha256').update(original).digest('hex')};
    const service=new InlineSourceEditService();
    const invalid=await service.apply(node,{nodeId:'sample',expectedHash:'a'.repeat(64),originalSource:original,updatedSource:'raise Exception()'});
    assert.equal(invalid.ok,false);assert.equal(doc.getText(),original);
    const baseline=await service.apply({...node,baselineOnly:true},{nodeId:'sample',expectedHash:node.contentHash!,originalSource:original,updatedSource:'pass'});
    assert.equal(baseline.ok,false);assert.equal(doc.getText(),original);
  });
});
