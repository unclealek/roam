# Scope 03 — Groups & Invitations

Implemented on 27 October 2026. The user subsequently approved hosted migration application; both Scope 03 migrations are now applied to Roam (`ywpmvqgtiawtkcqxeehf`). No Git push or native development-client build was performed. Scope 04 has not been started.

## Behavior

The Groups tab now provides My Groups, Create Group, and Join Group. Protected routes provide Group Details, Group Members, Group Settings, Invitation Sharing, and an explicit Invitation Preview step before joining. Existing Roam Screen, Panel, Field, Button, loading/error/empty-state components and tokens are reused.

Owners can edit names/descriptions/icons, generate expiring invitations with optional use limits, revoke invitations, remove members, transfer ownership to an existing member, and delete groups that have no game sessions. Destructive actions require confirmation; deletion additionally requires typing DELETE. Members can read peer display names and leave. Owners must transfer ownership before leaving. A user can belong to multiple groups.

Codes are generated when the owner selects Generate invitation. Each generated code is displayed once and can be copied or shared through React Native's native share sheet. The plaintext remains in screen memory only and is cleared on leaving, account changes, or revocation. It is never put in navigation URLs, persisted client storage, logs, or invitation-list responses. Existing codes cannot be recovered; owners can generate a new code and revoke old invitations.

## Migration and security

`supabase/migrations/20261027090000_groups_invitations.sql` adds:

- `public.groups`, `public.group_members`, `public.group_invites`, and private per-user invitation attempt counters.
- A unique `(group_id,user_id)` constraint and a partial unique owner-membership index.
- RLS on all three public tables. Authenticated clients have SELECT only on groups/members, filtered by active-session membership. Invitations have no client table privileges or enumeration policy, including for owners.
- Definer membership helpers in the private schema to avoid recursive RLS; helpers derive identity from the caller and verify an active Auth session. Privileged functions use an empty search path, schema-qualified tables, explicit revokes/grants, and no caller-supplied actor ID.
- Trusted creation/list/detail/management/invitation RPCs. All client writes are denied at the table boundary. Safe invitation previews contain only group ID, name, description, icon, and member count. Peer names are projected only for members; profile table policies are unchanged.
- Two server-generated UUIDv4 values per invitation, supplying 244 random bits, with SHA-256-only storage. Invitations default to seven days; owners can select 1–30 days and a positive use limit. Invalid, expired, revoked, and exhausted invitations share one safe error response.
- A shared limit of 20 preview/redemption calls per authenticated account per five minutes. Invalid-code responses are returned as values rather than raised exceptions, so attempts commit instead of rolling back. The client translates them into readable error messages. Anonymous and revoked-session requests are denied.
- Row locking in management and redemption, with group-before-invitation lock ordering. Redemption checks expiration, revocation, membership, and remaining uses under the lock. Duplicate membership is idempotent and does not spend another use. Ownership transfer and deletion are transactional.
- A real optional `game_sessions.group_id` FK with deletion restricted to preserve history. Group/session identity remains immutable. Indexes cover membership, owner, invitation group/hash, and session group lookups.
- Account deletion requires owners to transfer or delete groups first. The app explains this specific requirement; deletion after transfer keeps the remaining group intact.

Reviewed against [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and the current Supabase changelog. No service-role key or new secret was added to the app.

## Game-session integration

The existing engine is extended behind its original RPC entry points; standalone session creation, validation, host permissions, lifecycle transitions, capacity locks, and retry fingerprints remain compatible. A new `create_group_game_session` RPC adds a group ID and requires membership. The session service accepts an optional `groupId` and uses the appropriate RPC. Group session IDs are included in retry fingerprints; standalone fingerprints retain their previous format.

Groups can have multiple sessions and game types. Joining a group never joins a session. A member can create a session for a registered, available game, or enter a host-provided session ID to join an open lobby. Group lobbies reject nonmembers. Group details display only the caller's own session memberships, grouped into current and previous sessions; group membership alone does not expose private game state.

Leaving/removal never deletes or changes game-session membership, including started games. Existing session participants retain access to their own sessions after group removal, under the original game rules. Group details become unavailable once group membership ends. Any group with sessions is undeletable, preserving game history. Group ownership is separate from session host authority.

Secret Santa remains Coming soon. The developer-only available game fixture exercises group session creation without shipping another game or starting Scope 04.

## Validation

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run format:check`: passed.
- `npm run test:coverage`: 160 tests passed across 19 files. Configured platform coverage: 95.59% statements, 93.62% branches, 91.75% functions, 97.28% lines. Group service coverage: 98.57% lines, 97.46% branches. These percentages cover the configured domain/service modules, not every UI branch.
- Existing session database tests now apply the full migration chain, exercising the original engine against Scope 03.
- Group database tests cover creation/owner membership, multiple groups/sessions, code validation, expiry/revocation, duplicate memberships and constraints, exhausted uses, rate-limit persistence/reset/account isolation, anonymous/revoked-session denial, RLS/private-session visibility, transfer rollback, owner leave restrictions, member removal, preserved started-game membership, group deletion restrictions, and account deletion after ownership transfer.
- Group service and screen tests cover validation, transport arguments, safe errors, loading/empty/retry states, creation, explicit preview/confirmation, owner/member controls, transfer confirmation, and copy/revoke behavior.
- Browser suite: nine flows passed using mocked Supabase HTTP responses, including all existing auth/catalog/session regressions and new create/invite/revoke/preview/join flows. Group deep links remain authenticated. Mobile-width screenshots are in ignored `test-results/`.
- `scripts/test-group-concurrency.mjs`: passed against an isolated temporary PostgreSQL 17 runtime. Two separate connections were held concurrently at the same group row lock for a one-use invitation; exactly one redemption succeeded, the other returned unavailable, `use_count` stayed 1, and membership count stayed 2. The server was stopped after the test. This is stronger than the additional queued PGlite idempotency test.
- Web, iOS, and Android Metro exports are local compilation checks, not native installation or hosted API verification.

To reproduce the independent-connection race without touching any backend:

```sh
npm install --prefix /tmp/roam-scope03-postgres embedded-postgres@17.10.0-beta.17 --no-audit --no-fund
ROAM_POSTGRES_RUNTIME=/tmp/roam-scope03-postgres/package.json node scripts/test-group-concurrency.mjs
```

The runner uses a disposable loopback cluster on port 55483, applies all migrations against synthetic Auth fixtures, and never reads `.env`. The runtime is intentionally outside the app dependency graph.

## Remaining release checks

1. Hosted migrations are applied and schema/RLS/grants verified. Regenerate database types and verify end-to-end authenticated app behavior with real accounts; schema verification does not prove device behavior.
2. Rebuild the native development client with `expo-clipboard`, then verify native copy, share-sheet cancellation/success, and group flows using two real accounts on iOS and Android. Clipboard loading is deferred so older clients can still navigate Groups and share codes.
3. The production catalog still has no available games. Group session creation is verified with a developer-only fixture; actual gameplay remains out of scope.
4. Invitation throttling is per authenticated account, not IP. Distributed edge/IP abuse controls are not part of this database-only rate limit.

## Created files

- `scope-03-groups-invitations.md`
- `supabase/migrations/20261027090000_groups_invitations.sql`
- `src/platform/groups/types.ts`
- `src/platform/groups/service.ts`
- `src/presentation/groups/GroupScreens.tsx`
- `app/(account)/group/create.tsx`
- `app/(account)/group/join.tsx`
- `app/(account)/group/[groupId]/index.tsx`
- `app/(account)/group/[groupId]/members.tsx`
- `app/(account)/group/[groupId]/settings.tsx`
- `app/(account)/group/[groupId]/invites.tsx`
- `tests/groups-database.test.ts`
- `tests/group-services.test.ts`
- `tests/group-screens.test.tsx`
- `e2e/groups.spec.ts`
- `scripts/test-group-concurrency.mjs`
- `docs/scope-03-review.md`

## Modified files

- `app/(tabs)/groups.tsx`
- `app/(tabs)/profile.tsx`
- `app/(account)/session/[sessionId].tsx`
- `src/platform/database.types.ts`
- `src/platform/auth/operations.ts`
- `src/platform/sessions/types.ts`
- `src/platform/sessions/validation.ts`
- `src/platform/sessions/service.ts`
- `tests/fixtures/database.ts`
- `tests/screens.test.tsx`
- `tests/session-services.test.ts`
- `tests/account.test.ts`
- `e2e/foundation.spec.ts`
- `vitest.config.mts`
- `package.json`
- `package-lock.json`
- `README.md`
- `WORK_LOG.md`

## Hosted application — 27 October 2026

User explicitly approved applying the migration. The connector lacked Roam access; the authenticated CLI confirmed project identity (Roam, ACTIVE_HEALTHY) and the original three migration versions. A dry run selected only Scope 03, which was then applied with vault/seed updates excluded.

- Applied `20261027090000_groups_invitations.sql`, with explicit authenticated-only execution grants for the group-session creation RPC.
- The first advisor run flagged five public SECURITY DEFINER entry points. Added and applied `20261027090001_group_rpc_private_implementations.sql`: privileged bodies moved into private; public invoker wrappers preserve existing signatures, defaults, and authorization. The migration was created using the CLI and sequenced after the previously reserved Scope 03 version.
- Verified migration history, RLS on all seven public app tables, group FK with DELETE RESTRICT, unique memberships, denied direct writes/invitation-table reads, authenticated RPC grants, anonymous RPC denial, and zero public privileged group entry points.
- Final security/performance advisors returned no issues; migration dry run reported up to date with no pending versions.
- Focused group/session database tests: 32 passed with the complete five-migration chain.
- Added the remediation migration to the test fixture chain. No real user/group records were created for verification.
