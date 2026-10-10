// POST /api/ai/query → AI 预约查询助手（DeepSeek，Key 在服务端 env.DEEPSEEK_API_KEY）
// 失败兜底：Key 缺失 / 超时 / 额度用尽 / 网络错误，返回中文提示
import { listBookings } from '../../_lib/queries.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const TIMEOUT_MS = 15000;

const SYSTEM_PROMPT = `你是一个教务器材预约助手。用户会用自然语言提问关于器材预约的问题。
你只能基于下方提供的预约数据回答，不要编造不存在的预约。
如果数据里没有相关信息，直接说"暂无相关预约记录"。
回答要简洁，直接给结论，不要解释推理过程。
可用器材：projector（投影仪）、camera（单反相机）、speaker（便携音响）。
时段：第1-2节 08:00-09:35、第3-4节 10:00-11:35、第5-6节 14:00-15:35、第7-8节 16:00-17:35、晚间 19:00-21:00。`;

function buildContext(bookings) {
  if (!bookings || bookings.length === 0) {
    return '当前暂无任何预约记录，所有器材所有时段均空闲。';
  }
  const lines = bookings.map(b =>
    `- ${b.equipId} / ${b.date} / ${b.slot} / 预约人：${b.user}`
  );
  return '已有预约记录：\n' + lines.join('\n');
}

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON 格式错误' }), {
      status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const question = String(input.question || '').trim();
  if (!question) return jsonRes(400, { error: '请输入问题' });
  if (question.length > 200) return jsonRes(400, { error: '问题最长 200 个字' });

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return jsonRes(503, { error: 'AI 服务未配置', code: 'NO_KEY' });

  const bookings = await listBookings(env);
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${buildContext(bookings)}\n\n用户问题：${question}` }
    ],
    temperature: 0.3,
    max_tokens: 500
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (resp.status === 200) {
      const json = await resp.json();
      const answer = json.choices?.[0]?.message?.content || '（AI 返回了空回答）';
      return jsonRes(200, { answer: answer.trim() });
    } else if (resp.status === 429) {
      return jsonRes(429, { error: 'AI 额度已用尽，请稍后再试', code: 'QUOTA' });
    } else if (resp.status === 402) {
      return jsonRes(503, { error: 'AI 服务余额不足，请充值后再试', code: 'QUOTA' });
    } else if (resp.status === 401 || resp.status === 403) {
      return jsonRes(503, { error: 'AI 服务配置错误（Key 无效）', code: 'AUTH' });
    }
    return jsonRes(503, { error: `AI 服务异常（${resp.status}）`, code: 'NETWORK' });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return jsonRes(504, { error: 'AI 响应超时，请稍后再试', code: 'TIMEOUT' });
    }
    return jsonRes(503, { error: 'AI 服务暂不可用（网络错误）', code: 'NETWORK' });
  }
}

function jsonRes(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
