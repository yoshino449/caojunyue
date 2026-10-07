// 手动初始化数据库（幂等）：npm run db:init
const { ensureDb, listBookings } = require('./db');

ensureDb();
console.log(`数据库就绪，当前预约 ${listBookings().length} 条`);
