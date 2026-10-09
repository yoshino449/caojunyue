// DELETE /api/bookings/:id → 204 删除成功 / 404 id 不存在或非正整数
// [id] 是 Pages Functions 路径参数语法，会注入到 context.params.id
import { deleteBooking } from '../../_lib/queries.js';

function jsonResponse(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestDelete({ params, env }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonResponse(404, { error: '预约不存在' });
  }
  const deleted = await deleteBooking(env, id);
  if (!deleted) return jsonResponse(404, { error: '预约不存在' });
  return new Response(null, { status: 204 });
}
