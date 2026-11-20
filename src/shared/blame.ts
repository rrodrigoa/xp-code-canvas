/** Source-backed Git line attribution. Blame is last modification, not original authorship. */
export interface BlameLine {
  line: number; originalLine: number; hash: string; author: string;
  authorEmail?: string; timestamp: number; summary: string; file: string;
}
export interface BlameAuthor { author: string; lines: number; share: number; }
export interface BlameSummary { lines: number; uniqueCommits: number; authors: BlameAuthor[]; latest?: BlameLine; }
export interface BlameResult {
  nodeId: string; sourceHash?: string;
  /** 'clean' guarantees that HEAD line coordinates also address the current document. */
  status: 'clean' | 'dirty' | 'untracked' | 'unavailable';
  basis: 'HEAD';
  message?: string;
  lines: BlameLine[];
  summary?: BlameSummary;
}

const HEADER=/^([0-9a-f]{40,64}|\^{0,1}[0-9a-f]{40}) (\d+) (\d+)(?: (\d+))?$/i;
/** Git --line-porcelain parser; do not parse human-oriented git blame output. */
export function parseBlamePorcelain(raw:string,limit=6000):BlameLine[] {
  const lines:BlameLine[]=[];
  let current:Partial<BlameLine>|null=null;
  for(const entry of raw.split(/\r?\n/)) {
    const match=HEADER.exec(entry);
    if(match){
      current={hash:match[1],originalLine:Number(match[2]),line:Number(match[3]),author:'Unknown',timestamp:0,summary:'',file:''};
      continue;
    }
    if(!current)continue;
    if(entry.startsWith('\t')){
      if(current.line && Number.isFinite(current.line))lines.push(current as BlameLine);
      current=null;
      if(lines.length>=limit)break;
      continue;
    }
    const split=entry.indexOf(' ');
    if(split<0)continue;
    const key=entry.slice(0,split),value=entry.slice(split+1);
    if(key==='author')current.author=value.slice(0,256);
    if(key==='author-mail')current.authorEmail=value.replace(/^<|>$/g,'').slice(0,256);
    if(key==='author-time')current.timestamp=Number(value)||0;
    if(key==='summary')current.summary=value.slice(0,500);
    if(key==='filename')current.file=value.slice(0,4096);
  }
  return lines;
}
export function summarizeBlame(lines:readonly BlameLine[]):BlameSummary {
  const perAuthor=new Map<string,number>();
  const hashes=new Set<string>();
  let latest:BlameLine|undefined;
  for(const line of lines){
    perAuthor.set(line.author,(perAuthor.get(line.author)||0)+1);
    hashes.add(line.hash);
    if(!latest||line.timestamp>latest.timestamp)latest=line;
  }
  const count=lines.length;
  return {
    lines:count,uniqueCommits:hashes.size,latest,
    authors:[...perAuthor].map(([author,n])=>({author,lines:n,share:count?n/count:0}))
      .sort((a,b)=>b.lines-a.lines||a.author.localeCompare(b.author)),
  };
}
