-- Saved goals, habits and personal notes. These are separate from assignment notes.
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  target_count INTEGER NOT NULL DEFAULT 5 CHECK (typeof(target_count) = 'integer' AND target_count BETWEEN 1 AND 100000),
  current_count INTEGER NOT NULL DEFAULT 0 CHECK (typeof(current_count) = 'integer' AND current_count BETWEEN 0 AND 100000),
  unit TEXT NOT NULL DEFAULT 'sessions' CHECK (length(trim(unit)) BETWEEN 1 AND 30),
  deadline_date TEXT CHECK (deadline_date IS NULL OR (length(deadline_date) = 10 AND date(deadline_date) IS deadline_date)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);
CREATE INDEX goals_user_idx ON goals(user_id, created_at) WHERE deleted_at IS NULL;

CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  repeat_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]' CHECK (json_valid(repeat_days) AND json_type(repeat_days) = 'array' AND json_array_length(repeat_days) BETWEEN 1 AND 7),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);
CREATE INDEX habits_user_idx ON habits(user_id, created_at) WHERE deleted_at IS NULL;
CREATE TRIGGER habits_days_insert BEFORE INSERT ON habits
WHEN EXISTS (SELECT 1 FROM json_each(NEW.repeat_days) WHERE type != 'integer' OR value < 0 OR value > 6)
  OR (SELECT count(DISTINCT value) FROM json_each(NEW.repeat_days)) != json_array_length(NEW.repeat_days)
BEGIN SELECT RAISE(ABORT, 'habit repeat days are invalid'); END;
CREATE TRIGGER habits_days_update BEFORE UPDATE OF repeat_days ON habits
WHEN EXISTS (SELECT 1 FROM json_each(NEW.repeat_days) WHERE type != 'integer' OR value < 0 OR value > 6)
  OR (SELECT count(DISTINCT value) FROM json_each(NEW.repeat_days)) != json_array_length(NEW.repeat_days)
BEGIN SELECT RAISE(ABORT, 'habit repeat days are invalid'); END;

CREATE TABLE habit_checkins (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (length(date) = 10 AND date(date) IS date),
  completed INTEGER NOT NULL DEFAULT 1 CHECK (completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  PRIMARY KEY (user_id, habit_id, date)
);
CREATE INDEX habit_checkins_user_idx ON habit_checkins(user_id, date) WHERE deleted_at IS NULL;
CREATE TRIGGER habit_checkins_owner_insert BEFORE INSERT ON habit_checkins
WHEN NOT EXISTS (SELECT 1 FROM habits WHERE id = NEW.habit_id AND user_id = NEW.user_id AND (NEW.deleted_at IS NOT NULL OR deleted_at IS NULL))
BEGIN SELECT RAISE(ABORT, 'checkin habit is not owned or active'); END;
CREATE TRIGGER habit_checkins_owner_update BEFORE UPDATE OF user_id, habit_id, deleted_at ON habit_checkins
WHEN NOT EXISTS (SELECT 1 FROM habits WHERE id = NEW.habit_id AND user_id = NEW.user_id AND (NEW.deleted_at IS NOT NULL OR deleted_at IS NULL))
BEGIN SELECT RAISE(ABORT, 'checkin habit is not owned or active'); END;
CREATE TRIGGER habit_checkins_owner_fixed BEFORE UPDATE OF user_id ON habit_checkins WHEN NEW.user_id IS NOT OLD.user_id
BEGIN SELECT RAISE(ABORT, 'checkins cannot change owner'); END;
CREATE TRIGGER habits_clear_checkins AFTER UPDATE OF deleted_at ON habits
WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
BEGIN UPDATE habit_checkins SET completed = 0, deleted_at = NEW.deleted_at, updated_at = NEW.updated_at
  WHERE habit_id = NEW.id AND user_id = NEW.user_id AND deleted_at IS NULL; END;

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  category TEXT NOT NULL DEFAULT 'Personal' CHECK (length(category) <= 60),
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 5000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);
CREATE INDEX notes_user_idx ON notes(user_id, created_at) WHERE deleted_at IS NULL;

CREATE TRIGGER goals_owner_fixed BEFORE UPDATE OF user_id ON goals WHEN NEW.user_id IS NOT OLD.user_id
BEGIN SELECT RAISE(ABORT, 'goals cannot change owner'); END;
CREATE TRIGGER habits_owner_fixed BEFORE UPDATE OF user_id ON habits WHEN NEW.user_id IS NOT OLD.user_id
BEGIN SELECT RAISE(ABORT, 'habits cannot change owner'); END;
CREATE TRIGGER notes_owner_fixed BEFORE UPDATE OF user_id ON notes WHEN NEW.user_id IS NOT OLD.user_id
BEGIN SELECT RAISE(ABORT, 'notes cannot change owner'); END;

ALTER TABLE planner_imports ADD COLUMN goals_added INTEGER NOT NULL DEFAULT 0 CHECK (goals_added >= 0);
ALTER TABLE planner_imports ADD COLUMN habits_added INTEGER NOT NULL DEFAULT 0 CHECK (habits_added >= 0);
ALTER TABLE planner_imports ADD COLUMN habit_checkins_added INTEGER NOT NULL DEFAULT 0 CHECK (habit_checkins_added >= 0);
ALTER TABLE planner_imports ADD COLUMN notes_added INTEGER NOT NULL DEFAULT 0 CHECK (notes_added >= 0);
ALTER TABLE planner_imports ADD COLUMN personal_present INTEGER NOT NULL DEFAULT 0 CHECK (personal_present IN (0, 1));
