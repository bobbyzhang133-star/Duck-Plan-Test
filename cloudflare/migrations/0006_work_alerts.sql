-- NULL preserves existing tasks without activating reminders on upgrade.
ALTER TABLE items ADD COLUMN work_alerts TEXT CHECK (work_alerts IS NULL OR json_valid(work_alerts));
