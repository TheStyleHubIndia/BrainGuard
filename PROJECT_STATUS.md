# BrainGuard status

## Implemented in source
- Dashboard and three-tab navigation
- Manual session entry
- Brain-state thresholds
- Daily goal setting
- XP, levels and streaks
- Starter achievement unlocks
- Seven-day local history
- AsyncStorage persistence
- Device-local date keys
- Native Android UsageStatsManager bridge for Instagram, YouTube, Facebook and Snapchat
- Android Usage Access permission flow
- App-wise usage display for today and aggregate last seven days
- Refresh when the app opens or returns to foreground

## Not implemented or verified
- Individual Reel / Short detection
- Continuous background monitoring service
- App blocking
- OS notifications / focus reminders
- Successful APK build for the native integration (pending CI)
- Android device testing and OEM-specific verification

## Important behavior
- Native usage totals are separate from manually logged sessions.
- Usage reports require the user to grant Android Usage Access.
- Expo Go and web preview cannot load the custom native module; use the generated Android APK.
- Android UsageStatsManager reports app foreground time, not individual content consumption.

## Acceptance checklist
- [ ] Android build passes
- [ ] Grant Usage Access from BrainGuard settings
- [ ] Confirm Instagram / YouTube / Facebook / Snapchat totals against Android Settings
- [ ] Confirm app refreshes after returning from another app
- [ ] Test on target Android device
