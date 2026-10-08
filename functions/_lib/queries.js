// Cloudflare D1 数据访问层（ESM，对应 docs/技术方案.md §11.4）
// 签名与 backend/db.js 完全对齐，差别仅在内部：用 env.DB（D1 异步 API）替代 node:sqlite（同步）
// SQL 字符串集中放此文件，各 Function 只 import 调用，不散 SQL

// 互斥唯一约束冲突：D1 命中 uk_equip_date_slot 时抛出（与 backend/db.js 一致）
export class BookingConflictError extends Error {
  constructor(message) {
    super(message);
    this.code = 'BOOKING_CONFLICT';
  }
}

// 预约列表：date/slot 升序，字段名 camelCase 化
export async function listBookings(env) {
  const { results } = await env.DB
    .prepare('SELECT id, equip_id AS equipId, user, date, slot, created_at AS createdAt FROM bookings ORDER BY date, slot')
    .all();
  return results;
}

// 新建预约：参数化 SQL 防注入；唯一索引冲突 → 抛 BookingConflictError（路由层转 409）
export async function createBooking(env, { equipId, user, date, slot }) {
  const createdAt = Date.now();
  try {
    const { meta } = await env.DB
      .prepare('INSERT INTO bookings (equip_id, user, date, slot, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(equipId, user, date, slot, createdAt)
      .run();
    // D1 用 meta.last_row_id 替代 node:sqlite 的 lastInsertRowid
    return { id: Number(meta.last_row_id), equipId, user, date, slot, createdAt };
  } catch (e) {
    // D1 唯一约束错误仍包含 UNIQUE constraint 字样（SQLite 方言一致）
    const msg = String(e?.message || '');
    if (msg.includes('SQLITE_CONSTRAINT_UNIQUE') || /UNIQUE constraint/i.test(msg)) {
      throw new BookingConflictError('该器材在此时段已被预约，请更换日期或时段');
    }
    throw e;
  }
}

// 取消预约：按 id 删除，返回是否真的删到了（false → 路由层 404）
export async function deleteBooking(env, id) {
  const { meta } = await env.DB
    .prepare('DELETE FROM bookings WHERE id = ?')
    .bind(id)
    .run();
  return meta.changes > 0;
}

// 预约统计：两条聚合查询，供前端 Chart.js 渲染（聚合走服务端，前端不做计算）
export async function getStats(env) {
  const perEquipResult = await env.DB
    .prepare('SELECT equip_id AS equipId, COUNT(*) AS count FROM bookings GROUP BY equip_id')
    .all();
  const perSlotResult = await env.DB
    .prepare('SELECT slot, COUNT(*) AS count FROM bookings GROUP BY slot')
    .all();
  return { perEquip: perEquipResult.results, perSlot: perSlotResult.results };
}

// 访问计数自增：schema.sql 建表时已初始化 id=1, count=0
export async function incrementVisits(env) {
  await env.DB
    .prepare('UPDATE visits SET count = count + 1 WHERE id = 1')
    .run();
}

// 访问计数读取
// 注意：D1 prepared statement 用 .first() 取单行（不是 node:sqlite 的 .get()）
export async function getVisits(env) {
  const row = await env.DB
    .prepare('SELECT count FROM visits WHERE id = 1')
    .first();
  return { count: row ? row.count : 0 };
}
