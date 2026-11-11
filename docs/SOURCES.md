# 课程与评价来源

核对日期：2026年11月11日（America/New_York）。本轮只读调查，未登录、报名、提交竞价或联系他人。数据输出为 `data/catalog.json` 与 `data/reviews.json`。

## 可用的当期官方课程资料

已读取 [Yale SOM 官方课程目录](https://som.yale.edu/elective-core-courses) 页面及其公开配置。页面配置将 `202701` 标为 Spring 2027，并列出 Spring 1、Spring 2、Full session spring。

官方读取端点：[Spring 2027 课程数据](https://som.yale.edu/courses/session-items/202701)。以 POST 和空 JSON 对象请求，返回 HTTP 200、`coursesByTermAndType.post`、245 条不同 `courseID` 的记录。此 POST 是官方公开课程目录的数据读取，不是选课或竞价提交。响应时间戳保存在 JSON metadata，不能将其等同于实时名额。

已归一化课程号、section、课程名、学分、教师、类别、学段、开始与结束日期、常规星期与时间、容量、竞价许可、先修、项目标签和大纲链接。竞价许可按原始 `allowBid` 去空格、忽略大小写解析：245条中161条为true、84条为false、0条未知；已修正17条小写no曾被错误保留为null的问题。未复制教师邮箱及人员内部ID，也未镜像整份课程描述或登录后大纲。

重要限制：

- 245 条包括 PhD、core、EMBA 和项目专属课程，不能全部推荐为所有 SOM 同学都可选。`programTags` 是官方课程类型标签，不是完整个人资格判定。
- `eligibilityVerified` 均为 false：尚未核对具体同学的项目、先修和报名资格。可生成明确标为待核资格的候选方案，不能宣称已验证可报名。
- `capacity` 是上限，不是剩余名额；`availableSeats` 保留 null。
- 35 条未列常规课时；另1条星期写为 `S`，不能确定周六或周日，故不猜测。36条 `meetings` 留空，保留原始显示及未知状态。
- 常规时间不覆盖节假日、retreat、小组、Lab或其他特殊承诺。`FULL` 会与 S1、S2 都产生相关约束，但具体上课日仍需校历和课程要求。
- 大纲链接存在不代表内容已读取；Canvas、SharePoint及个人评价系统可能需要登录。
- 部分课程 summary 是基于官方课程内容的简短编辑性概述，已用 `summaryType` 标记，不是整份当期大纲或学生评价。

## 首位用户案例的核对结果

官方快照中的 554-01、525-03、561-01、531-02、846-01、651-02、901-01 的常规时间与导入历史课表相符。这证明对应时间字段在本次快照有依据，不代表用户已采纳该方案、已报名或满足全部资格。

- MGT 554：4 学分，提供01、02两个班。
- MGT 561：4 学分，官方内容偏技术驱动的 B2C 产品决策；未发现足够评价证据证明它普遍“很水”。
- MGT 651：S2，01班为周二／四08:30–09:50，02班为10:05–11:25。与878冲突的是02班，不能泛称所有651班次都与878冲突。
- MGT 878：S2，01班为周二／四10:05–11:25。
- MGT 652：S1，01班为周二／四16:10–17:30。若周四16:00限制被用户确认，该班确实违反该条件。
- MGT 901：S2，周二16:10–19:10，官方明确列出 MGT 900 为严格先修。
- MGT 925：S2，MMS AM项目标签，但未公布常规课时，不可编进已验证无冲突课表。
- MGT 935：S2，周三16:10–19:10，项目标签 MMS AM 和 elective。与531-02的常规周三时间重叠；仍需核对个人参与资格。

## 普通课程竞价规则

用户提供的 [Course Auction](https://courseauction.som.yale.edu/courseauctionfrontend) 在本环境普通HTTP读取中返回代理 Tunnel 403；网页读取工具也不可读。因此不能确认它是否要求登录，也不能把环境失败解释为网站永久不可用。

[GBS官方介绍](https://som.yale.edu/blog/what-the-management-science-concentration-and-stem-designation-mean-for-gbs-students)（2021年8月24日）说明SOM选修通过竞价分配，并提及半学期节点。它只支持一般机制背景，不能据此认证2027年具体轮次、预算、分值单位或退分。

用户现已明确提供两项：总分由每位使用者自行输入；竞价落选时退分。这两项标为用户提供，尚未通过当期官方文档独立核实。落选退分不等同于主动退课退分，不能互相推导。

定向搜索未取得当期普通课程FAQ。最小分值及增量、有效轮次和日期、按个人出价还是门槛扣分、平分处理、撤改、主动退课退分及候补机制仍未知。网上500分等说法未获当期官方规则支持，不作为官方默认预算。Exchange 和 Non-SOM资料不得替代普通课程竞价规则。

实现边界：使用用户输入的预算，并注明落选退分是用户提供规则；历史门槛与预算情景仍为参考。其他规则未确认时，不称为可直接提交的官方出价计划，不给精确成功概率。账户密码不需要在聊天中提供。

## 历史竞价与课程身份

数据Agent对用户Excel的解析已发现跨年课程号复用：历史554可指Luxury相关课、561可指Energy Technology Innovation、651可指法律服务改革、652可指International Entrepreneurship；846也有Financial Inclusion记录。因此不能单按MGT数字关联历史分数。

匹配至少需要课程号、规范化标题、适用学期和轮次。当前新课651／652没有可证实的同课历史时应显示缺失；标题缩写仅在有来源证据的人工别名映射下采用，不通过模糊相似度填充。历史教师、规则或容量变化也须另行解释。

## 网上课程体验

`data/reviews.json` 保存6条有链接的材料，覆盖554、531、561。只保留简短转述，不复制长文，不虚构星级或全班评分。

| 来源 | 可支持的内容 | 限制 |
| --- | --- | --- |
| [Ash Duong 的独立学生体验](https://fraxinus1098.substack.com/p/250k-later-my-slightly-obsessive)（2025年5月10日） | 554的实用商业取向及当时短测、作业、团队项目；531的个人与情绪投入 | 同一作者两个课程条目，不是两个独立样本；Lift是其个人投入评分，不是教学质量评分或工时 |
| [SOM供应链校友访谈](https://som.yale.edu/story/2025/som-women-supply-chain-10-questions-5-experts)（2025年1月14日） | Andrea Pacheco认为PM中的KPI度量可用于工作 | 学校发布的选择性正向访谈，不证明普遍质量或作业难度 |
| [Erin Manning校友访谈](https://poetsandquants.com/2024/08/24/2024-mba-to-watch-erin-manning-yale-school-of-management/)（2024年8月24日） | 其对Heidi Brooks所授IPD的积极体验及实践性质 | 单一校友，不能直接评价David Tate的当前班级 |
| [Edirin Aghoghovbia校友档案](https://som.yale.edu/profile/edirin-aghoghovbia-19) | 将Interpersonal列为个人最喜欢课程 | 只有喜好，没有作业、评分或投入证据 |
| [Luisa Locatelli的在校生活记录](https://som.yale.edu/story/2025/day-life-luisa-locatelli-25)（2025年6月23日） | PM助教角色与教学背景 | 只是助教背景，不是独立学生课程质量评价 |

[Yale课程评价入口](https://students.yale.edu/oce-submissions)显示CAS认证；未获得正式OCE评分或学生评价全集。[Coursicle的PM条目](https://www.coursicle.com/yale/courses/MGT/561/)可见课程目录，而教师评价页提示下载App；不能把“存在评价入口”当成已读评价。新课没有可核实评价时保持缺失，不自动降分排除。

## 六门重点课程的补充评价检索

在已有6条材料之外，又按课程名、课程号、当前教师与Yale组合，定向检索651、878、652、846、901、861。截至本次核对，没有新增可直接读到且能可靠归属于这些当前课程的一手评价；这表示本轮检索未取得，并不证明网上不存在评价。

| 课程 | 本轮结果与保留缺口 |
| --- | --- |
| MGT 651 Thinking with Data | 找到目录／课程内容线索，未取得该Yale新课的学生体验；不以Simonsohn的研究、讲座或其他学校评价替代 |
| MGT 652 Design of Business Models | 找到新课目录，未取得可核实学生体验；不混入历史同号International Entrepreneurship或教师一般评价 |
| MGT 878 Building Adaptive Enterprises | [Sang Kim官方介绍](https://som.yale.edu/profile/faculty/sang-kim)谈到新课目标，但属于教师陈述，不作为学生review |
| MGT 846 Introduction to Private Equity | [CourseTable条目](https://coursetable.com/catalog?course-modal=202401-28879)在本轮只读到JS壳；[Eddie Thai历史访谈](https://som.yale.edu/profile/eddie-thai-12)评价的是David Cromwell所授较早PE／VC课程，不转移到Robert Davis当前846 |
| MGT 901 Topics in Financial Engineering | [Jonathan Ingersoll教师介绍](https://som.yale.edu/profile/professor-jonathan-e-ingersoll-jr)含2014校友对早期金融工程课的好评，但无法归属当前Majd／Rosenbluth的901，故不添加为本课评价 |
| MGT 861 Foundations of Pricing Strategy | 未取得当前课的一手学生体验；Ghili的研究文章、其他课程及别校定价课不作替代 |

现有reviews仍为6条，未为了增加覆盖率而创建匿名评分、猜测评价或转移旧教师好评。检索范围与排除链接也已保存在reviews metadata。

## 参考工具与采用边界

发现现成的 [MySOMClasses](https://www.mysomclasses.com/) 与 [s-zhang/yale-som-course-picker](https://github.com/s-zhang/yale-som-course-picker)。其README声明浏览、筛选、课表、ICS与URL分享，代码为MIT许可。实际查看其读取课程的路由后，核实官方目录也公开提供同一数据端点；本轮未复制其业务代码、设计或部署配置。

若以后复用代码，应按MIT许可保留版权和许可声明。第三方工具的功能陈述不等于本项目已实现，也不能替代官方课程与个人资格核对。

## 数据消费检查

- `data/catalog.json`：metadata与245条courses；id包含课程号、section及term，meeting days以1至7表示星期，时间按纽黑文时区解释。只为能明确解析的普通星期生成meeting。
- `data/reviews.json`：metadata与6条reviews；每条包含来源类型、作者、日期、教师、局限。`rating`一律null；作者个人workload评分不可当星级质量评分。
- 待实施者核查：默认候选过滤、真实数据匹配、先修提示、未知课时处理、区分课程容量和剩余名额、避免将不同教师评价或课程换号直接混同。

当前调查足够支撑课程浏览、证据展示和候选排课的首版实现。普通竞价规则与官方OCE仍是明确依赖，不通过继续泛搜掩盖缺口。
