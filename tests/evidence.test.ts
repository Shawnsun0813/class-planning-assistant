import {describe,it,expect} from 'vitest';
import type {Course,Review,ReviewSources} from '../src/types';
import {courseMaterials,officialDescription,modelCourseEvidence,readableCourseUrl,materialTeacherState,accessLabel} from '../src/evidence';
import {recommendation} from '../src/core';
import catalog from '../data/catalog.json';
import registry from '../data/review-sources.json';
import material from '../data/reviews.json';

const c=catalog.courses.find(c=>c.code==='MGT 554') as Course;
const sources=registry as ReviewSources,reviews=material.reviews as Review[];
describe('真实课程资料在产品中的消费',()=>{
  it('简介完整进入讨论上下文，不拿人工简述代替',()=>{
    expect(officialDescription(c)).toContain('historical business data');
    expect(modelCourseEvidence(c).description).toBe(c.description);
    expect(readableCourseUrl(c)).toBe('https://som.yale.edu/elective-core-courses');
    expect(readableCourseUrl(c)).not.toBe(c.sourceUrl);
  });
  it('推荐能识别仅在官方完整描述中出现的方向',()=>{
    const neutral={...c,title:'A neutral title',categories:[],description:'Research into supply chain and procurement.',summary:null};
    expect(recommendation(neutral,'供应链').score).toBeGreaterThan(recommendation({...neutral,description:null},'供应链').score);
  });
  it('同号不同题名、学期或教学班不能误接评价材料',()=>{
    expect(courseMaterials(c,reviews,sources).length).toBeGreaterThan(0);
    expect(courseMaterials({...c,title:'Luxury: From Mortal Sin to Market Sector'},reviews,sources)).toEqual([]);
    expect(courseMaterials({...c,termCode:'203001'},reviews,sources)).toEqual([]);
    expect(courseMaterials({...c,id:'unknown-section'},reviews,sources)).toEqual([]);
  });
  it('正式评价和公开材料保持不同覆盖状态',()=>{
    expect(sources.metadata.authenticatedEvaluationCount).toBe(0);
    expect(sources.sources.some(s=>s.id==='som_internal'&&s.status==='authentication_required')).toBe(true);
  });
  it('新版官方925课时有实际资料，无时刻场景另外保持独立覆盖',()=>{
    const investing=catalog.courses.find(c=>c.code==='MGT 925') as Course;
    expect(investing.meetings).toEqual([{days:[2],start:'16:10',end:'19:10'}]);
    expect(investing.programTags).toContain('MMS AM');
    expect(investing.description).toContain('institutional allocator');
  });
  it('历史教师逐教学班核对，不能只凭同课程号或聚合身份判断相符',()=>{
    expect(materialTeacherState({...c,faculty:['Wang, Tong']},['Tong Wang'])).toBe('matches_current_teacher');
    expect(materialTeacherState({...c,faculty:['Tate, Sharon']},['Heidi Brooks'])).toBe('different_teacher');
    expect(materialTeacherState(c,[])).toBe('unknown');
  });
  it('来源技术枚举均转成中文状态，不以打不开等于没有评价',()=>{
    for(const source of sources.sources)expect(accessLabel(source.status)).not.toBe(source.status);
    for(const item of sources.courseSources)for(const link of item.links)expect(accessLabel(link.status)).not.toBe(link.status);
  });
});
