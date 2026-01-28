export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Endpoint {
  id: string;
  projectId: string;
  path: string;
  responseBody: string;
  statusCode: number;
  delay: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string | null;  // null for anonymous projects
  name: string;
  subdomain: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEndpointRequest {
  path: string;
  responseBody: string;
  statusCode?: number;
  delay?: number;
}

export interface UpdateEndpointRequest {
  responseBody?: string;
  statusCode?: number;
  delay?: number;
}

export interface CreateProjectRequest {
  name: string;
  subdomain: string;
}

// Auth types
export interface User {
  id: string;
  email: string;
  tier: 'free' | 'pro' | 'team';
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}

// Magic link types
export interface SendMagicLinkRequest {
  email: string;
}

export interface SendMagicLinkResponse {
  message: string;
}
