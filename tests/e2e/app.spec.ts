import {test,expect} from '@playwright/test';
test('真实数据、讨论采纳、撤回和独立方案',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByRole('heading',{name:'Course index.'})).toBeVisible();
 await page.getByRole('button',{name:'载入历史案例',exact:true}).click();await expect(page.getByRole('heading',{name:'首位用户历史基线',exact:true})).toBeVisible();
 await expect(page.getByText('历史导入 · 未确认').first()).toBeVisible();
 const s1=page.getByRole('button',{name:'S1 前半学期',exact:true}),s2=page.getByRole('button',{name:'S2 后半学期',exact:true});
 await expect(s1).toHaveCSS('background-color','rgb(23, 32, 30)');
 await s2.click();await expect(s2).toHaveClass('selected');await expect(s2).toHaveCSS('background-color','rgb(23, 32, 30)');await expect(s1).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 const thinkingSessions=page.locator('.calendar-course').filter({hasText:'MGT 651-02'});await expect(thinkingSessions).toHaveCount(2);await expect(thinkingSessions.first()).toBeVisible();await expect(thinkingSessions.nth(1)).toBeVisible();
 await page.getByRole('button',{name:'讨论：移除554',exact:true}).click();await expect(page.getByRole('heading',{name:'采纳前，看清这次变化'})).toBeVisible();
 await page.getByRole('button',{name:'明确采纳此方案',exact:true}).click();await expect(page.getByText('已确认方案').first()).toBeVisible();await expect(page.getByRole('button',{name:'撤回上次修改',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'撤回上次修改',exact:true}).click();await expect(page.getByRole('heading',{name:'首位用户历史基线'})).toBeVisible();
 await page.getByLabel('新本地方案名称').fill('另一位同学');await page.getByRole('button',{name:'新建独立方案',exact:true}).click();await expect(page.getByRole('heading',{name:'尚未加入课程'})).toBeVisible();
 await page.selectOption('#profile',{label:'我的选课方案'});await expect(page.getByRole('heading',{name:'首位用户历史基线'})).toBeVisible();expect(errors).toEqual([]);
});
test('预算超额保留输入且不能保存，模型不支持时真实反馈',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'载入历史案例',exact:true}).click();await page.getByRole('button',{name:'竞价建议',exact:true}).click();
 await page.getByLabel('总预算（你确认的分数）').fill('100');await page.getByLabel('当前草案分数').first().fill('101');await expect(page.getByRole('alert')).toContainText('超额');await expect(page.getByRole('button',{name:'保存这份预算草案',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'课程讨论',exact:true}).click();await page.getByRole('button',{name:'主动下载并启用免费模型',exact:true}).click();await expect(page.getByText('此浏览器没有可用 WebGPU。',{exact:false})).toBeVisible({timeout:20000});
});
test('390px无横向溢出，搜索零结果可恢复',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('textbox',{name:'搜索课程'}).fill('not-a-course-zzzz');await expect(page.getByRole('heading',{name:'没有匹配的课程'})).toBeVisible();await page.getByRole('button',{name:'清除筛选',exact:true}).click();await expect(page.locator('.course-card').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/mobile.png',fullPage:false});
});
test('临时无效预算刷新后保留22学分、7门与原输入',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'载入历史案例',exact:true}).click();
 await page.getByRole('button',{name:'竞价建议',exact:true}).click();await page.getByLabel('总预算（你确认的分数）').fill('100');await page.getByLabel('已占用／不可再用').fill('10');await page.getByLabel('总预算（你确认的分数）').fill('5');
 await page.reload();await expect(page.locator('.plan-stats').getByText('22',{exact:true})).toBeVisible();await expect(page.locator('.plan-stats').getByText('7',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'竞价建议',exact:true}).click();await expect(page.getByLabel('总预算（你确认的分数）')).toHaveValue('5');await expect(page.getByLabel('已占用／不可再用')).toHaveValue('10');await expect(page.getByRole('alert')).toContainText('已占用不能大于总预算');
});
test('损坏缓存保留原文，未经明确继续不覆写',async({page})=>{
 await page.goto('/');const original=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('som-planner-v1')!);s.profiles[0].preferences.rules=[null];const raw=JSON.stringify(s);localStorage.setItem('som-planner-v1',raw);return raw;});
 await page.reload();await expect(page.getByRole('alert')).toContainText('原本地缓存无法安全读取');await expect(page.getByRole('button',{name:'下载原数据备份'})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('som-planner-v1'))).toBe(original);expect(await page.evaluate(()=>localStorage.getItem('som-planner-v1-recovery'))).toBe(original);
 await page.getByRole('button',{name:'确认使用当前方案',exact:true}).click();await expect(page.getByText('原本地缓存无法安全读取，尚未被新方案覆盖。')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('som-planner-v1-recovery'))).toBe(original);
});
test('备份未知课程引用显式保留，不冒充完整课表',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'载入历史案例',exact:true}).click();
 const source=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('som-planner-v1')!);s.profiles[0].plan.courseIds.push('MGT-DOES-NOT-EXIST');return JSON.stringify(s);});
 await page.getByLabel('导入个人方案JSON').setInputFiles({name:'unknown-course.json',mimeType:'application/json',buffer:Buffer.from(source)});
 await expect(page.getByText('1 个课程引用不在当前目录，原引用已保留。')).toBeVisible();await expect(page.getByText('MGT-DOES-NOT-EXIST',{exact:false}).first()).toBeVisible();await page.getByRole('button',{name:/课表与方案/}).click();await expect(page.getByRole('button',{name:'导出常规课表 ICS'})).toBeDisabled();
 const refs=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('som-planner-v1')!);return s.profiles.find((p:{id:string})=>p.id===s.activeId).plan.courseIds;});expect(refs).toContain('MGT-DOES-NOT-EXIST');
});


test('新版目录首屏、渐进展示、比较与按需讨论入口',async({page})=>{
 await page.goto('/');await expect(page.locator('.course-card').first()).toBeVisible();
 expect((await page.locator('.course-card').first().boundingBox())!.y).toBeLessThanOrEqual(450);
 await expect(page.locator('.course-card')).toHaveCount(20);
 await page.getByRole('button',{name:'再显示 20 个教学班',exact:true}).click();await expect(page.locator('.course-card')).toHaveCount(40);
 await page.getByRole('textbox',{name:'搜索课程',exact:true}).fill('878');
 await expect(page.locator('.course-card')).toHaveCount(1);await expect(page.locator('.course-card h3')).toHaveText('Building Adaptive Enterprises: Supply Chains, Geopolitical Risks, and National Security');
 await page.getByRole('button',{name:'比较 MGT 878-01',exact:true}).click();await expect(page.locator('.compare-panel')).toBeVisible();
 expect((await page.locator('.compare-panel').boundingBox())!.y).toBeLessThan((await page.locator('.course-card').first().boundingBox())!.y);
 await page.getByRole('button',{name:'课程讨论',exact:true}).click();await expect(page.getByRole('dialog',{name:'课程讨论',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'课程讨论',exact:true})).toBeFocused();
});

test('手机条件默认折叠、确认和生成后回到结果',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.course-card').first()).toBeVisible();
 expect((await page.locator('.course-card').first().boundingBox())!.y).toBeLessThanOrEqual(700);await expect(page.locator('#personal-conditions')).not.toBeVisible();
 await page.getByRole('button',{name:/我的条件/}).click();await expect(page.locator('#personal-conditions')).toBeVisible();
 await page.getByLabel('求职或学习方向',{exact:true}).fill('AI');await page.getByRole('button',{name:'确认这些条件',exact:true}).click();await expect(page.locator('#personal-conditions')).not.toBeVisible();
 await page.getByRole('button',{name:/我的条件/}).click();await page.getByRole('button',{name:'生成候选课表',exact:true}).click();await expect(page.locator('#personal-conditions')).not.toBeVisible();
 await expect(page.getByRole('heading',{name:'My timetable.'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('官方完整简介、可读课程入口与评价读取状态相互区分',async({page})=>{
 await page.goto('/');await page.getByRole('textbox',{name:'搜索课程',exact:true}).fill('554');
 const course=page.locator('[data-course-id="MGT554-01-202701"]');
 await expect(course.locator('.description-preview')).toContainText('官方课程简介 · 英文摘录');
 await course.getByRole('button',{name:'展开官方全文 ↓',exact:true}).click();
 await expect(course.locator('.official-description')).toContainText('historical business data');
 await expect(course.locator('.official-description')).toContainText('measurable business outcomes.');
 await expect(course.locator('.course-facts')).toContainText('EVANS 2230');
 await course.locator('summary').filter({hasText:/^学生评价与体验/}).click();
 await expect(course).toContainText('当前没有导入 Yale 官方评价分数');
 await expect(course).toContainText('需本人登录');
 await course.locator('summary').filter({hasText:/^来源与访问状态/}).click();
 await expect(course.getByRole('link',{name:'打开 Yale SOM 官方课程目录 ↗',exact:true})).toHaveAttribute('href','https://som.yale.edu/elective-core-courses');
 await expect(course.locator('.technical-source')).not.toHaveAttribute('open','');
 await expect(course.getByRole('link',{name:'原始JSON接口 · 技术来源 ↗',exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:'资料与使用说明',exact:true}).click();
 await expect(page.locator('.review-source-registry')).toContainText('正式SOM评教记录 0 份');
 await expect(page.locator('.review-source-registry')).toContainText('访问受限，SOM 课评覆盖未证实');
});

test('390px官方长简介能展开，原文及访问状态无横向溢出',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('textbox',{name:'搜索课程',exact:true}).fill('935');
 const course=page.locator('[data-course-id="MGT935-01-202701"]');
 await course.getByRole('button',{name:'展开官方全文 ↓',exact:true}).click();
 await expect(course.locator('.official-description')).toContainText('out-of-sample');
 await expect(course.locator('.official-description')).toContainText('active practitioner');
 await course.locator('summary').filter({hasText:/^学生评价与体验/}).click();
 await expect(course).toContainText('这不表示课程没有评价');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
