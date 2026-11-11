# 课程评价接入复核

核对日期：2026年11月11日（America/New_York）。对应 `data/reviews.json`、`data/review-sources.json` 和 `scripts/review_sources.py`。

## 当前实际结果

公开材料已由6条扩为8条，覆盖554、531、561、858、623五门课程。分类是：同一位作者的4条独立课程体验、2条实质校友访谈、1条个人喜好档案、1条TA背景。它们不是8个独立样本，更不是评价网站或正式SOM评分的完整接入。当前直接取得的正式SOM课程评价为0条。

新增858和623来自已实际读到的[Ash Duong学生文章](https://fraxinus1098.substack.com/p/250k-later-my-slightly-obsessive)。前者讨论数据库概念与当时作业，后者讨论跨行业领导者交流及课堂参与。文章发布日期不是修读学期；作者的Lift是个人投入尺度，不能当课程质量星级或每周工时。826的旧主题与当前City Studio不同，没有转移评价。

原应用把“摘要未保留”显示成“官方无课程描述”，属于数据处理缺陷。官方目录包含 `courseDescription`，旧归一化只保留8条编辑概述。简介修复由工程者负责；这份复核不以缺少简介掩盖评价数据尚未取得。

## 来源矩阵

| 来源 | 实际核验 | 当前可接范围 |
| --- | --- | --- |
| SOM校内网站 | [SOM官方课程政策](https://catalog.yale.edu/management/rights-responsibilities-students/course-policies-residential-masters-degree-programs/)明确汇总评价在提交成绩后可于内部网站查看；[myPortal](https://som.yale.edu/myportal)实际跳转Yale CAS | 这是优先的SOM正式评价路径。尚未进入登录后页面，具体评教地址、格式与可分享范围均未核实 |
| Yale OCE学生查看 | [Registrar说明](https://registrar.yale.edu/curriculum/course-evaluations-for-students)链接到[studentViewer](https://oce.app.yale.edu/ocedashboard/studentViewer)，实际跳CAS | 该公开说明针对YC／GSAS，不能默认覆盖普通SOM课程。此前oce-submissions是提交入口，不应作为唯一查看依据 |
| CourseTable | FAQ和开源代码证实评价要求CAS及evaluation access；其[Ferry抓取器](https://github.com/coursetable/ferry/blob/master/ferry/crawler/evals/fetch.py)实际先检查Yale College，注释限定YC／Summer；本环境API另返回403／1010 | 可核实技术路径，但没有证据证明普通SOM课程被其评价源覆盖。不能把可导出当作SOM评价已经可用 |
| Coursicle | MGT课程与Robert Davis等教师目录可读；Alex Burnap评价深链在web reader中返回通用应用壳，HTTP曾429 | 已定位目录入口，未取得目标课程的实际评价记录或合法公开批量评价API；不把页面标题中的Reviews计作评价 |
| Rate My Professors | Yale学校页公开可读；学校评分与课程无关。Cain的Yale条目无评分，其他同名教师搜索结果可能来自别校；本机搜索HTTP403 | 暂无可验证匹配目标SOM课程、教师和学期的评价。教授总体分也不能无条件赋给其每门课程 |
| MySOMClasses | 实际核开源仓库及其课程API路由，读取官方课程目录；未发现评价API或评价材料 | 目录和排课参考，不作为已接入评价网站 |
| SOM Shortcut | HTTP403；web reader显示资源加载失败。搜索摘要提及评价，但无法取得资源清单和链接终点 | 只是待核资源索引，不据摘要声称已找到或接入SOM评教 |
| 公开学生文章与访谈 | 原文逐条核读；脚本另实际HTTP读取并核查3份SOM公开页面的课程及内容锚点 | 可展示有来源和限制的精简体验；不是自动评分数据流 |

CourseTable依据：[FAQ源代码](https://github.com/coursetable/coursetable/blob/master/frontend/src/pages/FAQ.tsx)、[API路由](https://github.com/coursetable/coursetable/blob/master/api/src/catalog/catalog.routes.ts)、[认证挑战说明](https://github.com/coursetable/coursetable/blob/master/docs/challenge.md)。其公开目录与登录后评价JSON分开；没有请求、提交或绕过认证挑战。开源代码也不代表有权复制其受限评价库。

## 可重复运行的已实现工具

以下CLI已实现并运行，**不代表网页已经支持同名导入操作**：

```bash
# 验证材料类型、课程号和标题、来源关系、245个教学班的来源状态
python3 scripts/review_sources.py validate

# 用当前目录和现有材料重建来源关联及覆盖统计，不抓网站
python3 scripts/review_sources.py rebuild

# 实际重新获取公开原文并核对内容锚点，不保存全文，不更改人工摘要
python3 scripts/review_sources.py verify-public \
  --review-id andrea-2025-mgt561 \
  --review-id edirin-2019-mgt531 \
  --review-id luisa-2025-mgt561-context

# 仅规范化用户已获准保存的本地JSON；输出必须位于本公开仓库之外
python3 scripts/review_sources.py import-json /path/to/authorized-input.json \
  --output /tmp/som-local-reviews.json
```

公开核查实际读取3份SOM页面，全部返回200且预期课程／内容锚点命中。脚本保存检查时间、响应hash及命中状态，不保存全文或登录页。Substack在web reader可读，而普通HTTP受代理403；Poets&Quants普通HTTP也403。遇阻时保留此前材料及明确状态，不改成“网站没有评价”，不尝试绕过。

本地导入接受规范化的 `{"reviews": [...]}`，不冒称能直接解析未知SOM门户导出。每条须有：`id`、`courseCode`、`courseTitle`、`title`、`sourceUrl`、`sourceId`、`sourceType`、`summary`、`materialKind`、`accessScope`、`term`、`faculty`。学期不明须显式null；教师不明可为[]；数字rating须同时给出有效ratingScale。以课程号和标题精确核对，不以同号或模糊名称替代；历史教师与当期不同必须展示。导入内容始终标为用户提供，未经独立核实。

导入字段使用白名单，丢弃NetID、邮箱、cookie、浏览器存储和原始HTML等额外字段；不向公开仓库写入任何本地导入。CLI仅产生本地文件，不会把资料加入发布产物、发送到模型或发布到GitHub。

## 前端消费契约

- `reviews.json`保留旧字段，并新增`materialKind`、`sourceId`、`courseTitle`、`accessScope`和`sourceChecks`。TA背景、个人喜好不能计入实质课程评价。
- `review-sources.json`的`sources`给来源状态、覆盖和实际证据；`courseSources`以课程号、标题、学期组成courseKey，并列courseIds。链接只是入口，不能计作已读取记录。
- `reviewMatches`明确历史范围、教师匹配状态与学期。531的Brooks校友访谈与当前Tate不同；该材料可作为历史体验，但不能默认为当前教师评价。
- 当前没有正式SOM评价，网页应说明“已整理的公开材料”和“尚未接通的校内评价”，避免“暂无公开评价”被误读成“该课没有任何学生评价”。

## 仍需完成的真实交接

要继续接入SOM正式评价，需要用户在本人可见的Yale CAS界面登录，确认内部网站中的实际Course Evaluations页面和可保存、使用范围。无需把密码、cookie或NetID贴进聊天。登录后再判断源格式、课程／教师／学期覆盖、是否能合法导出及适合的本地处理方式；尚未观察到的导出不能预先承诺。

本轮公开调查、来源状态和安全本地CLI已经可用。正式SOM评价接入仍受认证与资料范围限制，不能靠增加外部搜索链接或别校／旧教师评分填平。
