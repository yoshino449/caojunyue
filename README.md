### 作者

我是曹骏越，移动应用开发与软件测试专业学生。
讨论组号：9
课程目标：熟练使用 Git 与 Gitee，独立完成项目版本控制与代码托管。

---

# 教务器材预约

[![CI - Gitee Go](https://img.shields.io/badge/CI-Gitee%20Go-C71D23?logo=gitee)](https://gitee.com/cao-junyue/caojunyue/gitee_go)

👋 欢迎来到本项目，一起加油！——第9组 曹骏越

选器材、选日期时段完成预约，同一器材同一时段自动互斥。
当前阶段：v2 前后端已打通——页面经 API 读写 SQLite，互斥由服务端唯一索引兜底（冲突返回 409）。

## 目录结构

```
vibe-lab1/
├── frontend/          纯静态前端（单文件 index.html，预约/判重/取消逻辑）
├── backend/           Node 原生 http 后端（零 npm 依赖）
│   ├── server.js      入口：/ping、/api/bookings、静态托管 frontend/
│   ├── db.js          数据层：node:sqlite 连接与查询
│   └── init-db.js     手动初始化脚本（幂等）
├── db/                SQL 脚本
│   ├── schema.sql     建表 + 唯一索引（互斥键 equip_id+date+slot）
│   └── seed.sql       示例数据（幂等）
├── data/              运行时生成的 SQLite 文件（equipment.db）
├── tests/             接口测试（node:test，零依赖；5 条业务规则，独立测试库 test.db）
├── docs/              PRD / 技术方案 / 任务看板 / 部署手册
├── package.json       scripts：start、db:init；engines.node ≥ 22
├── entrypoint.sh      Sealos DevBox 发布为正式应用时的 OCI 镜像入口点
├── Dockerfile         容器镜像（Sealos 应用管理 镜像部署备选用，node:22-slim）
├── .dockerignore      排除 data/、node_modules、.git 等
├── render.yaml        Render Blueprint（Render/Zeabur 备选配置）
├── README.md
└── AGENTS.md          AI 编码代理协作规范
```

## 快速开始

前置：Node.js ≥ 22（使用内置 node:sqlite，**零 npm 依赖，无需 install**）

```bash
npm start            # 启动后端并托管前端
```

- 打开 http://localhost:3000          → 预约页面
- 打开 http://localhost:3000/ping     → 返回 `ok`（骨架验收接口）

## 测试（T1 测试补齐）

人列 5 条关键业务规则，AI 生成接口测试（Node 22 内置 `node:test`，零 npm 依赖；起真实 HTTP 服务 + 独立测试库 `data/test.db`，不碰开发数据）：

| # | 业务规则 | 期望 |
|---|---|---|
| 1 | 同器材 + 同日 + 同时段 | 拒绝 409 |
| 2 | 换时段（同器材同日） | 允许 201 |
| 3 | 换器材（同日同时段） | 允许 201 |
| 4 | 过去日期 | 拒绝 400 |
| 5 | 取消后时段释放可重约 | DELETE 204 → POST 201 |

```bash
npm test   # 5 条规则全绿；连跑可重入（before 清库 + 用例 finally 自清）
```

**跑挂修复记录**（均为改用例，业务代码零改动）：

1. `--test tests/` 报 Cannot find module → 改 `--test tests/api.test.js`：Node 22 在 Windows 下把带尾斜杠的目录当模块路径解析；
2. `Body has already been read` → createOk 先读 body 再断言：断言消息里的 `await res.text()` 无条件求值，提前消费了响应流；
3. 规则 2/3/5 连锁 409 → before 钩子清空测试库 + 用例 try/finally 自清：用例中途挂起会残留数据，共用互斥键导致下一轮全撞——测试必须可重入。

## CI（T2：Gitee Go）

流水线配置：[.workflow/ci.yml](.workflow/ci.yml)（组内统一模板）。push 到 `master` 自动触发（Webhook，已验证）：**装依赖 → 跑测试（Node 22）→ 通知**。

**接入踩坑**（下届注意）：

1. **按分支发现 YAML**：Gitee Go 按分支发现 `.workflow/*.yml`，默认分支是 master——YAML 只在 main 会永远"未发现"。本仓库主线是 main，靠 `git push origin main:master` 双分支同步解决；
2. **schema 与直觉不同**：`version: "1.0"` 必填；stages 元素直接平铺（不能套 `- stage:`）；commands 是字符串列表（多行块会报"steps 配置缺失或格式错误"）；触发器是 `trigger: auto + push.branches.precise`（详见 [Gitee 触发事件文档](https://help.gitee.com/gitee-go/pipeline/trigger/)）；
3. **开通时别用模板**：开通引导创建的 Maven 模板流水线对本项目无用且会把模板 YAML 提交进仓库，发现后直接删除；
4. **社区版通知不可达**：Gitee 平台通知设置（gitee.com/profile/notifications）无流水线开关，任务节点无通知区块，step 级 `notify` 无公开 YAML schema；实测成功构建（#2/#3）与故意失败构建（#4，改错断言验证 CI 拦截有效）**均收不到站内信/邮件**——"通知"环节以构建历史页状态为准（组内统一模板，结论同样适用）。

- **装依赖**：本项目零 npm 依赖，该步秒过（保留以符合模板环节）；
- **跑测试**：Gitee Go `build@nodejs` 插件官方版本最高 15.x，跑不了 `node:sqlite`，故测试步用 npmmirror 源自装 Node 22 后 `npm test`（5 条业务规则全绿才算过）；
- **通知**：社区版站内信/邮件均不可达（实测成功与失败构建均无），以构建历史页状态为准——见上方踩坑 4；
- **徽章**：README 顶部徽章链接到[流水线页](https://gitee.com/cao-junyue/caojunyue/gitee_go)；构建变绿后可在流水线「设置 → 徽标」复制动态状态徽标替换。

首次使用需在 Gitee 网页开通 Gitee Go（仓库 → 流水线 → 开通，需账号绑定手机号；单仓库 200 分钟免费构建时长），开通后流水线自动识别 `.workflow/ci.yml`。

## 数据库

```bash
npm run db:init      # 幂等初始化 data/equipment.db（建表 + 示例数据）
```

- 服务启动时也会自动执行同样的幂等初始化，`db:init` 仅用于手动触发；
- `db/schema.sql`：bookings 表 + 唯一索引，把 PRD 的互斥规则固化到数据库层；
- `db/seed.sql`：两条同时段、不同器材的示例预约，用于演示互斥范围（PRD AC4）。

## API（v0.2）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/ping`、`/api/ping` | 健康检查，返回 `ok` |
| GET | `/api/bookings` | 返回预约列表 JSON |
| GET | `/api/stats` | 返回预约聚合统计 JSON（`perEquip` 各器材计数、`perSlot` 各时段计数），供前端图表渲染 |
| GET | `/api/visits` | 返回页面访问计数 JSON（`{count}`），访问根页面时自增 |
| POST | `/api/bookings` | 新建预约，JSON：`equipId/user/date/slot`；成功 `201`，入参非法 `400`，同器材同日同时段冲突 `409` |
| DELETE | `/api/bookings/:id` | 取消预约（删除记录、释放时段）；成功 `204`，记录不存在 `404` |
| POST | `/api/ai/query` | AI 预约查询助手，JSON：`{question}`；成功 `200 {answer}`；无Key `503`、超时 `504`、额度用尽/余额不足 `429/503`、网络异常 `503`（Key 在服务端，前端不直连 LLM） |
| GET | `/` | 静态托管前端页面 |

## 开源组件接入：Chart.js（T1）

页面右上角「📊 统计」按钮打开统计弹窗，用柱状图展示各器材预约量、饼图展示各时段热度，数据来自服务端 `GET /api/stats` 聚合查询。

**怎么接的**

- head 引入 `<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4">`，CDN 直连、零构建、零 npm 依赖（不破坏 AGENTS.md「不引框架/构建链」约束）；
- 后端 `db.js#getStats()` 两条 `GROUP BY` 聚合（按器材、按时段），聚合走服务端、前端不做计算；
- 前端 `loadStats()` fetch 后 `new Chart(canvas, {...})`，柱状 `type:'bar'`、饼图 `type:'doughnut'`；模块级缓存 chart 实例。

**坑在哪**

1. **canvas 复用报错**：同一 canvas 再次 `new Chart()` 抛 "Canvas is already in use"。对策：关闭弹窗时先 `.destroy()` 旧实例再置 null，重开时重建。
2. **图表拉伸**：默认 `maintainAspectRatio:true` 会让图随容器宽度无限拉高。对策：`maintainAspectRatio:false` + 父容器 `.chart-wrap{height:220px}` 固定高度。
3. **CDN 可用性**：jsdelivr 在个别网络环境被墙。对策：`openStats()` 先判 `typeof Chart === 'undefined'`，未就绪时 toast 提示并阻止打开，不阻塞主预约流程。
4. **聚合时机**：每次打开统计弹窗都重新 fetch `/api/stats`（不缓存），保证新增/取消预约后数字实时变化。

## 部署（T2：Cloudflare Pages + Functions + D1）

线上部署到 Cloudflare Pages（pages.dev，国内可直连、Free 计划 $0/月、无需信用卡、GitHub OAuth 注册），拿到 `https://caojunyue.pages.dev/` 子域名，教师手机可开。**为什么用 Cloudflare**：Render 免费层 15 分钟无请求会休眠、重启清库（预约数据回 seed、访问计数归零）；Cloudflare Pages Functions 边缘运行 + D1 数据库持久化，无休眠、数据不丢、`/api/bookings` 真实落库。架构：`frontend/` 静态托管 + `functions/` 子树（ESM，Pages Functions 运行时硬性要求，与 `backend/` CommonJS 互不混用）+ D1 binding `DB`（平台注入，非 npm 包，不算引入第三方驱动）。

- **线上域名**：https://caojunyue.pages.dev/
- **D1 database_id**：`7f76097a-2ced-418c-8862-1d7cb99767cd`
- **完整步骤与坑在哪**：[docs/部署手册.md](docs/部署手册.md)（写给下届学生，含字段表、验收、避雷清单）
- **架构说明**：[docs/技术方案.md §11](docs/技术方案.md)（双轨架构：本地 `npm start` + `backend/` CommonJS / 线上 `functions/` ESM + D1 binding，二者并列互不替换）
- **关键文件**：[`wrangler.toml`](wrangler.toml)（D1 binding 声明，本地 `npm start` 不依赖）；[`functions/`](functions/) 子树 8 个文件（_lib/queries.js + index.js + ping.js + api/{ping,stats,visits}.js + api/bookings/{index,[id]}.js）
- **前置**：Cloudflare 只接 GitHub/GitLab/Bitbucket，不接 Gitee，需先把仓库镜像到 GitHub（手册 §1.2 有 GitHub Import 流程，不敲命令）
- **本地 vs 线上**：本地走 `backend/` + `node:sqlite`（CommonJS、`npm start`、http://localhost:3000），线上走 `functions/` + D1 binding `DB`（ESM、Cloudflare Pages Functions 运行时），两条路径互不替换；前端 `frontend/index.html` 通过相对路径 `/api/*` 调用，本地与线上同代码无需切换
- **验收 5 个 URL**：`/` 三张卡片+页脚访问计数；`/ping` 与 `/api/ping` 返回 `ok`；`/api/bookings` 返回 JSON 数组（含 seed 2 条）；`/api/visits` 返回 `{"count":N}`
- **已知限制**：D1 免费层 5GB 存储 + 500 万行读/天 + 10 万行写/天（T2 单机演示足够）；`functions/` 子树 ESM 是 Cloudflare Pages Functions 运行时硬性要求，已与 `backend/` CommonJS 隔离，不破坏 AGENTS.md「`backend/` 用 CommonJS」约束
- **历史备选**：仓库根 [`render.yaml`](render.yaml) / [`Dockerfile`](Dockerfile) / [`entrypoint.sh`](entrypoint.sh) 为 Render / Sealos DevBox 备选（实测 Render 免费层休眠 + 重启清库，Sealos cloud.sealos.io 改版后流程不匹配，均已降为备选）

## 文档索引

- [docs/PRD.md](docs/PRD.md) — 需求与验收标准（AC1–AC8）
- [docs/技术方案.md](docs/技术方案.md) — 架构与选型
- [docs/任务看板.md](docs/任务看板.md) — 任务拆解与状态
- [docs/部署手册.md](docs/部署手册.md) — Cloudflare Pages + Functions + D1 部署步骤与坑（T2）
- [AGENTS.md](AGENTS.md) — AI 编码代理协作规范

## 已知限制

- 当前为单机 SQLite + 单服务，未做多用户登录：取消操作不校验预约归属（PRD 已记录该限制）；
- 数据库文件在本机 `data/` 下，跨设备共用需迁移到 MySQL/云数据库，页面与接口逻辑可不变。
