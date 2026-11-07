# ROAM — SCOPE 03: GROUPS & INVITATIONS

You are developing Roam, a multiplayer social gaming platform built with Expo, React Native, TypeScript, Expo Router and Supabase.

Scope 01 established authentication, profiles and navigation.

Scope 02 established the game catalog, game registry and session engine.

Your task is to implement **Scope 03 — Groups & Invitations**.

## 1. Inspect the existing project

Before implementation:

- Review the repository structure and existing components.
- Review the Supabase schema, migrations and RLS policies.
- Identify existing session membership and authorization logic.
- Reuse the existing design system.
- Preserve working functionality from Scopes 01 and 02.
- Present a short implementation plan before making changes.

Do not rebuild the project or implement later scopes.

## 2. Persistent groups

Allow authenticated users to create groups that remain available across multiple games.

For example, a group called "Office Friends" can play Secret Santa in December and another game in January.

Each group should have:

- Unique group ID.
- Group name.
- Optional description.
- Host/owner ID.
- Created timestamp.
- Updated timestamp.
- Optional group avatar or icon.

The creator automatically becomes the group's first member and owner.

A user may belong to multiple groups.

## 3. Create group

Create a group creation screen with:

- Group name (required).
- Description (optional).
- Group icon selection (optional).
- Create Group button.

Validate inputs.

After successful creation, navigate to the group's details screen.

## 4. Invitation system

Generate a secure, unpredictable invitation code for each group.

Support:

- Copy invitation code.
- Share invitation code using the native share sheet.
- Enter invitation code to join.
- Preview group details before joining.
- Confirm group membership.

Invitation codes should be generated securely on the server.

Do not use sequential or easily guessable codes.

Support invitation expiration and revocation.

Apply rate limiting to invitation-code lookups and joining attempts.

## 5. Join group

Create a Join Group screen.

Flow:

1. User enters an invitation code.
2. Backend validates the invitation.
3. App displays a safe preview of the group.
4. User confirms joining.
5. Backend creates membership.
6. User is redirected to group details.

Handle:

- Invalid codes.
- Expired codes.
- Revoked invitations.
- Duplicate membership.
- Network failures.
- Unauthorized requests.

Prevent duplicate memberships with a database constraint.

## 6. Group details

Display:

- Group name.
- Description.
- Group icon.
- Member count.
- Member list.
- Group owner.
- Invitation sharing.
- Active game sessions.
- Previous game sessions.

Only display session information that the current user is authorized to view.

If the user has no active sessions, show a friendly empty state.

## 7. Group management

### Owner permissions

The group owner can:

- Edit group name and description.
- Generate new invitations.
- Revoke invitations.
- Remove members when permitted.
- Transfer ownership.
- Delete the group when allowed.

### Member permissions

Members can:

- View group details.
- View other members' display names.
- Leave the group.
- Participate in permitted group activities.

Members cannot change group settings or remove other members.

## 8. Leaving and removing members

Implement secure leave and removal operations.

Rules:

- Users cannot remove other members without authorization.
- The owner must transfer ownership before leaving, unless deleting the group.
- Removing a group member must not silently alter an already-started game session.
- Game session membership remains separate from group membership.
- Existing game sessions must follow their own rules for leaving and removal.

Use server-side authorization and transactions.

## 9. Database

Create migrations for:

### `groups`

- id UUID primary key
- name TEXT not null
- description TEXT nullable
- icon_key TEXT nullable
- owner_id UUID references auth.users
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

### `group_members`

- id UUID primary key
- group_id UUID references groups
- user_id UUID references auth.users
- role TEXT
- joined_at TIMESTAMPTZ

Add a unique constraint on `(group_id, user_id)`.

### `group_invites`

- id UUID primary key
- group_id UUID references groups
- code_hash TEXT unique
- created_by UUID
- expires_at TIMESTAMPTZ nullable
- revoked_at TIMESTAMPTZ nullable
- max_uses INTEGER nullable
- use_count INTEGER
- created_at TIMESTAMPTZ

Store only a secure hash of the invitation code where feasible.

Generate and verify invitation codes through trusted server-side functions.

Use cryptographically strong random codes with sufficient entropy.

Ensure invitation redemption is atomic so usage limits cannot be exceeded under concurrent requests.

## 10. Integration with game sessions

Update the generic `game_sessions` table from Scope 02 to support an optional `group_id` foreign key.

Requirements:

- A group can have multiple game sessions.
- A game session belongs to at most one persistent group.
- A game session may also exist without a persistent group.
- Only authorized members may create sessions within a group.
- A user cannot access a private group's sessions without authorization.
- Joining a group does not automatically enroll the user in all existing sessions.

Do not implement game-specific rules in the group module.

## 11. UI screens

Create or complete:

- My Groups.
- Create Group.
- Join Group.
- Group Details.
- Group Members.
- Group Settings.
- Invitation Sharing.
- Invitation Preview.

Use existing Roam design tokens and reusable components.

Provide loading, success, empty and error states.

## 12. Security

Enable and verify RLS for exposed tables.

Ensure:

- Only members can view private group information.
- Only owners can modify protected settings.
- Users cannot impersonate other users.
- Invitation lookup exposes only safe preview information.
- Users cannot enumerate group invitations.
- Group deletion and ownership transfer are transactional.
- Privileged server functions validate `auth.uid()` and membership.
- No service-role credentials are included in the mobile application.

Avoid recursive RLS policies and unsafe SECURITY DEFINER implementations.

## 13. Testing

Add tests covering:

- Group creation.
- Automatic owner membership.
- Joining using a valid code.
- Invalid invitation codes.
- Expired and revoked invitations.
- Duplicate membership.
- Concurrent invitation redemption.
- Unauthorized group updates.
- Ownership transfer.
- Owner leave restrictions.
- Member removal.
- Multiple groups per user.
- Multiple game sessions per group.
- Private group session visibility.

## 14. Acceptance criteria

Scope 03 is complete when:

1. Authenticated users can create groups.
2. Users can join groups using invitation codes.
3. Group owners can manage their groups.
4. Group members can leave safely.
5. Invitations can expire or be revoked.
6. Groups persist independently of game sessions.
7. Groups can host multiple different games.
8. RLS and server-side authorization protect group data.
9. Existing Scope 01 and Scope 02 functionality remains intact.
10. All relevant tests pass.

## 15. Completion instructions

After implementation:

- List all created and modified files.
- List database migrations.
- Summarize security and RLS policies.
- Explain how groups integrate with game sessions.
- Report lint, TypeScript and test results.
- Identify remaining issues.

**Stop after Scope 03. Do not begin Scope 04 without approval.**