# 对话档案：T1 测试三处跑挂，改用例不改业务

> 本文档基于 Day5 反思件还原。

- 日期：Day5
- 场景：Day5 T1 测试补齐（本地 `npm test`）+ T2 CI（Gitee Go）
- 对话结构：提问 → 排查返工（3 轮）→ 通过

## 一、提问（原话）

> 本轮任务：T1 测试补齐 / T2 CI / T3 互评。

人列 5 条关键业务规则，AI 生成接口测试。

## 二、对话还原

### 第 1 轮：`--test tests/` 报 Cannot find module

**我**：先把测试跑起来看看。

**AI**：`npm test` 直接报 `Cannot find module`。定位为 Node 22 在 Windows 下把带尾斜杠的目录当作模块路径解析。

> 返工点：把命令从 `--test tests/` 改成 `--test tests/api.test.js`（package.json scripts）。

### 第 2 轮：`Body has already been read`

**我**：模块找到了，下一处又红了。

**AI**：用例先读 body 再断言时抛 `Body has already been read`——断言消息里的 `await res.text()` 无条件求值，提前消费了响应流。改为 `createOk` 先读 body 再断言。

> 返工点：响应流只能读一次，断言消息别夹带未 await 的读取。

### 第 3 轮：规则 2/3/5 连锁 409

**我**：单条能过，连跑就全撞 409。

**AI**：用例中途挂起会残留数据，下一轮共用互斥键全撞。加 `before` 钩子清空测试库 + 用例 `try/finally` 自清。

> 返工点：测试必须可重入——连跑多轮结果一致才算绿。

## 三、通过证据

- 3 处跑挂均为「改用例」修复，业务代码零改动；
- `npm test`：5 条业务规则全绿，且连跑可重入（`before` 清库 + 用例 `finally` 自清）；
- 为可测性做了微重构：`server.js` 抽 `if (require.main === module)` 守卫，测试自行 `listen(0)` 随机端口；`db.js` 加 `DB_FILE` 环境变量隔离测试库；
- CI（Gitee Go）：#2/#3/#5/#6 全绿，**#4 故意把断言从 409 改成 410 触发红色失败**，验证 CI 真能拦截回归。

## 四、反思

1. **测试反过来推动可测试性**：为写测试才给 `server.js` 加 `require.main` 守卫、给 `db.js` 加 `DB_FILE`——「为测而改」是 TDD 的副产品；
2. **CI 的价值是「能抓挂」不是「跑绿」**：讲「1 次红 + 4 次绿」比讲「5 次绿」更能证明 CI 在工作；
3. **Gitee Go 与 GitHub Actions 差异大**：commands 列表项不自动 `&&`、多行块报 schema 错、按分支发现 `.workflow/*.yml`、社区版通知不可达；
4. **AI 互评有边界**：AI 能挑出魔法数字等问题，但缺「他人视角」，有组员时优先真实互评。
