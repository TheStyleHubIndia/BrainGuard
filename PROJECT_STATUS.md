# BrainGuard status

## Implemented in source
- Existing dashboard, navigation, goals, XP, streaks and local history retained
- Manual session entry and AsyncStorage persistence
- Native Android UsageStatsManager app-usage bridge (separate from swipe counts)
- Android Usage Access permission flow
- Draggable floating brain counter using Android WindowManager
- Foreground notification while floating overlay is active
- AccessibilityService configured for scroll and feed subtree-change events from Instagram, YouTube, Facebook and Snapchat
- Daily per-app swipe estimates stored locally using YYYY-MM-DD keys; local midnight naturally starts a new daily total
- Counter UI displays total plus Instagram Reels, YouTube Shorts, Facebook Reels and Snapchat Spotlight breakdown
- Accessibility service does not request window-content retrieval and does not read screen text or capture screen contents
- Duplicate scroll/content-change events are coalesced with a per-app 1.1-second debounce

## Detection limitations
- Counts are estimates of feed navigation/scroll events, not verified completed or watched videos
- App versions, OEM accessibility event behavior, nested feed views and autoplay can cause missed or extra counts
- AccessibilityService permission must be explicitly enabled by the user in Android Settings; the app cannot grant it silently
- Floating widget separately requires Display over other apps permission
- Expo Go and web preview cannot load these custom native modules; install the generated APK

## Not implemented or verified
- Individual Reel/Short completion detection
- App blocking
- Android device testing across target apps and OEM versions
- Successful APK build for this latest AccessibilityService integration (CI pending)

## Acceptance checklist
- [ ] Android release APK builds
- [ ] Enable BrainGuard swipe counter in Android Accessibility settings
- [ ] Grant Display over other apps permission
- [ ] Verify Instagram Reels swipe count
- [ ] Verify YouTube Shorts swipe count
- [ ] Verify Facebook Reels swipe count
- [ ] Verify Snapchat Spotlight swipe count
- [ ] Verify local-midnight reset
- [ ] Verify floating widget count updates and drag behavior
