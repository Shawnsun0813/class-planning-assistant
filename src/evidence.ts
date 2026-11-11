import type {Course,Review,ReviewSources} from './types';

export function officialDescription(course:Course):string|null {
  return course.description?.trim() || null;
}

export function descriptionPreview(course:Course):string|null {
  const text=officialDescription(course);
  if(!text)return null;
  return course.descriptionPreview || (text.length<=220?text:text.slice(0,217)+'…');
}

export const readableCourseUrl=(course:Course)=>course.directoryUrl||'https://som.yale.edu/elective-core-courses';

export function materialTeacherState(course:Course,faculty:string[]) {
  const key=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z]+/g)?.sort().join(' ')??'';
  if(!faculty.length||!course.faculty.length)return 'unknown';
  return faculty.some(name=>course.faculty.some(current=>key(name)===key(current)))?'matches_current_teacher':'different_teacher';
}

export function courseReviewCoverage(course:Course,sources:ReviewSources|null) {
  return sources?.courseSources.find(record=>
    record.courseCode===course.code && record.courseTitle===course.title && record.termCode===course.termCode
    && record.courseIds.includes(course.id)
  ) ?? null;
}

export function courseMaterials(course:Course,reviews:Review[],sources:ReviewSources|null) {
  const coverage=courseReviewCoverage(course,sources);
  if(!coverage)return [];
  const ids=new Set([...coverage.reviewIds,...coverage.contextIds]);
  return reviews.filter(review=>ids.has(review.id));
}

export function modelCourseEvidence(course:Course) {
  return {
    code:course.code,section:course.section,title:course.title,termCode:course.termCode,
    description:officialDescription(course),descriptionSource:course.descriptionSource??null,
    officialDirectoryUrl:readableCourseUrl(course),prerequisite:course.prerequisite,
    faculty:course.faculty,credits:course.credits,meetings:course.meetings,
    workload:'Unknown unless explicitly supported by a separate course-specific source',
  };
}

export const reviewTypeLabel=(type:string)=>({
  independent_student_first_person:'学生一手体验',
  school_published_alumni_first_person:'校方发布的校友体验',
  published_alumni_first_person_interview:'校友访谈',
  school_published_alumni_profile:'校友档案',
  school_published_student_ta_context:'助教背景材料（不是课程评价）',
}[type]??type);

export const accessLabel=(status:string)=>({
  accessible:'可访问',public:'公开可访问',public_readable:'公开可读',
  login_required:'需要登录',requires_login:'需要登录',yale_login_required:'需 Yale 登录',
  authentication_required:'需登录授权',not_read:'当前未读取到',not_fetched:'尚未读取',
  blocked:'本次未成功读取',network_blocked:'本次网络访问受阻',
  unverified:'尚未验证',unavailable:'本次不可用',
  link_only_no_review_loaded:'仅有入口，当前未读取到评语',
  coverage_unverified:'SOM 课评覆盖尚未证实',
  readable_public_materials:'公开材料可读',
  blocked_unverified:'本次未成功读取，覆盖未核实',
  restricted_and_SOM_coverage_unverified:'访问受限，SOM 课评覆盖未证实',
  directory_readable_reviews_not_obtained:'目录可读，尚未取得评语',
  curated_evidence_available:'已读取部分公开学生体验',
  curated_materials_available:'已读取部分公开访谈材料',
  catalogue_only_no_review_feed_verified:'仅课程目录，未证实有评价数据',
  resources_not_loaded:'本次资源未成功加载',
  school_page_readable_target_course_reviews_not_found:'学校页可读，尚未找到目标课程评价',
}[status]??'访问状态待核');
