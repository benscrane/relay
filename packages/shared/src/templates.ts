import type { CreateEndpointRequest } from './types/api';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  endpoints: CreateEndpointRequest[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'rest-crud',
    name: 'REST CRUD API',
    description: 'A users API with list, create, get, update, and delete endpoints.',
    endpoints: [
      {
        path: '/users',
        statusCode: 200,
        responseBody: JSON.stringify(
          {
            users: [
              { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
              { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
              { id: 3, name: 'Carol Williams', email: 'carol@example.com' },
            ],
            total: 3,
          },
          null,
          2
        ),
      },
      {
        path: '/users/:id',
        statusCode: 200,
        responseBody: JSON.stringify(
          { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', createdAt: '2025-01-15T10:30:00Z' },
          null,
          2
        ),
      },
    ],
  },
  {
    id: 'webhook-receiver',
    name: 'Webhook Receiver',
    description: 'A catch-all POST endpoint for testing webhooks and inspecting payloads.',
    endpoints: [
      {
        path: '/webhooks/incoming',
        statusCode: 200,
        responseBody: JSON.stringify(
          { received: true, message: 'Webhook processed successfully' },
          null,
          2
        ),
      },
    ],
  },
  {
    id: 'error-simulation',
    name: 'Error Simulation',
    description: 'Endpoints returning common HTTP errors for testing your error handling.',
    endpoints: [
      {
        path: '/success',
        statusCode: 200,
        responseBody: JSON.stringify(
          { status: 'ok', message: 'Request succeeded' },
          null,
          2
        ),
      },
      {
        path: '/bad-request',
        statusCode: 400,
        responseBody: JSON.stringify(
          { error: 'Bad Request', message: 'The request body is missing a required field: email' },
          null,
          2
        ),
      },
      {
        path: '/not-found',
        statusCode: 404,
        responseBody: JSON.stringify(
          { error: 'Not Found', message: 'The requested resource does not exist' },
          null,
          2
        ),
      },
      {
        path: '/server-error',
        statusCode: 500,
        responseBody: JSON.stringify(
          { error: 'Internal Server Error', message: 'An unexpected error occurred' },
          null,
          2
        ),
        delay: 500,
      },
    ],
  },
];
