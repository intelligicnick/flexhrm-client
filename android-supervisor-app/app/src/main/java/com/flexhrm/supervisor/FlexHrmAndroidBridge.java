package com.flexhrm.supervisor;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
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
  public String getInstalledApps() {
    PackageManager pm = activity.getPackageManager();
    JSONArray apps = new JSONArray();

    for (ApplicationInfo info : pm.getInstalledApplications(PackageManager.GET_META_DATA)) {
      if ((info.flags & ApplicationInfo.FLAG_SYSTEM) != 0) {
        continue;
      }
      try {
        JSONObject item = new JSONObject();
        item.put("packageName", info.packageName);
        CharSequence label = pm.getApplicationLabel(info);
        if (label != null) {
          item.put("appName", label.toString());
        }
        apps.put(item);
      } catch (Exception ignored) {
        // Skip malformed entries.
      }
    }

    return apps.toString();
  }

  @JavascriptInterface
  public void uninstallApp(String packageName) {
    if (packageName == null || packageName.trim().isEmpty()) {
      return;
    }
    Intent intent = new Intent(Intent.ACTION_DELETE);
    intent.setData(Uri.parse("package:" + packageName.trim()));
    activity.startActivity(intent);
  }
}
