# Endpoint Worker - Request Logging & WebSocket Broadcasting

This worker implements the Durable Object that handles mock endpoint requests and real-time WebSocket broadcasting.

## Features

### ✅ Request Logging
- All incoming mock requests are logged to SQLite storage
- Stores: method, path, headers, body, timestamp
- Automatic ID generation for each request
- Indexed by endpoint_id and timestamp for fast queries

### ✅ WebSocket Broadcasting
- Real-time broadcasting of new requests to connected clients
- Hibernation-enabled for efficient resource usage
- Support for multiple concurrent WebSocket connections
- Automatic cleanup on connection close

### ✅ WebSocket Message Handlers
- `ping` - Keep-alive mechanism, responds with `pong`
- `getHistory` - Retrieve past request logs (up to 100 most recent)
- `subscribe` - Subscribe to specific endpoint updates

### ✅ Internal API
- `GET /__internal/logs` - Retrieve request history
  - Query params: `limit` (default: 100), `endpointId` (optional filter)
- `DELETE /__internal/logs` - Clear request history
  - Query params: `endpointId` (optional filter)

## Architecture

```
External Request → Endpoint Worker → EndpointDO (by subdomain)
                                          ↓
                                    1. Match endpoint
                                    2. Log request to SQLite
                                    3. Broadcast via WebSocket
                                    4. Return mock response
```

## WebSocket Protocol

### Client → Server Messages

```typescript
// Ping (keep-alive)
{ "type": "ping" }

// Get request history
{ "type": "getHistory", "endpointId": "ep_abc123" }

// Subscribe to endpoint updates
{ "type": "subscribe", "endpointId": "ep_abc123" }
```

### Server → Client Messages

```typescript
// Pong response
{ "type": "pong" }

// New request broadcast
{
  "type": "request",
  "data": {
    "id": "req_xyz789",
    "endpoint_id": "ep_abc123",
    "method": "POST",
    "path": "/users",
    "headers": "{\"content-type\":\"application/json\"}",
    "body": "{\"name\":\"John\"}",
    "timestamp": "2024-01-25T04:30:00.000Z"
  }
}

// History response
{
  "type": "history",
  "data": [
    { /* RequestLog */ },
    { /* RequestLog */ }
  ]
}
```

## Database Schema

### Endpoints Table
```sql
CREATE TABLE endpoints (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  response_body TEXT NOT NULL DEFAULT '{}',
  status_code INTEGER NOT NULL DEFAULT 200,
  delay_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Request Logs Table
```sql
CREATE TABLE request_logs (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  headers TEXT NOT NULL DEFAULT '{}',
  body TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
);
```

## Testing

### Manual Testing with HTML Test Page

1. Start the development server:
```bash
pnpm dev
```

2. Open `scripts/test-websocket.html` in your browser

3. Test the flow:
   - Click "Connect" to establish WebSocket connection
   - Click "Send Ping" to test ping/pong
   - Click "Get History" to retrieve past requests
   - Click "Send Request" to send a mock request
   - Watch the real-time broadcast appear in the log

### Testing with curl

```bash
# Send a mock request (will be logged and broadcast)
curl -X POST http://localhost:8787/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Get request history via internal API
curl "http://localhost:8787/__internal/logs?limit=10"

# Clear request history
curl -X DELETE "http://localhost:8787/__internal/logs"
```

### Testing with WebSocket Client

```javascript
const ws = new WebSocket('ws://localhost:8787');

ws.onopen = () => {
  console.log('Connected');
  
  // Get history
  ws.send(JSON.stringify({ type: 'getHistory' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## Implementation Details

### Request Logging Flow

1. Mock request arrives at `handleMockRequest()`
2. Request body is read and stored
3. Endpoint is matched using path pattern matching
4. `logRequest()` creates a new RequestLog entry in SQLite
5. `broadcastRequest()` sends the log to all connected WebSocket clients
6. Configured delay is applied (if any)
7. Mock response is returned

### WebSocket Hibernation

The Durable Object uses WebSocket hibernation for efficiency:
- Connections are accepted with `state.acceptWebSocket()`
- The DO hibernates when no messages are being processed
- When a message arrives, the DO wakes up, processes it, and hibernates again
- When a mock request arrives, the DO wakes up to broadcast to all connections

### Error Handling

- WebSocket send errors are caught and logged (connection may be closed)
- Invalid JSON messages are caught and logged
- Unknown message types are logged as warnings
- Database errors will throw and be handled by the worker runtime

## Next Steps

- [ ] Add request filtering by date range
- [ ] Implement request log retention policies
- [ ] Add support for request replay
- [ ] Add metrics and analytics
- [ ] Implement rate limiting per endpoint
