package com.flexhrm.supervisor;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;

/** Persists the last fetched blocked-apps configuration for offline scans. */
public final class BlockedAppsPolicyCache {
  private static final String PREFS = "flexhrm_supervisor_security";
  private static final String KEY_BLOCKED_APPS = "blocked_apps_json";

  private BlockedAppsPolicyCache() {}

  public static void save(Context context, List<String> blockedApps) {
    JSONArray array = new JSONArray();
    for (String entry : blockedApps) {
      if (entry != null && !entry.trim().isEmpty()) {
        array.put(entry.trim());
      }
    }
    prefs(context).edit().putString(KEY_BLOCKED_APPS, array.toString()).apply();
  }

  public static List<String> load(Context context) {
    String raw = prefs(context).getString(KEY_BLOCKED_APPS, "");
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

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }
}
