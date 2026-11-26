-- Owner-scoped snapshot versions let unchanged refreshes read one small row.
-- SQL triggers cover old clients, Axis imports and cascading personal-data writes.
CREATE TABLE planner_versions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1)
);
INSERT INTO planner_versions(user_id) SELECT id FROM users;
CREATE TRIGGER planner_versions_new_user AFTER INSERT ON users BEGIN
  INSERT INTO planner_versions(user_id) VALUES (NEW.id);
END;
CREATE TRIGGER planner_version_items_insert AFTER INSERT ON items BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_items_update AFTER UPDATE ON items
WHEN NEW.sync_revision <> OLD.sync_revision BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_items_delete AFTER DELETE ON items BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_classes_insert AFTER INSERT ON classes BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_classes_update AFTER UPDATE ON classes BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_classes_delete AFTER DELETE ON classes BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_task_templates_insert AFTER INSERT ON task_templates BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_task_templates_update AFTER UPDATE ON task_templates BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_task_templates_delete AFTER DELETE ON task_templates BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_class_resources_insert AFTER INSERT ON class_resources BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_class_resources_update AFTER UPDATE ON class_resources BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_class_resources_delete AFTER DELETE ON class_resources BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_planner_preferences_insert AFTER INSERT ON planner_preferences BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_planner_preferences_update AFTER UPDATE ON planner_preferences BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_planner_preferences_delete AFTER DELETE ON planner_preferences BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_goals_insert AFTER INSERT ON goals BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_goals_update AFTER UPDATE ON goals BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_goals_delete AFTER DELETE ON goals BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_habits_insert AFTER INSERT ON habits BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_habits_update AFTER UPDATE ON habits BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_habits_delete AFTER DELETE ON habits BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_habit_checkins_insert AFTER INSERT ON habit_checkins BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_habit_checkins_update AFTER UPDATE ON habit_checkins BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_habit_checkins_delete AFTER DELETE ON habit_checkins BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_notes_insert AFTER INSERT ON notes BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_notes_update AFTER UPDATE ON notes BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = NEW.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
CREATE TRIGGER planner_version_notes_delete AFTER DELETE ON notes BEGIN
  INSERT INTO planner_versions(user_id, revision)
    SELECT id, 1 FROM users WHERE id = OLD.user_id
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
