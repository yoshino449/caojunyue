// GET /api/visits → 返回 {count}，前端页脚启动时拉取展示
import { getVisits } from '../_lib/queries.js';

export async function onRequestGet({ env }) {
  const data = await getVisits(env);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
