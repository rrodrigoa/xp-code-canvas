import { describe,expect,it } from 'vitest';
import { layoutGitLanes,parseGitLog } from '../../src/shared/gitHistory';
const A='a'.repeat(40), B='b'.repeat(40), C='c'.repeat(40), D='d'.repeat(40);
const gitRecord=(h:string,parents:string,subject:string,refs='')=>`${h}\x1f${parents}\x1f${subject}\x1fAda\x1f2026-11-01T13:00:00Z\x1f${refs}\x1e`;
describe('Git history presentation',()=>{
  it('parses source-backed history without inventing refs',()=>{
    const commits=parseGitLog(gitRecord(A,`${B} ${C}`,'Merge branch','HEAD -> main, tag: v3'));
    expect(commits).toHaveLength(1);
    expect(commits[0].parents).toEqual([B,C]);
    expect(commits[0].refs).toEqual(['HEAD -> main','tag: v3']);
  });
  it('draws parallel branch tracks and merges, preserving parent edges',()=>{
    const rows=layoutGitLanes([
      {hash:A,parents:[B,C],subject:'merge',author:'Ada',date:'2026',refs:[]},
      {hash:C,parents:[D],subject:'feature',author:'Ada',date:'2026',refs:[]},
      {hash:B,parents:[D],subject:'main',author:'Ada',date:'2026',refs:[]},
      {hash:D,parents:[],subject:'base',author:'Ada',date:'2026',refs:[]},
    ]);
    expect(rows[0].segments.filter(s=>s.active)).toHaveLength(2);
    expect(rows[0].after).toContain(B);expect(rows[0].after).toContain(C);
    expect(rows.at(-1)?.commit.hash).toBe(D);
  });
  it('ignores invalid hashes and bounds sanitized strings',()=>{
    const result=parseGitLog('not-a-hash\x1f\x1fsubject\x1fauthor\x1f2026\x1f\x1e');
    expect(result).toEqual([]);
  });
});
