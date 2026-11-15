ALTER TABLE items ADD COLUMN task_details TEXT
  CHECK (task_details IS NULL OR json_valid(task_details));

ALTER TABLE items ADD COLUMN sync_revision INTEGER NOT NULL DEFAULT 0
  CHECK (sync_revision >= 0);

-- All writers, including Axis and old clients, participate in the same CAS
-- revision. The guard also prevents recursion when recursive_triggers is on.
CREATE TRIGGER items_sync_revision_after_update
AFTER UPDATE ON items
WHEN NEW.sync_revision = OLD.sync_revision
BEGIN
  UPDATE items SET sync_revision = OLD.sync_revision + 1 WHERE id = NEW.id;
END;
