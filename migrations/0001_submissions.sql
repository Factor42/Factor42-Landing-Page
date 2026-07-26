-- D1 schema for form submissions (contact + consultation).
-- Apply: wrangler d1 execute factor42-submissions --file=migrations/0001_submissions.sql
CREATE TABLE IF NOT EXISTS submissions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  type             TEXT NOT NULL,          -- "contact" | "consultation"
  first_name       TEXT,
  last_name        TEXT,
  email            TEXT,
  company          TEXT,
  subject          TEXT,
  message          TEXT,
  phone            TEXT,
  role             TEXT,
  company_type     TEXT,
  monthly_ad_spend TEXT,
  platforms        TEXT,                   -- comma-joined
  challenge        TEXT,
  payload          TEXT                    -- full JSON payload
);

CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions (type);
