# Feature Specification: Team Collaboration & Sharing

## Overview

Enable multiple users to collaborate on mock API projects through team workspaces with role-based access control, invitations, and activity tracking. This unlocks B2B revenue streams and increases platform stickiness.

## Problem Statement

Currently, mockd projects are siloed to individual users:
- Teams cannot share mock APIs without sharing credentials
- No way to collaborate on endpoint configurations
- No visibility into team member activities
- Cannot delegate project management
- Limits adoption in organizational settings

## User Stories

### Team Management

1. **As a team admin**, I want to create a team workspace so that my colleagues can access shared projects.

2. **As a team admin**, I want to invite teammates by email so that they can join my workspace.

3. **As a team admin**, I want to assign roles (admin, editor, viewer) so that I can control what each member can do.

4. **As a team admin**, I want to remove team members so that former colleagues lose access.

5. **As a team member**, I want to see all teams I belong to so that I can switch between personal and team contexts.

### Project Sharing

6. **As a project owner**, I want to move a personal project to a team so that my team can collaborate on it.

7. **As an editor**, I want to create and edit endpoints so that I can contribute to team projects.

8. **As a viewer**, I want to view endpoints and request logs so that I can use the mocks for testing.

9. **As an admin**, I want to transfer project ownership so that another admin can manage it.

### External Sharing

10. **As a project owner**, I want to create a read-only share link so that external stakeholders can view (but not modify) the mock API.

11. **As a project owner**, I want to revoke share links so that I can remove external access.

### Activity & Audit

12. **As a team admin**, I want to see an activity feed so that I know what changes team members made.

13. **As a team admin**, I want to see who last modified an endpoint so that I can track accountability.

## Functional Requirements

### FR-1: Team Management

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Create team with name and optional description |
| FR-1.2 | Team creator becomes first admin |
| FR-1.3 | Update team name and description |
| FR-1.4 | Delete team (admin only, requires confirmation) |
| FR-1.5 | View team member list with roles |
| FR-1.6 | Team limits based on tier (see below) |

### FR-2: Invitations

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Invite by email address |
| FR-2.2 | Set role in invitation |
| FR-2.3 | Invitation expires in 7 days |
| FR-2.4 | Resend invitation |
| FR-2.5 | Cancel pending invitation |
| FR-2.6 | Accept invitation (creates account if needed) |
| FR-2.7 | Decline invitation |
| FR-2.8 | List pending invitations |

### FR-3: Roles & Permissions

| Permission | Admin | Editor | Viewer |
|------------|-------|--------|--------|
| View projects | ✅ | ✅ | ✅ |
| View endpoints | ✅ | ✅ | ✅ |
| View request logs | ✅ | ✅ | ✅ |
| Create endpoints | ✅ | ✅ | ❌ |
| Edit endpoints | ✅ | ✅ | ❌ |
| Delete endpoints | ✅ | ✅ | ❌ |
| Create projects | ✅ | ✅ | ❌ |
| Delete projects | ✅ | ❌ | ❌ |
| Manage team members | ✅ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ |
| Delete team | ✅ | ❌ | ❌ |

### FR-4: Project Ownership

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Projects belong to user OR team (not both) |
| FR-4.2 | Transfer personal project to team (owner only) |
| FR-4.3 | Transfer team project to personal (admin only) |
| FR-4.4 | Project counts against team's quota when in team |

### FR-5: External Share Links

| Requirement | Description |
|-------------|-------------|
| FR-5.1 | Generate unique share URL per project |
| FR-5.2 | Share link provides read-only access |
| FR-5.3 | No authentication required for share link |
| FR-5.4 | Share link can be enabled/disabled |
| FR-5.5 | Regenerate link (invalidates old link) |
| FR-5.6 | Optional password protection |
| FR-5.7 | Optional expiration date |

### FR-6: Activity Feed

| Requirement | Description |
|-------------|-------------|
| FR-6.1 | Log: endpoint created/updated/deleted |
| FR-6.2 | Log: project created/updated/deleted |
| FR-6.3 | Log: member invited/joined/removed |
| FR-6.4 | Log: role changed |
| FR-6.5 | Display actor, action, target, timestamp |
| FR-6.6 | Filter by project, member, action type |
| FR-6.7 | Retention: 90 days |

## API Design

### Team Endpoints

```
POST /api/teams
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Acme Engineering",
  "description": "Backend team mocks"
}

Response 201:
{
  "id": "team_abc123",
  "name": "Acme Engineering",
  "description": "Backend team mocks",
  "createdAt": "2024-01-15T10:30:00Z",
  "memberCount": 1,
  "projectCount": 0
}
```

```
GET /api/teams
Authorization: Bearer <token>

Response 200:
{
  "teams": [
    {
      "id": "team_abc123",
      "name": "Acme Engineering",
      "role": "admin",
      "memberCount": 5,
      "projectCount": 3
    }
  ]
}
```

```
GET /api/teams/:teamId
Authorization: Bearer <token>

Response 200:
{
  "id": "team_abc123",
  "name": "Acme Engineering",
  "description": "Backend team mocks",
  "createdAt": "2024-01-15T10:30:00Z",
  "members": [
    {
      "id": "user_xyz",
      "email": "alice@acme.com",
      "name": "Alice Smith",
      "role": "admin",
      "joinedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "user_def",
      "email": "bob@acme.com",
      "name": "Bob Jones",
      "role": "editor",
      "joinedAt": "2024-01-16T09:00:00Z"
    }
  ],
  "pendingInvitations": [
    {
      "id": "inv_123",
      "email": "charlie@acme.com",
      "role": "viewer",
      "invitedAt": "2024-01-17T14:00:00Z",
      "expiresAt": "2024-01-24T14:00:00Z"
    }
  ]
}
```

### Invitation Endpoints

```
POST /api/teams/:teamId/invitations
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newmember@acme.com",
  "role": "editor"
}

Response 201:
{
  "id": "inv_456",
  "email": "newmember@acme.com",
  "role": "editor",
  "invitedAt": "2024-01-18T10:00:00Z",
  "expiresAt": "2024-01-25T10:00:00Z"
}
```

```
POST /api/invitations/:invitationId/accept
Authorization: Bearer <token>

Response 200:
{
  "team": {
    "id": "team_abc123",
    "name": "Acme Engineering"
  },
  "role": "editor"
}
```

```
DELETE /api/teams/:teamId/invitations/:invitationId
Authorization: Bearer <token>

Response 204
```

### Member Management

```
PATCH /api/teams/:teamId/members/:userId
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}

Response 200:
{
  "id": "user_def",
  "role": "admin"
}
```

```
DELETE /api/teams/:teamId/members/:userId
Authorization: Bearer <token>

Response 204
```

### Project Transfer

```
POST /api/projects/:projectId/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetType": "team",
  "targetId": "team_abc123"
}

Response 200:
{
  "id": "proj_xyz",
  "name": "My API",
  "teamId": "team_abc123"
}
```

### Share Links

```
POST /api/projects/:projectId/share-link
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "optional-password",
  "expiresAt": "2024-02-15T00:00:00Z"
}

Response 201:
{
  "id": "share_789",
  "url": "https://mockd.sh/share/abc123xyz",
  "hasPassword": true,
  "expiresAt": "2024-02-15T00:00:00Z",
  "createdAt": "2024-01-18T10:00:00Z"
}
```

```
DELETE /api/projects/:projectId/share-link
Authorization: Bearer <token>

Response 204
```

### Activity Feed

```
GET /api/teams/:teamId/activity?limit=50&offset=0&project=proj_xyz
Authorization: Bearer <token>

Response 200:
{
  "activities": [
    {
      "id": "act_123",
      "actor": {
        "id": "user_xyz",
        "name": "Alice Smith",
        "email": "alice@acme.com"
      },
      "action": "endpoint.created",
      "target": {
        "type": "endpoint",
        "id": "ep_abc",
        "name": "GET /users"
      },
      "project": {
        "id": "proj_xyz",
        "name": "My API"
      },
      "timestamp": "2024-01-18T10:30:00Z",
      "details": {
        "method": "GET",
        "path": "/users"
      }
    }
  ],
  "hasMore": true
}
```

## Database Schema Changes

### New Tables (D1)

```sql
-- Teams
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Team memberships
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- Invitations
CREATE TABLE team_invitations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, email)
);

CREATE INDEX idx_invitations_token ON team_invitations(token);
CREATE INDEX idx_invitations_email ON team_invitations(email);

-- Share links
CREATE TABLE share_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  token TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_share_links_token ON share_links(token);

-- Activity log
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  details TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_team ON activity_log(team_id, created_at DESC);
CREATE INDEX idx_activity_project ON activity_log(project_id, created_at DESC);
```

### Modified Tables

```sql
-- Add team_id to projects
ALTER TABLE projects ADD COLUMN team_id TEXT REFERENCES teams(id) ON DELETE CASCADE;

CREATE INDEX idx_projects_team ON projects(team_id);
```

## UI/UX Design

### Team Switcher (Header)

```
┌─────────────────────────────────────────────────────────────────────┐
│  mockd    [Personal ▼]    Projects    Analytics    Docs       👤    │
│           ┌─────────────────────────┐                               │
│           │ Personal               ✓│                               │
│           │ ─────────────────────── │                               │
│           │ Acme Engineering        │                               │
│           │ Side Project Team       │                               │
│           │ ─────────────────────── │                               │
│           │ + Create Team           │                               │
│           └─────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Team Settings Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Acme Engineering Settings                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [General]  [Members]  [Billing]  [Activity]                                │
│                                                                             │
│  ┌─ Team Info ────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Team Name                                                             │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Acme Engineering                                               │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                        │ │
│  │  Description                                                           │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Backend team mock APIs for development and testing             │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                        │ │
│  │                                                    [Save Changes]      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Danger Zone ──────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Delete Team                                                           │ │
│  │  This will permanently delete the team and remove access for all       │ │
│  │  members. Projects will be transferred to your personal account.       │ │
│  │                                                                [Delete]│ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Members Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [General]  [Members]  [Billing]  [Activity]                                │
│                                                                             │
│  ┌─ Invite Member ────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Email                          Role                                   │ │
│  │  ┌────────────────────────┐    ┌──────────────┐                       │ │
│  │  │ email@example.com      │    │ Editor     ▼ │    [Send Invite]      │ │
│  │  └────────────────────────┘    └──────────────┘                       │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Members (4) ──────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  👤 Alice Smith          alice@acme.com           Admin     [Owner]    │ │
│  │  👤 Bob Jones            bob@acme.com             Editor    [···]      │ │
│  │  👤 Carol White          carol@acme.com           Editor    [···]      │ │
│  │  👤 Dave Brown           dave@acme.com            Viewer    [···]      │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Pending Invitations (1) ──────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ✉️ charlie@acme.com      Viewer    Expires in 5 days    [Resend] [×]  │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Activity Feed Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [General]  [Members]  [Billing]  [Activity]                                │
│                                                                             │
│  Filter: [All Projects ▼]  [All Members ▼]  [All Actions ▼]                 │
│                                                                             │
│  ┌─ Today ────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  10:30 AM  Bob Jones created endpoint GET /users in "My API"           │ │
│  │                                                                        │ │
│  │  10:15 AM  Alice Smith updated endpoint POST /orders in "My API"       │ │
│  │                                                                        │ │
│  │   9:45 AM  Carol White viewed project "Payment Mocks"                  │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Yesterday ────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │   4:30 PM  Alice Smith invited dave@acme.com as Viewer                 │ │
│  │                                                                        │ │
│  │   2:15 PM  Bob Jones deleted endpoint DELETE /users/:id in "My API"    │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                            [Load More]                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Share Link Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Share "My API"                                              X  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Anyone with this link can view (but not edit) your mock API.   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ https://mockd.sh/share/abc123xyz                   [📋] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ☐ Require password                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ☐ Set expiration date                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Never                                               [▼] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Regenerate Link]              [Disable Sharing]    [Done]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Invitation Email

```
Subject: You've been invited to join Acme Engineering on mockd

─────────────────────────────────────────────────────────────────

Alice Smith invited you to join Acme Engineering on mockd
as an Editor.

mockd is a mock API platform for creating and testing APIs.

[Accept Invitation]

This invitation expires on January 25, 2024.

─────────────────────────────────────────────────────────────────
```

## Technical Considerations

### Authorization Middleware

```typescript
// Middleware to check team permissions
async function requireTeamRole(
  teamId: string,
  userId: string,
  requiredRoles: Role[]
): Promise<void> {
  const membership = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.userId, userId)
    ))
    .first();

  if (!membership || !requiredRoles.includes(membership.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }
}
```

### Project Access Control

```typescript
// Check if user can access project
async function canAccessProject(
  projectId: string,
  userId: string,
  requiredPermission: Permission
): Promise<boolean> {
  const project = await getProject(projectId);

  // Personal project - user must be owner
  if (!project.teamId) {
    return project.userId === userId;
  }

  // Team project - check membership and role
  const membership = await getTeamMembership(project.teamId, userId);
  if (!membership) return false;

  return ROLE_PERMISSIONS[membership.role].includes(requiredPermission);
}
```

### Activity Logging

```typescript
// Log activity on mutations
async function logActivity(params: {
  teamId?: string;
  userId: string;
  projectId?: string;
  action: ActivityAction;
  target?: { type: string; id: string; name: string };
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(activityLog).values({
    id: generateId(),
    ...params,
    details: params.details ? JSON.stringify(params.details) : null,
    createdAt: new Date().toISOString()
  });
}
```

## Tier Limits

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Teams | 0 | 1 | 5 |
| Members per team | - | 5 | 25 |
| Share links | 1 per project | Unlimited | Unlimited |
| Activity history | - | 30 days | 90 days |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Team creation | 20% of Pro users | Teams created / Pro users |
| Avg team size | 3+ members | Total members / teams |
| Invitation acceptance | > 60% | Accepted / sent |
| Team project % | 40% of team projects | Team projects / total |
| Share link usage | 10% of projects | Projects with active links |

## Out of Scope (Future)

- SSO/SAML integration
- Custom roles (beyond admin/editor/viewer)
- Team-level API keys
- Audit log export
- Slack/Teams notifications
- Project templates for teams
- Team-wide environment variables

## Implementation Phases

### Phase 1 (MVP)
- Create team
- Invite members by email
- Basic roles (admin, editor, viewer)
- Project ownership (personal vs team)
- Team switcher in UI

### Phase 2
- Activity feed
- Transfer projects between personal/team
- Remove members
- Pending invitation management

### Phase 3
- Share links with password/expiry
- Activity filtering
- Team settings page
- Invitation emails
