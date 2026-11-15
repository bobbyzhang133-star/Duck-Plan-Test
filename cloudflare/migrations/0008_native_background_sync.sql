-- Device tokens remain private to the native transport/server. Pushes contain only
-- an invalidation hint; the device fetches its current authenticated snapshot.
CREATE TABLE native_push_devices (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  token TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_push_at INTEGER,
  last_ack_generation INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  PRIMARY KEY (user_id, installation_id),
  UNIQUE (environment, token)
);
CREATE INDEX native_push_devices_user ON native_push_devices(user_id);
CREATE TABLE native_sync_outbox (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL DEFAULT 1,
  changed_at INTEGER NOT NULL,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER native_sync_item_insert AFTER INSERT ON items BEGIN
  INSERT INTO native_sync_outbox(user_id, changed_at)
    SELECT NEW.user_id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET generation = generation + 1,
      changed_at = excluded.changed_at, next_attempt_at = 0, attempts = 0;
END;
-- 0007 bumps revisions in a nested update. Queue that update once, rather than
-- both the original write and the revision trigger's write.
CREATE TRIGGER native_sync_item_update AFTER UPDATE ON items
WHEN NEW.sync_revision <> OLD.sync_revision BEGIN
  INSERT INTO native_sync_outbox(user_id, changed_at)
    SELECT NEW.user_id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET generation = generation + 1,
      changed_at = excluded.changed_at, next_attempt_at = 0, attempts = 0;
END;
CREATE TRIGGER native_sync_item_delete AFTER DELETE ON items BEGIN
  INSERT INTO native_sync_outbox(user_id, changed_at)
    SELECT OLD.user_id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET generation = generation + 1,
      changed_at = excluded.changed_at, next_attempt_at = 0, attempts = 0;
END;
