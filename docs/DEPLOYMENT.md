# GitHub Pages 部署

2026年11月11日（America/New_York），用户明确要求将现有版本部署到GitHub Pages并由多Agent审核。本轮使用当前仓库和静态应用，不创建付费服务，不发送邀请，不接管学校账号。

## 当前发布状态

工作流和本地子路径候选已准备并验证，**尚未确认上线，没有已验证的分享网址**。

主Agent实际查询GitHub Pages返回404，随后在用户本轮授权下尝试启用，返回403 `Resource not accessible by integration`。这是当前GitHub连接缺少Pages管理权限，不代表本地构建失败。共享Chrome未登录；仓库设置页显示404或Sign in，无法用该会话代替用户完成设置。

需要仓库所有者在GitHub的Settings → Pages中，将Build and deployment的Source选择为GitHub Actions。完成后，再手动触发本工作流或重跑之前因未启用Pages而失败的运行；由主Agent在可用权限内核查工作流、Pages返回网址及线上功能。选择发布源本身不等于工作流已成功发布，不能跳过后续核验。

## 部署配置

工作流：[deploy.yml](../.github/workflows/deploy.yml)。`main`分支推送或手动触发后执行两个阶段：

1. 构建阶段使用Node 24、锁定依赖安装、15项核心检查和生产构建；仅上传`dist`。
2. 发布阶段依赖成功构建，将同一份产物部署到`github-pages`环境，并使用GitHub返回的`page_url`。真实线上网址与结果由主Agent核验后更新README和TASK，不能只凭配置文件宣称已上线。

默认只读仓库内容；构建阶段另有Pages读取权限，发布阶段仅有`pages: write`与`id-token: write`。并发组不取消正在进行的发布，避免同一站点被同时写入。工作流不自动开启尚未配置的Pages；由主Agent在本轮明确授权范围内完成仓库设置，再启动工作流。

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
