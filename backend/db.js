// 数据层：node:sqlite（Node ≥22 内置，启动需 --experimental-sqlite 标志，见 package.json）
// 零 npm 依赖；数据库文件：data/equipment.db（运行时生成，不手工编辑）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SCHEMA_SQL = path.join(ROOT, 'db', 'schema.sql');
const SEED_SQL = path.join(ROOT, 'db', 'seed.sql');

let db = null;

function openDb() {
  if (db) return db;
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    throw new Error('当前 Node 未启用 node:sqlite，请使用 npm start 启动（需要 --experimental-sqlite 标志，Node ≥ 22）');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // DB_FILE 环境变量可覆盖库文件名（tests/ 用独立 test.db 隔离开发数据）
  db = new DatabaseSync(path.join(DATA_DIR, process.env.DB_FILE || 'equipment.db'));
  return db;
}

// 幂等初始化：建表 + 示例数据（可重复执行）
function ensureDb() {
  const d = openDb();
  d.exec(fs.readFileSync(SCHEMA_SQL, 'utf8'));
  d.exec(fs.readFileSync(SEED_SQL, 'utf8'));
  return d;
}

function listBookings() {
  return openDb()
    .prepare('SELECT id, equip_id AS equipId, user, date, slot, created_at AS createdAt FROM bookings ORDER BY date, slot')
    .all();
}

// 唯一约束冲突：互斥键 equip_id+date+slot 被数据库层拒绝时抛出
class BookingConflictError extends Error {
  constructor(message) {
    super(message);
    this.code = 'BOOKING_CONFLICT';
  }
}

// 新建预约：参数化 SQL 防注入；命中 uk_equip_date_slot 唯一索引时抛 BookingConflictError
function createBooking({ equipId, user, date, slot }) {
  const createdAt = Date.now();
  try {
    const info = openDb()
      .prepare('INSERT INTO bookings (equip_id, user, date, slot, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(equipId, user, date, slot, createdAt);
    return { id: Number(info.lastInsertRowid), equipId, user, date, slot, createdAt };
  } catch (e) {
    if (String(e.code || '').includes('SQLITE_CONSTRAINT') || /UNIQUE constraint/i.test(String(e.message))) {
      throw new BookingConflictError('该器材在此时段已被预约，请更换日期或时段');
    }
    throw e;
  }
}

// 取消预约：按 id 删除，返回是否真的删到了（false → 路由层 404）
function deleteBooking(id) {
  const info = openDb().prepare('DELETE FROM bookings WHERE id = ?').run(id);
  return info.changes > 0;
}

// 预约统计：两条聚合查询，供前端图表渲染（聚合走服务端，前端不做计算）
function getStats() {
  const d = openDb();
  const perEquip = d
    .prepare('SELECT equip_id AS equipId, COUNT(*) AS count FROM bookings GROUP BY equip_id')
    .all();
  const perSlot = d
    .prepare('SELECT slot, COUNT(*) AS count FROM bookings GROUP BY slot')
    .all();
  return { perEquip, perSlot };
}

// 访问统计（T2）：单行计数器自增与读取；schema.sql 建表时已初始化 id=1,count=0
function incrementVisits() {
  openDb().prepare('UPDATE visits SET count = count + 1 WHERE id = 1').run();
}

function getVisits() {
  const row = openDb().prepare('SELECT count FROM visits WHERE id = 1').get();
  return { count: row ? row.count : 0 };
}

module.exports = { ensureDb, listBookings, createBooking, deleteBooking, getStats, incrementVisits, getVisits, BookingConflictError };
