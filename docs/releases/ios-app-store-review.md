# Roam iOS App Review handoff

**App Store Connect record** [Roam](https://appstoreconnect.apple.com/apps/6827296384) · Bundle ID `com.moredata.roam`

## Release gates

1. Approve and apply [the reporting migration](../../supabase/migrations/20261107202522_safety_reports.sql) to the Supabase project used by the intended store build. Verify a member report and a group report end to end, confirm that another member cannot read them, then review and resolve a test report in the Dashboard. See the [moderation runbook](../scope-07.6-safety.md).
2. Review guideline 1.2 against Roam’s member-visible display names, group names, and group descriptions. Roam currently filters a small set of explicit threats and has private reporting. It uses shareable invitation codes and has no chat, public feed, or personal block control. Decide whether to strengthen filtering or add a moderator restriction before review. Record who will monitor reports and handle them promptly.
3. Confirm the latest build number in App Store Connect and use a new build number for the signed candidate. Confirm the build environment targets the intended hosted project. Upload the candidate to TestFlight and verify reporting, sign-in, invitations, push notifications, and account deletion on a physical iPhone. Test deletion with a separate disposable account so reviewer access remains intact.
4. Use the provisioned Apple reviewer account in the private **Roam App Review** group. Test the sign-in instructions from a fresh install and keep the account and backend available during review. Enter any credentials only in App Store Connect’s review information fields.
5. Confirm the App Store listing, screenshots, age rating, support URL, privacy policy, and privacy disclosures. Review the disclosures for stored report text and linked account identifiers, including Apple's Customer Support and User Content categories. Use `roamsupport@moredata.app` as the public support address and confirm the App Review contact is monitored.
6. Attach the verified build, enter the review notes, and confirm the release option. Submit the selected version after the owner authorizes App Review submission.

## Reviewer access

The hosted account `roam-app-review@example.invalid` can sign in with its password and read the two-member **Roam App Review** group. Copy its password from the private credential handoff into the App Review Information password field. Keep the owner’s credentials private. The reviewer requires a build that includes **Sign in with email**. Reporting instructions apply after the hosted reporting migration is live.

## Draft App Review notes

Roam is a private group games app. On the sign-in screen, tap **Sign in with email**, enter the credentials in App Review Information, and tap **Sign in**. Open **Groups → Roam App Review**. The reviewer is a regular group member, and **Demo Host** is available for testing member reporting.

- **Report a group.** On the group details screen, tap **Report group**, choose a reason, and tap **Submit report**.
- **Report a member.** Tap **View members** and **Report member** under **Demo Host**. Choose a reason and submit. An explanation is optional.
- **Safety and support.** Open **Profile → Privacy & account → Safety & Reporting**. The support contact is `roamsupport@moredata.app`. Roam reviews reports privately.
- **Account deletion.** Open **Profile → Privacy & account → Delete account**. Use separate disposable review access for deletion testing.

## References

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple app privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple submission workflow](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app-for-review/)
- [Roam Support](https://www.moredata.app/roam/support)
- [Roam Community Guidelines](https://www.moredata.app/roam/community-guidelines)
