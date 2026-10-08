### 作者

我是曹骏越，移动应用开发与软件测试专业学生。
讨论组号：9
课程目标：熟练使用 Git 与 Gitee，独立完成项目版本控制与代码托管。

---

# 教务器材预约

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
├── docs/              PRD / 技术方案 / 任务看板
├── package.json       scripts：start、db:init
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
| POST | `/api/bookings` | 新建预约，JSON：`equipId/user/date/slot`；成功 `201`，入参非法 `400`，同器材同日同时段冲突 `409` |
| DELETE | `/api/bookings/:id` | 取消预约（删除记录、释放时段）；成功 `204`，记录不存在 `404` |
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

## 文档索引

- [docs/PRD.md](docs/PRD.md) — 需求与验收标准（AC1–AC8）
- [docs/技术方案.md](docs/技术方案.md) — 架构与选型
- [docs/任务看板.md](docs/任务看板.md) — 任务拆解与状态
- [AGENTS.md](AGENTS.md) — AI 编码代理协作规范

## 已知限制

- 当前为单机 SQLite + 单服务，未做多用户登录：取消操作不校验预约归属（PRD 已记录该限制）；
- 数据库文件在本机 `data/` 下，跨设备共用需迁移到 MySQL/云数据库，页面与接口逻辑可不变。
