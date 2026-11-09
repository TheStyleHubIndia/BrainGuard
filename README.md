# BrainGuard v0.1 — Android-first prototype

This is an Expo React Native prototype. It is **not yet a native usage-tracking or app-blocking app**.

## Included
- Original dark dashboard and reactive brain-state mascot
- Fresh, Focused, Cooked and Overloaded states
- Manual scrolling-session logging
- Daily goal setting
- XP, levels, streaks and starter achievements
- Seven-day local history
- Local persistence with AsyncStorage
- Local date handling (device timezone)

## Not included yet
- Automatic Reels/Shorts detection
- Android Usage Access integration
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
All minutes in v0.1 are manually entered. They are not measured from Instagram, YouTube, or device usage. Stats are stored locally. No backend, analytics, account, or cloud sync is configured.

## Next native Android milestone
Implement an opt-in UsageStatsManager integration, explain Android Usage Access, and report per-app foreground time accurately. Do not represent app-level time as individual Reel/Short counts. Evaluate any blocking feature separately for compatibility, user consent and Google Play policy.
