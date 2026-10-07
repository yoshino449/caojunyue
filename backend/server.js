// 后端入口：Node 原生 http，零 npm 依赖（对应 docs/技术方案.md §1）
// 职责：健康检查 /ping、预约列表 /api/bookings、静态托管 ../frontend
const http = require('http');
const fs = require('fs');
const path = require('path');

const { ensureDb, listBookings } = require('./db');

const PORT = 3000;
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

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

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  // 健康检查（骨架验收接口）
  if (req.method === 'GET' && (pathname === '/ping' || pathname === '/api/ping')) {
    return send(res, 200, 'ok');
  }

  // 预约列表：证明数据库已打通；v2 在此扩展判重写入 POST /api/bookings
  if (req.method === 'GET' && pathname === '/api/bookings') {
    return send(res, 200, JSON.stringify(listBookings()), 'application/json; charset=utf-8');
  }

  // 静态托管 frontend/
  if (req.method === 'GET') {
    const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
    const fp = path.resolve(FRONTEND_DIR, rel);
    if (fp !== FRONTEND_DIR && !fp.startsWith(FRONTEND_DIR + path.sep)) {
      return send(res, 403, 'Forbidden'); // 防目录穿越
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
server.listen(PORT, () => {
  console.log(`教务器材预约后端已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/ping`);
});
