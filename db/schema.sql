-- 预约表：互斥唯一键 equip_id + date + slot（对应 PRD F3 / 技术方案 §2）
CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  equip_id   TEXT    NOT NULL,              -- projector | camera | speaker
  user       TEXT    NOT NULL,              -- 预约人
  date       TEXT    NOT NULL,              -- YYYY-MM-DD
  slot       TEXT    NOT NULL,              -- 五个固定时段之一
  created_at INTEGER NOT NULL               -- 毫秒时间戳
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_equip_date_slot
  ON bookings (equip_id, date, slot);
