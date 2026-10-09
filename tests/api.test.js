// T1 接口测试：5 条关键业务规则（人列规则，AI 生成用例）
// 运行：npm test（node --experimental-sqlite --test tests/api.test.js，零 npm 依赖，用 Node 22 内置 node:test）
// 隔离：独立测试库 data/test.db（DB_FILE 环境变量，须在 require server 前设置），不碰开发数据
// DB_FILE 是文件名（不是路径），由 backend/db.js 在 openDb() 里 path.join(DATA_DIR, DB_FILE) 解析到 data/ 下；
// 故此处赋值 'test.db' 即落到 data/test.db，与开发库 data/equipment.db 隔离
process.env.DB_FILE = 'test.db';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const server = require('../backend/server');

const SLOT1 = '第1-2节 08:00-09:35';
const SLOT2 = '第3-4节 10:00-11:35';
const TEST_DB = path.join(__dirname, '..', 'data', 'test.db');

let base; // 测试服务地址（随机端口）

// 未来日期（默认 +30 天）：30 远离 seed 用的"明天"固定日期，也避开"过去日期"拦截；
// 即便 seed 改用其他日期，+30 也足够拉开距离，5 条规则间互不撞单
function futureDate(days = 30) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function postBooking(body) {
  return fetch(`${base}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function deleteBooking(id) {
  return fetch(`${base}/api/bookings/${id}`, { method: 'DELETE' });
}

// 建一条预约并断言 201，返回 id（供用例内自建自清）
async function createOk(body) {
  const res = await postBooking(body);
  const data = await res.json(); // 先读 body 再断言：断言消息里读 body 会提前消费流
  assert.strictEqual(res.status, 201, `建预约失败：${res.status} ${JSON.stringify(data)}`);
  return data.id;
}

test.before(async () => {
  // 清空测试库 bookings 表（require server 时已 ensureDb 建表），保证测试可重入：
  // 上轮跑挂残留的数据不会污染本轮
  const { DatabaseSync } = require('node:sqlite');
  const tdb = new DatabaseSync(TEST_DB);
  tdb.exec('DELETE FROM bookings');
  tdb.close();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  // 尽力删除测试库；Windows 上 SQLite 连接未关闭时可能删不掉，残留无害（下轮 before 会清表）
  try { fs.unlinkSync(TEST_DB); } catch { /* 忽略 */ }
});

test('规则1 同器材+同日+同时段 → 拒绝（409）', async () => {
  const body = { equipId: 'speaker', user: '测试-规则1', date: futureDate(), slot: SLOT1 };
  const id = await createOk(body); // 第一次：占坑成功
  try {
    const res = await postBooking(body); // 第二次：同键撞单
    assert.strictEqual(res.status, 409);
    assert.match((await res.json()).error, /已被预约/);
  } finally {
    await deleteBooking(id); // 清理
  }
});

test('规则2 换时段（同器材同日）→ 允许（201）', async () => {
  const base1 = { equipId: 'speaker', user: '测试-规则2', date: futureDate() };
  const id1 = await createOk({ ...base1, slot: SLOT1 });
  try {
    const id2 = await createOk({ ...base1, slot: SLOT2 }); // 同器材同日换时段
    await deleteBooking(id2);
  } finally {
    await deleteBooking(id1);
  }
});

test('规则3 换器材（同日同时段）→ 允许（201）', async () => {
  const base1 = { user: '测试-规则3', date: futureDate(), slot: SLOT1 };
  const id1 = await createOk({ ...base1, equipId: 'speaker' });
  try {
    const id2 = await createOk({ ...base1, equipId: 'camera' }); // 同日同时段换器材
    await deleteBooking(id2);
  } finally {
    await deleteBooking(id1);
  }
});

test('规则4 过去日期 → 拒绝（400）', async () => {
  const res = await postBooking({ equipId: 'speaker', user: '测试-规则4', date: '2020-01-01', slot: SLOT1 });
  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /过去/);
});

test('规则5 取消后时段释放 → 可重约（DELETE 204 → POST 201）', async () => {
  const body = { equipId: 'speaker', user: '测试-规则5', date: futureDate(), slot: SLOT1 };
  const id1 = await createOk(body); // 占坑
  const del = await deleteBooking(id1); // 取消
  assert.strictEqual(del.status, 204);
  const id2 = await createOk(body); // 同时段重约成功
  await deleteBooking(id2); // 清理
});
