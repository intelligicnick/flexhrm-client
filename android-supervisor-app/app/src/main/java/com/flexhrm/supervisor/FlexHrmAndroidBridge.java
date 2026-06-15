package com.flexhrm.supervisor;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
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
  public String getInstalledApps() {
    List<BlockedAppsScanner.InstalledApp> apps =
        BlockedAppsScanner.getUserInstalledApps(activity);
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
}
