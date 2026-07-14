package com.flexhrm.supervisor;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import com.flexhrm.supervisor.tracking.bridge.TrackingBridge;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Native bridge exposed to the supervisor WebView as {@code window.FlexHrmAndroid}.
 */
public class FlexHrmAndroidBridge {
  private final MainActivity activity;

  public FlexHrmAndroidBridge(MainActivity activity) {
    this.activity = activity;
  }

  @JavascriptInterface
  public String getDeviceId() {
    String androidId =
        Settings.Secure.getString(activity.getContentResolver(), Settings.Secure.ANDROID_ID);
    return androidId != null ? androidId : "";
  }

  @JavascriptInterface
  public String getBuildNumber() {
    return Build.DISPLAY != null ? Build.DISPLAY : "";
  }

  @JavascriptInterface
  public boolean isNativeApp() {
    return true;
  }

  @JavascriptInterface
  public String getApiBase() {
    return BuildConfig.API_ORIGIN;
  }

  @JavascriptInterface
  public void logDebug(String payload) {
    android.util.Log.d("FlexHrmDebug", payload != null ? payload : "");
  }

  @JavascriptInterface
  public String getInstalledApps() {
    List<BlockedAppsScanner.InstalledApp> apps =
        BlockedAppsScanner.getAllInstalledApps(activity);
    JSONArray array = new JSONArray();
    for (BlockedAppsScanner.InstalledApp app : apps) {
      JSONObject item = new JSONObject();
      try {
        item.put("packageName", app.packageName);
        item.put("appName", app.appName);
        array.put(item);
      } catch (Exception ignored) {
        // skip malformed entry
      }
    }
    return array.toString();
  }

  @JavascriptInterface
  public void uninstallApp(String packageName) {
    if (packageName == null || packageName.trim().isEmpty()) return;
    Intent intent = new Intent(Intent.ACTION_DELETE);
    intent.setData(Uri.parse("package:" + packageName.trim()));
    activity.startActivity(intent);
  }

  @JavascriptInterface
  public String getGpsCoordinates() {
    String cached = TrackingBridge.getCachedGpsJson();
    if (cached != null && !cached.equals("{}")) {
      return cached;
    }
    return NativeGpsHelper.getCoordinatesJson(activity);
  }

  @JavascriptInterface
  public void warmupGps() {
    NativeGpsHelper.warmup(activity);
  }

  @JavascriptInterface
  public void capturePhoto() {
    activity.runOnUiThread(() -> activity.launchNativeCamera());
  }

  @JavascriptInterface
  public void requestFreshGps() {
    NativeGpsHelper.requestFreshCoordinates(
        activity,
        json -> activity.runOnUiThread(() -> activity.deliverGpsJsonToWeb(json)));
  }

  @JavascriptInterface
  public void saveSupervisorSession(String json) {
    SupervisorSessionCache.saveFromJson(activity, json);
  }

  @JavascriptInterface
  public String getSupervisorSession() {
    return SupervisorSessionCache.loadJson(activity);
  }

  @JavascriptInterface
  public void clearSupervisorSession() {
    SupervisorSessionCache.clear(activity);
  }

  @JavascriptInterface
  public void startTracking() {
    TrackingBridge.startTracking(activity);
  }

  @JavascriptInterface
  public void stopTracking() {
    TrackingBridge.stopTracking(activity);
  }

  @JavascriptInterface
  public String getTrackingStatus() {
    return TrackingBridge.getTrackingStatus(activity);
  }

  @JavascriptInterface
  public String getRoutePoints(long fromMs, long toMs) {
    return TrackingBridge.getRoutePoints(activity, fromMs, toMs);
  }

  @JavascriptInterface
  public String getRouteSummary(long fromMs, long toMs) {
    return TrackingBridge.getRouteSummary(activity, fromMs, toMs);
  }

  @JavascriptInterface
  public boolean isBatteryOptimizationDisabled() {
    return TrackingBridge.isBatteryOptimizationDisabled(activity);
  }

  @JavascriptInterface
  public void openBatterySettings() {
    activity.runOnUiThread(() -> TrackingBridge.openBatterySettings(activity));
  }

  @JavascriptInterface
  public String getDeviceIntegrity() {
    return TrackingBridge.getDeviceIntegrity(activity);
  }
}
