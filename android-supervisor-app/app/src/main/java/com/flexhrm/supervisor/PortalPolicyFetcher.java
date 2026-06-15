package com.flexhrm.supervisor;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public final class PortalPolicyFetcher {
  private PortalPolicyFetcher() {}

  public static List<String> fetchBlockedApps(String apiBase) throws Exception {
    String base = apiBase.endsWith("/") ? apiBase.substring(0, apiBase.length() - 1) : apiBase;
    URL url = new URL(base + "/auth/supervisor/portal-policy");
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setConnectTimeout(15000);
    connection.setReadTimeout(15000);
    connection.setRequestMethod("GET");

    int code = connection.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new IllegalStateException("Policy request failed: HTTP " + code);
    }

    StringBuilder body = new StringBuilder();
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
      String line;
      while ((line = reader.readLine()) != null) {
        body.append(line);
      }
    } finally {
      connection.disconnect();
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
