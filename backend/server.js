// 后端入口：Node 原生 http，零 npm 依赖（对应 docs/技术方案.md §1）
// 职责：健康检查 /ping、预约列表 /api/bookings、静态托管 ../frontend
const http = require('http');
const fs = require('fs');
const path = require('path');

const { ensureDb, listBookings, createBooking, deleteBooking, getStats, incrementVisits, getVisits, BookingConflictError } = require('./db');
const { queryDeepSeek } = require('./ai');

const PORT = process.env.PORT || 3000;   // Render 注入 PORT 环境变量；本地默认 3000
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

// 合法取值与前端 index.html 保持一致（服务端再校一遍，不信前端）
const EQUIP_IDS = ['projector', 'camera', 'speaker'];
const SLOTS = [
  '第1-2节 08:00-09:35',
  '第3-4节 10:00-11:35',
  '第5-6节 14:00-15:35',
  '第7-8节 16:00-17:35',
  '晚间 19:00-21:00'
];

// 简易 MIME 表（静态托管用）
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

// 读取并解析 JSON 请求体（限制 8KB，防大包）
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 8 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(new Error('JSON 格式错误'));
      }
    });
    req.on('error', reject);
  });
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 预约入参校验：返回 trim 后的字段；不合法返回错误信息
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

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  // 健康检查（骨架验收接口）
  if (req.method === 'GET' && (pathname === '/ping' || pathname === '/api/ping')) {
    return send(res, 200, 'ok');
  }

  // 预约列表
  if (req.method === 'GET' && pathname === '/api/bookings') {
    return send(res, 200, JSON.stringify(listBookings()), 'application/json; charset=utf-8');
  }

  // 预约统计：两条聚合查询，供前端 Chart.js 图表渲染
  if (req.method === 'GET' && pathname === '/api/stats') {
    return send(res, 200, JSON.stringify(getStats()), 'application/json; charset=utf-8');
  }

  // 访问统计（T2）：返回当前页面访问计数
  if (req.method === 'GET' && pathname === '/api/visits') {
    return send(res, 200, JSON.stringify(getVisits()), 'application/json; charset=utf-8');
  }

  // 新建预约：校验 → 写入；唯一索引冲突 → 409（互斥规则在数据库层兜底）
  if (req.method === 'POST' && pathname === '/api/bookings') {
    return readJsonBody(req)
      .then(input => {
        const checked = validateBooking(input);
        if (checked.error) return sendJson(res, 400, { error: checked.error });
        try {
          const created = createBooking(checked.value);
          return sendJson(res, 201, created);
        } catch (e) {
          if (e instanceof BookingConflictError) return sendJson(res, 409, { error: e.message });
          console.error(e);
          return sendJson(res, 500, { error: '服务器内部错误' });
        }
      })
      .catch(err => sendJson(res, 400, { error: err.message }));
  }

  // AI 预约查询助手：Key 在服务端，失败兜底（无Key/超时/额度/网络）
  // 路径用 /api/bookings/ai（复用 bookings 路由前缀，因 Cloudflare Pages 不识别新增 Function 文件）
  if (req.method === 'POST' && pathname === '/api/bookings/ai') {
    return readJsonBody(req)
      .then(input => {
        const question = String(input.question || '').trim();
        if (!question) return sendJson(res, 400, { error: '请输入问题' });
        if (question.length > 200) return sendJson(res, 400, { error: '问题最长 200 个字' });
        return queryDeepSeek(question, listBookings())
          .then(result => sendJson(res, 200, result))
          .catch(err => {
            // 失败兜底：按错误类型返回对应状态码与中文提示
            const statusMap = { NO_KEY: 503, TIMEOUT: 504, QUOTA: 429, AUTH: 503, NETWORK: 503 };
            const status = statusMap[err.code] || 503;
            return sendJson(res, status, { error: err.message, code: err.code });
          });
      })
      .catch(err => sendJson(res, 400, { error: err.message }));
  }

  // 取消预约：删除成功 204；id 不存在 / 非正整数 → 404
  if (req.method === 'DELETE' && pathname.startsWith('/api/bookings/')) {
    const id = Number(pathname.slice('/api/bookings/'.length));
    if (!Number.isInteger(id) || id <= 0) return sendJson(res, 404, { error: '预约不存在' });
    return deleteBooking(id)
      ? send(res, 204, '')
      : sendJson(res, 404, { error: '预约不存在' });
  }

  // 静态托管 frontend/；访问根页面（GET /）时计一次访问数（不计静态资源与 API）
  if (req.method === 'GET') {
    const isRoot = pathname === '/';
    const rel = isRoot ? 'index.html' : pathname.slice(1);
    const fp = path.resolve(FRONTEND_DIR, rel);
    if (fp !== FRONTEND_DIR && !fp.startsWith(FRONTEND_DIR + path.sep)) {
      return send(res, 403, 'Forbidden'); // 防目录穿越
    }
    if (isRoot) {
      // 访问统计是辅助功能，失败不应影响首页可用；故静默 catch 仅记日志
      try { incrementVisits(); } catch (e) { console.error('访问计数失败', e); }
    }
    fs.readFile(fp, (err, data) => {
      if (err) return send(res, 404, 'Not Found');
      send(res, 200, data, MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream');
    });
    return;
  }

  send(res, 405, 'Method Not Allowed');
});

ensureDb(); // 启动即保证数据库就绪（幂等：建表 + 示例数据）
// 仅直接运行（npm start）时监听端口；被 tests/ require 时由测试自行 listen(0) 随机端口
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`教务器材预约后端已启动: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/ping`);
  });
}

module.exports = server;
