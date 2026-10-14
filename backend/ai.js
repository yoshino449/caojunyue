// AI 查询助手：封装 DeepSeek 调用，Key 在服务端（环境变量 DEEPSEEK_API_KEY）
// 职责：接收用户自然语言问题 + 当前预约数据，调 DeepSeek 返回回答
// 失败兜底：Key 缺失 / 超时 / 额度用尽 / 网络错误，均返回带中文提示的 JSON
const https = require('https');

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const TIMEOUT_MS = 15000; // 超时 15 秒

const ALL_EQUIPS = ['projector（投影仪）', 'camera（单反相机）', 'speaker（便携音响）'];
const ALL_SLOTS = [
  '第1-2节 08:00-09:35',
  '第3-4节 10:00-11:35',
  '第5-6节 14:00-15:35',
  '第7-8节 16:00-17:35',
  '晚间 19:00-21:00'
];

// 把预约列表拼成上下文文本，供 LLM 基于真实数据回答
// 额外列出器材全集 + 时段全集，让 LLM 能做"差集推理"（已有预约的补集 = 可用）
function buildContext(bookings) {
  const header = `【全部器材】\n${ALL_EQUIPS.map(e => `- ${e}`).join('\n')}\n\n【全部时段】\n${ALL_SLOTS.map(s => `- ${s}`).join('\n')}\n\n【已有预约记录】`;
  if (!bookings || bookings.length === 0) {
    return header + '\n（空）—— 所有器材所有时段均空闲。';
  }
  const lines = bookings.map(b =>
    `- ${b.equipId} / ${b.date} / ${b.slot} / 预约人：${b.user}`
  );
  return header + '\n' + lines.join('\n');
}

// 系统 prompt：约束 LLM 只回答预约相关问题，基于上下文数据
// 关键增强：教 LLM 做"差集推理"（已有预约的补集 = 可用时段）
const SYSTEM_PROMPT = `你是一个教务器材预约助手。用户会用自然语言提问关于器材预约的问题。

## 回答规则
1. 只能基于下方【已有预约记录】回答，不要编造不存在的预约。
2. 如果某器材某天某时段出现在预约列表里 → 该时段已被占用、不可约。
3. 如果某器材某天某时段**没有**出现在预约列表里 → 该时段可用（数据库只存已预约的，没出现 = 空闲）。
4. 用户问"明天上午投影仪"：先算明天日期（YYYY-MM-DD），再找该日 projector 的预约，没出现的时段就是可用时段。
5. 用户问"X月X日有投影仪吗"：同上，找该日该器材的预约，列出可用时段。
6. 用户问"我能预约"或"哪些日期可以约"：列出**全部器材 × 全部时段**中，预约列表里没出现的组合即可。
7. 不要说"无法判断"——数据是全量的，"没记录 = 空闲"是铁律。
8. 回答要简洁，直接给结论，不要解释推理过程。`;

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
        } else if (resp.statusCode === 402) {
          const err = new Error('AI 服务余额不足，请充值后再试');
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
