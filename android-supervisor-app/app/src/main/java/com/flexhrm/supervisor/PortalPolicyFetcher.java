package com.flexhrm.supervisor;

import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public final class PortalPolicyFetcher {
  private static final String TAG = "PortalPolicyFetcher";
  private static final int MAX_ATTEMPTS = 3;

  private PortalPolicyFetcher() {}

  public static List<String> fetchBlockedApps(String apiBase) throws Exception {
    Exception lastError = null;
    String base = apiBase.endsWith("/") ? apiBase.substring(0, apiBase.length() - 1) : apiBase;
    String policyUrl = base + "/auth/supervisor/portal-policy";

    for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return fetchOnce(policyUrl);
      } catch (Exception error) {
        lastError = error;
        Log.w(TAG, "Policy fetch attempt " + attempt + " failed", error);
        if (attempt < MAX_ATTEMPTS) {
          Thread.sleep(1000L * attempt);
        }
      }
    }

    if (lastError != null) {
      throw lastError;
    }
    throw new IllegalStateException("Policy fetch failed");
  }

  private static List<String> fetchOnce(String policyUrl) throws Exception {
    URL url = new URL(policyUrl);
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setConnectTimeout(20000);
    connection.setReadTimeout(20000);
    connection.setRequestMethod("GET");
    connection.setInstanceFollowRedirects(true);
    connection.setRequestProperty("Accept", "application/json");
    connection.setRequestProperty(
        "User-Agent",
        "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 FlexHrmSupervisor/"
            + BuildConfig.VERSION_NAME);

    int code = connection.getResponseCode();
    InputStream stream =
        code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
    if (stream == null) {
      connection.disconnect();
      throw new IllegalStateException("Policy request failed: HTTP " + code);
    }

    StringBuilder body = new StringBuilder();
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        body.append(line);
      }
    } finally {
      connection.disconnect();
    }

    if (code < 200 || code >= 300) {
      throw new IllegalStateException("Policy request failed: HTTP " + code);
    }

    JSONObject json = new JSONObject(body.toString());
    JSONArray blocked = json.optJSONArray("blockedAppsToUninstall");
    List<String> result = new ArrayList<>();
    if (blocked == null) {
      return result;
    }
    for (int i = 0; i < blocked.length(); i++) {
      String entry = blocked.optString(i, "").trim();
      if (!entry.isEmpty()) {
        result.add(entry);
      }
    }
    return result;
  }
}
