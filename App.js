import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, StatusBar, NativeModules, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./src/lib/supabase";

const STORAGE_KEY = "brainguard.v01.state";
const usageNative = NativeModules.BrainGuardUsageStats;
const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
};
const defaults = { minutes: 0, sessions: 0, goal: 90, xp: 0, streak: 0, lastActiveDate: null, history: {}, sessionsByDay: {}, achievements: [] };

function normalizeStoredData(value, today) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const safeNumber = (input, fallback, min, max) => {
    const n = Number(input);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
  };
  const validHistory = {};
  if (source.history && typeof source.history === "object" && !Array.isArray(source.history)) {
    Object.entries(source.history).forEach(([key, value]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) validHistory[key] = safeNumber(value, 0, 0, 1440);
    });
  }
  const validSessions = {};
  if (source.sessionsByDay && typeof source.sessionsByDay === "object" && !Array.isArray(source.sessionsByDay)) {
    Object.entries(source.sessionsByDay).forEach(([key, value]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) validSessions[key] = safeNumber(value, 0, 0, 1440);
    });
  }
  const lastActiveDate = typeof source.lastActiveDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.lastActiveDate) ? source.lastActiveDate : null;
  if (lastActiveDate === today && validSessions[today] === undefined) {
    validSessions[today] = safeNumber(source.sessions, 0, 0, 1440);
  }
  return {
    ...defaults,
    minutes: validHistory[today] || 0,
    sessions: validSessions[today] || 0,
    goal: safeNumber(source.goal, 90, 15, 720),
    xp: safeNumber(source.xp, 0, 0, 100000000),
    streak: safeNumber(source.streak, 0, 0, 1000000),
    lastActiveDate,
    history: validHistory,
    sessionsByDay: validSessions,
    achievements: Array.isArray(source.achievements) ? [...new Set(source.achievements.filter(x => typeof x === "string"))] : []
  };
}

function brainFor(minutes, goal) {
  const ratio = goal > 0 ? minutes / goal : 0;
  if (ratio < 0.5) return { name: "FRESH", face: "🧠", line: "Your brain is feeling fresh.", color: "#57D6A3" };
  if (ratio < 1) return { name: "FOCUSED", face: "🙂", line: "You're approaching your daily limit.", color: "#F6C85F" };
  if (ratio < 1.5) return { name: "COOKED", face: "🥵", line: "You've crossed your daily goal. Take a break.", color: "#FF9B54" };
  return { name: "OVERLOADED", face: "🤯", line: "That's enough scrolling for today.", color: "#FF647C" };
}
function Card({ children, style }) { return <View style={[s.card, style]}>{children}</View>; }
function Label({ children }) { return <Text style={s.label}>{children}</Text>; }

export default function App() {
  const [data, setData] = useState(defaults);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [entry, setEntry] = useState("10");
  const [goalEntry, setGoalEntry] = useState("90");
  const [usageAccess, setUsageAccess] = useState(false);
  const [usageToday, setUsageToday] = useState([]);
  const [usageWeek, setUsageWeek] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [overlayPermission, setOverlayPermission] = useState(false);
  const [swipeAccessibility, setSwipeAccessibility] = useState(false);
  const [swipeCounts, setSwipeCounts] = useState({ total: 0, apps: {} });
  const [floatingEnabled, setFloatingEnabled] = useState(false);
  const [overlayError, setOverlayError] = useState("");
  const today = localDateKey();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) { setAuthUser(session?.user || null); setAuthReady(true); }
    }).catch(() => { if (mounted) setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setAuthUser(session?.user || null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function submitAuth() {
    const email = authEmail.trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { setAuthMessage("Enter a valid email address."); return; }
    if (authMode !== "reset" && authPassword.length < 8) { setAuthMessage("Password must be at least 8 characters."); return; }
    setAuthBusy(true); setAuthMessage("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password: authPassword });
        if (error) throw error;
        setAuthMessage(data.session ? "Account created. You are signed in." : "Account created. Check your email to verify it, then sign in.");
        if (!data.session) setAuthMode("signin");
      } else if (authMode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setAuthMessage("Password reset email sent if this address is registered.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
        if (error) throw error;
      }
    } catch (error) { setAuthMessage(error?.message || "Authentication failed."); }
    finally { setAuthBusy(false); }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Sign out failed", error.message);
  }

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = normalizeStoredData(JSON.parse(raw), today);
          setData(saved);
          setGoalEntry(String(saved.goal));
        }
      } catch {
        Alert.alert("Storage issue", "Saved data could not be loaded. You can continue with a fresh profile.");
      } finally { setLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  async function refreshUsage() {
    if (!usageNative) { setUsageError("Automatic tracking requires the Android APK, not Expo Go or web preview."); return; }
    setUsageLoading(true); setUsageError("");
    try {
      const allowed = await usageNative.hasUsageAccess(); setUsageAccess(!!allowed);
      if (!allowed) { setUsageToday([]); setUsageWeek([]); return; }
      const results = await Promise.all([usageNative.getUsageStats(1), usageNative.getUsageStats(7)]);
      setUsageToday(results[0].apps || []); setUsageWeek(results[1].apps || []);
    } catch (error) { setUsageError(error?.message || "Could not read app usage."); }
    finally { setUsageLoading(false); }
  }

  async function requestUsageAccess() {
    if (!usageNative) { Alert.alert("Android APK required", "Install the BrainGuard APK to use native app tracking."); return; }
    try { await usageNative.openUsageAccessSettings(); }
    catch (error) { Alert.alert("Settings error", error?.message || "Open Android Settings > Special app access > Usage access."); }
  }

  async function refreshSwipeStatus() {
    if (!usageNative) return;
    try {
      const [enabled, counts, overlay] = await Promise.all([
        usageNative.hasSwipeAccessibilityEnabled(),
        usageNative.getTodaySwipeCounts(),
        usageNative.hasOverlayPermission()
      ]);
      setSwipeAccessibility(!!enabled);
      setSwipeCounts(counts || { total: 0, apps: {} });
      if (authUser?.id && counts?.apps) {
        const rows = Object.entries(counts.apps).map(([app_key, count]) => ({
          user_id: authUser.id, activity_date: localDateKey(), app_key,
          forward_count: Number(count) || 0, tracking_source: "accessibility"
        }));
        if (rows.length) {
          const { error } = await supabase.from("daily_swipe_counts").upsert(rows, { onConflict: "user_id,activity_date,app_key,tracking_source" });
          if (error) console.warn("BrainGuard swipe cloud sync:", error.message);
        }
      }
      setOverlayPermission(!!overlay);
    } catch (error) {
      setOverlayError(error?.message || "Could not check swipe counter permissions.");
    }
  }

  async function enableSwipeTracking() {
    if (!usageNative) {
      Alert.alert("Android APK required", "Swipe counting requires the installed native BrainGuard APK.");
      return;
    }
    try {
      await usageNative.openAccessibilitySettings();
      setOverlayError("Android Accessibility settings opened. Select BrainGuard swipe counter and turn it ON. Return to BrainGuard afterwards.");
    } catch (error) {
      setOverlayError(error?.message || "Could not open Accessibility settings.");
    }
  }

  async function enableFloatingWidget() {
    if (!usageNative) { Alert.alert("Android APK required", "Floating widget requires the installed native BrainGuard APK."); return; }
    setOverlayError("");
    try {
      const swipeAllowed = await usageNative.hasSwipeAccessibilityEnabled();
      setSwipeAccessibility(!!swipeAllowed);
      if (!swipeAllowed) {
        await enableSwipeTracking();
        return;
      }
      const allowed = await usageNative.hasOverlayPermission();
      setOverlayPermission(!!allowed);
      if (!allowed) {
        await usageNative.openOverlaySettings();
        setOverlayError("Allow Display over other apps for BrainGuard, return here, then tap Enable again.");
        return;
      }
      await usageNative.startFloatingWidget();
      setFloatingEnabled(true);
    } catch (error) { setOverlayError(error?.message || "Could not enable floating widget."); }
  }

  async function disableFloatingWidget() {
    if (!usageNative) return;
    try { await usageNative.stopFloatingWidget(); setFloatingEnabled(false); setOverlayError(""); }
    catch (error) { setOverlayError(error?.message || "Could not stop floating widget."); }
  }

  useEffect(() => {
    refreshUsage();
    refreshSwipeStatus();
    const sub = AppState.addEventListener("change", state => {
      if (state === "active") { refreshUsage(); refreshSwipeStatus(); }
    });
    return () => sub.remove();
  }, []);

  const brain = useMemo(() => brainFor(data.minutes, data.goal), [data.minutes, data.goal]);
  const progress = Math.min(1, data.goal > 0 ? data.minutes / data.goal : 0);
  const level = Math.floor(data.xp / 100) + 1;

  function addMinutes(value) {
    const mins = Number(value);
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) {
      Alert.alert("Invalid amount", "Enter a whole number between 1 and 600 minutes.");
      return;
    }
    if (data.minutes + mins > 1440) {
      Alert.alert("Daily limit reached", "A day cannot contain more than 1,440 logged minutes.");
      return;
    }
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = localDateKey(yesterdayDate);
    setData(prev => {
      const sessions = prev.sessions + 1;
      const xp = prev.xp + Math.max(5, Math.round(mins / 2));
      const streak = prev.lastActiveDate === today ? prev.streak : (prev.lastActiveDate === yesterday ? prev.streak + 1 : 1);
      const achievements = [...prev.achievements];
      if (!achievements.includes("first-session")) achievements.push("first-session");
      if (xp >= 100 && !achievements.includes("100-xp")) achievements.push("100-xp");
      return {
        ...prev, minutes: prev.minutes + mins, sessions, xp, streak, lastActiveDate: today,
        history: { ...prev.history, [today]: (prev.history[today] || 0) + mins },
        sessionsByDay: { ...prev.sessionsByDay, [today]: (prev.sessionsByDay[today] || 0) + 1 },
        achievements
      };
    });
    setEntry("10");
    if (authUser?.id) {
      const endedAt = new Date();
      supabase.from("focus_sessions").insert({
        user_id: authUser.id,
        started_at: new Date(endedAt.getTime() - mins * 60000).toISOString(),
        ended_at: endedAt.toISOString(),
        duration_minutes: mins,
        session_type: "manual"
      }).then(({ error }) => {
        if (error) console.warn("BrainGuard session cloud sync:", error.message);
      });
    }
  }

  function saveGoal() {
    const goal = Number(goalEntry);
    if (!Number.isInteger(goal) || goal < 15 || goal > 720) {
      Alert.alert("Invalid goal", "Choose a daily goal between 15 and 720 minutes.");
      return;
    }
    setData(prev => ({ ...prev, goal }));
    Alert.alert("Goal saved", "Your daily goal is " + goal + " minutes.");
  }

  function resetToday() {
    Alert.alert("Reset today's demo data?", "This clears today's minutes and sessions, but keeps XP and streak history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => setData(p => ({ ...p, minutes: 0, sessions: 0, history: { ...p.history, [today]: 0 }, sessionsByDay: { ...p.sessionsByDay, [today]: 0 } })) }
    ]);
  }

  if (!loaded || !authReady) return <SafeAreaView style={s.container}><Text style={s.title}>BrainGuard</Text><Text style={s.muted}>Loading your profile…</Text></SafeAreaView>;

  if (!authUser) return <SafeAreaView style={s.container}>
    <StatusBar barStyle="light-content" />
    <ScrollView contentContainerStyle={s.authWrap}>
      <Text style={s.brand}>BRAINGUARD</Text>
      <Text style={s.pageTitle}>{authMode === "signup" ? "Create your account" : authMode === "reset" ? "Reset password" : "Welcome back"}</Text>
      <Text style={s.muted}>Sign in to sync your focus progress across devices.</Text>
      <Card>
        <Label>EMAIL</Label>
        <TextInput value={authEmail} onChangeText={setAuthEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" placeholderTextColor="#788098" style={[s.input,{marginTop:8,marginBottom:14}]} />
        {authMode !== "reset" && <><Label>PASSWORD</Label><TextInput value={authPassword} onChangeText={setAuthPassword} secureTextEntry autoComplete={authMode === "signup" ? "new-password" : "password"} placeholder="At least 8 characters" placeholderTextColor="#788098" style={[s.input,{marginTop:8}]} /></>}
        <TouchableOpacity disabled={authBusy} style={s.primaryButtonWide} onPress={submitAuth}><Text style={s.buttonText}>{authBusy ? "PLEASE WAIT…" : authMode === "signup" ? "CREATE ACCOUNT" : authMode === "reset" ? "SEND RESET EMAIL" : "SIGN IN"}</Text></TouchableOpacity>
        {!!authMessage && <Text style={s.muted}>{authMessage}</Text>}
        {authMode === "signin" && <TouchableOpacity onPress={() => {setAuthMode("reset");setAuthMessage("");}}><Text style={s.authLink}>Forgot password?</Text></TouchableOpacity>}
        <TouchableOpacity onPress={() => {setAuthMode(authMode === "signup" ? "signin" : "signup");setAuthMessage("");}}><Text style={s.authLink}>{authMode === "signup" ? "Already have an account? Sign in" : "New to BrainGuard? Create account"}</Text></TouchableOpacity>
      </Card>
      <Card><Text style={s.sectionTitle}>Google sign-in</Text><Text style={s.muted}>Google OAuth is not enabled yet. It needs Google Cloud OAuth credentials and redirect configuration.</Text></Card>
      <Text style={s.footerText}>Your existing local profile remains stored on this device.</Text>
    </ScrollView>
  </SafeAreaView>;

  return <SafeAreaView style={s.container}>
    <StatusBar barStyle="light-content" />
    <View style={s.header}>
      <View><Text style={s.brand}>BRAINGUARD</Text><Text style={s.muted}>Take back your attention.</Text></View>
      <View style={s.levelPill}><Text style={s.levelText}>LVL {level}</Text></View>
    </View>
    <View style={s.tabs}>{["home", "progress", "settings"].map(t =>
      <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
        <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t.toUpperCase()}</Text>
      </TouchableOpacity>
    )}</View>

    {tab === "home" && <ScrollView contentContainerStyle={s.content}>
      <Card style={s.brainCard}>
        <Label>YOUR BRAIN RIGHT NOW</Label>
        <Text style={s.brainFace}>{brain.face}</Text>
        <Text style={[s.brainState, { color: brain.color }]}>{brain.name}</Text>
        <Text style={s.muted}>{brain.line}</Text>
        <View style={s.progressTrack}><View style={[s.progressFill, { width: (progress * 100) + "%", backgroundColor: brain.color }]} /></View>
        <Text style={s.progressText}>{data.minutes} / {data.goal} min today</Text>
      </Card>
      <View style={s.statsRow}>
        <Card style={s.stat}><Label>SCROLL TIME</Label><Text style={s.statNumber}>{data.minutes}<Text style={s.unit}>m</Text></Text></Card>
        <Card style={s.stat}><Label>SESSIONS</Label><Text style={s.statNumber}>{data.sessions}</Text></Card>
        <Card style={s.stat}><Label>STREAK</Label><Text style={s.statNumber}>{data.streak}<Text style={s.unit}>d</Text></Text></Card>
      </View>
      <Card>
        <View style={s.usageHeader}>
          <View style={{ flex: 1 }}><Text style={s.sectionTitle}>Tracked social apps</Text><Text style={s.muted}>Android foreground time. Refreshes when BrainGuard opens or returns to foreground.</Text></View>
          <TouchableOpacity style={s.refreshButton} onPress={refreshUsage}><Text style={s.refreshText}>{usageLoading ? "..." : "REFRESH"}</Text></TouchableOpacity>
        </View>
        {!usageAccess ? <View><Text style={s.muted}>{usageError || "Grant Usage Access to read Instagram, YouTube, Facebook and Snapchat usage."}</Text><TouchableOpacity style={s.primaryButtonWide} onPress={requestUsageAccess}><Text style={s.buttonText}>ENABLE USAGE TRACKING</Text></TouchableOpacity></View> : usageToday.map(item => <View key={item.packageName} style={s.appUsageRow}><Text style={s.appUsageName}>{item.app}</Text><Text style={s.appUsageTime}>{Math.round(item.minutes || 0)} min</Text></View>)}
        {!!usageError && <Text style={s.errorText}>{usageError}</Text>}
        <Text style={s.muted}>Last 7 days combined: {usageWeek.reduce((sum, item) => sum + (item.minutes || 0), 0)} minutes.</Text>
      </Card>
      <Card>
        <Text style={s.sectionTitle}>Log a scrolling session</Text>
        <Text style={s.muted}>Manual entry only — this prototype does not automatically track phone usage.</Text>
        <View style={s.entryRow}>
          <TextInput value={entry} onChangeText={setEntry} keyboardType="number-pad" style={s.input} placeholder="Minutes" placeholderTextColor="#788098" />
          <TouchableOpacity style={s.primaryButton} onPress={() => addMinutes(entry)}><Text style={s.buttonText}>ADD SESSION</Text></TouchableOpacity>
        </View>
        <View style={s.quickRow}>{[5, 10, 15, 30].map(n =>
          <TouchableOpacity key={n} style={s.quickButton} onPress={() => addMinutes(String(n))}><Text style={s.quickText}>+{n}m</Text></TouchableOpacity>
        )}</View>
      </Card>
      <Card>
        <Text style={s.sectionTitle}>Your rewards</Text>
        <View style={s.rewardRow}><Text style={s.muted}>Experience points</Text><Text style={s.rewardValue}>{data.xp} XP</Text></View>
        <View style={s.rewardTrack}><View style={[s.rewardFill, { width: (data.xp % 100) + "%" }]} /></View>
        <Text style={s.muted}>Next level at {level * 100} XP</Text>
      </Card>
    </ScrollView>}

    {tab === "progress" && <ScrollView contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Your progress</Text>
      <Card>
        <Text style={s.sectionTitle}>Last 7 days</Text>
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i));
          const key = localDateKey(d);
          const mins = key === today ? data.minutes : (data.history[key] || 0);
          const max = Math.max(data.goal, ...Object.values(data.history), 1);
          return <View key={key} style={s.dayRow}>
            <Text style={s.dayLabel}>{d.toLocaleDateString(undefined, { weekday: "short" })}</Text>
            <View style={s.dayTrack}><View style={[s.dayFill, { width: Math.min(100, mins / max * 100) + "%" }]} /></View>
            <Text style={s.dayValue}>{mins}m</Text>
          </View>;
        })}
      </Card>
      <Card>
        <Text style={s.sectionTitle}>Achievements</Text>
        {[
          ["first-session", "First session", "Log your first scrolling session"],
          ["100-xp", "Century club", "Earn 100 XP"]
        ].map(([id, title, desc]) => {
          const earned = data.achievements.includes(id);
          return <View key={id} style={s.achievementRow}>
            <Text style={s.achievementIcon}>{earned ? "🏆" : "🔒"}</Text>
            <View style={{ flex: 1 }}><Text style={s.achievementTitle}>{title}</Text><Text style={s.muted}>{desc}</Text></View>
            <Text style={{ color: earned ? "#57D6A3" : "#788098" }}>{earned ? "EARNED" : "LOCKED"}</Text>
          </View>;
        })}
      </Card>
      <Card><Text style={s.sectionTitle}>Streak rules</Text><Text style={s.muted}>A day counts when you log at least one session. Multiple sessions on the same day only count once toward the streak.</Text></Card>
    </ScrollView>}

    {tab === "settings" && <ScrollView contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Settings</Text>
      <Card><Text style={s.sectionTitle}>Account</Text><Text style={s.muted}>{authUser?.email || "Signed in"}</Text><TouchableOpacity style={s.primaryButtonWide} onPress={signOut}><Text style={s.buttonText}>SIGN OUT</Text></TouchableOpacity></Card>\n      <Card><Text style={s.sectionTitle}>Account</Text><Text style={s.muted}>{authUser?.email || "Signed in"}</Text><TouchableOpacity style={s.primaryButtonWide} onPress={signOut}><Text style={s.buttonText}>SIGN OUT</Text></TouchableOpacity></Card>
      <Card>
        <Text style={s.sectionTitle}>Daily scrolling goal</Text><Text style={s.muted}>Set your target in minutes (15–720).</Text>
        <View style={s.entryRow}>
          <TextInput value={goalEntry} onChangeText={setGoalEntry} keyboardType="number-pad" style={s.input} />
          <TouchableOpacity style={s.primaryButton} onPress={saveGoal}><Text style={s.buttonText}>SAVE GOAL</Text></TouchableOpacity>
        </View>
      </Card>
      <Card>
        <Text style={s.sectionTitle}>Automatic app usage tracking</Text><Text style={s.statusTag}>{usageAccess ? "USAGE ACCESS GRANTED" : "PERMISSION REQUIRED"}</Text>
        <Text style={s.muted}>Reads total foreground time for Instagram, YouTube, Facebook and Snapchat using Android UsageStatsManager. It does not count individual Reels or Shorts and is not a constant background tracker.</Text>
        <TouchableOpacity style={s.primaryButtonWide} onPress={usageAccess ? refreshUsage : requestUsageAccess}><Text style={s.buttonText}>{usageAccess ? "REFRESH APP USAGE" : "OPEN USAGE ACCESS SETTINGS"}</Text></TouchableOpacity>
        {!!usageError && <Text style={s.errorText}>{usageError}</Text>}
      </Card>
      <Card><Text style={s.sectionTitle}>Last 7 days — tracked apps</Text>{usageWeek.length ? usageWeek.map(item => <View key={item.packageName} style={s.appUsageRow}><Text style={s.appUsageName}>{item.app}</Text><Text style={s.appUsageTime}>{Math.round(item.minutes || 0)} min</Text></View>) : <Text style={s.muted}>Grant Usage Access and refresh to load the report.</Text>}</Card>
      <Card>
        <Text style={s.sectionTitle}>Reels / Shorts swipe counter</Text>
        <Text style={s.muted}>Today's estimated feed swipes. Counter resets automatically at local midnight.</Text>
        <Text style={{ color: "#F5F6FA", fontSize: 42, fontWeight: "900", marginTop: 8 }}>{swipeCounts.total || 0}</Text>
        {[
          ["Instagram Reels", "instagram"],
          ["YouTube Shorts", "youtube"],
          ["Facebook Reels", "facebook"],
          ["Snapchat Spotlight", "snapchat"]
        ].map(([label, key]) => (
          <View key={key} style={s.appUsageRow}>
            <Text style={s.appUsageName}>{label}</Text>
            <Text style={s.appUsageTime}>{(swipeCounts.apps || {})[key] || 0}</Text>
          </View>
        ))}
        <Text style={s.statusTag}>{swipeAccessibility ? "ACCESSIBILITY TRACKING ENABLED" : "ACCESSIBILITY PERMISSION REQUIRED"}</Text>
        <TouchableOpacity style={s.primaryButtonWide} onPress={enableSwipeTracking}>
          <Text style={s.buttonText}>{swipeAccessibility ? "OPEN ACCESSIBILITY SETTINGS" : "ENABLE SWIPE COUNTING"}</Text>
        </TouchableOpacity>
        <Text style={s.muted}>BrainGuard listens only for scroll and feed-content-change event types from these four apps. It does not retrieve screen text or content. Detection is an estimate and app updates can change its accuracy.</Text>
      </Card>
      <Card>
        <Text style={s.sectionTitle}>Floating Brain Widget</Text>
        <Text style={s.muted}>Show a draggable brain and today's Reels / Shorts swipe count over other apps.</Text>
        <Text style={s.statusTag}>{floatingEnabled ? "FLOATING WIDGET ENABLED" : overlayPermission ? "OVERLAY PERMISSION GRANTED" : "OVERLAY PERMISSION REQUIRED"}</Text>
        <TouchableOpacity style={s.primaryButtonWide} onPress={floatingEnabled ? disableFloatingWidget : enableFloatingWidget}>
          <Text style={s.buttonText}>{floatingEnabled ? "TURN OFF FLOATING WIDGET" : overlayPermission ? "ENABLE FLOATING WIDGET" : "GRANT OVERLAY PERMISSION"}</Text>
        </TouchableOpacity>
        {!!overlayError && <Text style={s.errorText}>{overlayError}</Text>}
        <Text style={s.muted}>Android shows a persistent notification while the floating widget service is active. You can turn it off here.</Text>
      </Card>
      <Card>
        <Text style={s.sectionTitle}>App blocker</Text>
        <Text style={s.muted}>Not active in this prototype. System-level blocking needs a separately implemented Android service, user opt-in, and compatibility and policy testing.</Text>
        <TouchableOpacity style={s.disabledButton} disabled><Text style={s.buttonText}>BLOCKER — NOT AVAILABLE YET</Text></TouchableOpacity>
      </Card>
      <Card><Text style={s.sectionTitle}>Privacy</Text><Text style={s.muted}>Prototype stats are stored locally on this device using AsyncStorage. No account or cloud sync is configured.</Text></Card>
      <TouchableOpacity style={s.resetButton} onPress={resetToday}><Text style={s.resetText}>RESET TODAY'S DEMO DATA</Text></TouchableOpacity>
    </ScrollView>}

    <View style={s.footer}><Text style={s.footerText}>BRAIN POWERED. NOT BRAIN DRAINED.</Text><Text style={s.footerText}>v0.1 · LOCAL PROTOTYPE</Text></View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090B14" },
  authWrap: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 16 },
  authLink: { color: "#C6B9FF", textAlign: "center", fontWeight: "800", marginTop: 16 },
  title: { color: "#F5F6FA", fontSize: 24, fontWeight: "900", padding: 20 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#F5F6FA", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  muted: { color: "#969DB2", fontSize: 13, lineHeight: 19, marginTop: 5 },
  levelPill: { backgroundColor: "#25213D", borderColor: "#6553B8", borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  levelText: { color: "#C6B9FF", fontWeight: "800", fontSize: 11 },
  tabs: { flexDirection: "row", marginHorizontal: 20, padding: 4, backgroundColor: "#141827", borderRadius: 13, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#353052" },
  tabText: { color: "#788098", fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  tabTextActive: { color: "#D9D1FF" },
  content: { padding: 20, paddingBottom: 30, gap: 14 },
  card: { backgroundColor: "#141827", borderRadius: 20, padding: 17, borderWidth: 1, borderColor: "#252C40" },
  brainCard: { alignItems: "center", paddingVertical: 22 },
  label: { color: "#788098", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  brainFace: { fontSize: 66, marginTop: 10 },
  brainState: { fontSize: 18, fontWeight: "900", letterSpacing: 2, marginTop: 5 },
  progressTrack: { width: "100%", height: 9, backgroundColor: "#292F42", borderRadius: 9, overflow: "hidden", marginTop: 20 },
  progressFill: { height: 9, borderRadius: 9 },
  progressText: { color: "#E6E8F0", fontWeight: "800", marginTop: 9 },
  statsRow: { flexDirection: "row", gap: 9 },
  stat: { flex: 1, padding: 12 },
  statNumber: { color: "#F5F6FA", fontSize: 25, fontWeight: "900", marginTop: 8 },
  unit: { color: "#969DB2", fontSize: 13 },
  sectionTitle: { color: "#F5F6FA", fontSize: 16, fontWeight: "800", marginBottom: 5 },
  entryRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  input: { flex: 1, minWidth: 0, backgroundColor: "#0D1120", borderWidth: 1, borderColor: "#343C54", borderRadius: 12, color: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  primaryButton: { backgroundColor: "#8B72F6", borderRadius: 12, justifyContent: "center", alignItems: "center", paddingHorizontal: 15 },
  buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10, letterSpacing: .5 },
  quickRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  quickButton: { flex: 1, backgroundColor: "#25213D", paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  quickText: { color: "#C6B9FF", fontWeight: "800" },
  rewardRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  rewardValue: { color: "#F6C85F", fontWeight: "900" },
  rewardTrack: { height: 7, backgroundColor: "#292F42", borderRadius: 8, marginTop: 10, overflow: "hidden" },
  rewardFill: { height: 7, backgroundColor: "#F6C85F", borderRadius: 8 },
  pageTitle: { color: "#F5F6FA", fontSize: 25, fontWeight: "900", marginBottom: 2 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 15 },
  dayLabel: { color: "#969DB2", width: 35, fontSize: 12 },
  dayTrack: { flex: 1, height: 8, backgroundColor: "#292F42", borderRadius: 8, overflow: "hidden" },
  dayFill: { height: 8, backgroundColor: "#8B72F6", borderRadius: 8 },
  dayValue: { color: "#E6E8F0", width: 35, textAlign: "right", fontSize: 12, fontWeight: "700" },
  achievementRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  achievementIcon: { fontSize: 25 },
  achievementTitle: { color: "#F5F6FA", fontWeight: "800" },
  statusTag: { color: "#F6C85F", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginTop: 9, marginBottom: 5 },
  usageHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  refreshButton: { backgroundColor: "#25213D", paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9 },
  refreshText: { color: "#C6B9FF", fontSize: 10, fontWeight: "900" },
  primaryButtonWide: { backgroundColor: "#8B72F6", borderRadius: 12, justifyContent: "center", alignItems: "center", padding: 14, marginTop: 12 },
  appUsageRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#252C40" },
  appUsageName: { color: "#E6E8F0", fontWeight: "700" },
  appUsageTime: { color: "#C6B9FF", fontWeight: "900" },
  errorText: { color: "#FF8498", fontSize: 12, marginTop: 8 },
  disabledButton: { backgroundColor: "#303548", padding: 13, borderRadius: 11, alignItems: "center", marginTop: 14, opacity: .65 },
  resetButton: { borderColor: "#713848", borderWidth: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  resetText: { color: "#FF8498", fontWeight: "900", fontSize: 11 },
  footer: { paddingVertical: 10, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#1E2435" },
  footerText: { color: "#69718A", fontSize: 8, fontWeight: "800", letterSpacing: .7 }
});
