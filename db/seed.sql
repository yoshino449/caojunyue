-- 示例数据：幂等（重复执行自动跳过）
-- 两条同时段、不同器材：演示互斥范围仅限"同器材+同日期+同时段"（PRD AC4）
-- 注意：date('now') 按 UTC 计算，与本地日期可能相差一天，仅作演示数据
INSERT OR IGNORE INTO bookings (equip_id, user, date, slot, created_at) VALUES
  ('projector', '示例-张三', date('now', '+1 day'), '第1-2节 08:00-09:35', CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('camera',    '示例-李四', date('now', '+1 day'), '第1-2节 08:00-09:35', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
