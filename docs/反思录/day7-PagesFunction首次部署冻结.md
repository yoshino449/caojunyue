# 对话档案：新增 Function 首次部署全 405，复用现有文件绕过

> 本文档基于 Day7 反思件还原。

- 日期：2026-10-10
- 场景：Day7 T1 LLM 预约查询助手上线（Cloudflare Pages Functions + D1）
- 对话结构：提问 → 排查返工（3 轮）→ 通过

## 一、提问（原话）

> T1 LLM 能力上线：后端封装 DeepSeek，前端 AI 助手弹窗。

## 二、对话还原

### 第 1 轮：新建 Function 文件，线上全 405

**我**：给 AI 查询单独建一个路由文件。

**AI**：新增 Function 文件承载 AI 逻辑，本地没毛病；部署后线上却全返回 **405**。

> 返工点：Cloudflare Pages Functions 有「首次部署冻结」效应——新增的 Function 文件/方法首次部署后不会被注册到路由表。

### 第 2 轮：换了好几条路径，还是全 405

**我**：是不是文件名或目录不对，多试几个。

**AI**：依次尝试 `query.js`、`ai.js`、`ai/index.js`、`bot/index.js`、`[id].js` 加 `onRequestPost` 等多种路径，**全部 405**，文件内容正确也没用。

> 返工点：不能靠「新增文件/方法」解决，只能复用已经注册过的现有文件与现有方法。

### 第 3 轮：复用现有文件 + body 分流，顺带对齐部署源

**我**：那怎么让 AI 能力上线？

**AI**：把 AI 逻辑内嵌进现有 `functions/api/bookings/index.js`，通过 `body.ai === true` 分流走 AI 分支（本地 `backend/server.js` 同步做 `input.ai === true` 分支）。

同时发现第二处坑：Cloudflare Pages 连的是 GitHub 仓库，而日常 push 到 Gitee，导致新代码从不触发部署。

> 返工点：线上推送必须 `git push github main` 同步，部署触发源要明确。

## 三、通过证据

- 线上 `POST /api/bookings` body 含 `ai:true` 返回真实回答；
- 本地 `npm test` 5/5 全绿；
- 失败兜底覆盖全部路径：无 Key `503`、超时 `504`、额度用尽 `429`、网络异常 `503`（`backend/server.js` 的 `statusMap`，D1 侧同步）；
- 尝试过的失败路径：`query.js`、`ai.js`、`ai/index.js`、`bot/index.js`、`[id].js` —— 全部 405；
- 任务看板 Day7-T1 入库，tag `day7` + 完工报告。

## 四、反思

1. **Cloudflare Pages Functions 的「首次部署冻结」**：新增文件/方法首次部署后不注册路由，复用现有文件 + body 分流是唯一可靠绕过方式；
2. **部署目标仓库要对齐**：多 remote 必须明确哪个是「部署触发源」，push 后要同步到 GitHub；
3. **AI 兜底要覆盖全部失败路径**：402/429/401/403/503 加超时、断网，每个错误码都要有对应中文提示；
4. **数据字典以 schema.sql 为唯一真源**：基于受版本控制的建表脚本，而非可能被手工改动的运行时库。
