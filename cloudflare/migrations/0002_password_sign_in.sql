-- Sign-in without email: passwords plus a one-time recovery code replace magic links, so the
-- Worker never has to send email (which needs a paid sending domain).
--
-- The email column stays the account's login name. It is never verified and nothing is ever sent
-- to it, so Google sign-in won't attach itself to a password account with the same address.
--
-- users is not rebuilt: D1 enforces foreign keys and dropping it would cascade-delete every
-- class and item, so the new columns are added in place.

ALTER TABLE users ADD COLUMN password_hash TEXT;   -- 'pbkdf2-sha256$<iterations>$<salt>$<hash>'
ALTER TABLE users ADD COLUMN recovery_hash TEXT;   -- SHA-256 of the current recovery code

DROP TABLE login_tokens;

-- Wrong passwords and recovery codes, used to slow down guessing. Old rows are pruned on write.
CREATE TABLE login_failures (
  email TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX login_failures_email_idx ON login_failures (email, created_at);
