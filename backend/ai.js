// AI 查询助手：封装 DeepSeek 调用，Key 在服务端（环境变量 DEEPSEEK_API_KEY）
// 职责：接收用户自然语言问题 + 当前预约数据，调 DeepSeek 返回回答
// 失败兜底：Key 缺失 / 超时 / 额度用尽 / 网络错误，均返回带中文提示的 JSON
const https = require('https');

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const TIMEOUT_MS = 15000; // 超时 15 秒

// 把预约列表拼成上下文文本，供 LLM 基于真实数据回答
function buildContext(bookings) {
  if (!bookings || bookings.length === 0) {
    return '当前暂无任何预约记录，所有器材所有时段均空闲。';
  }
  const lines = bookings.map(b =>
    `- ${b.equipId} / ${b.date} / ${b.slot} / 预约人：${b.user}`
  );
  return '已有预约记录：\n' + lines.join('\n');
}

// 系统 prompt：约束 LLM 只回答预约相关问题，基于上下文数据
const SYSTEM_PROMPT = `你是一个教务器材预约助手。用户会用自然语言提问关于器材预约的问题。
你只能基于下方提供的预约数据回答，不要编造不存在的预约。
如果数据里没有相关信息，直接说"暂无相关预约记录"。
回答要简洁，直接给结论，不要解释推理过程。
可用器材：projector（投影仪）、camera（单反相机）、speaker（便携音响）。
时段：第1-2节 08:00-09:35、第3-4节 10:00-11:35、第5-6节 14:00-15:35、第7-8节 16:00-17:35、晚间 19:00-21:00。`;

/**
 * 调用 DeepSeek 回答用户预约问题
 * @param {string} question 用户自然语言问题
 * @param {Array} bookings 当前预约列表
 * @returns {Promise<{answer: string}>}
 * @throws {Error} code 字段标识失败类型：NO_KEY / TIMEOUT / QUOTA / AUTH / NETWORK
 */
function queryDeepSeek(question, bookings) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      const e = new Error('AI 服务未配置');
      e.code = 'NO_KEY';
      return reject(e);
    }

    const context = buildContext(bookings);
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${context}\n\n用户问题：${question}` }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const req = https.request(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: TIMEOUT_MS
    }, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        if (resp.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const answer = json.choices?.[0]?.message?.content || '（AI 返回了空回答）';
            resolve({ answer: answer.trim() });
          } catch (e) {
            const err = new Error('AI 响应解析失败');
            err.code = 'NETWORK';
            reject(err);
          }
        } else if (resp.statusCode === 429) {
          const err = new Error('AI 额度已用尽，请稍后再试');
          err.code = 'QUOTA';
          reject(err);
        } else if (resp.statusCode === 401 || resp.statusCode === 403) {
          const err = new Error('AI 服务配置错误（Key 无效）');
          err.code = 'AUTH';
          reject(err);
        } else {
          const err = new Error(`AI 服务异常（${resp.statusCode}）`);
          err.code = 'NETWORK';
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const e = new Error('AI 响应超时，请稍后再试');
      e.code = 'TIMEOUT';
      reject(e);
    });

    req.on('error', () => {
      const e = new Error('AI 服务暂不可用（网络错误）');
      e.code = 'NETWORK';
      reject(e);
    });

    req.write(body);
    req.end();
  });
}

module.exports = { queryDeepSeek };
