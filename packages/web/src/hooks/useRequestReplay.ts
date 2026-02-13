import { useState, useCallback } from 'react';
import type { RequestLog } from '@mockd/shared';

export interface ReplayResponse {
  status: number;
  statusText: string;
  body: string;
  duration: number;
}

export interface ReplayState {
  isReplaying: boolean;
  response: ReplayResponse | null;
  error: string | null;
}

const EMPTY_STATE: ReplayState = { isReplaying: false, response: null, error: null };

export function useRequestReplay() {
  const [replayStates, setReplayStates] = useState<Record<string, ReplayState>>({});

  const replay = useCallback(async (request: RequestLog, mockBaseUrl: string) => {
    const requestId = request.id;

    setReplayStates(prev => ({
      ...prev,
      [requestId]: { isReplaying: true, response: null, error: null },
    }));

    const url = mockBaseUrl + request.path;
    const startTime = performance.now();

    try {
      let headers: Record<string, string> = {};
      try {
        headers = JSON.parse(request.headers || '{}');
      } catch {
        // skip malformed headers
      }

      // Filter out non-repeatable headers
      const filteredHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        const lower = key.toLowerCase();
        if (lower === 'host' || lower === 'content-length' || lower.startsWith('cf-')) continue;
        filteredHeaders[key] = value;
      }

      const fetchOptions: RequestInit = {
        method: request.method,
        headers: filteredHeaders,
      };

      if (request.body && request.body !== 'null' && !['GET', 'HEAD'].includes(request.method)) {
        fetchOptions.body = request.body;
      }

      const response = await fetch(url, fetchOptions);
      const duration = Math.round(performance.now() - startTime);
      const body = await response.text();

      setReplayStates(prev => ({
        ...prev,
        [requestId]: {
          isReplaying: false,
          response: { status: response.status, statusText: response.statusText, body, duration },
          error: null,
        },
      }));
    } catch (err) {
      setReplayStates(prev => ({
        ...prev,
        [requestId]: {
          isReplaying: false,
          response: null,
          error: err instanceof Error ? err.message : 'Replay failed',
        },
      }));
    }
  }, []);

  const getReplayState = useCallback((requestId: string): ReplayState => {
    return replayStates[requestId] || EMPTY_STATE;
  }, [replayStates]);

  const clearReplayState = useCallback((requestId: string) => {
    setReplayStates(prev => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  }, []);

  return { replay, getReplayState, clearReplayState };
}
