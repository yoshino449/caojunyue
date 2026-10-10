// /api/bookings：GET 列表 / POST 新建（对应 backend/server.js 路由分支）
// 入参校验与服务端一致（不信前端）；唯一索引冲突 → 409
import { listBookings, createBooking, BookingConflictError } from '../../_lib/queries.js';

// 合法取值与前端 index.html、backend/server.js 保持一致
const EQUIP_IDS = ['projector', 'camera', 'speaker'];
const SLOTS = [
  '第1-2节 08:00-09:35',
  '第3-4节 10:00-11:35',
  '第5-6节 14:00-15:35',
  '第7-8节 16:00-17:35',
  '晚间 19:00-21:00'
];

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 预约入参校验：返回 trim 后的字段；不合法返回错误信息（与 backend 一致）
function validateBooking(input) {
  const equipId = String(input.equipId || '').trim();
  const user = String(input.user || '').trim();
  const date = String(input.date || '').trim();
  const slot = String(input.slot || '').trim();
  if (!EQUIP_IDS.includes(equipId)) return { error: '器材标识不合法' };
  if (!user) return { error: '请填写预约人姓名' };
  if (user.length > 20) return { error: '预约人姓名最长 20 个字' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { error: '日期格式不合法' };
  if (date < todayStr()) return { error: '不能预约过去的日期' };
  if (!SLOTS.includes(slot)) return { error: '时段不合法' };
  return { value: { equipId, user, date, slot } };
}

function jsonResponse(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// GET /api/bookings → JSON 数组
export async function onRequestGet({ env }) {
  const data = await listBookings(env);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// POST /api/bookings → 201 创建成功 / 400 校验失败 / 409 互斥冲突
export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: 'JSON 格式错误' });
  }
  const checked = validateBooking(input);
  if (checked.error) return jsonResponse(400, { error: checked.error });
  try {
    const created = await createBooking(env, checked.value);
    return jsonResponse(201, created);
  } catch (e) {
    if (e instanceof BookingConflictError) return jsonResponse(409, { error: e.message });
    console.error(e);
    return jsonResponse(500, { error: '服务器内部错误' });
  }
}
