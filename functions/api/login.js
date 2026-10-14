// /api/login：登录校验（对应 backend/server.js POST /api/login）
// D1 数据库 users 表需同步 schema.sql（CREATE TABLE users + INSERT OR IGNORE）
import { getUsers, checkLogin } from '../_lib/queries.js';

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: 'JSON 格式错误' });
  }
  const username = String(input.username || '').trim();
  const password = String(input.password || '').trim();
  if (!username || !password) return jsonResponse(400, { error: '请填写用户名和密码' });

  if (await checkLogin(env, username, password)) {
    return jsonResponse(200, { ok: true, username });
  }
  return jsonResponse(401, { ok: false, error: '用户名或密码错误' });
}

function jsonResponse(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
