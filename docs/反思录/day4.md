# Day4 反思件

> 2026-10-09 ｜ 今日交付：部署手册补全上线信息并入库 + 上线后端到端全量验收 + day4 tag + 完工报告 issue

## 今日完成

- 部署手册回填本项目实际上线信息：线上域名 `https://caojunyue.pages.dev/`、D1 database_id `7f76097a-2ced-418c-8862-1d7cb99767cd`、5 个验收 URL、3 条首次部署踩坑实录（commit `c1aac49`、`a63b25e`）；
- 部署手册补占位符替换提示：明确标注 `cao-junyue`/`yoshino449`/`caojunyue.pages.dev`/`7f76097a...` 均为本项目作者实例值，下届同学部署时必须替换，唯一不用换的是数据库名 `equipment-booking` 与 binding 名 `DB`（commit `febd846`）；
- 上线后端到端全量验收：5 个 URL 全通过（首页三张卡片+页脚计数、`/ping`=ok、`/api/ping`=ok、`/api/bookings`=seed 2 条 JSON、`/api/visits`=`{"count":N}`），POST/DELETE 写操作实测通过（Day3 修复的 405 已生效）；
- tag `day4` 已推，「第 4 天完工报告」issue 已发。

## 反思

1. **部署手册不能留占位符交差**：第一版手册里 `database_id = "<部署后回填>"` 这种占位符如果忘了填，下届同学照抄会部署失败。回填实例值（域名、database_id、验收 URL）是手册从"教程"变成"可复现指南"的关键——占位符只该出现在"你需要替换的值"说明里，不该出现在最终配置代码块里；
2. **上线后端到端验收要覆盖写操作**：GET 接口全通不代表部署成功，POST/DELETE 才是真实业务链路。Day3 暴露的 405 bug 证明——只验 GET 会让命名错误这种潜伏 bug 漏到验收前。端到端验收清单必须包含"约→撞→取消→再约"完整闭环，而不是只 curl 几个 GET；
3. **部署选型要提前留 Plan B 并写清切换成本**：从 Sealos（改版卡住）→ Render（要绑国际卡）→ Cloudflare（零门槛）换了三条路线才落地。教训是选型阶段就要调研每条路线的硬约束（绑卡？手机号？国内可直连？数据持久？），而不是走到一半才发现卡住。把 Plan B 的切换成本提前摸清，比临场换方案省很多时间；
4. **双 remote 同步是纪律不是可选**：Cloudflare 只接 GitHub，Gitee 是主仓库，代码必须两边都推。漏推 GitHub 会导致线上还是旧版，漏推 Gitee 会导致协作不同步。日常更新流程要钉死：`git push origin main` → `git push github main`，缺一不可。

## 明日重点

PRD AC1–AC7 全量走查；演示脚本排练（「约→撞→取消→再约」90 秒闭环 + 审题三问问答）。
