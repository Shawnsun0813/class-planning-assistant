# 免费本地模型运行验证

验证日期：2026年11月11日，08:14至08:15，America/New_York。

## 结论

实际应用模块`src/ai.ts`已被独立headless Chromium加载并调用`enableLocalModel`。当前环境下未完成模型初始化，未进行真实推理，不能把“已接入WebLLM”写成“模型运行验收通过”。

默认环境的WebGPU无可用adapter由主Agent另行观察。本次独立测试进程使用软件GPU参数后，成功获得SwiftShader adapter；模型初始化随后在HuggingFace配置下载阶段被浏览器证书信任错误阻塞。

没有调用收费API，没有模拟模型回答，没有修改应用、依赖或共享Chrome设置，也没有关闭TLS证书验证。

## 实际检查

使用项目已有`@playwright/test`及系统`/usr/bin/chromium`，版本156.0.8078.79。Playwright默认内置headless浏览器不存在，未安装新浏览器，改用项目已有测试配置所采用的系统Chromium。

测试进程参数：

```text
--no-sandbox
--enable-unsafe-webgpu
--use-angle=swiftshader
--disable-gpu-sandbox
```

这组参数只用于验证进程，不构成向同学提供的软件GPU运行建议。

| 项目 | 实际结果 |
| --- | --- |
| 本地应用 | http://127.0.0.1:5173/可打开 |
| 实际调用路径 | 浏览器动态导入/src/ai.ts，调用enableLocalModel |
| WebGPU adapter | 可用，vendor为google，architecture为swiftshader |
| shader-f16特征 | 未提供；本次未走到模型计算阶段，不能据此声称实际已触发该特征错误 |
| maxBufferSize及maxStorageBufferBindingSize | 均为1,073,741,824字节；这不是实际模型内存用量测量 |
| 模型 | Qwen3-0.6B-q4f16_1-MLC，来自已安装WebLLM真实模型目录 |
| 初始化 | 失败，TypeError: Failed to fetch |
| 具体请求 | https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC/resolve/main/mlc-chat-config.json |
| 浏览器网络错误 | net::ERR_CERT_AUTHORITY_INVALID |
| 初始化进度 | 无进度回调，未进入权重下载和计算验证 |
| 真实模型输出 | 无，推理未执行 |

另用加Vulkan相关参数的独立进程检查过adapter，同样获得SwiftShader adapter，未改变以上结论。安装包模型目录报告`vram_required_MB: 1403.34`，这是目录估计，不是本次实测消耗。

## 证书诊断边界

保留环境CA信任的curl请求对同一配置URL收到HTTP307，说明该URL可获得服务器响应，不能把浏览器失败笼统写成“模型域名不可访问”。这不证明完整权重或WASM下载可用。

第二次模型尝试在独立Playwright进程中配置HTTPS请求的可信传输转发，保留真实响应内容，没有mock模型或关闭TLS；实际ArtifactCache请求仍返回相同的浏览器证书错误。转发未解决此路径问题，未再反复重试，也没有新增CPU替代模块。

## 证据与复现

- [测试脚本](../artifacts/model/verify-model.mjs)
- [软件WebGPU实际结果](../artifacts/model/software-webgpu-result.json)
- [可信传输尝试结果](../artifacts/model/trusted-transport-result.json)

先运行本地应用，再执行：

```bash
node artifacts/model/verify-model.mjs
node artifacts/model/verify-model.mjs --trusted-transport
```

脚本为初始化设置60秒上限；只有初始化成功才尝试一个极短实际问答，并设置30秒推理上限。本次两次初始化均约1.4秒即失败。

后续仍需在正常信任模型资源证书、能够访问模型文件、并有适用GPU能力和内存的真实桌面浏览器验证完整下载及推理。当前应分别报告“WebLLM接入完成”和“免费模型实际运行尚未验证”，不能把课程与排课的通过结果代替模型验收。
