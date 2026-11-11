import {describe,it,expect} from 'vitest';
import {allocation,applyDraft,budgetIssue,calendarICS,courseConflict,emptyProfile,generatePlan,referenceBid,ruleConflicts,scheduleIssues,undoPlan,validBackup} from '../src/core';
import type {Course,BidRecord,Store} from '../src/types';
import data from '../data/catalog.json';
import history from '../data/bidding-history.json';
const courses=data.courses as Course[], records=history.records as BidRecord[];
const get=(code:string,section='01')=>courses.find(c=>c.code==='MGT '+code&&c.section===section)!;
describe('真实课程与学段约束',()=>{
 it('只对正确教学班判定651与878冲突',()=>{expect(courseConflict(get('651','02'),get('878'))).toBe(true);expect(courseConflict(get('651','01'),get('878'))).toBe(false);});
 it('S1和S2同一时段不误判冲突，全学期会冲突',()=>{const c=get('651','02');expect(courseConflict(c,{...get('878'),session:'S1',startDate:'2027-01-19',endDate:'2027-03-04'})).toBe(false);expect(courseConflict(c,get('878'))).toBe(true);});
 it('时间例外只能作用到指定课程和学段',()=>{const p=emptyProfile().preferences;const c=get('652');p.rules=[{id:'thu',day:4,start:'16:00',end:'23:59',session:'FULL',confirmed:true}];expect(ruleConflicts(c,p)).toHaveLength(1);p.exceptions=[{ruleId:'thu',courseId:c.id,session:'S2'}];expect(ruleConflicts(c,p)).toHaveLength(1);p.exceptions=[{ruleId:'thu',courseId:c.id,session:'S1'}];expect(ruleConflicts(c,p)).toHaveLength(0);});
 it('未确认规则不生效，生成前必须确认条件',()=>{const p=emptyProfile().preferences;p.rules=[{id:'x',day:1,start:'00:00',end:'23:59',session:'FULL',confirmed:false}];expect(ruleConflicts(get('554'),p)).toHaveLength(0);expect(generatePlan(courses,p).error).toContain('确认');});
 it('锁定冲突不能被生成器静默删除',()=>{const p=emptyProfile().preferences;p.confirmed=true;p.locked=[get('651','02').id,get('878').id];expect(generatePlan(courses,p).error).toContain('锁定课程');});
 it('生成器满足确认时段学分且不偷偷放宽',()=>{const p=emptyProfile().preferences;p.confirmed=true;p.career='AI';p.rules=[{id:'mon',day:1,start:'00:00',end:'11:00',session:'FULL',confirmed:true}];const r=generatePlan(courses,p);expect(r.error).toBeUndefined();const selected=r.ids.map(id=>courses.find(c=>c.id===id)!);expect(scheduleIssues(selected,p).filter(i=>i.kind==='conflict')).toEqual([]);expect(selected.every(c=>c.meetings.length>0)).toBe(true);});
 it('特殊活动未知仍保留，不宣称整体已核验',()=>{const p=emptyProfile().preferences;p.minCredits=0;p.events=[{id:'r',title:'retreat',day:6,start:'09:00',end:'17:00',session:'FULL',known:false}];expect(scheduleIssues([get('531','02')],p).some(i=>i.text.includes('retreat')&&i.kind==='unknown')).toBe(true);});
});
describe('竞价证据与预算',()=>{
 it('课程编号复用不能把法律课历史给Thinking with Data',()=>{expect(referenceBid(get('651','02'),records).sampleSize).toBe(0);expect(referenceBid(get('652'),records).reference).toBeNull();});
 it('PM参考固定同一round与metric，不混最后有值轮次',()=>{const h=referenceBid(get('561'),records);expect(h.round).toBe(3);expect(h.metric).toBe('reported_round_value');const values=h.records.flatMap(r=>r.rounds.filter(v=>v.round===h.round&&v.metric===h.metric&&v.value!==null).map(v=>v.value!)).sort((a,b)=>a-b);expect(h.reference).toBe(values[Math.floor(values.length/2)]);expect(h.sampleSize).toBe(values.length);});
 it('无历史依据不自动给新课编造分数，保留未分配余额',()=>{const cs=[get('651','02'),get('652')];expect(allocation(cs,records,1000,0)).toEqual({});const r=allocation([get('561')],records,1000,0);expect(r[get('561').id]).toBeLessThan(1000);});
 it('极小预算也不超支；0保留且不是缺失',()=>{const r=allocation([get('554'),get('561'),get('846')],records,2,1);expect(Object.values(r).reduce((a,b)=>a+b,0)).toBeLessThanOrEqual(1);expect(budgetIssue({a:0},10,0)).toBeNull();expect(budgetIssue({a:11},10,0)).toContain('超额');expect(budgetIssue({a:-1},10,0)).not.toBeNull();});
});
describe('方案决定、恢复与导出',()=>{
 it('讨论和明确采纳分离，采纳和撤回不借机恢复退分',()=>{const p=emptyProfile();p.plan={courseIds:[get('554').id],name:'基线',status:'historical',updatedAt:'2026-11-11'};p.draft={courseIds:[],name:'移除讨论',status:'discussion',updatedAt:'2026-11-11'};p.bids={[get('554').id]:100};const result=applyDraft(p);expect(p.plan.courseIds).toHaveLength(1);expect(result.plan.courseIds).toEqual([]);expect(result.bids).toEqual({});const undo=undoPlan(result);expect(undo.plan.courseIds).toEqual(p.plan.courseIds);expect(undo.bids).toEqual({});});
 it('有效备份可恢复，深层null/错误时间/非数值bid拒绝',()=>{const p=emptyProfile();const s:Store={schemaVersion:1,activeId:p.id,profiles:[p]};expect(validBackup(s)).toBe(true);for(const patch of [{rules:[null]},{events:[null]},{exceptions:[null]},{rules:[{id:'x',day:3,start:'99:00',end:'20:00',session:'FULL',confirmed:true}]}]){expect(validBackup({...s,profiles:[{...p,preferences:{...p.preferences,...patch}}]})).toBe(false);}expect(validBackup({...s,profiles:[{...p,bids:{a:'NaN'}}]})).toBe(false);expect(validBackup({...s,profiles:[{...p,draft:{courseIds:[]}}]})).toBe(false);});
 it('预算与时段的可编辑非法草稿能保存，执行时仍被拒绝',()=>{const p=emptyProfile();p.preferences.budget=5;p.preferences.used=10;p.preferences.rules=[{id:'x',day:1,start:'',end:'11:00',session:'FULL',confirmed:true}];p.bids={draft:-1};const s:Store={schemaVersion:1,activeId:p.id,profiles:[p]};expect(validBackup(s)).toBe(true);expect(budgetIssue(p.bids,5,10)).not.toBeNull();expect(scheduleIssues([],p.preferences).some(i=>i.kind==='conflict'&&i.text.includes('尚未填写完整'))).toBe(true);});
 it('日历使用准确学段与纽约时间，不为无时间课程造事件',()=>{const plan=emptyProfile().plan;const r=calendarICS([get('651','02')],plan);expect(r.count).toBeGreaterThan(5);expect(r.text).toContain('TZID=America/New_York');expect(r.text).toContain('T100500');expect(r.text).not.toContain('202702');const missing=calendarICS([get('925')],plan);expect(missing.count).toBe(0);});
});
