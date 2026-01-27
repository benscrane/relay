-- Allow anonymous projects (no user association)
-- These are created via path-based routing (/m/{projectId}/...)

-- SQLite doesn't support ALTER COLUMN, so we recreate the table
-- Step 1: Create new table with nullable user_id
CREATE TABLE projects_new (
  id TEXT PRIMARY KEY,
  user_id TEXT,  -- Now nullable for anonymous projects
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Step 2: Copy existing data
INSERT INTO projects_new (id, user_id, name, subdomain, created_at, updated_at)
SELECT id, user_id, name, subdomain, created_at, updated_at FROM projects;

-- Step 3: Drop old table
DROP TABLE projects;

-- Step 4: Rename new table
ALTER TABLE projects_new RENAME TO projects;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_subdomain ON projects(subdomain);

-- Index to find anonymous projects
CREATE INDEX IF NOT EXISTS idx_projects_anonymous ON projects(user_id) WHERE user_id IS NULL;
