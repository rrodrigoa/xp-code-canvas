/** Pure and bounded Git history parsing and lane planning, independent of the renderer. */
export interface GitCommit {
  hash: string;
  parents: string[];
  subject: string;
  author: string;
  date: string;
  refs: string[];
}
export interface GitLaneSegment { from: number; to: number; active: boolean; }
export interface GitLaneRow {
  commit: GitCommit;
  lane: number;
  before: string[];
  after: string[];
  segments: GitLaneSegment[];
}
export function parseGitLog(raw: string): GitCommit[] {
  const commits: GitCommit[] = [];
  for (const record of raw.split('\x1e')) {
    const fields = record.trimStart().split('\x1f');
    if (fields.length < 6) continue;
    const [hash, parentText, subject, author, date, refs] = fields;
    if (!/^[a-f0-9]{40,64}$/i.test(hash.trim())) continue;
    commits.push({
      hash: hash.trim(),
      parents: parentText.trim() ? parentText.trim().split(/\s+/) : [],
      subject: subject.trim().slice(0, 400),
      author: author.trim().slice(0, 160),
      date: date.trim(),
      refs: refs.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12),
    });
  }
  return commits;
}
/** The history is already in --topo-order: heads precede their parents. */
export function layoutGitLanes(commits: GitCommit[]): GitLaneRow[] {
  let active: string[] = [];
  const rows: GitLaneRow[] = [];
  for (const commit of commits) {
    const before = [...active];
    let lane = before.indexOf(commit.hash);
    if (lane < 0) {
      lane = before.length;
      before.push(commit.hash);
    }
    const next = [...before];
    next.splice(lane, 1);
    for (let i = 0; i < commit.parents.length; i++) {
      const parent = commit.parents[i];
      if (next.includes(parent)) continue;
      next.splice(Math.min(lane + i, next.length), 0, parent);
    }
    const segments: GitLaneSegment[] = [];
    for (let i = 0; i < before.length; i++) {
      const hash = before[i];
      if (hash === commit.hash) {
        for (const parent of commit.parents) {
          const destination = next.indexOf(parent);
          if (destination >= 0) segments.push({from:lane,to:destination,active:true});
        }
      } else {
        const destination = next.indexOf(hash);
        if (destination >= 0) segments.push({from:i,to:destination,active:false});
      }
    }
    rows.push({ commit, lane, before, after:[...next], segments });
    active=next;
  }
  return rows;
}
