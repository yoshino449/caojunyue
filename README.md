# 教务器材预约

选器材、选日期时段完成预约，同一器材同一时段自动互斥。
当前阶段：v1 纯前端闭环已验证；本仓库为前后端骨架（`/ping` 打通），服务端判重为 v2 范围。

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

## API（骨架 v0.1）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/ping`、`/api/ping` | 健康检查，返回 `ok` |
| GET | `/api/bookings` | 返回预约列表 JSON（证明数据库打通） |
| GET | `/` | 静态托管前端页面 |

## 文档索引

- [docs/PRD.md](docs/PRD.md) — 需求与验收标准（AC1–AC7）
- [docs/技术方案.md](docs/技术方案.md) — 架构与选型
- [docs/任务看板.md](docs/任务看板.md) — 任务拆解与状态
- [AGENTS.md](AGENTS.md) — AI 编码代理协作规范

## 已知限制

- v1 判重仍在前端（localStorage），跨设备不互斥；服务端判重（`POST /api/bookings` + 唯一索引兜底）为 v2 范围；
- 浏览器数据按源隔离：更换端口 / 协议后，原 localStorage 数据不可见。
