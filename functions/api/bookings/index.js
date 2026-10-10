// /api/bookings：GET 列表 / POST 新建（对应 backend/server.js 路由分支）
// POST body 含 ai=true 时走 AI 预约查询助手（复用现有路由，因 Cloudflare Pages 不识别新增 Function 文件/方法）
// 入参校验与服务端一致（不信前端）；唯一索引冲突 → 409
import { listBookings, createBooking, BookingConflictError } from '../../_lib/queries.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const AI_TIMEOUT_MS = 15000;

const AI_SYSTEM_PROMPT = `你是一个教务器材预约助手。用户会用自然语言提问关于器材预约的问题。
你只能基于下方提供的预约数据回答，不要编造不存在的预约。
如果数据里没有相关信息，直接说"暂无相关预约记录"。
回答要简洁，直接给结论，不要解释推理过程。
可用器材：projector（投影仪）、camera（单反相机）、speaker（便携音响）。
时段：第1-2节 08:00-09:35、第3-4节 10:00-11:35、第5-6节 14:00-15:35、第7-8节 16:00-17:35、晚间 19:00-21:00。`;

function buildAiContext(bookings) {
  if (!bookings || bookings.length === 0) return '当前暂无任何预约记录，所有器材所有时段均空闲。';
  const lines = bookings.map(b => `- ${b.equipId} / ${b.date} / ${b.slot} / 预约人：${b.user}`);
  return '已有预约记录：\n' + lines.join('\n');
}

async function handleAiQuery(env, question) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return jsonResponse(503, { error: 'AI 服务未配置', code: 'NO_KEY' });
  const bookings = await listBookings(env);
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: `${buildAiContext(bookings)}\n\n用户问题：${question}` }
    ],
    temperature: 0.3,
    max_tokens: 500
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body, signal: controller.signal
    });
    clearTimeout(timer);
    if (resp.status === 200) {
      const json = await resp.json();
      const answer = json.choices?.[0]?.message?.content || '（AI 返回了空回答）';
      return jsonResponse(200, { answer: answer.trim() });
    } else if (resp.status === 429) return jsonResponse(429, { error: 'AI 额度已用尽，请稍后再试', code: 'QUOTA' });
    else if (resp.status === 402) return jsonResponse(503, { error: 'AI 服务余额不足，请充值后再试', code: 'QUOTA' });
    else if (resp.status === 401 || resp.status === 403) return jsonResponse(503, { error: 'AI 服务配置错误（Key 无效）', code: 'AUTH' });
    return jsonResponse(503, { error: `AI 服务异常（${resp.status}）`, code: 'NETWORK' });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') return jsonResponse(504, { error: 'AI 响应超时，请稍后再试', code: 'TIMEOUT' });
    return jsonResponse(503, { error: 'AI 服务暂不可用（网络错误）', code: 'NETWORK' });
  }
}

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
// body 含 ai=true 时走 AI 查询助手分支
export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: 'JSON 格式错误' });
  }
  // AI 查询助手分支：body.ai === true
  if (input.ai === true) {
    const question = String(input.question || '').trim();
    if (!question) return jsonResponse(400, { error: '请输入问题' });
    if (question.length > 200) return jsonResponse(400, { error: '问题最长 200 个字' });
    return handleAiQuery(env, question);
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
