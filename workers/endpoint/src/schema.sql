-- Durable Object SQLite Schema
-- This schema is applied within the EndpointDO class

CREATE TABLE IF NOT EXISTS endpoints (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  response_body TEXT NOT NULL DEFAULT '{}',
  status_code INTEGER NOT NULL DEFAULT 200,
  delay_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  headers TEXT NOT NULL DEFAULT '{}',
  body TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
);

CREATE INDEX IF NOT EXISTS idx_endpoints_method_path ON endpoints(method, path);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
