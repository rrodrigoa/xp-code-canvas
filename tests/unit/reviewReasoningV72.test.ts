import {describe,it,expect} from 'vitest';
import {applyCognition,emptyCognition,recoverCognition,reviewCoverage} from '../../src/review/reviewReasoning';
describe('V7.2 review cognition state',()=>{
 it('records explicit assessment and questions, never infers review from a click',()=>{
   const first=emptyCognition('scope','head1');expect(reviewCoverage(first,['agent']).unseen).toBe(1);
   const questioned=applyCognition(first,{action:'question',key:'agent',body:'What validates input?'},'2026-01-01','q1');
   expect(questioned.records.agent.questions[0].status).toBe('open');
   const reviewed=applyCognition(questioned,{action:'status',key:'agent',status:'reviewed'});
   expect(reviewCoverage(reviewed,['agent']).reviewed).toBe(1);
   const refreshed=recoverCognition(reviewed,'scope','head2');
   expect(refreshed.records.agent.status).toBe('stale');expect(refreshed.revisionChanged).toBe(true);
   expect(refreshed.records.agent.questions[0].body).toBe('What validates input?');
 });
 it('limits comparison shelf to four references',()=>{
   let state=emptyCognition('s','h');for(let i=0;i<4;i++)state=applyCognition(state,{action:'shelf',key:String(i),enabled:true});
   expect(()=>applyCognition(state,{action:'shelf',key:'5',enabled:true})).toThrow('limit');
   expect(applyCognition(state,{action:'shelf',key:'0',enabled:false}).shelf).toHaveLength(3);
 });
 it('marks a question answered without deleting the source evidence',()=>{
   const s=applyCognition(emptyCognition('s','h'),{action:'question',key:'f',body:'Check the exception path'},'2026-01-01','x');
   const a=applyCognition(s,{action:'answer',key:'f',questionId:'x',answered:true});
   expect(a.records.f.questions[0].status).toBe('answered');
   expect(()=>applyCognition(a,{action:'answer',key:'f',questionId:'unknown',answered:true})).toThrow('not found');
 });
});
