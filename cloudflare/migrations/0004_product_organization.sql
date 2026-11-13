-- Personal task organization. Existing tasks keep their deadlines and Axis bookkeeping.
ALTER TABLE items ADD COLUMN importance TEXT CHECK (importance IS NULL OR importance IN ('important', 'not_important'));
ALTER TABLE items ADD COLUMN urgency TEXT NOT NULL DEFAULT 'auto' CHECK (urgency IN ('auto', 'urgent', 'not_urgent'));

CREATE TABLE task_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (typeof(duration_minutes) = 'integer' AND duration_minutes BETWEEN 5 AND 1440),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  reminder_choice TEXT NOT NULL DEFAULT 'default' CHECK (reminder_choice IN ('default', 'off', '15', '60', '1440')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);
CREATE INDEX task_templates_user_idx ON task_templates(user_id, created_at) WHERE deleted_at IS NULL;

CREATE TABLE class_resources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  url TEXT NOT NULL CHECK (length(url) BETWEEN 1 AND 2048 AND (lower(substr(url, 1, 7)) = 'http://' OR lower(substr(url, 1, 8)) = 'https://')),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 60),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (typeof(sort_order) = 'integer' AND sort_order BETWEEN 0 AND 10000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);
CREATE INDEX class_resources_user_class_idx ON class_resources(user_id, class_id, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE planner_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  urgency_days INTEGER NOT NULL DEFAULT 2 CHECK (typeof(urgency_days) = 'integer' AND urgency_days BETWEEN 0 AND 30),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The same local planner may be retried with fresh remapped row IDs after a lost response.
-- Insert its receipt in the import transaction so retries cannot create a second copy.
CREATE TABLE planner_imports (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_key TEXT NOT NULL CHECK (length(import_key) = 64 AND lower(import_key) NOT GLOB '*[^0-9a-f]*'),
  imported INTEGER NOT NULL CHECK (imported >= 0),
  classes_added INTEGER NOT NULL CHECK (classes_added >= 0),
  templates_added INTEGER NOT NULL CHECK (templates_added >= 0),
  resources_added INTEGER NOT NULL CHECK (resources_added >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, import_key)
);

-- Ownership is enforced both by API filters and the schema, including imports.
CREATE TRIGGER task_templates_class_owner_insert BEFORE INSERT ON task_templates
WHEN NEW.class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.class_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'template class belongs to another user'); END;
CREATE TRIGGER task_templates_class_owner_update BEFORE UPDATE OF class_id, user_id ON task_templates
WHEN NEW.class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.class_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'template class belongs to another user'); END;
CREATE TRIGGER task_templates_owner_fixed BEFORE UPDATE OF user_id ON task_templates WHEN NEW.user_id IS NOT OLD.user_id
BEGIN SELECT RAISE(ABORT, 'templates cannot change owner'); END;

CREATE TRIGGER class_resources_class_owner_insert BEFORE INSERT ON class_resources
WHEN NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.class_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'resource class belongs to another user'); END;
CREATE TRIGGER class_resources_class_owner_update BEFORE UPDATE OF class_id, user_id ON class_resources
WHEN NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.class_id AND user_id = NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'resource class belongs to another user'); END;
CREATE TRIGGER class_resources_owner_fixed BEFORE UPDATE OF user_id ON class_resources WHEN NEW.user_id IS NOT OLD.user_id
BEGIN SELECT RAISE(ABORT, 'resources cannot change owner'); END;
CREATE TRIGGER planner_preferences_owner_fixed BEFORE UPDATE OF user_id ON planner_preferences WHEN NEW.user_id IS NOT OLD.user_id
BEGIN SELECT RAISE(ABORT, 'preferences cannot change owner'); END;
