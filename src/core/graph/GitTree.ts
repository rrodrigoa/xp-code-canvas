/** Pure parser for Git's NUL-delimited ls-tree and ls-files --stage results. */
import * as path from 'node:path';
export interface GitBlob { oid:string; path:string; }
function safeRelativePath(value:string):boolean {
  return value.endsWith('.py') && !value.startsWith('/') && !value.includes('\\') &&
    !value.split('/').some(p=>p==='' || p==='.' || p==='..') && !path.isAbsolute(value);
}
export function parseGitTree(text:string):GitBlob[] {
  const records:GitBlob[]=[];
  for(const record of text.split('\0')) {
    if(!record)continue;
    const match=/^\d{6} blob ([0-9a-f]{40,64})\t(.+)$/.exec(record);
    if(match && safeRelativePath(match[2]))records.push({oid:match[1],path:match[2]});
  }
  return records;
}
export function parseGitIndex(text:string):GitBlob[] {
  const records:GitBlob[]=[];
  for(const record of text.split('\0')) {
    if(!record)continue;
    const match=/^\d{6} ([0-9a-f]{40,64}) (\d)\t(.+)$/.exec(record);
    if(match && match[2]==='0' && safeRelativePath(match[3]))records.push({oid:match[1],path:match[3]});
  }
  return records;
}
