package com.flexhrm.supervisor;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

public final class SupervisorSessionCache {
  private static final String PREFS = "flexhrm_supervisor_session";
  private static final String KEY_TOKEN = "token";
  private static final String KEY_NAME = "name";
  private static final String KEY_SUPERVISOR_ID = "supervisor_id";

  private SupervisorSessionCache() {}

  public static void save(Context context, String token, String name, String supervisorId) {
    if (token == null || token.trim().isEmpty()) {
      clear(context);
      return;
    }
    prefs(context)
        .edit()
        .putString(KEY_TOKEN, token.trim())
        .putString(KEY_NAME, name != null ? name.trim() : "")
        .putString(KEY_SUPERVISOR_ID, supervisorId != null ? supervisorId.trim() : "")
        .apply();
  }

  public static void saveFromJson(Context context, String json) {
    if (json == null || json.trim().isEmpty()) {
      clear(context);
      return;
    }
    try {
      JSONObject object = new JSONObject(json);
      save(
          context,
          object.optString("token", ""),
          object.optString("name", ""),
          object.optString("supervisorId", ""));
    } catch (Exception ignored) {
      clear(context);
    }
  }

  public static String loadJson(Context context) {
    SharedPreferences store = prefs(context);
    String token = store.getString(KEY_TOKEN, "");
    if (token == null || token.trim().isEmpty()) {
      return "";
    }
    try {
      JSONObject object = new JSONObject();
      object.put("token", token.trim());
      object.put("name", store.getString(KEY_NAME, ""));
      object.put("supervisorId", store.getString(KEY_SUPERVISOR_ID, ""));
      return object.toString();
    } catch (Exception error) {
      return "";
    }
  }

  public static void clear(Context context) {
    prefs(context).edit().clear().apply();
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }
}
