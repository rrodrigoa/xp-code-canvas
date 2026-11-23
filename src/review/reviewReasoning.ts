/** Reviewer-attested progress and questions. Display is evidence of activity, not correctness. */
export type ReviewStatus='unseen'|'opened'|'reviewed'|'needs-evidence'|'stale';
export interface ReviewQuestion {id:string;body:string;status:'open'|'answered';createdAt:string;}
export interface ReviewRecord {status:ReviewStatus;questions:ReviewQuestion[];updatedAt?:string;headAtReview?:string;}
export interface ReviewCognitionState {
  reviewKey:string;head:string;records:Record<string,ReviewRecord>;bookmarks:string[];shelf:string[];
  /** Set when previously attested review records refer to a different revision. */
  revisionChanged:boolean;
}
export type CognitionAction=
  | {action:'status';key:string;status:'opened'|'reviewed'|'needs-evidence'|'unseen'}
  | {action:'question';key:string;body:string}
  | {action:'answer';key:string;questionId:string;answered:boolean}
  | {action:'bookmark';key:string;enabled:boolean}
  | {action:'shelf';key:string;enabled:boolean};

export function emptyCognition(reviewKey:string,head:string):ReviewCognitionState{
  return {reviewKey,head,records:{},bookmarks:[],shelf:[],revisionChanged:false};
}
export function recoverCognition(state:ReviewCognitionState|undefined,key:string,head:string):ReviewCognitionState {
  if(!state||state.reviewKey!==key)return emptyCognition(key,head);
  if(state.head===head)return state;
  const records:Record<string,ReviewRecord>={};
  for(const [id,record] of Object.entries(state.records))records[id]={...record,
    status:record.status==='reviewed'||record.status==='opened'?'stale':record.status};
  return {...state,head,records,revisionChanged:true};
}
export function applyCognition(state:ReviewCognitionState,action:CognitionAction,now='2026-01-01T00:00:00Z',id='question'):ReviewCognitionState {
  if(!('key' in action)||!action.key||action.key.length>2048)throw Error('Invalid review target');
  const key=action.key;
  const record=state.records[key]??{status:'unseen' as const,questions:[]};
  if(action.action==='bookmark'||action.action==='shelf'){
    const property=action.action==='bookmark'?'bookmarks':'shelf';const limit=action.action==='shelf'?4:150;
    const values=state[property].filter(v=>v!==key);
    if(action.enabled)values.push(key);
    if(values.length>limit)throw Error(`${property} limit exceeded`);
    return {...state,[property]:values};
  }
  const records={...state.records};
  if(action.action==='status'){
    records[key]={...record,status:action.status,updatedAt:now,headAtReview:action.status==='reviewed'?state.head:record.headAtReview};
  }else if(action.action==='question'){
    const body=action.body.trim();if(body.length<2||body.length>4000)throw Error('Question must contain 2–4,000 characters');
    if(record.questions.length>=100)throw Error('Question limit exceeded');
    records[key]={...record,questions:[...record.questions,{id,body,status:'open',createdAt:now}],updatedAt:now};
  }else if(action.action==='answer'){
    if(!record.questions.some(q=>q.id===action.questionId))throw Error('Question not found');
    records[key]={...record,questions:record.questions.map(q=>q.id===action.questionId?{...q,status:action.answered?'answered':'open'}:q),updatedAt:now};
  }
  if(Object.keys(records).length>1500)throw Error('Review scope has too many saved review records');
  return {...state,records};
}
export function reviewCoverage(state:ReviewCognitionState,keys:string[]):Record<ReviewStatus,number>{
  const totals:Record<ReviewStatus,number>={unseen:0,opened:0,reviewed:0,'needs-evidence':0,stale:0};
  for(const key of new Set(keys))totals[state.records[key]?.status??'unseen']++;
  return totals;
}
