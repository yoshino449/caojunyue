// GET /：自增访问计数 + 返回 frontend/index.html（对应 backend/server.js §静态托管分支）
// env.ASSETS 是 Pages 自动注入的静态资源 binding，仅线上 / wrangler pages dev 存在
import { incrementVisits } from './_lib/queries.js';

export async function onRequestGet({ request, env }) {
  // 访问计数自增（与 backend 一致：只计根路径，不计静态资源与 API；这里就是根路径）
  try {
    await incrementVisits(env);
  } catch (e) {
    // 计数失败不阻塞首页渲染（与 backend 一致：console.error 后继续）
    console.error('访问计数失败', e);
  }
  // 让 Pages 内置静态资源服务返回 frontend/index.html
  return env.ASSETS.fetch(new Request(new URL('/', request.url)));
}
