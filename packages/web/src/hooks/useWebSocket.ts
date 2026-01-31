import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  RequestLog,
  ClientMessage,
  ServerMessage,
  RequestMessage,
  HistoryMessage
} from '@mockd/shared';
import { getEndpointWebSocketUrl, getApiBaseUrl } from '../config';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseWebSocketOptions {
  subdomain?: string;
  endpointId?: string;
  projectId?: string;
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  status: ConnectionStatus;
  requests: RequestLog[];
  connect: () => void;
  disconnect: () => void;
  clearRequests: () => Promise<void>;
}

const MAX_REQUESTS = 100;
const PING_INTERVAL = 30000;
const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

function getWebSocketUrl(doName: string): string {
  const baseWsUrl = getEndpointWebSocketUrl();
  // Use path-based routing: /m/{doName}
  return `${baseWsUrl}/m/${doName}`;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { subdomain, endpointId, projectId, autoConnect = true } = options;
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [requests, setRequests] = useState<RequestLog[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef(MIN_RECONNECT_DELAY);
  const shouldReconnectRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const startPingInterval = useCallback(() => {
    pingIntervalRef.current = window.setInterval(() => {
      sendMessage({ type: 'ping' });
    }, PING_INTERVAL);
  }, [sendMessage]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as ServerMessage;

      switch (message.type) {
        case 'pong':
          // Keepalive acknowledged
          break;

        case 'request': {
          const requestMsg = message as RequestMessage;
          setRequests(prev => {
            const newRequests = [requestMsg.data, ...prev];
            return newRequests.slice(0, MAX_REQUESTS);
          });
          break;
        }

        case 'history': {
          const historyMsg = message as HistoryMessage;
          setRequests(prev => {
            const combined = [...historyMsg.data, ...prev];
            // Deduplicate by id
            const seen = new Set<string>();
            const unique = combined.filter(req => {
              if (seen.has(req.id)) return false;
              seen.add(req.id);
              return true;
            });
            return unique.slice(0, MAX_REQUESTS);
          });
          break;
        }

        case 'error':
          console.error('WebSocket error message:', message.data);
          break;
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!shouldReconnectRef.current) return;

    reconnectTimeoutRef.current = window.setTimeout(() => {
      connect();
    }, reconnectDelayRef.current);

    // Exponential backoff
    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * 2,
      MAX_RECONNECT_DELAY
    );
  }, []);

  const connect = useCallback(() => {
    // Don't connect without a valid subdomain/doName
    if (!subdomain) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    clearTimers();
    shouldReconnectRef.current = true;
    setStatus('connecting');

    try {
      const ws = new WebSocket(getWebSocketUrl(subdomain));
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        reconnectDelayRef.current = MIN_RECONNECT_DELAY;

        // Request history first, then subscribe
        sendMessage({ type: 'getHistory', endpointId });
        sendMessage({ type: 'subscribe', endpointId });

        startPingInterval();
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        clearTimers();
        scheduleReconnect();
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setStatus('error');
      scheduleReconnect();
    }
  }, [clearTimers, endpointId, handleMessage, scheduleReconnect, sendMessage, startPingInterval, subdomain]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('disconnected');
  }, [clearTimers]);

  const clearRequests = useCallback(async () => {
    if (projectId && endpointId) {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/endpoints/${endpointId}/logs`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          console.error('Failed to clear logs on server');
        }
      } catch (err) {
        console.error('Failed to clear logs:', err);
      }
    }
    setRequests([]);
  }, [projectId, endpointId]);

  // Auto-connect on mount or when subdomain/endpointId changes
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [subdomain, endpointId, autoConnect]);

  return {
    status,
    requests,
    connect,
    disconnect,
    clearRequests,
  };
}
