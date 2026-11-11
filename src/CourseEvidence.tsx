import type {Course,Review,ReviewSources,BidRecord} from './types';
import {courseMaterials,courseReviewCoverage,officialDescription,readableCourseUrl,reviewTypeLabel,accessLabel,materialTeacherState} from './evidence';
import {referenceBid} from './core';

type Props={course:Course;reviews:Review[];sources:ReviewSources|null;bids:BidRecord[];eligibilityChecked:boolean;onEligibilityChange:(checked:boolean)=>void};
const safe=(url:string|null|undefined)=>!!url&&/^https?:\/\//.test(url);
export default function CourseEvidence({course:c,reviews,sources,bids,eligibilityChecked,onEligibilityChange}:Props){
  const description=officialDescription(c);
  const coverage=courseReviewCoverage(c,sources);
  const materials=courseMaterials(c,reviews,sources);
  const contextIds=new Set(coverage?.contextIds??[]);
  const testimony=materials.filter(r=>!contextIds.has(r.id));
  const background=materials.filter(r=>contextIds.has(r.id));
  const history=referenceBid(c,bids);
  const renderMaterial=(r:Review)=>{const match=coverage?.reviewMatches?.find(m=>m.reviewId===r.id);const sourceFaculty=match?.sourceFaculty??r.faculty??[];const teacherState=materialTeacherState(c,sourceFaculty);return <article className="review" key={r.id}>
    <a href={r.sourceUrl} target="_blank" rel="noreferrer">{r.title} ↗</a>
    <p>{r.summary}</p>
    <p className="hint">{reviewTypeLabel(r.sourceType)} · {r.author||'作者未列出'} · {r.publishedAt||'日期待核'}</p>
    <p className="hint">课程关联：{c.code} · {c.title}；材料学期：{r.term||'未注明，不能当作2027当期评价'}。</p>
    <p className={teacherState==='different_teacher'?'pending':'hint'}>{teacherState==='different_teacher'?'历史材料的教师与当前教学班不同；不能作为当前教师的评价。':teacherState==='matches_current_teacher'?'材料所列教师至少一位与当前教学班相符，但历史材料不等于2027当期评价。':'材料教师或修读学期未充分核实，当前班次适用性待核。'}</p>
    <p className="hint">材料所述教师：{(match?.sourceFaculty??r.faculty??[]).join(' / ')||'未注明'}；当前教学班：{c.faculty.join(' / ')||'待定'}。发布日期不是修读学期。</p>
    {r.limitations?.length>0&&<p className="hint">局限：{r.limitations.join('；')}</p>}
  </article>;};

  return <div className="course-evidence">
    <details className="course-details evidence-section" id={'description-'+c.id}>
      <summary>课程简介 <span>{description?'官方英文全文':'官方暂未提供'}</span></summary>
      <div className="details-content">
        <p className="evidence-label">Yale SOM 官方课程简介 · 英文原文，未作机器翻译</p>
        {description?<div className="official-description">{description}</div>:<p>官方本次目录未提供这门课的课程简介。可查看课程目录或大纲；不会用课名或人工概述补成官方说明。</p>}
        <p className="hint">简介来源：官方 {c.termCode.slice(0,4)} 春季课程目录，课程 {c.code}-{c.section}。简介说明课程定位，不证明实际学习效果、评分或工作量。</p>
        <div className="course-facts">
          <p><strong>学段日期：</strong>{c.startDate??'待核'} 至 {c.endDate??'待核'}</p>
          <p><strong>学分：</strong>{c.credits??'待核'}<strong>　教室：</strong>{c.room||'目录未提供'}</p>
          <p><strong>教师：</strong>{c.faculty.join(' / ')||'待定'}</p>
          <p><strong>先修：</strong>{c.prerequisite||'目录未单列先修；不等于无资格限制'}</p>
          <p><strong>课程类别：</strong>{c.programTags.join('、')||'待核'}{c.cohort?'；cohort：'+c.cohort:''}</p>
          <p><strong>课程容量：</strong>{c.capacity??'未知'}（不是剩余名额）</p>
        </div>
        <label className="checkline"><input type="checkbox" checked={eligibilityChecked} onChange={e=>onEligibilityChange(e.target.checked)}/>我已核对本人的资格与先修（不是学校审核）</label>
      </div>
    </details>

    <details className="course-details evidence-section" id={'reviews-'+c.id}>
      <summary>学生评价与体验 <span>{testimony.length?`${testimony.length} 条公开材料`:'官方评价当前未导入'}{background.length?' · 另有背景材料':''}</span></summary>
      <div className="details-content">
        <p className="evidence-label">评价和课程简介分别核对</p>
        <p>当前没有导入 Yale 官方评价分数。公开体验是个别作者的材料，不能当作独立评分样本或2027春季课程效果保证。</p>
        {testimony.length?testimony.map(renderMaterial):<p className="hint">当前未读取到这门课的可靠学生评价；这不表示课程没有评价。新课也不会因此自动排除。</p>}
        {background.length>0&&<section><h4>背景与偏好材料，不计作课程评价</h4>{background.map(renderMaterial)}</section>}
        <h4>评价网站入口与实际访问状态</h4>
        <p className="hint">“入口可打开”不等于“评语已读取”。若你有获准使用的评价导出，可交给项目维护者导入；当前网页的“导入备份”只接收个人方案，不直接上传评价文件。</p>
        {!sources&&<p className="hint">评价来源状态尚未加载，不能宣称已接入评价网站。</p>}
        {coverage?.links.map((link,i)=>{
          const source=sources?.sources.find(s=>s.id===link.sourceId);
          return <div className="source-access" key={link.sourceId+'-'+i}>
            <a href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>
            <p>{accessLabel(link.status)}{link.requiresLogin?' · 需本人登录':''}</p>
            <p className="hint">{link.scope==='faculty_search'?'教师搜索入口，不是这门课的评价页面':link.scope==='evaluation_portal'?'评价门户入口，不代表已读取到内容':'目录／搜索入口，不代表已匹配到具体评价'}{source?.details?'。'+source.details:''}</p>
          </div>;
        })}
      </div>
    </details>

    <details className="course-details evidence-section">
      <summary>历史竞价 <span>{history.sampleSize?`${history.sampleSize} 条同课可比记录`:'无同课可比历史'}</span></summary>
      <div className="details-content">
        <p className="hint">同时匹配课程号与规范化名称，并区分教学班、轮次和字段含义；相同课程号的其他科目不会混入。</p>
        {history.records.length?history.records.map((r,i)=><div className="history-record" key={r.id+'-'+i}>
          <strong>{r.term} · {r.courseCode}</strong>
          <p>{r.rounds.map(v=>`R${v.round}：${v.value===null?'缺失':v.value}（${v.metric==='clearing_price'?'历史 Clearing Price':'原表 Round 值，语义待核'}）`).join('；')}</p>
          <small>{r.sourceSheet} · 第 {r.sourceRow} 行</small>
        </div>):<p>没有这门当前课程的可比历史，不使用同号其他科目的分数填补。</p>}
        <p className="hint">以上是历史记录，不是未来最低中标价或成功概率。</p>
      </div>
    </details>

    <details className="course-details evidence-section">
      <summary>来源与访问状态 <span>官方目录 / 当期大纲 / 历史档案</span></summary>
      <div className="details-content">
        <p><a href={readableCourseUrl(c)} target="_blank" rel="noreferrer">打开 Yale SOM 官方课程目录 ↗</a></p>
        <p className="hint">在官方目录选择 Spring 2027，再搜索 {c.code} 或 “{c.title}”，核对 section {c.section}。这是可读目录，不是原始JSON。</p>
        {safe(c.syllabusUrl)?<p><a href={c.syllabusUrl!} target="_blank" rel="noreferrer">当期目录所列大纲或课程资源 ↗</a><span className="hint">（可能需 Yale／Canvas 登录）</span></p>:<p className="hint">当前目录没有提供当期大纲链接。</p>}
        {safe(c.oldSyllabusUrl)&&<p><a href={c.oldSyllabusUrl!} target="_blank" rel="noreferrer">历年大纲档案 ↗</a><span className="hint">（历史材料，不是当前大纲，可能需登录）</span></p>}
        <details className="technical-source"><summary>技术数据来源（可选）</summary><p className="hint">原始目录接口采用读取型 POST；直接打开可能显示整页JSON。普通查看请使用上方课程目录。</p><a href={c.sourceUrl} target="_blank" rel="noreferrer">原始JSON接口 · 技术来源 ↗</a><p className="hint">记录标识：{c.id}；字段：courseDescription、units、prerequisite、room、courseSessionStartDate／EndDate。</p></details>
      </div>
    </details>
  </div>;
}
