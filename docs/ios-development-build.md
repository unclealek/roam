# Roam iOS development build

Roam uses bundle identifier `com.moredata.roam` and native Sign in with Apple. Use an installed Roam development build for account acceptance testing, rather than Expo Go.

## Configured

- Original user-supplied mascot icon: `assets/icon.png` (1254 × 1254, opaque).
- Apple sign-in capability and Expo plugin.
- Expo project: `@alekille/roam-social-games`.
- Development environment contains only the public Supabase URL and publishable client key.
- `development` EAS profile: internal distribution, physical device, development client.
- `development-simulator` profile: simulator only; not proof of real-device Apple sign-in.

## Build and install

```sh
eas build --platform ios --profile development
```

First-time setup requires signing in to the Apple Developer account, selecting the team that owns `com.moredata.roam`, and registering the test iPhone for internal distribution. Enter passwords and verification codes directly into the trusted Expo CLI, never into chat or source files.

After a successful build, install using the Expo build link on the registered iPhone, enable Developer Mode if requested, and run:

```sh
npm run start:dev
```

Open the development server from the installed Roam app on the same network. Complete Apple sign-in and verify the profile persists after reopening. Google OAuth must separately allow `roam://auth/callback` in Supabase.

## Current verification boundary

Local tests, lint, TypeScript, resolved icon and Apple entitlement pass. Apple accepted `com.moredata.roam` under team `3Y42VMC42F`, and the registered iPhone is included in the active ad hoc profile.

Development build **0.1.0 (1)** finished successfully:
https://expo.dev/accounts/alekille/projects/roam-social-games/builds/fbc12ee5-bf5d-43e1-a0e9-689d1a8f1e9d

Open that page on the registered iPhone and choose Install. The development server was started on port 8083. Installation and real-user login are still pending; this build was not submitted to TestFlight.

Supabase Apple Client IDs must include `com.moredata.roam`; the previously entered `com.roam.mobile` does not match this app.

## Simulator preview

Roam’s own simulator client is built with the `development-simulator` profile. It uses the same bundle identifier and native dependencies but produces a simulator app rather than an iPhone IPA.

```sh
eas build --platform ios --profile development-simulator
npm run ios -- --port 8083
```

The default `start` and `ios` scripts target the development client. Do not open the old Expo Go preview when testing this app. Simulator login results do not replace real-device acceptance.

Verified simulator build: `730f9b66-dabb-4f77-a9cb-e11f154be227`. Installed and launched on iPhone 18 Pro with `com.moredata.roam`; both sign-in buttons render enabled without the Expo Go notice. The simulator window is hosted by Xcode’s Device Hub.
