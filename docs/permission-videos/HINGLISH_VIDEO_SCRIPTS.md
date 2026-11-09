# BrainGuard Permission Tutorial Video Pack (Hinglish)

This folder contains the production scripts and shot lists for original BrainGuard permission tutorials. These are **not rendered MP4 files** yet. Do not label a script or storyboard as a playable video.

## Production format
- 1080x1920 (9:16), 30 fps, target 20–40 seconds each.
- Hinglish voiceover, large readable captions, Android screen recording from a real device.
- Use a clean test device with BrainGuard installed from the official project build.
- Blur email addresses, notifications, device identifiers and unrelated apps.
- UI labels must match the recorded Android/OEM version. Do not fake a universal settings path.
- End every video with: “Settings save karke BrainGuard par wapas aayein. App permission status dobara check karega.”
- Never imply BrainGuard can grant its own Accessibility, Usage Access or overlay permission.

## Video 01 — Android Usage Access (20–25 sec)
**Voiceover:** “BrainGuard ko supported apps ka total screen time dikhane ke liye Usage Access chahiye. Settings khulegi. List mein BrainGuard select karein, Permit usage access ON karein, phir app mein wapas aayein. Ye permission total foreground time read karti hai; messages ya screen content nahi.”
**Shots:** BrainGuard guide card → Android Usage Access list → BrainGuard row → system toggle ON → return to BrainGuard status.
**On-screen captions:** “Settings kholo” → “BrainGuard select karo” → “Permit usage access ON” → “Wapas aao”.

## Video 02 — Accessibility / Swipe Counter (35–40 sec)
**Voiceover:** “Swipe counter ke liye Accessibility service manually enable karni hoti hai. Downloaded apps ya Installed services mein BrainGuard swipe counter kholein aur ON karein. Agar Android ‘Restricted setting’ dikhaye, App info kholein, top-right menu mein Allow restricted settings option ho to use allow karein. Phir Accessibility screen par laut kar service ON karein. Android ki security approval ko BrainGuard bypass nahi kar sakta.”
**Shots:** Accessibility settings → Installed services → BrainGuard service → restricted-setting warning → App info menu (only if option exists on this OS) → toggle ON → return.
**On-screen captions:** “Accessibility kholo” → “BrainGuard swipe counter” → “Restricted setting? App info → ⋮” → “Allow restricted settings (if shown)” → “Service ON”.
**Critical:** Capture the real device route. If the OEM hides the menu item, show the actual supported route or a clear fallback; never invent a button.

## Video 03 — Display over other apps (20 sec)
**Voiceover:** “Floating Brain widget ke liye Display over other apps permission chahiye. BrainGuard select karein, Allow display over other apps ON karein, phir wapas aakar widget enable karein.”
**Shots:** App list → BrainGuard → system overlay switch → return.

## Video 04 — Notifications (15–20 sec)
**Voiceover:** “Service status aur alerts ke liye notifications allow karein. Android prompt aaye to Allow tap karein. Agar prompt pehle dismiss kiya tha, App info ke Notifications section se enable kar sakte hain.”
**Shots:** Runtime notification prompt → Allow → app notification settings fallback.

## Video 05 — Battery / No restrictions (25–30 sec)
**Voiceover:** “Background reliability ke liye BrainGuard ki App battery settings check karein. No restrictions ya Unrestricted option available ho to select karein. Xiaomi phones par Autostart bhi check karein. Options phone ke model aur software ke hisaab se badalte hain. Isse Force stop ke baad tracking resume hone ki guarantee nahi milti.”
**Shots:** App info → Battery → No restrictions (if available) → OEM Autostart (if available).

## OEM variants — record separately
- Xiaomi / Redmi / POCO: Accessibility restricted-setting route, Autostart, Battery saver, Display pop-up/overlay.
- Samsung: Accessibility installed apps, Appear on top, battery background usage.
- Vivo / iQOO: Accessibility, Display over other apps, Background power consumption.
- OPPO / Realme: Accessibility, Display over other apps, Auto launch / background activity.
- Motorola: Accessibility, Display over other apps, battery optimization.

## Release checklist
- [ ] Record actual screen captures for each target OEM/Android version.
- [ ] Record or synthesize original Hinglish narration with licensed voice/audio.
- [ ] Add captions and export MP4s.
- [ ] Verify each video plays offline from inside the APK.
- [ ] Test every settings deep link on physical devices.
- [ ] Confirm permission status refresh after returning from Settings.
