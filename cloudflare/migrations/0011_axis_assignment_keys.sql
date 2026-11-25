-- Axis can regenerate VEVENT UIDs on every fetch. Keep owner-scoped aliases and
-- exact source snapshots independently of editable task fields. Never delete tasks.
CREATE TABLE axis_assignment_keys (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identity_key TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, identity_key)
);
CREATE INDEX axis_assignment_keys_item ON axis_assignment_keys(user_id, item_id);
CREATE TRIGGER axis_assignment_keys_owner_insert BEFORE INSERT ON axis_assignment_keys
WHEN NOT EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'Axis assignment belongs to another user'); END;
CREATE TRIGGER axis_assignment_keys_owner_update BEFORE UPDATE ON axis_assignment_keys
WHEN NOT EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'Axis assignment belongs to another user'); END;
