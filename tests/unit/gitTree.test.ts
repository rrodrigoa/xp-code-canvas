import { describe, it, expect } from 'vitest';
import { parseGitTree, parseGitIndex } from '../../src/core/graph/GitTree';
const hash='a'.repeat(40);
describe('local Git object listings',()=>{
  it('parses blob paths without treating paths as commands',()=>{
    const result=parseGitTree(`100644 blob ${hash}\tsrc/pkg/a.py\0`+`100644 blob ${hash}\t../../unsafe.py\0`+`100644 blob ${hash}\tassets/image.png\0`);
    expect(result).toEqual([{oid:hash,path:'src/pkg/a.py'}]);
  });
  it('only accepts index stage zero and Python source',()=>{
    const result=parseGitIndex(`100644 ${hash} 0\tsrc/a.py\0`+`100644 ${hash} 2\tsrc/b.py\0`);
    expect(result).toEqual([{oid:hash,path:'src/a.py'}]);
  });
});
