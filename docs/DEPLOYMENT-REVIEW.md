# GitHub Pages 独立部署评审

日期：2026年11月11日（America/New_York）｜任务：REVIEW-DEPLOY-01。

配置与本地项目子路径检查通过；发布工作流已独立查询为成功。**独立headless线上交互验证受当前测试浏览器证书信任错误阻塞，尚未完成。** 不把本地通过或Actions成功写成线上功能验收通过。

## 发布候选

- 源提交：`3fafd3582bcdfd83c7e63c8780f3bd1e15c6f9bd`，与本次审核的工作区候选及工作流head_sha一致；后续纯文档提交不改变该已部署源码版本。
- [发布工作流43034046878](https://github.com/Shawnsun0813/class-planning-assistant/actions/runs/43034046878)：本评审通过GitHub读取接口独立观察到status completed、conclusion success。
- Pages实际返回的网址由主Agent交接为：https://shawnsun0813.github.io/class-planning-assistant/ 。本评审已对该精确网址发起真实浏览器导航。

## 已独立核查

工作流只在main推送或手动触发；构建锁定依赖、执行核心检查、构建后仅上传dist，发布阶段依赖构建成功。build采用contents读取和Pages读取；deploy仅有Pages写及OIDC权限，绑定github-pages环境及并发组。五个官方Action固定SHA均通过各官方仓库的git tag独立核对一致。

vite保留相对子路径资源，仅将catalog、bidding-history、reviews、enrollment-history、exchange-history和nonsom-history六份运行JSON复制至站点，原Excel、审计和仓库源文件不在站点产物中。这不改变源仓库已经公开的事实。

在真实Chromium中将本地dist挂载到/class-planning-assistant/后，独立检查245课程、20条初始行、六份JSON200、历史22学分7门、S2选中和651每周两次会面、100预算101草案拒存、390px布局均通过，无页面错误或失败资源。此范围明确是本地子路径，不是公开站点。

## 真实线上尝试

使用独立headless系统Chromium，保持正常TLS校验，从新浏览器上下文访问上述HTTPS网址。导航直接报`net::ERR_CERT_AUTHORITY_INVALID`。没有取得应用页面，没有执行线上目录、方案、预算或手机交互断言；没有关闭证书校验、改共享浏览器设置或模拟服务器成功响应。

因此本评审不判断网站本身不可用或所有访问者均有证书问题。错误只能证明当前独立测试浏览器的该次访问被信任错误阻塞。主Agent应结合受信HTTP、共享Chrome或其他真实正常浏览器继续完成线上核查，并明确证据范围。

证据：[线上尝试记录](../artifacts/deploy/live-review-evidence.json)、[实际验证脚本](../artifacts/deploy/live-review.py)。该JSON保留checks为空、TLS校验未关闭、失败请求及完整错误，另记独立读取的工作流结果和配置指纹。

## 主Agent另行观察

主Agent随后交接：使用默认共享Chrome已实际打开该线上网址并看到新版页面，无证书告警；保留环境CA的HTTP客户端也实际返回200及245条课程，并将继续在共享Chrome操作课表与预算。以上为主Agent报告的独立路径观察，不改写本子Agentheadless失败事实，也不能据此宣称所有设备或全部交互均已通过。最终线上操作范围以主Agent保存的实际证据为准。

## 剩余边界

免费模型真实推理、个人选课资格、完整竞价规则与效果没有因部署获得通过结论。每位同学的条件与课表在自己的浏览器保存，无账号或跨设备同步；上线不会自动迁移localhost的本地记录。

## 主Agent最终线上核查补充

主Agent已实际完成默认共享Chrome线上操作：历史基线22学分／7门、S1/S2切换及651-02显示、预算100／10到临时5／10、刷新仍保留原方案和输入、错误提示与保存禁用。临时测试值已恢复0／0，停留在未确认历史课表。受信HTTPS还核对10份线上产物为200且与已审build哈希相同。

这些为主Agent实际路径核查，证据见[live-manager-evidence.json](../artifacts/deploy/live-manager-evidence.json)，不改写本评审的独立headless证书阻塞或将未运行断言标为通过。
