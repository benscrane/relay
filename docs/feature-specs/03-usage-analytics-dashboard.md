# Feature Specification: Usage Analytics Dashboard

## Overview

Provide users with aggregated insights into their mock API usage through visual dashboards showing request volumes, error rates, response times, and usage patterns. This helps users understand their testing patterns and justify paid tier upgrades.

## Problem Statement

Currently, mockd provides real-time request logging but lacks aggregated analytics:
- Users can't see usage trends over time
- No visibility into which endpoints are most used
- No error rate tracking to identify problematic mocks
- No way to see how close they are to tier limits
- Difficult to justify ROI of upgrading to paid plans

## User Stories

### Usage Visibility

1. **As a developer**, I want to see my total requests this billing period so that I know if I'm approaching my limit.

2. **As a developer**, I want to see a graph of requests over time so that I can identify usage patterns.

3. **As a developer**, I want to see which endpoints are most frequently called so that I can prioritize improvements.

### Error Tracking

4. **As a developer**, I want to see my error rate (4xx, 5xx responses) over time so that I can identify configuration issues.

5. **As a developer**, I want to see which endpoints have the highest error rates so that I can fix them.

### Performance Insights

6. **As a developer**, I want to see average response times so that I can ensure my mocks aren't adding latency.

7. **As a developer**, I want to see response time percentiles (p50, p95, p99) so that I can identify slow endpoints.

### Quota Management

8. **As a developer**, I want to receive alerts when I'm approaching my usage limit so that I can upgrade or reduce usage.

9. **As a developer**, I want to see usage breakdown by project so that I can identify which projects consume the most quota.

## Functional Requirements

### FR-1: Dashboard Overview

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Display total requests in current billing period |
| FR-1.2 | Display quota usage percentage with visual indicator |
| FR-1.3 | Display requests remaining until limit |
| FR-1.4 | Display projected usage based on current rate |
| FR-1.5 | Show comparison to previous period (% change) |

### FR-2: Time-Series Charts

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Requests over time (line/bar chart) |
| FR-2.2 | Configurable time ranges: 24h, 7d, 30d, custom |
| FR-2.3 | Granularity auto-adjusts: hourly (24h), daily (7d+) |
| FR-2.4 | Overlay multiple metrics on same chart |
| FR-2.5 | Hover tooltips with exact values |

### FR-3: Error Analytics

| Requirement | Description |
|-------------|-------------|
| FR-3.1 | Error rate over time (percentage of 4xx+5xx) |
| FR-3.2 | Breakdown by status code category (2xx, 3xx, 4xx, 5xx) |
| FR-3.3 | Top endpoints by error count |
| FR-3.4 | Error spike detection and highlighting |

### FR-4: Response Time Analytics

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Average response time over time |
| FR-4.2 | p50, p95, p99 percentiles |
| FR-4.3 | Slowest endpoints ranking |
| FR-4.4 | Response time distribution histogram |

### FR-5: Endpoint Analytics

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | Top 10 endpoints by request volume |
| FR-5.2 | Endpoint request volume over time |
| FR-5.3 | Per-endpoint error rate |
| FR-5.4 | Per-endpoint average response time |

### FR-6: Project-Level Analytics

| Requirement | Description |
|-------------|-------------|
| FR-6.1 | Usage breakdown by project (pie/bar chart) |
| FR-6.2 | Project comparison table |
| FR-6.3 | Per-project drill-down to endpoint analytics |

### FR-7: Alerts & Notifications

| Requirement | Description |
|-------------|-------------|
| FR-7.1 | Alert at 80% quota usage |
| FR-7.2 | Alert at 100% quota usage |
| FR-7.3 | In-app notification banners |
| FR-7.4 | Optional email notifications |
| FR-7.5 | Alert when error rate exceeds threshold (>10%) |

### FR-8: Data Export

| Requirement | Description |
|-------------|-------------|
| FR-8.1 | Export analytics data as CSV |
| FR-8.2 | Export analytics data as JSON |
| FR-8.3 | Scheduled email reports (Pro+ tier) |

## API Design

### Analytics Endpoints

```
GET /api/analytics/overview?period=7d
Authorization: Bearer <token>

Response 200:
{
  "period": {
    "start": "2024-01-08T00:00:00Z",
    "end": "2024-01-15T00:00:00Z"
  },
  "requests": {
    "total": 15234,
    "limit": 100000,
    "percentUsed": 15.2,
    "remaining": 84766,
    "projectedTotal": 30468,
    "previousPeriod": 12500,
    "changePercent": 21.9
  },
  "errors": {
    "total": 234,
    "rate": 1.5,
    "by4xx": 180,
    "by5xx": 54
  },
  "responseTime": {
    "avg": 45,
    "p50": 32,
    "p95": 120,
    "p99": 250
  }
}
```

```
GET /api/analytics/timeseries?metric=requests&period=7d&granularity=daily
Authorization: Bearer <token>

Response 200:
{
  "metric": "requests",
  "granularity": "daily",
  "data": [
    { "timestamp": "2024-01-08T00:00:00Z", "value": 2100 },
    { "timestamp": "2024-01-09T00:00:00Z", "value": 2350 },
    { "timestamp": "2024-01-10T00:00:00Z", "value": 1890 },
    // ...
  ]
}
```

```
GET /api/analytics/endpoints?sort=requests&order=desc&limit=10&period=7d
Authorization: Bearer <token>

Response 200:
{
  "endpoints": [
    {
      "id": "ep_abc123",
      "projectId": "proj_xyz",
      "projectName": "My API",
      "method": "GET",
      "path": "/users",
      "requests": 5230,
      "errorRate": 0.5,
      "avgResponseTime": 35
    },
    // ...
  ]
}
```

```
GET /api/analytics/projects?period=7d
Authorization: Bearer <token>

Response 200:
{
  "projects": [
    {
      "id": "proj_xyz",
      "name": "My API",
      "requests": 8500,
      "percentOfTotal": 55.8,
      "endpoints": 12,
      "errorRate": 1.2
    },
    // ...
  ]
}
```

### Alert Configuration

```
GET /api/alerts/settings
Authorization: Bearer <token>

Response 200:
{
  "quotaAlerts": {
    "enabled": true,
    "thresholds": [80, 100],
    "emailNotifications": true
  },
  "errorRateAlerts": {
    "enabled": true,
    "threshold": 10,
    "emailNotifications": false
  }
}
```

```
PUT /api/alerts/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "quotaAlerts": {
    "enabled": true,
    "thresholds": [75, 90, 100],
    "emailNotifications": true
  }
}
```

## Database Schema Changes

### New Tables (D1)

```sql
-- Aggregated hourly metrics for fast querying
CREATE TABLE analytics_hourly (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id), -- NULL for user-level
  endpoint_id TEXT,                          -- NULL for project-level
  hour TEXT NOT NULL,                        -- ISO timestamp truncated to hour
  requests INTEGER DEFAULT 0,
  status_2xx INTEGER DEFAULT 0,
  status_3xx INTEGER DEFAULT 0,
  status_4xx INTEGER DEFAULT 0,
  status_5xx INTEGER DEFAULT 0,
  response_time_sum INTEGER DEFAULT 0,       -- For calculating average
  response_time_count INTEGER DEFAULT 0,
  response_time_p50 INTEGER,
  response_time_p95 INTEGER,
  response_time_p99 INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, project_id, endpoint_id, hour)
);

CREATE INDEX idx_analytics_hourly_user_hour ON analytics_hourly(user_id, hour);
CREATE INDEX idx_analytics_hourly_project_hour ON analytics_hourly(project_id, hour);

-- Daily rollups for longer-term queries
CREATE TABLE analytics_daily (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  date TEXT NOT NULL,                        -- YYYY-MM-DD
  requests INTEGER DEFAULT 0,
  status_2xx INTEGER DEFAULT 0,
  status_3xx INTEGER DEFAULT 0,
  status_4xx INTEGER DEFAULT 0,
  status_5xx INTEGER DEFAULT 0,
  response_time_avg INTEGER,
  response_time_p50 INTEGER,
  response_time_p95 INTEGER,
  response_time_p99 INTEGER,
  UNIQUE(user_id, project_id, date)
);

CREATE INDEX idx_analytics_daily_user_date ON analytics_daily(user_id, date);

-- Alert configurations
CREATE TABLE alert_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) UNIQUE,
  quota_alerts_enabled INTEGER DEFAULT 1,
  quota_thresholds TEXT DEFAULT '[80, 100]',  -- JSON array
  quota_email_enabled INTEGER DEFAULT 0,
  error_alerts_enabled INTEGER DEFAULT 0,
  error_threshold INTEGER DEFAULT 10,
  error_email_enabled INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sent alerts (to prevent duplicates)
CREATE TABLE alert_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  alert_type TEXT NOT NULL,                  -- 'quota_80', 'quota_100', 'error_rate'
  period TEXT NOT NULL,                      -- Which period triggered alert
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, alert_type, period)
);
```

## UI/UX Design

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Analytics                                          Period: [Last 7 days ▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌─────────┐│
│  │ Total Requests   │ │ Error Rate       │ │ Avg Response     │ │ Quota   ││
│  │     15,234       │ │     1.5%         │ │     45ms         │ │  15%    ││
│  │ ↑ 21.9% vs prev  │ │ ↓ 0.3% vs prev   │ │ ↓ 5ms vs prev    │ │ ████░░░ ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └─────────┘│
│                                                                             │
│  ┌─ Requests Over Time ───────────────────────────────────────────────────┐ │
│  │      ▲                                                                 │ │
│  │  3k  │                            ██                                   │ │
│  │      │         ██    ██    ██    ████    ██                            │ │
│  │  2k  │   ██   ████  ████  ████  ██████  ████   ██                      │ │
│  │      │  ████  ████  ████  ████  ██████  ████  ████                     │ │
│  │  1k  │  ████  ████  ████  ████  ██████  ████  ████                     │ │
│  │      │  ████  ████  ████  ████  ██████  ████  ████                     │ │
│  │  0   └──Jan 8──Jan 9──Jan 10─Jan 11─Jan 12──Jan 13─Jan 14─────────▶   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Top Endpoints ─────────────────────────┐ ┌─ Status Code Breakdown ────┐ │
│  │                                         │ │                            │ │
│  │  GET /users             5,230  (34%)    │ │      ┌────────────────┐    │ │
│  │  ████████████████████░░░░░░░░░░         │ │      │     2xx        │    │ │
│  │                                         │ │      │     85%        │    │ │
│  │  POST /orders           2,100  (14%)    │ │      └────────────────┘    │ │
│  │  ████████░░░░░░░░░░░░░░░░░░░░░░         │ │   4xx: 12%    5xx: 3%      │ │
│  │                                         │ │                            │ │
│  │  GET /products/:id      1,850  (12%)    │ │                            │ │
│  │  ███████░░░░░░░░░░░░░░░░░░░░░░░         │ │                            │ │
│  │                                         │ │                            │ │
│  │  [View All Endpoints →]                 │ │                            │ │
│  └─────────────────────────────────────────┘ └────────────────────────────┘ │
│                                                                             │
│  ┌─ Response Time Distribution ───────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  p50: 32ms    p95: 120ms    p99: 250ms                                 │ │
│  │                                                                        │ │
│  │       ▲                                                                │ │
│  │       │    ████                                                        │ │
│  │       │   ██████                                                       │ │
│  │       │  ████████                                                      │ │
│  │       │ ██████████  ██                                                 │ │
│  │       │████████████████  ██  ░░                                        │ │
│  │       └──0-50ms──50-100──100-200──200-500──500+──────────▶            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Quota Alert Banner

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ You've used 80% of your monthly request quota (80,000 / 100,000)        │
│     Upgrade to Pro for 100x more requests  [Upgrade Now]  [Dismiss]         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Project Breakdown View

```
┌─ Usage by Project ────────────────────────────────────────────────────────┐
│                                                                           │
│  Project              Requests    % of Total    Endpoints    Error Rate   │
│  ─────────────────────────────────────────────────────────────────────── │
│  My API               8,500       55.8%         12           1.2%         │
│  ████████████████████████████░░░░░░░░░░░░░░░░░░░░░                        │
│                                                                           │
│  Test Project         4,200       27.6%         5            0.5%         │
│  █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                        │
│                                                                           │
│  Demo                 2,534       16.6%         8            3.1%         │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Technical Considerations

### Data Aggregation Strategy

1. **Real-time Writes**: Each request logs to Durable Object (existing)

2. **Hourly Aggregation**: Scheduled Worker runs every hour
   - Query request_logs from each Durable Object
   - Aggregate into analytics_hourly table
   - Calculate percentiles using approximate algorithms (t-digest)

3. **Daily Rollup**: Scheduled Worker runs at midnight UTC
   - Aggregate hourly data into daily summaries
   - Calculate daily percentiles

4. **Retention**: Based on tier
   - Free: 7 days of hourly, 30 days of daily
   - Pro: 30 days of hourly, 90 days of daily
   - Team: 90 days of hourly, 365 days of daily

### Percentile Calculation

Use t-digest algorithm for approximate percentiles:
- Memory efficient
- Mergeable across time periods
- Accurate within 1% for p50, p95, p99

### Caching Strategy

- Overview stats: Cache for 5 minutes
- Time series: Cache for 1 minute
- Use stale-while-revalidate pattern

### Alert Processing

Scheduled Worker checks alerts every 15 minutes:
1. Query current period usage per user
2. Compare against thresholds
3. Check alert_history to avoid duplicates
4. Send notifications (in-app + email)

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard views | 50% of active users weekly | Page view analytics |
| Time on dashboard | > 30 seconds avg | Session duration |
| Alert click-through | > 20% | Clicks / alerts shown |
| Upgrade from alert | > 5% | Upgrades within 24h of alert |

## Tier Restrictions

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Analytics retention | 7 days | 30 days | 90 days |
| Time granularity | Daily | Hourly | Hourly |
| Export | ❌ | CSV | CSV + JSON |
| Email reports | ❌ | Monthly | Weekly |
| Custom alerts | ❌ | ✅ | ✅ |

## Out of Scope (Future)

- Real-time streaming analytics
- Custom dashboard widgets
- API for analytics data
- Anomaly detection (ML-based)
- Comparison between time periods
- Cohort analysis
- Geographic distribution

## Implementation Phases

### Phase 1 (MVP)
- Overview cards (total requests, quota, error rate)
- Requests over time chart (daily granularity)
- Basic quota alert banner
- Project breakdown table

### Phase 2
- Hourly granularity
- Response time charts and percentiles
- Top endpoints ranking
- Status code breakdown

### Phase 3
- Configurable alerts
- Email notifications
- Data export
- Per-endpoint drill-down
