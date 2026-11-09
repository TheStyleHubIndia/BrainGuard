# BrainGuard v0.1 — Android-first prototype

This is an Expo React Native prototype. It is **not yet a native usage-tracking or app-blocking app**.

## Included
- Original dark dashboard and reactive brain-state mascot
- Fresh, Focused, Cooked and Overloaded states
- Manual scrolling-session logging
- Native Android UsageStatsManager integration for Instagram, YouTube, Facebook and Snapchat
- Opt-in Usage Access permission flow and app-wise foreground-time dashboard
- Today and last-7-days aggregate app usage reports (refreshed on app foreground)
- Daily goal setting
- XP, levels, streaks and starter achievements
- Seven-day local history
- Local persistence with AsyncStorage
- Local date handling (device timezone)

## Not included yet
- Automatic Reels/Shorts detection
- Per-app usage totals are refreshed when the app opens or returns to foreground; no continuous background service
- Accessibility Service
- System-level app blocking
- Scheduled OS notifications
- APK build or device verification

## Preview free in a browser
1. Open https://snack.expo.dev/ on Android.
2. Create a new Expo Snack.
3. Paste the contents of `App.js` into the editor.
4. Add dependency `@react-native-async-storage/async-storage`.
5. Preview with Expo Go.

## Run locally (optional)
Run `npm install`, then `npx expo start`.

## Data and accuracy
Manual session entries are stored locally. Native app usage totals are read from Android UsageStatsManager after the user grants Usage Access. Estimated Reels/Shorts swipe counts are collected separately through the opt-in AccessibilityService and stored locally by app and local date. The accessibility service does not retrieve window content or screen text. No backend, analytics, account, or cloud sync is configured.

## Next native Android milestone
Implement an opt-in UsageStatsManager integration, explain Android Usage Access, and report per-app foreground time accurately. Do not represent app-level time as individual Reel/Short counts. Evaluate any blocking feature separately for compatibility, user consent and Google Play policy.


## Build an Android APK with GitHub Actions

A GitHub Actions workflow is included at `.github/workflows/android-build.yml`.

1. Open the repository's **Actions** tab.
2. Select **Build Android APK**.
3. Tap **Run workflow** on the `main` branch.
4. Wait for the workflow to finish successfully.
5. Open the completed run and download the `BrainGuard-Android-APK` artifact.

The artifact is a debug-signed release-variant APK intended for testing/sideloading, not a Play Store production release. GitHub-hosted runner availability and free-minute limits apply. The first build may fail if Expo/Android dependency versions need adjustment; inspect the workflow logs rather than assuming an APK was produced.
