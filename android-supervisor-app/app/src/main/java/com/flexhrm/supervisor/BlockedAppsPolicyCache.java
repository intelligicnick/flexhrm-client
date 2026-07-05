package com.flexhrm.supervisor;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.json.JSONArray;

/** Persists the last fetched blocked-apps configuration for offline scans. */
public final class BlockedAppsPolicyCache {
  private static final String PREFS = "flexhrm_supervisor_security";
  private static final String KEY_BLOCKED_APPS = "blocked_apps_json";
  private static final String KEY_POLICY_SYNCED = "blocked_apps_synced";

  /**
   * Offline fallback only: fake-GPS / location-spoofing and remote-access tools.
   * Must NOT include social apps — blocked-app-packages.json is a lookup map, not a block list.
   */
  private static final String[] BUNDLED_SECURITY_POLICY = {
    "anyto",
    "imyfone anyto",
    "tenorshare ianygo",
    "fake gps",
    "fake gps location",
    "fake gps joystick",
    "fake gps go location spoofer",
    "fake gps 360",
    "fake gps location professional",
    "fake gps route",
    "fake gps route pro",
    "fake gps run",
    "fake gps navigation",
    "fake gps expert",
    "fake gps by lexa",
    "fake gps by incorporateapps",
    "fake location",
    "locaedit",
    "fake gps location-locaedit",
    "gps emulator",
    "lexa fake gps",
    "mock locations",
    "mock gps with joystick",
    "mock gps controller",
    "location changer",
    "gps joystick",
    "joystick gps",
    "fly gps",
    "lockito",
    "gps route simulator",
    "gps movement simulator",
    "anydesk",
    "teamviewer",
    "unicool tailorgo",
    "tailorgo",
    "virtual location",
    "locationsimulator",
    "dr.fone virtual location",
    "3utools",
    "easeus mobianygo",
    "wootechy imovego",
  };

  private BlockedAppsPolicyCache() {}

  public static void save(Context context, List<String> blockedApps) {
    JSONArray array = new JSONArray();
    for (String entry : blockedApps) {
      if (entry != null && !entry.trim().isEmpty()) {
        array.put(entry.trim());
      }
    }
    prefs(context)
        .edit()
        .putString(KEY_BLOCKED_APPS, array.toString())
        .putBoolean(KEY_POLICY_SYNCED, true)
        .apply();
  }

  public static boolean hasSyncedPolicy(Context context) {
    return prefs(context).getBoolean(KEY_POLICY_SYNCED, false);
  }

  public static List<String> load(Context context) {
    if (!hasSyncedPolicy(context)) {
      return new ArrayList<>();
    }
    String raw = prefs(context).getString(KEY_BLOCKED_APPS, "[]");
    if (raw == null || raw.trim().isEmpty()) {
      return new ArrayList<>();
    }
    try {
      JSONArray array = new JSONArray(raw);
      List<String> result = new ArrayList<>();
      for (int i = 0; i < array.length(); i++) {
        String entry = array.optString(i, "").trim();
        if (!entry.isEmpty()) {
          result.add(entry);
        }
      }
      return result;
    } catch (Exception ignored) {
      return new ArrayList<>();
    }
  }

  /** GPS spoofing + remote access defaults used only before the first successful server sync. */
  public static List<String> loadBundledDefaults() {
    return new ArrayList<>(Arrays.asList(BUNDLED_SECURITY_POLICY));
  }

  public static List<String> resolvePolicy(Context context) {
    if (hasSyncedPolicy(context)) {
      return load(context);
    }
    return loadBundledDefaults();
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }
}
