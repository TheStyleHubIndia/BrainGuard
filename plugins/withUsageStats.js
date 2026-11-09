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
      long start = now - Math.max(1, Math.min(days, 7)) * 24L * 60L * 60L * 1000L;
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
    return config;
  }]);
  return config;
}

module.exports = withUsageStats;
