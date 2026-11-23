import type {ComparisonModel} from './changeCognition';
import type {ReviewCognitionState} from './reviewReasoning';
import type { SourceGraph, ChangeStatus } from '../shared/types';
export type ReviewScope = 'working' | 'unstaged' | 'staged' | 'branch' | 'pr';
export type ThreadStatus = 'open' | 'resolved' | 'outdated';
export type ReviewOrigin = 'local' | 'github';
export interface ReviewTarget {
  nodeId?: string;
  edgeId?: string;
  uri?: string;
  /** Zero-based source line. GitHub's line number is one-based and must be translated at the API boundary. */
  line?: number;
  side?: 'LEFT'|'RIGHT';
  qualifiedName?:string;
}
export interface ReviewComment { id:string; author:string; body:string; createdAt:string; updatedAt?:string; url?:string; }
export interface ReviewThread {
  id:string;
  origin:ReviewOrigin;
  status:ThreadStatus;
  target:ReviewTarget;
  comments:ReviewComment[];
  remoteId?:string;
  /** Remote comment id needed for posting a direct reply. */
  replyToId?:number;
  isDraft?:boolean;publishedUrl?:string;
}
export interface ReviewFile {path:string;status:'added'|'modified'|'deleted'|'renamed'|'untracked';oldPath?:string;additions?:number;deletions?:number;}
export interface ReviewPR {owner:string;repo:string;number:number;title:string;url:string;headSha:string;baseSha:string;draft:boolean;state:string;}
export interface ReviewSnapshot {
  reviewKey:string;scope:ReviewScope;title:string;baseline:string;head:string;
  graph:SourceGraph;files:ReviewFile[];threads:ReviewThread[];pr?:ReviewPR;
  analysisAvailable:boolean;message?:string;reviewedFiles?:string[];
  /** V7.2 before/after structural evidence; never AI generated. */
  comparison?:ComparisonModel; cognition?:ReviewCognitionState;
  createdAt:string;
}
export interface ReviewMetrics {changed:number;removed:number;added:number;modified:number;potentiallyAffected:number;linksChanged:number;filesChanged:number;openThreads:number;resolvedThreads:number;}
export interface ReviewDecoration {nodeStatus:Map<string,ChangeStatus>;edgeStatus:Map<string,ChangeStatus>;counts:Map<string,{open:number;resolved:number;total:number}>;direct:Set<string>;affected:Set<string>}
export type ReviewAction =
  | {action:'add';target:ReviewTarget;body:string}
  | {action:'reply';threadId:string;body:string}
  | {action:'resolve'|'reopen'|'delete';threadId:string}
  | {action:'refresh'}
  | {action:'markReviewed'|'unmarkReviewed';path:string}
  | {action:'githubReply';threadId:string;body:string}
  | {action:'githubResolve'|'githubReopen';threadId:string}
  | {action:'githubPost';threadId:string}
  | {action:'githubSubmit';event:'COMMENT'|'APPROVE'|'REQUEST_CHANGES';body:string}
  | {action:'githubEdit'|'githubDelete';threadId:string;commentId:string;body?:string};
