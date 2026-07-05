# Keep WebView JavaScript bridge methods.
-keepclassmembers class com.flexhrm.supervisor.FlexHrmAndroidBridge {
    public *;
}

-keep class com.flexhrm.supervisor.tracking.** { *; }
-keep class com.flexhrm.supervisor.SupervisorSessionCache { *; }
-keep class com.flexhrm.supervisor.SupervisorSession { *; }

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
