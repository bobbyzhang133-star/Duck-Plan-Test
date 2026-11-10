CREATE TABLE push_devices (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX push_devices_user ON push_devices(user_id);
CREATE TABLE task_alarms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  fire_at INTEGER NOT NULL,
  time_zone TEXT NOT NULL,
  UNIQUE(user_id, item_id)
);
CREATE INDEX task_alarms_due ON task_alarms(fire_at);
CREATE TABLE alarm_deliveries (
  alarm_id TEXT NOT NULL REFERENCES task_alarms(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL REFERENCES push_devices(endpoint) ON DELETE CASCADE,
  claimed_at INTEGER NOT NULL,
  accepted_at INTEGER,
  shown_at INTEGER,
  PRIMARY KEY(alarm_id, endpoint)
);
