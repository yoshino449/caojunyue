# Day7 反思件

> 2026-10-10 ｜ 今日交付：T1 LLM 预约查询助手上线 + T2 数据字典入库 + T3 看板风险评估 + day7 tag + 完工报告

## 今日完成

- **T1 LLM 能力上线**：后端封装 DeepSeek（Key 在服务端 `DEEPSEEK_API_KEY`），前端 AI 助手弹窗，失败兜底（无Key 503/超时 504/额度 429/网络 503）；线上 `POST /api/bookings` body `ai:true` 返回真实回答，本地 5/5 测试全绿；
- **T2 数据字典**：基于 `db/schema.sql` 生成 [docs/数据字典.md](../数据字典.md)（bookings + visits 两张表，含字段/索引/取值说明）；
- **T3 看板+风险**：[docs/任务看板.md](../任务看板.md) 新增 Day7-T1/T2 任务行 + R1-R5 剩余风险评估表，R4（LLM Key 配置）已关闭；
- **Cloudflare Pages 部署踩坑**：发现两个关键限制并绕过——① 首次部署后不识别新增 Function 文件/方法 → AI 逻辑内嵌到现有 `bookings/index.js`，通过 `body.ai===true` 分流；② Pages 连接的是 GitHub 仓库而非 Gitee → push 必须同时推 `github` remote 才能触发部署。

## 反思

1. **Cloudflare Pages Functions 的"首次部署冻结"效应**：新增的 Function 文件和方法在首次部署后不会被注册到路由表，即使文件内容正确也返回 405。排查过程中尝试了 `query.js`、`ai.js`、`ai/index.js`、`bot/index.js`、`[id].js` 加 onRequestPost 等多种路径，全部 405。最终方案是**复用现有文件的现有方法**，通过 body 参数分流——这是绕过该限制的唯一可靠方式；
2. **部署目标仓库要对齐**：Cloudflare Pages 连的是 GitHub（`yoshino449/caojunyue`），但日常 push 到 Gitee（`origin`），导致新代码从不触发部署。教训：多 remote 仓库必须明确哪个是"部署触发源"，push 后要 `git push github main` 同步，或配 Gitee→GitHub 镜像；
3. **AI 兜底要覆盖全部失败路径**：DeepSeek 可能返回 402（余额不足）、429（限流）、401/403（Key 无效）、503（服务端异常），加上网络超时和断网。每个错误码都要有对应的中文提示和状态码，前端才能给用户明确反馈而不是"出错了"；
4. **数据字典要以 schema.sql 为唯一真源**：T2 用 SQLite MCP 直连数据库生成数据字典，但更稳妥的做法是基于 `db/schema.sql`（版本受控）而非运行时数据库（可能被手工修改）。本次最终采用 schema.sql 解析，确保字典与建表脚本一致。

## 明日重点

- 提交 Day6 剩余 6 条 issue（Issue 6-11），全部 11 条 URL 回填互评记录；
- fork 组员仓库 → push 修复分支 → 发 PR（关联 Issue 1+2）；
- 等待组员对自己仓库的评审，处理 T2 整改清单。
