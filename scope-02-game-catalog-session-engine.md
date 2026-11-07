# ROAM — SCOPE 02: GAME CATALOG & SESSION ENGINE

You are working on Roam, a multiplayer social gaming platform built with Expo, React Native, TypeScript and Supabase.

Scope 01 established the application foundation, authentication, profiles and navigation.

Your task is to implement **Scope 02: Game Catalog & Session Engine**.

## 1. Inspect the existing project

Before implementation:

- Review the current project structure.
- Identify the existing navigation and authentication setup.
- Review Supabase configuration and migrations.
- Reuse existing components and design tokens.
- Preserve all working Scope 01 features.

Do not rebuild the project or implement later scopes.

## 2. Game catalog

Create a reusable catalog of games.

Each game should have:

- Unique identifier.
- Display name.
- Description.
- Category.
- Icon or artwork reference.
- Minimum and maximum players.
- Availability status.
- Game configuration schema.
- Route to its game-specific experience.

Initial game types:

**Secret Santa**
- ID: `secret_santa`
- Category: Social / Mystery
- Status: Coming soon
- Minimum players: 2
- Description: Exchange secret gifts, discover clues and play mystery challenges with friends.

**Future Games**
- Show a generic coming-soon placeholder.
- Do not invent or implement additional production games.

Only registered game types should be selectable.

## 3. Game registry

Implement a typed registry using TypeScript.

The registry should define:

- Game identifier.
- Metadata.
- Configuration validation.
- Route definitions.
- Supported lifecycle operations.

Use a modular monolith architecture.

Suggested structure:

```text
src/
  platform/
    games/
      registry.ts
      types.ts
      services/
    sessions/
      services/
      hooks/
  games/
    secret-santa/
      index.ts
      config.ts
      screens/
  components/
    games/
```

Adapt this structure to existing project conventions.

Avoid dynamic code loading or microservices.

## 4. Game session engine

Implement generic game sessions.

A session represents one instance of a game being played.

Example:

A group called "Office Friends" could play Secret Santa in December and a different game in January.

Each session should include:

- Session ID.
- Game type.
- Host ID.
- Optional group ID.
- Session name.
- Configuration.
- Status.
- Created timestamp.
- Started timestamp.
- Completed timestamp.

Generic statuses:

- `draft`
- `lobby`
- `active`
- `completed`
- `cancelled`
- `failed`

Game-specific phases must be modeled separately.

## 5. Session operations

Implement secure operations for:

- Creating a session.
- Fetching a session.
- Listing sessions visible to the authenticated user.
- Updating permitted session settings.
- Joining a session.
- Leaving a session.
- Cancelling a session.
- Starting a session when the game supports it.

All operations must validate authentication and authorization.

Use server-side enforcement for lifecycle transitions.

Do not trust client-provided host IDs or membership claims.

## 6. Database

Create migrations for:

### `game_types`
- id
- name
- description
- category
- min_players
- max_players
- availability_status
- created_at

### `game_sessions`
- id
- game_type_id
- host_id
- group_id (nullable; add the foreign key when groups exist)
- name
- configuration
- status
- created_at
- started_at
- completed_at

### `game_session_members`
- id
- session_id
- user_id
- joined_at
- role

Add:
- Appropriate foreign keys.
- Unique membership constraints.
- Useful indexes.
- Valid lifecycle constraints.
- RLS policies.

For Scope 02, keep `group_id` nullable and defer group association until Scope 03 if the groups table does not yet exist.

Validate configuration against a game-specific schema on the trusted server before persistence.

Do not rely on client-side validation alone.

## 7. Game catalog UI

Create a Games screen.

Display:

- Available games.
- Coming-soon games.
- Game artwork or icons.
- Game descriptions.
- Player count requirements.
- Availability indicators.

Selecting Secret Santa should open a game details screen.

Until Scope 06, show a clear "Coming soon" state rather than a broken create-session action.

## 8. My Games

Create a section showing sessions the user belongs to.

Include:

- Session name.
- Game type.
- Current status.
- Participant count.
- Session details navigation.

Support empty states.

## 9. Session details

Create a reusable session details screen showing:

- Game name.
- Session name.
- Host.
- Participants.
- Session status.
- Created date.

Show only actions permitted by the authenticated user's role.

Do not implement invitations, matching, Mind Match or missions in this scope.

## 10. Testing

Add tests for:

- Game registry lookup.
- Unknown game IDs.
- Game configuration validation.
- Session creation.
- Duplicate membership prevention.
- Unauthorized session updates.
- Valid and invalid lifecycle transitions.
- Host-only cancellation.
- Session visibility.

## 11. Acceptance criteria

Scope 02 is complete when:

1. Users can browse the game catalog.
2. Secret Santa appears as the first game.
3. The app supports a typed game registry.
4. The database supports multiple game types.
5. Authorized users can create and manage generic sessions through tested services.
6. Sessions have validated lifecycle transitions.
7. Users can see sessions they belong to.
8. The architecture supports adding a second game without rewriting core services.
9. Existing authentication and navigation still work.
10. No Secret Santa gameplay has been implemented prematurely.

## 12. Completion report

After implementation:

- List created and modified files.
- List migrations.
- Explain the registry design.
- Explain session authorization.
- Report lint, TypeScript and test results.
- Identify any remaining issues.

Stop after Scope 02. Do not begin Scope 03 without approval.