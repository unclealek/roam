# Scope 07.6 — User safety, reporting and moderation

## In the app

- In Group Details, tap **Report group**. In **View members**, tap **Report member** under another member’s name.
- Choose a reason, optionally add up to 1,000 characters, and submit. The sheet confirms receipt or lets the reporter retry.
- **Profile → Privacy & account → Safety & Reporting** provides instructions and links to support and the Community Guidelines.

## Private storage and administrative review

The app invokes `public.submit_safety_report` with the group context, optional target user, reason and optional description. The database derives the reporter from an active authenticated session and checks current group membership for both parties to a member report. It rejects self-reports, invalid reasons and overlong descriptions. The response contains no report details.

The reports and rate counters are in the non-exposed `private` schema with RLS enabled, no client policies and explicit privilege revocations. Group ownership confers no moderation access. The submission RPC is the only client entry point. It serializes submissions per reporter, treats the same target, group context and reason within 24 hours as a successful retry without creating another row, and accepts up to five new reports per one-hour window. The first report’s explanation is retained on a duplicate.

Review uses the Supabase project’s privileged SQL Editor. Use an existing project administrator account authorized to investigate complaints. Keep report details in the Dashboard. The rows contain no game assignments. Deleting either account or deleting the relevant group cascades to its associated reports. Deleting a reporter also removes the rate counter. This keeps account and group deletion functional and means deleted targets are unavailable for subsequent review.

1. Open the project in Supabase Dashboard and select **SQL Editor**. Run the following to see the current queue. Treat the description as user-submitted text.

   ```sql
   select r.id, r.created_at, r.reported_type, r.reporter_id,
          r.reported_group_id, r.reported_user_id, r.context_group_id,
          g.name as group_name, p.display_name as member_name,
          r.reason, r.description, r.status, r.review_decision, r.resolved_at
   from private.safety_reports as r
   left join public.groups as g
     on g.id = coalesce(r.reported_group_id, r.context_group_id)
   left join public.profiles as p on p.id = r.reported_user_id
   where r.status in ('pending', 'reviewing')
   order by r.created_at, r.id;
   ```

2. Replace the example UUID with the report ID and move it into review.

   ```sql
   update private.safety_reports
   set status = 'reviewing'
   where id = '00000000-0000-0000-0000-000000000000'::uuid
     and status = 'pending'
   returning id, status, updated_at;
   ```

3. Enter a concise decision and use `resolved` or `dismissed`. The database requires a decision for either terminal status and sets the resolution time automatically. A zero-row result means the report is no longer in the expected state.

   ```sql
   update private.safety_reports
   set status = 'resolved',
       review_decision = 'Replace with the actual decision and action taken.'
   where id = '00000000-0000-0000-0000-000000000000'::uuid
     and status = 'reviewing'
   returning id, status, updated_at, resolved_at;
   ```

## Content checks and blocking

The existing length and control-character restrictions still apply. The new check rejects a short list of exact explicit threats in names and group descriptions, ignoring capitalization and repeated spaces. It accepts international names and avoids broad substring filters. The database validates inserts and changed values, so existing text does not prevent unrelated edits. Reports cover context and inappropriate content outside this narrow check.

Roam has shareable invitation codes and no account-targeted invitation, messaging, or other direct contact workflow. Personal blocking has no direct interaction to stop. Group owner controls and Secret Santa participation remain separate.

## Website and rollout

- The official [support](https://www.moredata.app/roam/support) and [Community Guidelines](https://www.moredata.app/roam/community-guidelines) pages returned HTTP 200. The published support page already includes **Report a concern** and explains in-app group and member reporting.
- The app and published support page use `roamsupport@moredata.app`. The available MoreData checkout lacks the source routes for the published pages.
- The repository has no configured outgoing transactional email integration for reports. Email notification is an optional follow-up. The SQL Editor is the review queue.
- The new migration is `20261107202522_safety_reports.sql`. It was exercised in the PGlite integration suite. Apply it to an authorized hosted environment and verify the authenticated RPC and Dashboard review before releasing the updated app. Production migration requires approval.

## File inventory

| Change | Files |
| --- | --- |
| Added migration | [20261107202522_safety_reports.sql](../supabase/migrations/20261107202522_safety_reports.sql) |
| Added reporting and validation | [report.ts](../src/platform/safety/report.ts), [service.ts](../src/platform/safety/service.ts), [content.ts](../src/platform/safety/content.ts), [ReportSheet.tsx](../src/presentation/safety/ReportSheet.tsx) |
| Added tests | [database integration](../tests/safety-database.test.ts), [validation](../tests/safety-validation.test.ts), [sheet interaction](../tests/safety-sheet.test.tsx), [browser flow](../e2e/safety.spec.ts) |
| Added documentation | This runbook |
| Modified app | [GroupScreens.tsx](../src/presentation/groups/GroupScreens.tsx), [PrivacyScreen.tsx](../src/presentation/profile/PrivacyScreen.tsx), [roam-website.ts](../src/presentation/roam-website.ts), [RoamButton.tsx](../src/presentation/brand/RoamButton.tsx), [overlays.tsx](../src/presentation/brand/overlays.tsx) |
| Modified platform | [database.types.ts](../src/platform/database.types.ts), [group service](../src/platform/groups/service.ts), [profile validation](../src/platform/profiles/validation.ts) |

## Verification

- TypeScript, ESLint, and all 351 Vitest tests passed. PGlite exercised the migration with separate client and administrative roles, including the RLS default-deny behavior.
- The reporting browser scenario verified both entry points and the exact RPC payloads against a disposable local fixture. The full browser pass recorded 44 passing checks and the same 17 failures as the pre-change snapshot, which had 43 passing checks.
- The final Expo exports succeeded for iOS, Android, and web. Xcode built an unsigned iOS simulator app. Hosted Supabase, Android native compilation, physical devices, and native screen readers remain unverified.
