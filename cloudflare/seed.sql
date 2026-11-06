-- Local/dev sample data: the planner's demo classes and tasks for one demo user.
-- Run with `npm run db:seed:local` after `npm run db:migrate:local`. Never run it against prod.
-- Sign in locally as demo@duckplan.test with the password duckplan-demo.

INSERT OR IGNORE INTO users (id, email, display_name, password_hash) VALUES
  ('d0c0d0c0-0000-4000-8000-000000000001', 'demo@duckplan.test', 'Demo Duck', 'pbkdf2-sha256$50000$rpclJ86oKVwPIm7JgVOMzQ$2B_tvCZ9oQt7EW20p8nqxVzelvPry7u_FWzsEMO-DLY');

INSERT OR IGNORE INTO classes (id, user_id, name, teacher, period, color, code) VALUES
  ('c1a55000-0000-4000-8000-000000000001', 'd0c0d0c0-0000-4000-8000-000000000001', 'Calculus', 'Ms. Nguyen', 'Period 2', '#538fc5', 'M'),
  ('c1a55000-0000-4000-8000-000000000002', 'd0c0d0c0-0000-4000-8000-000000000001', 'English', 'Mr. Ramirez', 'Period 4', '#d96f63', 'E'),
  ('c1a55000-0000-4000-8000-000000000003', 'd0c0d0c0-0000-4000-8000-000000000001', 'Physics', 'Dr. Shah', 'Period 5', '#7d6fbd', 'P'),
  ('c1a55000-0000-4000-8000-000000000004', 'd0c0d0c0-0000-4000-8000-000000000001', 'Computer Science', 'Ms. Chen', 'Period 7', '#3e946d', 'CS'),
  ('c1a55000-0000-4000-8000-000000000005', 'd0c0d0c0-0000-4000-8000-000000000001', 'Personal', 'Personal', 'Anytime', '#c48b34', '★');

INSERT OR IGNORE INTO items (id, user_id, class_id, type, title, priority, due_date, due_time, scheduled_start, duration_minutes, completed) VALUES
  ('17e00000-0000-4000-8000-000000000001', 'd0c0d0c0-0000-4000-8000-000000000001', 'c1a55000-0000-4000-8000-000000000001', 'task', 'Finish calculus practice set', 'high', date('now', 'localtime'), '17:00', date('now', 'localtime') || 'T15:30', 60, 0),
  ('17e00000-0000-4000-8000-000000000002', 'd0c0d0c0-0000-4000-8000-000000000001', 'c1a55000-0000-4000-8000-000000000002', 'task', 'Submit reading response', 'medium', date('now', 'localtime'), '20:00', NULL, 45, 0),
  ('17e00000-0000-4000-8000-000000000003', 'd0c0d0c0-0000-4000-8000-000000000001', 'c1a55000-0000-4000-8000-000000000003', 'task', 'Organize lab notes', 'medium', date('now', 'localtime', '+1 day'), '09:00', date('now', 'localtime', '+1 day') || 'T07:45', 45, 0),
  ('17e00000-0000-4000-8000-000000000004', 'd0c0d0c0-0000-4000-8000-000000000001', 'c1a55000-0000-4000-8000-000000000004', 'task', 'Review app wireframe', 'low', date('now', 'localtime', '+2 day'), '14:15', date('now', 'localtime', '+1 day') || 'T16:00', 60, 0),
  ('17e00000-0000-4000-8000-000000000005', 'd0c0d0c0-0000-4000-8000-000000000001', 'c1a55000-0000-4000-8000-000000000002', 'task', 'Study vocabulary cards', 'medium', date('now', 'localtime', '+3 day'), '16:00', NULL, 30, 0),
  ('17e00000-0000-4000-8000-000000000006', 'd0c0d0c0-0000-4000-8000-000000000001', 'c1a55000-0000-4000-8000-000000000003', 'test', 'Complete motion quiz', 'high', date('now', 'localtime', '-1 day'), '12:30', NULL, 45, 0),
  ('17e00000-0000-4000-8000-000000000007', 'd0c0d0c0-0000-4000-8000-000000000001', 'c1a55000-0000-4000-8000-000000000005', 'task', 'Pack materials for Monday', 'low', date('now', 'localtime'), '20:00', NULL, 30, 1);
