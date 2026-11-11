# GitHub Pages 部署与使用

当前已上线：[打开选课助手](https://shawnsun0813.github.io/class-planning-assistant/)。页面可直接分享，个人方案保存在每位使用者自己的浏览器。

发布源提交：3fafd3582bcdfd83c7e63c8780f3bd1e15c6f9bd。工作流：[43034046878](https://github.com/Shawnsun0813/class-planning-assistant/actions/runs/43034046878)，所有者启用Pages后重跑构建和发布均成功。以下原配置／启用记录保留为过程与复现信息；早先403不是当前上线阻塞。

## 实际线上验证

- 受信HTTPS获取index、3个构建assets及6份JSON均200，逐文件SHA与已审核本地dist相同。
- 主Agent默认共享Chrome实际访问线上网址，无TLS告警；历史基线22学分7门、S1/S2正确切换、预算5／已用10错误与禁存、刷新后原方案和输入保留均已观察。测试值已恢复0／0，历史方案仍未确认。
- 独立评审完成配置和本地子路径交互检查；其独立headless浏览器的线上访问被本机ERR_CERT_AUTHORITY_INVALID阻塞，线上互动未执行，未关闭TLS校验。该限制不等于站点证书已证实无效。
- 模型真实推理、完整个人资格／竞价规则、竞价效果、账号及跨设备同步不因部署而通过。

实际界面：[默认共享Chrome线上截图](../artifacts/deploy/live-shared-chrome.png)。

证据：[主Agent线上验证](../artifacts/deploy/live-manager-evidence.json)、[独立部署审核](DEPLOYMENT-REVIEW.md)。

## 授权与启用

2026年11月11日，用户明确授权把现有版本部署到GitHub Pages并进行多Agent审核。初次API启用因连接缺少管理权限返回403；用户随后在仓库设置中选择GitHub Actions，主Agent重跑工作流并完成发布及上述线上核查。没有创建付费服务、发送邀请或接管学校账号。

## 部署配置

工作流：[deploy.yml](../.github/workflows/deploy.yml)。`main`分支推送或手动触发后执行两个阶段：

1. 构建阶段使用Node 24、锁定依赖安装、15项核心检查和生产构建；仅上传`dist`。
2. 发布阶段依赖成功构建，将同一份产物部署到`github-pages`环境，并使用GitHub返回的`page_url`。当前实际网址与验证结果已更新至README、TASK及本页；配置存在或工作流成功本身不替代线上核验。

默认只读仓库内容；构建阶段另有Pages读取权限，发布阶段仅有`pages: write`与`id-token: write`。并发组不取消正在进行的发布，避免同一站点被同时写入。工作流不自动开启尚未配置的Pages；初次启用需仓库所有者配置，现已完成，后续main推送按同一流程发布。

所有Actions都固定到实际验证的官方发布提交，而不是可移动的major标签：

| Action | 版本 | 固定提交 |
| --- | --- | --- |
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/configure-pages | v6.0.0 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| actions/upload-pages-artifact | v5.0.0 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| actions/deploy-pages | v5.0.1 | `368f82528645a54fb793d4d04e342629a3f51346` |

版本和提交来自各`actions/*`官方仓库的最新release及对应Git tag，已逐项核对。配置结构参考[GitHub官方Pages工作流](https://github.com/actions/starter-workflows/blob/main/pages/static.yml)、[上传产物说明](https://github.com/actions/upload-pages-artifact/blob/main/README.md)和[部署Action说明](https://github.com/actions/deploy-pages/blob/main/README.md)。

## 公开产物范围

`vite.config.ts`保留`base: './'`，使HTML、模块和数据路径相对站点所在目录。应用没有深层客户端路由；从项目路径根目录及其尾部斜线进入。子路径已经用真实浏览器验证，不以根路径预览代替。

构建只复制应用实际读取的六份JSON快照：catalog、bidding-history、reviews、enrollment-history、exchange-history和nonsom-history。源Excel、`data-audit.json`、仓库的`src`目录、报告、`.git`及其他非构建文件不进入站点产物；编译后的应用JavaScript和CSS正常公开提供。工作流额外检查`dist/index.html`、`dist/data/catalog.json`存在，且没有`dist/data/raw`。

源Excel和审计记录继续保存在用户指定的公开GitHub仓库中，站点产物排除它们不等于将仓库内容变为私有。课程目录是采集快照，不是实时余位接口。

## 本地验证

已实际运行`npm run test`：15项通过；`npm run build`通过。模型的按需代码块较大，Vite产生大小警告；未为此更改原有运行逻辑或隐藏警告。

将最终`dist`挂载在`/class-planning-assistant/`下，用系统Chromium和Playwright实际检查：

- HTML、CSS、模块和六份JSON均返回200；目录245个教学班，首批显示20条。
- 历史基线22学分／7门；S2显示651的两次会面，选中样式与内容一致。
- 18学分讨论分支明确采纳与撤回恢复22；未知资格不被改成已认证。
- 预算100、草案101时保留输入且禁止保存。
- 390px独立浏览器上下文下条件默认收起、878长课名可搜索、无横向溢出。
- 站点中的原始工作簿、审计文件、AGENTS和`.git/config`请求为404；产物不存在Excel文件。

没有页面运行错误或失败资源请求。证据：[本地子路径检查](../artifacts/deploy/local-prefix-evidence.json)、[桌面](../artifacts/deploy/local-prefix-desktop.png)、[手机](../artifacts/deploy/local-prefix-mobile.png)。这证明本地构建产物可以部署在项目子路径；不代替GitHub实际发布及线上核验。

## 访问与资料边界

GitHub Pages为公开HTTPS站点，适用于给同学分享一个网址。个人条件和方案仍在各自浏览器保存，没有账号登录或跨设备同步；同一浏览器的命名方案不是保密边界。清理浏览器数据会丢失本地记录，应导出备份。

来源：[GitHub Pages说明](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。

## 免费模型与未验证范围

浏览器本地开源推理无需API密钥，由用户主动下载，使用设备资源。部署本身不会证明模型推理可用：当前云端环境默认无可用GPU，软件GPU尝试又遇到模型下载证书错误，尚未生成真实模型回答。详见[模型运行验证](MODEL-VALIDATION.md)。

核心排课和预算检查独立于模型。上线后仍须保留资格、先修、活动时间、竞价规则和历史记录含义等限制，不能把部署成功当作模型、竞价效果或用户价值验收通过。

## 更新与撤回

后续`main`更新会自动执行同一构建与发布检查。恢复旧界面或逻辑时，通过普通Git提交恢复已知版本，再由同一工作流发布；不强制改写历史。当前构建不在发布流程中重新抓取课程网站，也不下载模型权重。

目录刷新和历史表处理仍按`scripts/fetch_catalog.py`及[数据说明](DATA.md)执行，更新后核对课程身份、先修和受影响方案，不静默改写用户决定。
