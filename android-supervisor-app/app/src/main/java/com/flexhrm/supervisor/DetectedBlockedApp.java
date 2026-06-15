package com.flexhrm.supervisor;

public class DetectedBlockedApp {
  public final String blockedEntry;
  public final String packageName;
  public final String appName;

  public DetectedBlockedApp(String blockedEntry, String packageName, String appName) {
    this.blockedEntry = blockedEntry;
    this.packageName = packageName;
    this.appName = appName;
  }
}
