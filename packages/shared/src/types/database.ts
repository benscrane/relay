export interface DbUser {
  id: string;
  email: string;
  password_hash: string | null;
  tier: 'free' | 'pro' | 'team';
  created_at: string;
  updated_at: string;
}

export interface DbSession {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface DbProject {
  id: string;
  user_id: string | null;  // null for anonymous projects
  name: string;
  subdomain: string;
  created_at: string;
  updated_at: string;
}

export interface DbEndpoint {
  id: string;
  project_id: string;
  path: string;
  response_body: string;
  status_code: number;
  delay_ms: number;
  created_at: string;
  updated_at: string;
}

export interface DbRequestLog {
  id: string;
  endpoint_id: string;
  method: string;
  path: string;
  headers: string;
  body: string | null;
  timestamp: string;
}

export interface DbMagicLinkToken {
  id: string;
  email: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface DbOAuthConnection {
  id: string;
  user_id: string;
  provider: 'github';
  provider_user_id: string;
  provider_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOAuthState {
  id: string;
  state: string;
  provider: string;
  redirect_uri: string | null;
  code_verifier: string | null;
  expires_at: string;
  created_at: string;
}
