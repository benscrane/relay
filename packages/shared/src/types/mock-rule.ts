export interface MockRule {
  id: string;
  endpointId: string;
  priority: number;
  name: string | null;
  matchMethod: string | null;
  matchPath: string | null;
  matchHeaders: Record<string, string> | null;
  responseStatus: number;
  responseHeaders: Record<string, string> | null;
  responseBody: string;
  responseDelayMs: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DbMockRule {
  [key: string]: string | number | null;
  id: string;
  endpoint_id: string;
  priority: number;
  name: string | null;
  match_method: string | null;
  match_path: string | null;
  match_headers: string | null;
  response_status: number;
  response_headers: string | null;
  response_body: string;
  response_delay_ms: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMockRuleRequest {
  endpointId: string;
  priority?: number;
  name?: string;
  matchMethod?: string;
  matchPath?: string;
  matchHeaders?: Record<string, string>;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody: string;
  responseDelayMs?: number;
  isActive?: boolean;
}

export interface UpdateMockRuleRequest {
  priority?: number;
  name?: string | null;
  matchMethod?: string | null;
  matchPath?: string | null;
  matchHeaders?: Record<string, string> | null;
  responseStatus?: number;
  responseHeaders?: Record<string, string> | null;
  responseBody?: string;
  responseDelayMs?: number;
  isActive?: boolean;
}
