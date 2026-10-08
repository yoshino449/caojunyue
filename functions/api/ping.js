// GET /api/ping → 返回 'ok'（与 backend/server.js 一致，验收基线接口）
export async function onRequestGet() {
  return new Response('ok', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
