import { describe,it,expect } from 'vitest';
import { parseBlamePorcelain,summarizeBlame } from '../../src/shared/blame';
const sample=`1111111111111111111111111111111111111111 10 5 1\nauthor Ada\nauthor-mail <ada@example.com>\nauthor-time 1730000000\nsummary First change\nfilename service/worker.py\n\treturn value\n2222222222222222222222222222222222222222 20 6 1\nauthor Bea\nauthor-time 1731000000\nsummary Second change\nfilename service/worker.py\n\treturn 2\n1111111111111111111111111111111111111111 11 7 1\nauthor Ada\nauthor-time 1730000000\nsummary First change\nfilename service/worker.py\n\treturn 3`;
describe('Git porcelain blame (V5)',()=>{
  it('attributes individual lines and never guesses authorship',()=>{
    const lines=parseBlamePorcelain(sample);
    expect(lines.map(l=>l.line)).toEqual([5,6,7]);
    expect(lines[0].authorEmail).toBe('ada@example.com');
    expect(summarizeBlame(lines).authors[0]).toMatchObject({author:'Ada',lines:2});
    expect(summarizeBlame(lines).uniqueCommits).toBe(2);
    expect(summarizeBlame(lines).latest?.author).toBe('Bea');
  });
  it('drops unstructured lines and bounds work',()=>{
    expect(parseBlamePorcelain('fatal: no such file')).toEqual([]);
    expect(parseBlamePorcelain(sample,1)).toHaveLength(1);
  });
});
