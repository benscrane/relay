// Client → Server message types
export type ClientMessageType = 'ping' | 'getHistory' | 'subscribe';

// Server → Client message types
export type ServerMessageType = 'pong' | 'request' | 'history' | 'error';

// Client → Server messages
export interface ClientMessage {
  type: ClientMessageType;
  endpointId?: string;
}

export interface PingMessage extends ClientMessage {
  type: 'ping';
}

export interface GetHistoryMessage extends ClientMessage {
  type: 'getHistory';
  endpointId?: string;
}

export interface SubscribeMessage extends ClientMessage {
  type: 'subscribe';
  endpointId?: string;
}

// Server → Client messages
export interface ServerMessage {
  type: ServerMessageType;
  data?: unknown;
}

export interface PongMessage extends ServerMessage {
  type: 'pong';
}

export interface RequestLog {
  [key: string]: string | null;
  id: string;
  endpoint_id: string;
  method: string;
  path: string;
  headers: string; // JSON string
  body: string | null;
  timestamp: string;
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  path_params: string | null; // JSON string
}

export interface RequestMessage extends ServerMessage {
  type: 'request';
  data: RequestLog;
}

export interface HistoryMessage extends ServerMessage {
  type: 'history';
  data: RequestLog[];
}

export interface ErrorMessage extends ServerMessage {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

// Legacy types (for backward compatibility)
export type WebSocketMessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'request_log'
  | 'endpoint_updated'
  | 'error';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: unknown;
}

export interface RequestLogMessage {
  type: 'request_log';
  payload: {
    endpointId: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string | null;
    timestamp: string;
  };
}

export interface EndpointUpdatedMessage {
  type: 'endpoint_updated';
  payload: {
    endpointId: string;
    changes: Partial<{
      responseBody: string;
      statusCode: number;
      delay: number;
    }>;
  };
}
