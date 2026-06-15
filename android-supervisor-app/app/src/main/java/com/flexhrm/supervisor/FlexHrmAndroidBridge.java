package com.flexhrm.supervisor;

import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

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
}
