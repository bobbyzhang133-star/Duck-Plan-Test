-- Additive: preserve all existing user IDs, sessions and planner records.
ALTER TABLE users ADD COLUMN github_sub TEXT;
CREATE UNIQUE INDEX users_github_sub_idx ON users (github_sub) WHERE github_sub IS NOT NULL;

-- Separate from the pending Google transaction migration; no shared provider cookies.
CREATE TABLE github_oauth_transactions (
  token_hash TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  verifier TEXT NOT NULL,
  next_path TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('sign-in', 'link')),
  user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  session_hash TEXT,
  expires_at TEXT NOT NULL
);
CREATE INDEX github_oauth_transactions_expiry_idx ON github_oauth_transactions (expires_at);
