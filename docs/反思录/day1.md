# Day1 反思件

> 2026-10-08 ｜ 今日交付：T1 外部能力确认 + 一页想法电梯稿 + day1 tag + 完工报告 issue

## 今日完成

- T1 接入外部能力确认通过：Chart.js 统计弹窗（柱状图各器材预约量 + 饼图各时段热度），数据来自服务端 `/api/stats` 聚合，README 已记录接法与 4 条坑；
- 写出 [docs/电梯稿.md](../电梯稿.md)（组内互讲版）：一句话定位 → 痛点 → 方案 → 亮点 → 90 秒演示闭环 → 当前数据，一页讲清想法；
- 当日署名 commit `5c1d284`，tag `day1` 已推，「第 1 天完工报告」issue 已发。

## 反思

1. **平台改版是最大的坑**：部署选型从 Sealos（改版卡住）→ Render（要绑卡）→ Cloudflare（零门槛）换了三条路线才落地。教训：选型时就要备好 Plan B，且每条路线的切换成本要提前摸清；
2. **概念混淆浪费操作预算**：Cloudflare 控制台里 Workers 和 Pages 入口合并后极易误建项目类型，动手前应先开 Build 配置页确认有 Framework preset（Pages 特征）再往下走；
3. **API 差异要实测不能想当然**：D1 prepared statement 没有 node:sqlite 的 `.get()` 方法，本地能跑的代码上 D1 报 Error 1101——同类 API 不同实现，只能逐条 SQL 在 D1 Console 里试；
4. **验证要用对的工具**：WebFetch 抓本站点只拿到 SPA fallback 静态页，判活判接口必须 curl 或真实浏览器，证据以原始输出为准。

## 明日重点

三件套（PRD / 技术方案 / 任务看板）定稿互审；骨架本机复跑；分支合并流程确认。
