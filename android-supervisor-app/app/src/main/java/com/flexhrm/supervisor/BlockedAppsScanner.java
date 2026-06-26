package com.flexhrm.supervisor;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class BlockedAppsScanner {
  private static final String OWN_PACKAGE = "com.flexhrm.supervisor";
  private static final int MIN_PARTIAL_LABEL_LENGTH = 3;

  private static volatile Map<String, String[]> knownPackages;

  private static Map<String, String[]> getKnownPackages(Context context) {
    Map<String, String[]> cached = knownPackages;
    if (cached != null) {
      return cached;
    }
    synchronized (BlockedAppsScanner.class) {
      if (knownPackages != null) {
        return knownPackages;
      }
      knownPackages = loadKnownAppPackages(context.getApplicationContext());
      return knownPackages;
    }
  }

  private static Map<String, String[]> loadKnownAppPackages(Context context) {
    Map<String, String[]> map = new HashMap<>();
    try {
      java.io.InputStream stream = context.getAssets().open("blocked-app-packages.json");
      java.io.BufferedReader reader =
          new java.io.BufferedReader(new java.io.InputStreamReader(stream));
      StringBuilder json = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) {
        json.append(line);
      }
      reader.close();
      org.json.JSONObject root = new org.json.JSONObject(json.toString());
      java.util.Iterator<String> keys = root.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        org.json.JSONArray packages = root.getJSONArray(key);
        String[] values = new String[packages.length()];
        for (int i = 0; i < packages.length(); i++) {
          values[i] = packages.getString(i);
        }
        map.put(key, values);
      }
    } catch (Exception ignored) {
      map.put("whatsapp", new String[] {"com.whatsapp", "com.whatsapp.w4b"});
    }
    return map;
  }

  private BlockedAppsScanner() {}

  /** Returns every installed app visible on the device (user + updated system apps). */
  public static List<InstalledApp> getAllInstalledApps(Context context) {
    PackageManager pm = context.getPackageManager();
    List<InstalledApp> apps = new ArrayList<>();

    for (ApplicationInfo info : pm.getInstalledApplications(PackageManager.GET_META_DATA)) {
      boolean isUpdatedSystem =
          (info.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0;
      boolean isSystem = (info.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
      if (isSystem && !isUpdatedSystem) {
        continue;
      }

      CharSequence label = pm.getApplicationLabel(info);
      apps.add(
          new InstalledApp(
              info.packageName,
              label != null ? label.toString() : info.packageName));
    }
    return apps;
  }

  /**
   * Scans every installed app and returns those that match any entry in the configured blocked list.
   */
  public static List<DetectedBlockedApp> findInstalledBlockedApps(
      Context context, List<String> blockedEntries, List<InstalledApp> installedApps) {
    List<DetectedBlockedApp> detected = new ArrayList<>();
    if (blockedEntries == null || blockedEntries.isEmpty()) {
      return detected;
    }

    Set<String> seen = new HashSet<>();
    String ownPackageNorm = normalize(OWN_PACKAGE);
    Map<String, String[]> knownPackages = getKnownPackages(context);

    for (InstalledApp installed : installedApps) {
      String packageNorm = normalize(installed.packageName);
      if (packageNorm.equals(ownPackageNorm)) {
        continue;
      }

      String matchedEntry = null;
      for (String entry : blockedEntries) {
        if (entry == null || entry.trim().isEmpty()) {
          continue;
        }
        if (installedAppMatchesBlockedEntry(installed, entry.trim(), knownPackages)) {
          matchedEntry = entry.trim();
          break;
        }
      }

      if (matchedEntry == null) {
        continue;
      }

      if (seen.contains(packageNorm)) {
        continue;
      }
      seen.add(packageNorm);

      String displayName =
          installed.appName != null && !installed.appName.isEmpty()
              ? installed.appName
              : installed.packageName;
      detected.add(new DetectedBlockedApp(matchedEntry, installed.packageName, displayName));
    }

    return detected;
  }

  private static boolean installedAppMatchesBlockedEntry(
      InstalledApp installed, String entry, Map<String, String[]> knownPackages) {
    ParsedEntry parsed = parseBlockedAppEntry(entry, knownPackages);
    if (parsed.label.isEmpty()) {
      return false;
    }

    String packageNorm = normalize(installed.packageName);
    String appLabelNorm = installed.appName != null ? normalize(installed.appName) : "";
    String blockedLabelNorm = normalize(parsed.label);

    for (String blockedPackage : parsed.packageNames) {
      if (packageNorm.equals(normalize(blockedPackage))) {
        return true;
      }
    }

    if (looksLikePackageName(parsed.label) && packageNorm.equals(blockedLabelNorm)) {
      return true;
    }

    if (!appLabelNorm.isEmpty() && appLabelNorm.equals(blockedLabelNorm)) {
      return true;
    }

    if (!appLabelNorm.isEmpty() && blockedLabelNorm.length() >= MIN_PARTIAL_LABEL_LENGTH) {
      if (appLabelNorm.contains(blockedLabelNorm) || blockedLabelNorm.contains(appLabelNorm)) {
        return true;
      }
    }

    if (!appLabelNorm.isEmpty() && allSignificantTokensMatch(blockedLabelNorm, appLabelNorm, packageNorm)) {
      return true;
    }

    return false;
  }

  private static boolean allSignificantTokensMatch(
      String blockedLabelNorm, String appLabelNorm, String packageNorm) {
    String[] tokens = blockedLabelNorm.split("[^a-z0-9]+");
    int significant = 0;
    int matched = 0;
    for (String token : tokens) {
      if (token.length() < MIN_PARTIAL_LABEL_LENGTH) {
        continue;
      }
      significant++;
      if (appLabelNorm.contains(token) || packageNorm.contains(token)) {
        matched++;
      }
    }
    return significant > 0 && matched == significant;
  }

  private static ParsedEntry parseBlockedAppEntry(
      String entry, Map<String, String[]> knownPackages) {
    String trimmed = entry.trim();
    if (trimmed.isEmpty()) return new ParsedEntry("", new String[0]);

    String[] pipeParts = trimmed.split("\\|");
    if (pipeParts.length >= 2) {
      String label = pipeParts[0].trim();
      List<String> packages = new ArrayList<>();
      for (int i = 1; i < pipeParts.length; i++) {
        String part = pipeParts[i].trim();
        if (looksLikePackageName(part)) packages.add(part);
      }
      if (!packages.isEmpty()) {
        return new ParsedEntry(label, packages.toArray(new String[0]));
      }
    }

    if (looksLikePackageName(trimmed)) {
      return new ParsedEntry(trimmed, new String[] {trimmed});
    }

    String[] known = knownPackages.get(normalize(trimmed));
    if (known != null) return new ParsedEntry(trimmed, known);

    return new ParsedEntry(trimmed, new String[0]);
  }

  private static boolean looksLikePackageName(String value) {
    return value.matches("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+)+$");
  }

  private static String normalize(String value) {
    return value.trim().toLowerCase(Locale.US);
  }

  public static class InstalledApp {
    public final String packageName;
    public final String appName;

    public InstalledApp(String packageName, String appName) {
      this.packageName = packageName;
      this.appName = appName;
    }
  }

  private static class ParsedEntry {
    final String label;
    final String[] packageNames;

    ParsedEntry(String label, String[] packageNames) {
      this.label = label;
      this.packageNames = packageNames;
    }
  }
}
