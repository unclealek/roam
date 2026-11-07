# Scope 02 review — Game Catalog & Session Engine

Implemented locally on 26 October 2026. Scope 03 has not started.

**Subsequent setup update:** Scope 01–02 migrations are now deployed to the supplied Roam project, all four tables have RLS, and security/performance advisors pass after a separate maintenance-function permission hardening migration. The pre-deployment report below preserves the original review state; see `../WORK_LOG.md` for the latest evidence. Real Apple/Google OAuth and authenticated device flows remain pending.

The supplied request is preserved in [scope-02-game-catalog-session-engine.md](../scope-02-game-catalog-session-engine.md). The existing Expo SDK 58 foundation, auth provider, profile behavior, shared UI, and five-tab navigation were reused. No dependencies were added or updated.

## Behavior

- Games loads the catalog from Supabase and displays only entries recognized by the app registry. Secret Santa is the sole production module, with the requested description/category, a gift icon, 2+ players, and Coming soon availability. No maximum was invented.
- The Future Games placeholder is informational and cannot be selected.
- Secret Santa opens a registered details page with a clear Coming soon state. There is no create-session or gameplay action.
- My Games lists only sessions the caller belongs to, with game name, session name, status, participant count, and detail navigation. Empty, loading, error, and retry states are included.
- Protected session details show the host, participants, status, and locally formatted creation date. Controls depend on the caller's host/member role, lifecycle state, and registered module support. Host settings, lobby opening, start, cancellation confirmation, and member leaving delegate to trusted services.
- Resource requests are scoped to the account and loader; stale responses are ignored on account/route changes. Session route changes reset unsaved editor and confirmation state.

## Registry design

`createGameRegistry` builds a static, typed map of modules and rejects duplicate/unknown identifiers. Each definition contains metadata, a strict configuration schema and validator, route definitions, and supported lifecycle operations. No dynamic code loading is used.

`src/games/secret-santa` reserves the module's identity and validates only an empty configuration object. Its operation list is empty and its playable experience route is null until Scope 06. It contains no gift settings, assignments, matching, clues, missions, or scheduling.

The matching trusted registry lives in `game_types`: metadata, availability, configuration schema, and supported operations are managed only by migrations/server administration. The client never enables a coming-soon module simply because the database says it is available, and honors backend unavailability.

The shared schema contract is a strict JSON Schema subset: object properties containing bounded strings, safe integers with bounds, and booleans; required properties; no additional properties. PostgreSQL enforces the same contract before persistence, even if the client validator is bypassed. Nested/game-specific requirements beyond this subset need a trusted validator extension when introduced.

The second module exists only under `tests/fixtures/game.ts`. Tests register it in an isolated client registry and an isolated PostgreSQL database, then create/manage sessions using unchanged services. It is never imported by application code or seeded by production migrations.

## Database migration

New migration: `supabase/migrations/20261026185245_game_catalog_session_engine.sql`.

It adds:

- `game_types`, seeded with Secret Santa only.
- `game_sessions`, with UUID identity, game/host foreign keys, name, configuration, lifecycle timestamps, and per-host creation request IDs/fingerprints for idempotent retries.
- `game_session_members`, with foreign keys, unique session/user membership, a unique host-role index, and user/session lookup indexes.
- Owner/member SELECT policies, explicit grants, trusted mutation functions, and lifecycle/configuration constraints.

`group_id` is nullable and constrained to null. Scope 03 must replace that constraint with a real groups foreign key and authorization before associations can be stored.

The existing Scope 01 migration is unchanged. No remote project was linked, queried for user data, or modified; no migration was deployed.

## Session authorization and lifecycle

Clients have no INSERT, UPDATE, or DELETE grants on the three new tables. Exposed RPC wrappers use SECURITY INVOKER; privileged implementations live in the unexposed `private` schema with fixed search paths and explicit execute grants. Every operation checks the authenticated user against a live caller-owned `auth.sessions` record. Host and membership claims are derived server-side, never accepted as parameters.

| Operation | Server rule |
| --- | --- |
| Create | Registered available game supporting creation; valid schema/name; derive host from caller; insert host membership in the same transaction. Repeated request ID returns the original session; different payload for that ID is rejected. |
| Fetch/list | Membership required. RLS also prevents direct table reads of other sessions/memberships. Only an authorized detail response includes participant display names; the private profile policy stays unchanged. |
| Update | Host only, draft/lobby only, name and configuration only. Configuration is revalidated using the actual locked session's game type. |
| Open lobby | Host only; draft; available game supporting the operation. |
| Join | Any signed-in user who knows the ID may join an explicitly opened lobby, if the game supports joining and capacity remains. There is no public lobby discovery or invitation mechanism. Drafts are private and cannot be joined. Duplicate joins are idempotent. |
| Leave | Non-host member only, before start/end, with module support. Repeated leave is harmless. Hosts must cancel instead. |
| Start | Host only, lobby only, available supporting game, within player-count limits. |
| Cancel | Host only, supported operation, draft/lobby/active. Repeat cancellation is idempotent. Terminal completed/failed sessions cannot be cancelled. |

Mutations lock the session row before checking/changing membership, capacity, settings, or lifecycle. This serializes competing joins, leaves, and starts on hosted PostgreSQL. Local PGlite tests validate constraints and operation behavior; they do not prove independent multi-connection concurrency on hosted Supabase.

Allowed transitions:

```text
draft  → lobby | cancelled
lobby  → active | cancelled | failed
active → completed | cancelled | failed
completed / cancelled / failed → terminal
```

A trigger enforces the graph, immutable identity/settings after launch, and server-owned lifecycle timestamps. Client RPCs do not accept arbitrary status values. Completed/failed transitions are reserved for future trusted game/server handlers; no finish worker or gameplay was added.

Account deletion still works: deleting a host cascades to their hosted sessions and memberships; deleting a participant removes their membership. There is no host transfer or active-game compensation policy in this scope. Future game modules must handle account removal when defining their gameplay rules.

## Validation

- ESLint: passed without warnings.
- TypeScript: passed.
- Vitest: 114 tests across 13 files, including the complete Scope 01 suite.
- Coverage: enforced minimum 80% for statements, branches, functions, and lines across auth/profile and new registry/session service modules. UI interactions and actual migration behavior have additional tests.
- PostgreSQL: both migrations executed in PGlite with test-only auth fixtures and roles. Tests cover unknown/unavailable games, server configuration validation, creation/host derivation, retry idempotency, duplicate membership, visibility, unauthorized updates, participant vs host permissions, capacity, supported operations, the complete lifecycle transition matrix, timestamps, and account-deletion cascades.
- Playwright: six fixture-based browser flows pass, covering the original auth/profile/deletion flow, catalog/details/empty state, session settings and refresh, retry recovery, and authentication gates for deep links.
- Web, iOS, and Android Metro exports pass. These are bundle checks, not native distribution builds.
- Mobile catalog screenshot visually reviewed; styling reuses Scope 01 tokens/components.

## Created files

```text
scope-02-game-catalog-session-engine.md
docs/scope-02-review.md
app/(account)/_layout.tsx
app/(account)/game/[gameId].tsx
app/(account)/session/[sessionId].tsx
src/games/secret-santa/config.ts
src/games/secret-santa/index.ts
src/platform/games/types.ts
src/platform/games/configuration.ts
src/platform/games/registry.ts
src/platform/games/service.ts
src/platform/sessions/types.ts
src/platform/sessions/validation.ts
src/platform/sessions/service.ts
src/platform/sessions/permissions.ts
src/platform/sessions/useAccountResource.ts
src/presentation/games/GameCard.tsx
src/presentation/games/MyGames.tsx
supabase/migrations/20261026185245_game_catalog_session_engine.sql
tests/fixtures/game.ts
tests/fixtures/database.ts
tests/registry.test.ts
tests/sessions-database.test.ts
tests/session-services.test.ts
tests/catalog.test.ts
tests/game-screens.test.tsx
tests/account-resource.test.tsx
e2e/games.spec.ts
```

## Modified files

```text
app/_layout.tsx                         Add protected detail-route stack.
app/(tabs)/games.tsx                    Replace placeholder with catalog and My Games.
src/platform/database.types.ts         Add table/RPC contracts.
vitest.config.mts                      Include registry/session modules in coverage.
tests/screens.test.tsx                 Keep neutral-theme assertion on global screens; Games now has its own tests.
e2e/foundation.spec.ts                 Extend local fixture responses for the new catalog/session reads.
README.md                              Update current scope, architecture, and validation instructions.
WORK_LOG.md                            Record implementation, decisions, evidence, and review boundary.
```

## Remaining issues and review boundary

- The intended Supabase project and Apple/Google providers are still unconfigured. Hosted migration/application, advisors, real authenticated HTTP behavior, device OAuth/restart persistence, and native navigation remain unverified.
- No production game is enabled for session creation. Generic engine behavior is demonstrated through tested services and the developer-only fixture; Secret Santa creation stays gated until Scope 06.
- Review the explicit open-lobby joining policy and host-deletion cascade behavior above before rollout.
- Scope 01's upstream Expo CLI/node-forge audit findings and provider-side token revocation requirement remain pending. Dependencies were unchanged in this scope.
- No commit, push, deployment, EAS build, or submission was performed.

Stop here for review. Scope 03 is not implemented.
