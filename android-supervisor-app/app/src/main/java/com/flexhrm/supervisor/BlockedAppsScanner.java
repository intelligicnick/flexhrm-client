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
  private static final Map<String, String[]> KNOWN_APP_PACKAGES = new HashMap<>();

  static {
    KNOWN_APP_PACKAGES.put("anyto", new String[] {"com.imyfone.anytoandroid", "com.tenorshare.ianygo"});
    KNOWN_APP_PACKAGES.put("fake gps", new String[] {
        "com.lexa.fakegps", "com.incorporateapps.fakegps.fre",
        "com.blogspot.newapphorizons.fakegps", "com.fakegps.mock"
    });
    KNOWN_APP_PACKAGES.put("fake gps location", new String[] {
        "com.lexa.fakegps", "com.incorporateapps.fakegps.fre"
    });
    KNOWN_APP_PACKAGES.put("gps emulator", new String[] {"com.rosteam.gpsemulator"});
    KNOWN_APP_PACKAGES.put("lexa fake gps", new String[] {"com.lexa.fakegps"});
    KNOWN_APP_PACKAGES.put("mock locations", new String[] {"com.lexa.fakegps"});
    KNOWN_APP_PACKAGES.put("location changer", new String[] {"com.lexa.fakegps"});
    KNOWN_APP_PACKAGES.put("gps joystick", new String[] {"com.theappninjas.gpsjoystick"});
    KNOWN_APP_PACKAGES.put("fly gps", new String[] {"com.fakegps.mock"});
    KNOWN_APP_PACKAGES.put("anydesk", new String[] {"com.anydesk.anydeskandroid"});
    KNOWN_APP_PACKAGES.put("teamviewer", new String[] {"com.teamviewer.teamviewer.market.mobile"});
    KNOWN_APP_PACKAGES.put("whatsapp", new String[] {"com.whatsapp", "com.whatsapp.w4b"});
    KNOWN_APP_PACKAGES.put("telegram", new String[] {"org.telegram.messenger", "org.telegram.messenger.web"});
    KNOWN_APP_PACKAGES.put("facebook", new String[] {"com.facebook.katana", "com.facebook.lite"});
    KNOWN_APP_PACKAGES.put("instagram", new String[] {"com.instagram.android"});
    KNOWN_APP_PACKAGES.put("snapchat", new String[] {"com.snapchat.android"});
    KNOWN_APP_PACKAGES.put("tiktok", new String[] {"com.zhiliaoapp.musically", "com.ss.android.ugc.trill"});
    KNOWN_APP_PACKAGES.put("twitter", new String[] {"com.twitter.android"});
    KNOWN_APP_PACKAGES.put("x", new String[] {"com.twitter.android"});
    KNOWN_APP_PACKAGES.put("zoom", new String[] {"us.zoom.videomeetings"});
    KNOWN_APP_PACKAGES.put("teams", new String[] {"com.microsoft.teams"});
    KNOWN_APP_PACKAGES.put("discord", new String[] {"com.discord"});
    KNOWN_APP_PACKAGES.put("signal", new String[] {"org.thoughtcrime.securesms"});
    KNOWN_APP_PACKAGES.put("viber", new String[] {"com.viber.voip"});
    KNOWN_APP_PACKAGES.put("wechat", new String[] {"com.tencent.mm"});
    KNOWN_APP_PACKAGES.put("truecaller", new String[] {"com.truecaller"});
    KNOWN_APP_PACKAGES.put("shareit", new String[] {"com.lenovo.anyshare.gps"});
    KNOWN_APP_PACKAGES.put("pubg", new String[] {"com.tencent.ig", "com.pubg.imobile"});
    KNOWN_APP_PACKAGES.put("free fire", new String[] {"com.dts.freefireth", "com.dts.freefiremax"});
    KNOWN_APP_PACKAGES.put("unicool tailorgo", new String[] {"com.unictool.tailorgo", "com.tailorgo.virtual"});
    KNOWN_APP_PACKAGES.put("tailorgo", new String[] {"com.unictool.tailorgo", "com.tailorgo.virtual"});
    KNOWN_APP_PACKAGES.put("virtual location", new String[] {"com.lexa.fakegps", "com.imyfone.anytoandroid"});
    KNOWN_APP_PACKAGES.put("locationsimulator", new String[] {"com.lexa.fakegps", "com.incorporateapps.fakegps.fre"});
    KNOWN_APP_PACKAGES.put("dr.fone virtual location", new String[] {"com.wondershare.drfonevirtuallocation"});
    KNOWN_APP_PACKAGES.put("3utools", new String[] {"com.3u.tools"});
    KNOWN_APP_PACKAGES.put("easeus mobianygo", new String[] {"com.easeus.mobianygo"});
    KNOWN_APP_PACKAGES.put("wootechy imovego", new String[] {"com.wootechy.imovego"});
  }

  private BlockedAppsScanner() {}

  public static List<InstalledApp> getUserInstalledApps(Context context) {
    PackageManager pm = context.getPackageManager();
    List<InstalledApp> apps = new ArrayList<>();

    for (ApplicationInfo info : pm.getInstalledApplications(PackageManager.GET_META_DATA)) {
      if ((info.flags & ApplicationInfo.FLAG_SYSTEM) != 0) {
        continue;
      }
      CharSequence label = pm.getApplicationLabel(info);
      apps.add(new InstalledApp(
          info.packageName,
          label != null ? label.toString() : info.packageName));
    }
    return apps;
  }

  public static List<DetectedBlockedApp> findInstalledBlockedApps(
      List<String> blockedEntries, List<InstalledApp> installedApps) {
    Map<String, InstalledApp> installedByPackage = new HashMap<>();

    for (InstalledApp app : installedApps) {
      installedByPackage.put(normalize(app.packageName), app);
    }

    List<DetectedBlockedApp> detected = new ArrayList<>();
    Set<String> seen = new HashSet<>();

    for (String entry : blockedEntries) {
      ParsedEntry parsed = parseBlockedAppEntry(entry);
      if (parsed.label.isEmpty()) continue;

      InstalledApp match = null;
      for (String packageName : parsed.packageNames) {
        match = installedByPackage.get(normalize(packageName));
        if (match != null) break;
      }
      if (match == null) {
        match = exactLabelMatch(parsed.label, installedApps);
      }
      if (match == null) continue;

      String dedupeKey = normalize(match.packageName);
      if (seen.contains(dedupeKey)) continue;
      seen.add(dedupeKey);

      String displayName = match.appName != null && !match.appName.isEmpty()
          ? match.appName : parsed.label;
      detected.add(new DetectedBlockedApp(entry, match.packageName, displayName));
    }
    return detected;
  }

  private static InstalledApp exactLabelMatch(String label, List<InstalledApp> installedApps) {
    String labelNorm = normalize(label);
    for (InstalledApp app : installedApps) {
      if (app.appName != null && normalize(app.appName).equals(labelNorm)) {
        return app;
      }
    }
    return null;
  }

  private static ParsedEntry parseBlockedAppEntry(String entry) {
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

    String[] known = KNOWN_APP_PACKAGES.get(normalize(trimmed));
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
