# AGENTS.md — AI 编码代理协作规范

> AI 代理（Trae 等）在本仓库工作前必读。需求真源是 `docs/`，本文件约束"怎么改"。

## 项目一句话

教务器材预约：选器材、选日期时段预约，同器材同时段互斥。PRD（docs/PRD.md）是需求的唯一真源。

## 目录约定

| 目录 | 职责 | 约束 |
|---|---|---|
| `docs/` | PRD、技术方案、任务看板 | 需求与方案真源；变更走"先审改后实施" |
| `frontend/` | 纯静态前端（单文件 index.html） | 不引入框架/构建链 |
| `backend/` | Node 原生 http 服务 | server.js 入口、db.js 数据层、init-db.js 初始化 |
| `db/` | SQL 脚本 | schema.sql 建表、seed.sql 示例；表结构变更必须同步技术方案 |
| `data/` | 运行时 SQLite 文件 | 自动生成，不手工编辑、不写入版本库 |

## 技术栈约束（改动前先更新本文件与 docs/技术方案.md）

- 后端：Node ≥ 22 原生 `http` 模块，**禁止引入 Express/Koa 等框架**（v2 再议）；
- 数据库：内置 `node:sqlite`，启动带 `--experimental-sqlite` 标志（见 package.json scripts），**禁止引入第三方 ORM / 数据库驱动**；
- 模块规范：CommonJS（require / module.exports）；
- 依赖策略：保持零 npm 依赖；确需新增时必须在 README 说明理由并经用户确认；
- 注释、文档、提交信息一律中文。

## 数据契约

- 互斥唯一键：`equip_id + date + slot`（db/schema.sql 已建唯一索引，前端 localStorage 判重逻辑与其一致）；
- 预约字段：equipId / user / date(YYYY-MM-DD) / slot / createdAt(毫秒)；
- 判重唯一事实源：服务端数据库唯一索引 + `POST /api/bookings` 返回 409；前端不再本地判重（v1 的 `equipment_bookings_v1` localStorage 已废弃）。

## 常用命令

- `npm start` — 启动后端（含静态托管前端），http://localhost:3000
- `npm run db:init` — 幂等初始化数据库
- 验收基线：GET `/ping` 与 `/api/ping` 返回 `ok`；GET `/api/bookings` 返回 JSON 数组；页面可打开可交互

## 编码守则

- 最小改动：不做需求外的重构，不加用不到的抽象和防御分支；
- 用户输入进入 DOM 前必须 escapeHtml，进入 SQL 必须参数化（防 XSS / 注入）；
- UI 状态与数据刷新分离：数据刷新不得连带重建弹窗等 UI 容器；
- 破坏性操作（删库、删除文档、force push）必须先获得用户明确授权。

## 改动纪律

1. 功能变更先改 docs/PRD.md（走审改），再同步技术方案，最后动代码；
2. 每次交付按 PRD 的 AC 清单自查，并在 docs/任务看板.md 更新任务状态；
3. 接口变更必须同步 README 的 API 表。
