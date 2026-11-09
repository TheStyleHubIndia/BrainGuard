const { withAndroidManifest, withMainApplication, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE = "com.brainguard.wellbeing.usage";

function withUsageStats(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    const permission = "android.permission.PACKAGE_USAGE_STATS";
    if (!manifest["uses-permission"].some((p) => p.$["android:name"] === permission)) {
      manifest["uses-permission"].push({ $: { "android:name": permission, "tools:ignore": "ProtectedPermissions" } });
    }
    const overlayPermissions = [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
      "android.permission.POST_NOTIFICATIONS"
    ];
    overlayPermissions.forEach((name) => {
      if (!manifest["uses-permission"].some((p) => p.$["android:name"] === name)) {
        manifest["uses-permission"].push({ $: { "android:name": name } });
      }
    });
    manifest.service = manifest.service || [];
    if (!manifest.service.some((s) => s.$["android:name"] === ".usage.BrainGuardOverlayService")) {
      manifest.service.push({
        $: {
          "android:name": ".usage.BrainGuardOverlayService",
          "android:exported": "false",
          "android:foregroundServiceType": "specialUse"
        },
        "property": [{
          $: {
            "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
            "android:value": "User-enabled floating digital wellbeing counter overlay"
          }
        }]
      });
    }
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    return config;
  });

  config = withMainApplication(config, (config) => {
    const marker = "PackageList(this).packages.apply {";
    const registration = "PackageList(this).packages.apply {\n          add(com.brainguard.wellbeing.usage.UsageStatsPackage())";
    if (!config.modResults.contents.includes("UsageStatsPackage()")) {
      if (!config.modResults.contents.includes(marker)) {
        throw new Error("BrainGuard UsageStats plugin: MainApplication package registration marker not found.");
      }
      config.modResults.contents = config.modResults.contents.replace(marker, registration);
    }
    return config;
  });

  config = withDangerousMod(config, ["android", async (config) => {
    const root = path.join(config.modRequest.projectRoot, "android/app/src/main/java/com/brainguard/wellbeing/usage");
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "UsageStatsPackage.java"), `package ${PACKAGE};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class UsageStatsPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new UsageStatsModule(context));
    return modules;
  }
  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Collections.emptyList();
  }
}
`);
    fs.writeFileSync(path.join(root, "UsageStatsModule.java"), `package ${PACKAGE};

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class UsageStatsModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext context;
  private static final Map<String, String> TRACKED = new HashMap<>();
  static {
    TRACKED.put("com.instagram.android", "Instagram");
    TRACKED.put("com.google.android.youtube", "YouTube");
    TRACKED.put("com.facebook.katana", "Facebook");
    TRACKED.put("com.snapchat.android", "Snapchat");
  }

  UsageStatsModule(ReactApplicationContext reactContext) {
    super(reactContext);
    context = reactContext;
  }

  @Override public String getName() { return "BrainGuardUsageStats"; }

  private boolean hasAccess() {
    AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
    if (appOps == null) return false;
    int mode;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      mode = appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
          android.os.Process.myUid(), context.getPackageName());
    } else {
      mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
          android.os.Process.myUid(), context.getPackageName());
    }
    return mode == AppOpsManager.MODE_ALLOWED;
  }

  @ReactMethod public void hasUsageAccess(Promise promise) {
    promise.resolve(hasAccess());
  }

  @ReactMethod public void openUsageAccessSettings(Promise promise) {
    try {
      Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(intent);
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("SETTINGS_ERROR", "Could not open Usage Access settings.", e);
    }
  }

  @ReactMethod public void hasOverlayPermission(Promise promise) {
    promise.resolve(Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context));
  }

  @ReactMethod public void openOverlaySettings(Promise promise) {
    try {
      if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(context)) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + context.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
      }
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("OVERLAY_SETTINGS_ERROR", "Could not open overlay permission settings.", e);
    }
  }

  @ReactMethod public void startFloatingWidget(Promise promise) {
    try {
      if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(context)) {
        promise.reject("NO_OVERLAY_PERMISSION", "Grant Display over other apps permission first.");
        return;
      }
      Intent intent = new Intent(context, BrainGuardOverlayService.class);
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
      else context.startService(intent);
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("OVERLAY_START_ERROR", "Could not start floating widget.", e);
    }
  }

  @ReactMethod public void stopFloatingWidget(Promise promise) {
    try {
      context.stopService(new Intent(context, BrainGuardOverlayService.class));
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("OVERLAY_STOP_ERROR", "Could not stop floating widget.", e);
    }
  }

  @ReactMethod public void getUsageStats(int days, Promise promise) {
    try {
      if (!hasAccess()) {
        promise.reject("NO_USAGE_ACCESS", "Grant Usage Access in Android settings first.");
        return;
      }
      UsageStatsManager manager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
      if (manager == null) {
        promise.reject("UNAVAILABLE", "Android UsageStatsManager is unavailable.");
        return;
      }
      long now = System.currentTimeMillis();
      int safeDays = Math.max(1, Math.min(days, 7));
      Calendar calendar = Calendar.getInstance();
      calendar.set(Calendar.HOUR_OF_DAY, 0);
      calendar.set(Calendar.MINUTE, 0);
      calendar.set(Calendar.SECOND, 0);
      calendar.set(Calendar.MILLISECOND, 0);
      calendar.add(Calendar.DAY_OF_YEAR, -(safeDays - 1));
      long start = calendar.getTimeInMillis();
      Map<String, Long> totals = new HashMap<>();
      Map<String, Long> lastUsed = new HashMap<>();
      for (UsageStats stat : manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, now)) {
        String name = TRACKED.get(stat.getPackageName());
        if (name != null) {
          totals.put(name, totals.getOrDefault(name, 0L) + stat.getTotalTimeInForeground());
          lastUsed.put(name, Math.max(lastUsed.getOrDefault(name, 0L), stat.getLastTimeUsed()));
        }
      }
      WritableArray apps = Arguments.createArray();
      for (String packageName : TRACKED.keySet()) {
        String name = TRACKED.get(packageName);
        WritableMap item = Arguments.createMap();
        item.putString("app", name);
        item.putString("packageName", packageName);
        item.putDouble("minutes", Math.round(totals.getOrDefault(name, 0L) / 60000.0));
        item.putDouble("lastUsed", lastUsed.getOrDefault(name, 0L));
        apps.pushMap(item);
      }
      WritableMap result = Arguments.createMap();
      result.putArray("apps", apps);
      result.putDouble("from", start);
      result.putDouble("to", now);
      result.putString("source", "Android UsageStatsManager");
      promise.resolve(result);
    } catch (Exception e) {
      promise.reject("USAGE_STATS_ERROR", "Could not read app usage statistics.", e);
    }
  }
}
`);

    fs.writeFileSync(path.join(root, "BrainGuardOverlayService.java"), `package ${PACKAGE};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Calendar;
import java.util.List;

public class BrainGuardOverlayService extends Service {
  private static final String CHANNEL = "brainguard_overlay";
  private WindowManager windowManager;
  private View bubble;
  private TextView counter;
  private final Handler handler = new Handler();
  private int x, y;
  private final Runnable updater = new Runnable() {
    @Override public void run() {
      if (counter != null) counter.setText("🧠  " + getTodayMinutes() + "m");
      handler.postDelayed(this, 60000L);
    }
  };

  @Override public void onCreate() {
    super.onCreate();
    createChannel();
    Notification.Builder notificationBuilder = Build.VERSION.SDK_INT >= 26
      ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
    Notification notification = notificationBuilder
      .setContentTitle("BrainGuard floating counter")
      .setContentText("Your wellbeing counter is active")
      .setSmallIcon(android.R.drawable.ic_menu_info_details)
      .setOngoing(true)
      .build();
    startForeground(7103, notification);
    if (Settings.canDrawOverlays(this)) showBubble();
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel channel = new NotificationChannel(CHANNEL, "Floating counter", NotificationManager.IMPORTANCE_LOW);
      NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      if (nm != null) nm.createNotificationChannel(channel);
    }
  }

  private int getTodayMinutes() {
    try {
      UsageStatsManager manager = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
      if (manager == null) return 0;
      Calendar cal = Calendar.getInstance();
      cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0);
      cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
      long now = System.currentTimeMillis();
      long total = 0L;
      List<UsageStats> stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, cal.getTimeInMillis(), now);
      if (stats != null) for (UsageStats stat : stats) {
        String p = stat.getPackageName();
        if ("com.instagram.android".equals(p) || "com.google.android.youtube".equals(p) ||
            "com.facebook.katana".equals(p) || "com.snapchat.android".equals(p)) {
          total += stat.getTotalTimeInForeground();
        }
      }
      return (int) Math.round(total / 60000.0);
    } catch (Exception e) { return 0; }
  }

  private void showBubble() {
    if (bubble != null || windowManager == null) return;
    LinearLayout box = new LinearLayout(this);
    box.setOrientation(LinearLayout.VERTICAL);
    box.setGravity(Gravity.CENTER);
    box.setPadding(13, 9, 13, 9);
    GradientDrawable bg = new GradientDrawable();
    bg.setColor(Color.rgb(61, 39, 25));
    bg.setCornerRadius(48);
    bg.setStroke(3, Color.rgb(255, 211, 143));
    box.setBackground(bg);

    TextView brain = new TextView(this);
    brain.setText("🧠");
    brain.setTextSize(22);
    brain.setGravity(Gravity.CENTER);
    box.addView(brain);

    counter = new TextView(this);
    counter.setTextColor(Color.rgb(255, 229, 180));
    counter.setTextSize(16);
    counter.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    counter.setGravity(Gravity.CENTER);
    counter.setText(" " + getTodayMinutes() + "m ");
    box.addView(counter);

    final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    );
    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
    params.x = 0; params.y = 90;
    box.setOnTouchListener(new View.OnTouchListener() {
      private int startX, startY;
      private float downX, downY;
      @Override public boolean onTouch(View v, MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
          startX = params.x; startY = params.y;
          downX = event.getRawX(); downY = event.getRawY(); return true;
        }
        if (event.getAction() == MotionEvent.ACTION_MOVE) {
          params.x = startX + (int)(event.getRawX() - downX);
          params.y = startY + (int)(event.getRawY() - downY);
          try { windowManager.updateViewLayout(box, params); } catch (Exception ignored) {}
          return true;
        }
        return event.getAction() == MotionEvent.ACTION_UP;
      }
    });
    windowManager.addView(box, params);
    bubble = box;
    handler.post(updater);
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY; }
    if (bubble == null) { windowManager = (WindowManager)getSystemService(WINDOW_SERVICE); showBubble(); }
    return START_STICKY;
  }

  @Override public void onDestroy() {
    handler.removeCallbacks(updater);
    if (bubble != null && windowManager != null) {
      try { windowManager.removeView(bubble); } catch (Exception ignored) {}
      bubble = null; counter = null;
    }
    super.onDestroy();
  }

  @Override public IBinder onBind(Intent intent) { return null; }
}
`);
    return config;
  }]);
  return config;
}

module.exports = withUsageStats;
