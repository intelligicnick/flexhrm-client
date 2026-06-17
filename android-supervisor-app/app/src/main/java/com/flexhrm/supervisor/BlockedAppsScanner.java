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

  private static final Map<String, String[]> KNOWN_APP_PACKAGES = new HashMap<>();

  static {
    KNOWN_APP_PACKAGES.put("anyto", new String[] {"com.imyfone.anytoandroid", "com.tenorshare.ianygo"});
    KNOWN_APP_PACKAGES.put("fake gps", new String[] {
        "com.lexa.fakegps", "com.incorporateapps.fakegps.fre",
        "com.blogspot.newapphorizons.fakegps", "com.fakegps.mock",
        "com.mobile.fakelocation"
    });
    KNOWN_APP_PACKAGES.put("fake gps location", new String[] {
        "com.lexa.fakegps", "com.incorporateapps.fakegps.fre",
        "com.mobile.fakelocation"
    });
    KNOWN_APP_PACKAGES.put("locaedit", new String[] {"com.mobile.fakelocation"});
    KNOWN_APP_PACKAGES.put("fake gps location-locaedit", new String[] {"com.mobile.fakelocation"});
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
      List<String> blockedEntries, List<InstalledApp> installedApps) {
    List<DetectedBlockedApp> detected = new ArrayList<>();
    if (blockedEntries == null || blockedEntries.isEmpty()) {
      return detected;
    }

    Set<String> seen = new HashSet<>();
    String ownPackageNorm = normalize(OWN_PACKAGE);

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
        if (installedAppMatchesBlockedEntry(installed, entry.trim())) {
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

  private static boolean installedAppMatchesBlockedEntry(InstalledApp installed, String entry) {
    ParsedEntry parsed = parseBlockedAppEntry(entry);
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
