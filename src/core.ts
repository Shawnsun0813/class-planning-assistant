import type {Course,Preferences,Session,Issue,Plan,Profile,Store,BidRecord} from './types';
export const dayNames=['','周一','周二','周三','周四','周五','周六','周日'];
export const sessionName=(s:Session)=>s==='FULL'?'全学期':s;
export const minutes=(time:string)=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
const validTime=(time:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const invalidTimeRange=(slot:{start:string;end:string})=>!validTime(slot.start)||!validTime(slot.end)||minutes(slot.start)>=minutes(slot.end);
const halves=(s:Session):('S1'|'S2')[]=>s==='FULL'?['S1','S2']:[s];
export function activeTogether(a:Course,b:Course){
 if(!halves(a.session).some(s=>halves(b.session).includes(s)))return false;
 if(a.startDate&&a.endDate&&b.startDate&&b.endDate)return a.startDate.slice(0,10)<=b.endDate.slice(0,10)&&b.startDate.slice(0,10)<=a.endDate.slice(0,10);
 return true;
}
export function courseConflict(a:Course,b:Course){
 if(a.code===b.code)return true;
 if(!activeTogether(a,b))return false;
 return a.meetings.some(x=>b.meetings.some(y=>x.days.some(d=>y.days.includes(d))&&minutes(x.start)<minutes(y.end)&&minutes(y.start)<minutes(x.end)));
}
export function ruleConflicts(c:Course,p:Preferences){
 return p.rules.filter(r=>r.confirmed&&halves(c.session).some(s=>halves(r.session).includes(s)&&!p.exceptions.some(e=>e.courseId===c.id&&e.ruleId===r.id&&halves(e.session).includes(s)))&&c.meetings.some(m=>m.days.includes(r.day)&&minutes(m.start)<minutes(r.end)&&minutes(r.start)<minutes(m.end)));
}
export function scheduleIssues(courses:Course[],p:Preferences):Issue[]{
 const issues:Issue[]=[];
 for(const r of p.rules.filter(r=>r.confirmed&&invalidTimeRange(r)))issues.push({kind:'conflict',text:`${dayNames[r.day]}不可用时段尚未填写完整，或结束时间不晚于开始时间。`,courseIds:[]});
 for(const e of p.events.filter(e=>e.known&&invalidTimeRange(e)))issues.push({kind:'conflict',text:`${e.title}的固定活动时间无效，请先修正。`,courseIds:[]});
 for(const id of p.locked)if(!courses.some(c=>c.id===id))issues.push({kind:'conflict',text:'方案缺少已锁定的课程，请取消锁定或恢复课程。',courseIds:[id]});
 for(let i=0;i<courses.length;i++){
  const c=courses[i];
  for(let j=i+1;j<courses.length;j++)if(courseConflict(c,courses[j]))issues.push({kind:'conflict',text:`${c.code}-${c.section} 与 ${courses[j].code}-${courses[j].section} 时间重叠或为同一课程的不同班。`,courseIds:[c.id,courses[j].id]});
  for(const r of ruleConflicts(c,p))issues.push({kind:'conflict',text:`${c.code} 违反 ${sessionName(r.session)} ${dayNames[r.day]} ${r.start}–${r.end} 不可用时间。`,courseIds:[c.id]});
  for(const e of p.events.filter(e=>e.known))if(halves(c.session).some(s=>halves(e.session).includes(s))&&c.meetings.some(m=>m.days.includes(e.day)&&minutes(m.start)<minutes(e.end)&&minutes(e.start)<minutes(m.end)))issues.push({kind:'conflict',text:`${c.code} 与 ${e.title} 冲突。`,courseIds:[c.id]});
  if(!c.meetings.length||!c.startDate||!c.endDate)issues.push({kind:'unknown',text:`${c.code}-${c.section} 的课时或日期不完整。`,courseIds:[c.id]});
  if(!p.eligibility.includes(c.id))issues.push({kind:'unknown',text:`${c.code}-${c.section} 的个人资格／先修待核${c.prerequisite?'：'+c.prerequisite:''}。`,courseIds:[c.id]});
 }
 for(const e of p.events.filter(e=>!e.known))issues.push({kind:'unknown',text:`${e.title} 日期／准确时间待核，尚不能确认全部承诺无冲突。`,courseIds:[]});
 if(!p.confirmed)issues.push({kind:'unknown',text:'个人条件尚未确认；当前只作讨论预览。',courseIds:[]});
 const total=credits(courses);if(total>p.maxCredits||total<p.minCredits)issues.push({kind:'conflict',text:`当前 ${total} 学分不在设定的 ${p.minCredits}–${p.maxCredits} 学分范围内。`,courseIds:[]});
 return issues;
}
export const credits=(courses:Course[])=>Math.round(courses.reduce((n,c)=>n+(c.credits??0),0)*100)/100;
export const halfCredits=(courses:Course[],half:'S1'|'S2')=>credits(courses.filter(c=>halves(c.session).includes(half)));
const careerWords:Record<string,string[]>={AI:['artificial intelligence','ai ','machine learning','data','analytics','technology','digital'],产品:['product','design','innovation','customer','business model','pricing','marketing'],咨询:['strategy','strategic','decision','competitive','operations','management'],金融:['finance','financial','invest','capital','credit','equity','pricing'],供应链:['supply','operations','geopolit','procurement','manufactur','enterprise']};
export function recommendation(c:Course,career:string){
 const text=[c.title,c.description??'',...c.categories].join(' ').toLowerCase();
 const terms=career.split(/[,，、\s]+/).filter(Boolean);const hits=terms.filter(t=>(careerWords[t]??[t.toLowerCase()]).some(w=>text.includes(w)));
 return {score:hits.length*20+(c.meetings.length?1:0),reason:hits.length?`课程标题／描述与“${hits.join('、')}”相关；这是文本关联，不代表学习效果或求职保证。`:'尚未发现与当前方向的直接文本关联；仍可按兴趣和课程资料比较。'};
}
export function generatePlan(all:Course[],p:Preferences):{ids:string[];error?:string;unknown:number}{
 if(!p.confirmed)return {ids:[],error:'请先核对并确认个人条件，再生成候选课表。',unknown:0};
 if(!Number.isFinite(p.minCredits)||!Number.isFinite(p.maxCredits)||p.minCredits<0||p.maxCredits<p.minCredits)return {ids:[],error:'请设置有效的学分范围。',unknown:0};
 const locked=p.locked.map(id=>all.find(c=>c.id===id)).filter((c):c is Course=>!!c);
 if(locked.length!==p.locked.length)return {ids:[],error:'有锁定课程不在当前目录中，请先核对。',unknown:0};
 const lockedProblems=scheduleIssues(locked,{...p,minCredits:0}).filter(i=>i.kind==='conflict');
 if(lockedProblems.length)return {ids:[],error:'锁定课程无法同时满足条件：'+lockedProblems.map(i=>i.text).join(' '),unknown:0};
 if(locked.some(c=>!c.meetings.length||!c.startDate||!c.endDate||c.credits===null))return {ids:[],error:'锁定课程缺少时间、日期或学分，暂不能生成完整时间方案。',unknown:0};
 const eligible=all.filter(c=>!p.excluded.includes(c.id)&&!locked.some(l=>l.id===c.id)&&c.credits!==null&&c.credits>0&&c.meetings.length&&c.startDate&&c.endDate&&!ruleConflicts(c,p).length&&!scheduleIssues([c],{...p,minCredits:0,maxCredits:999,locked:[]}).some(i=>i.kind==='conflict'))
 .filter(c=>(c.programTags.includes('elective')&&c.bidAllowed===true)||p.eligibility.includes(c.id))
 .sort((a,b)=>recommendation(b,p.career).score-recommendation(a,p.career).score||a.code.localeCompare(b.code));
 type State={courses:Course[];sum:number;score:number};
 let beam:State[]=[{courses:locked,sum:credits(locked),score:locked.reduce((n,c)=>n+recommendation(c,p.career).score,0)}];
 for(const c of eligible){
  const next:State[]=[];
  for(const state of beam)if(state.sum+(c.credits??0)<=p.maxCredits&&!state.courses.some(old=>courseConflict(old,c)))next.push({courses:[...state.courses,c],sum:state.sum+(c.credits??0),score:state.score+recommendation(c,p.career).score});
  const uniq=new Map<string,State>();
  for(const state of [...beam,...next]){const key=state.courses.map(c=>c.id).sort().join(',');if(!uniq.has(key))uniq.set(key,state);}
  beam=[...uniq.values()].sort((a,b)=>{
   const va=(a.sum>=p.minCredits?1000:0)+a.score+a.sum, vb=(b.sum>=p.minCredits?1000:0)+b.score+b.sum;return vb-va;
  }).slice(0,180);
 }
 const result=beam.filter(s=>s.sum>=p.minCredits&&s.sum<=p.maxCredits).sort((a,b)=>b.score-a.score)[0];
 if(!result)return {ids:[],error:'当前搜索未找到满足已确认时间、锁定和学分条件的组合。请检查锁定／排除与时段，或调整范围；不会自动放宽条件。此为有界搜索，不证明所有组合都无解。',unknown:0};
 return {ids:result.courses.map(c=>c.id),unknown:result.courses.filter(c=>!p.eligibility.includes(c.id)).length};
}
export const titleKey=(title:string)=>title.toLowerCase().replace(/[^a-z0-9]/g,'');
export function historicalRecords(course:Course,records:BidRecord[]){
 return records.filter(r=>r.courseNumber===course.code&&titleKey(r.title)===titleKey(course.title)&&!r.qualityFlags?.includes('term_label_anomaly')&&r.year>=2010).sort((a,b)=>b.year-a.year||(a.season==='spring'?-1:1)).slice(0,8);
}
export function referenceBid(course:Course,records:BidRecord[]){
 const found=historicalRecords(course,records);const exact=found.filter(r=>r.section===course.section);const used=exact.length?exact:found;
 const groups=new Map<string,{round:number;metric:string;values:number[];terms:string[]}>();
 for(const r of used)for(const v of r.rounds){if(v.value===null||!Number.isFinite(v.value))continue;const key=v.round+'|'+v.metric;const g=groups.get(key)??{round:v.round,metric:v.metric,values:[],terms:[]};g.values.push(v.value);g.terms.push(r.term);groups.set(key,g);}
 const latest=used.flatMap(r=>r.rounds.filter(v=>v.value!==null&&Number.isFinite(v.value)).slice(-1)).at(0);
 const chosen=latest?groups.get(latest.round+'|'+latest.metric):undefined;
 const values=[...(chosen?.values??[])].sort((a,b)=>a-b);
 const mid=values.length?values[Math.floor(values.length/2)]:null;
 return {records:used,reference:mid,min:values[0]??null,max:values.at(-1)??null,sampleSize:values.length,sectionMatch:exact.length>0,round:chosen?.round??null,metric:chosen?.metric??null,groups:[...groups.values()]};
}
export function allocation(courses:Course[],records:BidRecord[],budget:number,used:number){
 const available=Math.max(0,Math.floor(budget-used));if(!Number.isFinite(available))return {};
 const allowed=courses.filter(c=>c.bidAllowed===true&&referenceBid(c,records).reference!==null);const weights=allowed.map(c=>Math.max(0,referenceBid(c,records).reference!));const sum=weights.reduce((a,b)=>a+b,0);
 const scale=sum?Math.min(1,available/sum):0;
 const out:Record<string,number>={};for(let i=0;i<allowed.length;i++)out[allowed[i].id]=Math.floor(weights[i]*scale);
 return out;
}
export function budgetIssue(bids:Record<string,number>,budget:number,used:number){
 if(!Number.isInteger(budget)||!Number.isInteger(used)||budget<0||used<0||used>budget)return '总预算和已占用分数需为非负整数，已占用不能大于总预算。';
 const values=Object.values(bids);if(values.some(n=>!Number.isInteger(n)||n<0))return '每门课程分配须为非负整数。';
 const total=values.reduce((a,b)=>a+b,0);return total>budget-used?`分配超额 ${total-(budget-used)} 分，请调整后再确认。`:null;
}
export const emptyPreferences=():Preferences=>({career:'',minCredits:12,maxCredits:22,confirmed:false,rules:[],exceptions:[],events:[],locked:[],excluded:[],eligibility:[],budget:0,used:0});
export const emptyProfile=(name='我的选课方案'):Profile=>({id:crypto.randomUUID(),name,preferences:emptyPreferences(),plan:{courseIds:[],status:'discussion',name:'新方案',updatedAt:new Date().toISOString()},draft:null,previous:null,bids:{},budgetConfirmed:false,notes:[]});
export function applyDraft(profile:Profile):Profile{if(!profile.draft)return profile;return {...profile,previous:profile.plan,plan:{...profile.draft,status:'confirmed',updatedAt:new Date().toISOString()},draft:null,bids:{},budgetConfirmed:false};}
export function undoPlan(profile:Profile):Profile{if(!profile.previous)return profile;return {...profile,plan:profile.previous,previous:null,draft:null,bids:{},budgetConfirmed:false};}
export function validBackup(v:unknown):v is Store{
 const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const str=(x:unknown)=>typeof x==='string'&&x.length<=10000;
 const strings=(x:unknown)=>Array.isArray(x)&&x.length<=500&&x.every(str);
 // Backups preserve finite, editable numeric drafts. Execution validity belongs
 // to scheduleIssues/generatePlan/budgetIssue, not destructive cache recovery.
 const num=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e9;
 const integer=(x:unknown)=>num(x)&&Number.isInteger(x);
 const session=(x:unknown)=>x==='FULL'||x==='S1'||x==='S2';
 const time=(x:unknown)=>x===''||(typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x));
 const slot=(x:unknown)=>obj(x)&&str(x.id)&&integer(x.day)&&(x.day as number)>=1&&(x.day as number)<=7&&time(x.start)&&time(x.end)&&session(x.session);
 const plan=(x:unknown)=>obj(x)&&strings(x.courseIds)&&str(x.name)&&str(x.updatedAt)&&['historical','discussion','confirmed'].includes(x.status as string);
 if(!obj(v)||v.schemaVersion!==1||!Array.isArray(v.profiles)||!v.profiles.length||v.profiles.length>30||!str(v.activeId))return false;
 const good=v.profiles.every(p=>{
  if(!obj(p)||!str(p.id)||!str(p.name)||!plan(p.plan)||(p.draft!==null&&!plan(p.draft))||(p.previous!==null&&!plan(p.previous))||typeof p.budgetConfirmed!=='boolean'||!strings(p.notes)||!obj(p.bids)||!Object.values(p.bids).every(num)||!obj(p.preferences))return false;
  const a=p.preferences;
  return str(a.career)&&num(a.minCredits)&&num(a.maxCredits)&&num(a.budget)&&num(a.used)&&typeof a.confirmed==='boolean'&&strings(a.locked)&&strings(a.excluded)&&strings(a.eligibility)&&Array.isArray(a.rules)&&a.rules.length<100&&a.rules.every(r=>slot(r)&&obj(r)&&typeof r.confirmed==='boolean')&&Array.isArray(a.events)&&a.events.length<100&&a.events.every(e=>slot(e)&&obj(e)&&str(e.title)&&typeof e.known==='boolean')&&Array.isArray(a.exceptions)&&a.exceptions.length<100&&a.exceptions.every(e=>obj(e)&&str(e.courseId)&&str(e.ruleId)&&session(e.session));
 });
 return good&&new Set(v.profiles.map(p=>p.id)).size===v.profiles.length&&v.profiles.some(p=>p.id===v.activeId);
}
const icsEscape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
export function calendarICS(courses:Course[],plan:Plan){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SOM Course Planner//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:'+icsEscape(plan.name+' · '+plan.status),'X-WR-TIMEZONE:America/New_York'];let count=0;
 for(const c of courses){if(!c.startDate||!c.endDate||!c.meetings.length)continue;
  for(const m of c.meetings){const date:Date=new Date(c.startDate.slice(0,10)+'T12:00:00Z');const end:string=c.endDate.slice(0,10);for(let guard=0;guard<400&&date.toISOString().slice(0,10)<=end;guard++,date.setUTCDate(date.getUTCDate()+1)){
   const day=date.getUTCDay()||7;if(!m.days.includes(day))continue;const d=date.toISOString().slice(0,10).replace(/-/g,'');const time=(t:string)=>t.replace(':','')+'00';count++;
   lines.push('BEGIN:VEVENT','UID:'+icsEscape(c.id+'-'+d+'-'+m.start)+'@som-course-planner','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z','DTSTART;TZID=America/New_York:'+d+'T'+time(m.start),'DTEND;TZID=America/New_York:'+d+'T'+time(m.end),'SUMMARY:'+icsEscape(c.code+' '+c.title),'DESCRIPTION:'+icsEscape('方案状态：'+plan.status+'。仅按官方日期范围展开；节假日与特殊活动需核对。来源：'+c.sourceUrl),'END:VEVENT');
  }}
 }
 lines.push('END:VCALENDAR');return {text:lines.join('\r\n'),count};
}
