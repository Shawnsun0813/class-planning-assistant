# Yale SOM 选课助手

面向Yale SOM同学，以用户本人为首位用户。根据时间限制、求职方向等偏好，浏览真实课程资料、比较课程、生成和调整S1／S2课表，并在用户输入预算内准备有依据的竞价分配草案。

## 在线使用

[打开选课助手](https://shawnsun0813.github.io/class-planning-assistant/)。该链接可直接分享；GitHub Pages已部署当前试用版。部署与实际验证范围见[部署说明](docs/DEPLOYMENT.md)和[独立评审](docs/DEPLOYMENT-REVIEW.md)。

## 运行

```sh
npm ci
npm run dev
```

默认工作区入口：http://localhost:5173/ 。这是试用服务，不是长期托管。当前云端共享浏览器已打开该入口；不同机器上的localhost并不指向同一个服务。

```sh
npm run test
npm run test:e2e
npm run build
npm run preview
```

本环境npm默认缓存不可写时可用 `npm ci --cache /tmp/som-npm-cache`。浏览器测试默认复用 `/usr/bin/chromium`，其他环境的调整见 [实施说明](docs/IMPLEMENTATION.md)。构建产物在dist，使用相对资源路径。

## 当前界面

沿用学术目录方向：墨黑页头、纸白工作面、整行课程索引；手机条件默认收起，课程结果渐进展开。本轮资料修复实际预览：[桌面简介全文](artifacts/audit/design-desktop-523-expanded.png)、[手机简介全文](artifacts/audit/design-mobile-523-full.png)。[全面复核](docs/FULL-AUDIT.md)记录源字段与真实用户路径检查，设计结论见DESIGN-REVIEW。

## 可试用的核心路径

1. 浏览2027春官方目录，或恢复本人历史案例。
2. 核对个人条件；导入的历史偏好不会自动成为硬约束。
3. 比较课程，按全学期／S1／S2时间生成候选；资格和特殊活动未知单独提示。
4. 查看讨论分支和变化，明确采纳后才能更新方案；可撤回。
5. 输入自己的竞价总分及已占用分，查看同课、同轮次、同口径历史，调整预算草案。
6. 导出个人方案或常规课表日历。

不同同学可在各自浏览器使用；命名本地方案用于分别保存条件，不是账号保密边界或跨设备同步。

## 已接入资料

- 官方2027春目录：245个教学班、145个课程号；161条标可竞价、84条不可竞价。211条保留官方英文简介，34条源目录未提供；最新快照35条常规课时缺失或歧义。
- 用户上传4份原始Excel：[data/raw](data/raw/)。普通竞价2714条、报名3658条、跨院1071条、交换7条，分开保存与使用。
- 公开材料8条，覆盖5个课程号：同一作者4条课程体验、2条校友体验、1条个人喜好和1条助教背景；没有正式校内评价分数。每门课程显示材料类型、适用范围及评价站点访问状态，外链不算数据接通。
- 刷新目录：`python3 scripts/fetch_catalog.py --term 202701`；历史处理及验证见 [DATA](docs/DATA.md)。
- 评价材料与来源登记校验：`python3 scripts/review_sources.py validate`。SOM内部评价入口需Yale登录，目前未取得正式记录；不能用Yale College评价覆盖代替SOM覆盖。具体证据与限制见 [评价来源复核](docs/REVIEW-SOURCES.md)。

## 免费模型与限制

可选的浏览器本地WebLLM／Qwen3模型由用户主动下载，不需要API密钥，不调用付费模型。**当前云端测试没有完成成功推理：默认浏览器无可用GPU，受控软件GPU测试又遇到模型下载证书错误。** 功能接入不等于推理验收通过，详见 [实际模型验证](docs/MODEL-VALIDATION.md)。规则排课与预算检查不依赖模型。

总竞价预算由用户输入，落选退分来自用户提供规则；退课退款、轮次及单课限制等仍待完整官方核对。历史课程号可能复用，不能将旧同号异名课的分数套给新课。预算输出是草案，不保证中标，不报告未经验证的成功概率。

课程目录是带时间戳的快照，容量不是实时剩余名额。个人资格、先修、retreat和假期仍需核对；ICS只展开常规目录时间，不能替代学校日历。

## 项目文件

- [PRD](docs/PRD.md)、[首位用户案例](docs/FIRST-USER-CASE.md)、[任务状态](TASK.md)。
- [设计](docs/DESIGN.md)、[实际页面复查及视觉预览](docs/DESIGN-REVIEW.md)。
- [来源与评价](docs/SOURCES.md)、[数据说明](docs/DATA.md)、[实施与测试](docs/IMPLEMENTATION.md)。
- [后续部署](docs/DEPLOYMENT.md)、[协作要求](AGENTS.md)、[START-HERE v4.2](START-HERE.txt)。

本仓库为项目文件维护入口；原Pages版为早期审阅记录，不自动同步。原版START-PROMPT仍未提供，不编造其内容。GitHub Pages试用版已公开部署；未发送邀请或向学校提交选课／竞价。

关于账号、数据库、服务端AI和后续框架的分阶段建议，见[架构反思](docs/ARCHITECTURE-REVIEW.md)；当前未启动全栈迁移。
