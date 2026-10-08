// GET /api/stats → 两条聚合查询（perEquip + perSlot），供前端 Chart.js 渲染
import { getStats } from '../_lib/queries.js';

export async function onRequestGet({ env }) {
  const data = await getStats(env);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
