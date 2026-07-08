package com.flexhrm.supervisor;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import com.flexhrm.supervisor.tracking.domain.TrackingConfig;
import com.flexhrm.supervisor.tracking.bridge.TrackingBridge;
import androidx.webkit.WebViewAssetLoader;
import android.graphics.BitmapFactory;
import android.util.Base64;
import androidx.core.content.FileProvider;
import java.io.ByteArrayOutputStream;
import java.io.File;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
  private static final String TAG = "FlexHrmSupervisor";
  private static final String NATIVE_USER_AGENT_TOKEN =
      "FlexHrmSupervisor/" + BuildConfig.VERSION_NAME;

  private WebView webView;
  private ProgressBar progressBar;
  private LinearLayout errorPanel;
  private LinearLayout securityCheckPanel;
  private LinearLayout locationGatePanel;
  private TextView errorMessage;
  private TextView locationGateMessage;
  private WebViewAssetLoader assetLoader;
  private ValueCallback<Uri[]> filePathCallback;
  private PermissionRequest pendingWebPermissionRequest;
  private GeolocationPermissions.Callback pendingGeoCallback;
  private String pendingGeoOrigin;
  private AlertDialog blockedAppsDialog;
  private boolean portalLoaded;
  private boolean securityCheckPassed;
  private long lastSecurityPassAt;
  private boolean pendingNativeCameraAfterPermission;
  private boolean pendingCameraAfterSettings;
  private File pendingCaptureFile;
  private Uri pendingCaptureUri;
  private enum CaptureTarget {
    NATIVE_BRIDGE,
    WEB_FILE_INPUT
  }
  private CaptureTarget pendingCaptureTarget = CaptureTarget.NATIVE_BRIDGE;
  private final ExecutorService securityExecutor = Executors.newSingleThreadExecutor();

  private final ActivityResultLauncher<Uri> takePictureLauncher =
      registerForActivityResult(
          new ActivityResultContracts.TakePicture(),
          success -> {
            if (success && pendingCaptureFile != null && pendingCaptureFile.exists()) {
              if (pendingCaptureTarget == CaptureTarget.WEB_FILE_INPUT) {
                deliverCapturedUriToFileCallback(pendingCaptureUri);
              } else {
                deliverCapturedPhoto(pendingCaptureFile);
              }
            } else if (pendingCaptureTarget == CaptureTarget.WEB_FILE_INPUT) {
              cancelFileCallback();
            } else {
              deliverPhotoErrorToWeb("Camera capture cancelled.");
            }
            pendingCaptureFile = null;
            pendingCaptureUri = null;
            pendingCaptureTarget = CaptureTarget.NATIVE_BRIDGE;
          });

  private final ActivityResultLauncher<String[]> startupPermissionLauncher =
      registerForActivityResult(
          new ActivityResultContracts.RequestMultiplePermissions(),
          result -> onStartupPermissionsResult());

  private final ActivityResultLauncher<String[]> webPermissionLauncher =
      registerForActivityResult(
          new ActivityResultContracts.RequestMultiplePermissions(),
          result -> onWebPermissionsResult());

  private final ActivityResultLauncher<String> backgroundLocationLauncher =
      registerForActivityResult(
          new ActivityResultContracts.RequestPermission(),
          granted -> {
            if (granted) {
              maybePromptBatteryOptimization();
            }
          });

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    SplashScreen.installSplashScreen(this);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    setContentView(R.layout.activity_main);

    webView = findViewById(R.id.webView);
    progressBar = findViewById(R.id.progressBar);
    errorPanel = findViewById(R.id.errorPanel);
    securityCheckPanel = findViewById(R.id.securityCheckPanel);
    locationGatePanel = findViewById(R.id.locationGatePanel);
    errorMessage = findViewById(R.id.errorMessage);
    locationGateMessage = findViewById(R.id.locationGateMessage);
    Button retryButton = findViewById(R.id.retryButton);
    Button locationEnableButton = findViewById(R.id.locationEnableButton);
    Button locationRetryButton = findViewById(R.id.locationRetryButton);

    retryButton.setOnClickListener(v -> runSecurityCheck());
    locationEnableButton.setOnClickListener(v -> onLocationGateAction());
    locationRetryButton.setOnClickListener(v -> ensureLocationReady());
    webView.setVisibility(View.GONE);

    assetLoader =
        new WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", new SpaAssetPathHandler(this))
            .build();

    configureWebView();
    ensurePortalLoaded();
    requestStartupPermissions();

    getOnBackPressedDispatcher()
        .addCallback(
            this,
            new OnBackPressedCallback(true) {
              @Override
              public void handleOnBackPressed() {
                if (blockedAppsDialog != null && blockedAppsDialog.isShowing()) return;
                if (webView.getVisibility() == View.VISIBLE && webView.canGoBack()) {
                  webView.goBack();
                } else {
                  setEnabled(false);
                  getOnBackPressedDispatcher().onBackPressed();
                }
              }
            });
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (pendingCameraAfterSettings) {
      pendingCameraAfterSettings = false;
      if (hasCameraPermission()) {
        if (pendingCaptureTarget == CaptureTarget.WEB_FILE_INPUT && filePathCallback != null) {
          openFileChooser();
        } else {
          launchNativeCamera();
        }
      } else {
        deliverPhotoErrorToWeb(getString(R.string.camera_permission_denied));
      }
    }
    if (securityCheckPassed && locationGatePanel.getVisibility() == View.VISIBLE) {
      ensureLocationReady();
      return;
    }
    if (securityCheckPassed && portalLoaded) {
      long elapsed = System.currentTimeMillis() - lastSecurityPassAt;
      if (elapsed >= TrackingConfig.SECURITY_SCAN_INTERVAL_MS) {
        runSecurityCheck(false);
      }
      return;
    }
    runSecurityCheck(true);
  }

  private void runSecurityCheck() {
    runSecurityCheck(true);
  }

  private void runSecurityCheck(boolean blocking) {
    if (blocking) {
      securityCheckPassed = false;
      hideLocationGate();
      errorPanel.setVisibility(View.GONE);
      securityCheckPanel.setVisibility(View.VISIBLE);
      webView.setVisibility(View.GONE);
    }

    final List<String> initialPolicy = BlockedAppsPolicyCache.resolvePolicy(this);
    securityExecutor.execute(
        () -> {
          runLocalScan(initialPolicy, blocking);
          if (isOnline() && BlockedAppsPolicyCache.shouldRefreshPolicy(MainActivity.this)) {
            try {
              List<String> remotePolicy =
                  PortalPolicyFetcher.fetchBlockedApps(BuildConfig.API_BASE);
              BlockedAppsPolicyCache.save(MainActivity.this, remotePolicy);
              runLocalScan(remotePolicy, false);
            } catch (Exception error) {
              Log.w(TAG, "Security policy fetch failed; using cached/bundled policy", error);
            }
          }
        });
  }

  private void runLocalScan(List<String> blockedPolicy) {
    runLocalScan(blockedPolicy, true);
  }

  private void runLocalScan(List<String> blockedPolicy, boolean blocking) {
    List<BlockedAppsScanner.InstalledApp> installed =
        BlockedAppsScanner.getAllInstalledApps(MainActivity.this);
    List<DetectedBlockedApp> detected =
        BlockedAppsScanner.findInstalledBlockedApps(this, blockedPolicy, installed);
    Log.d(
        TAG,
        "Blocked app scan: policy="
            + blockedPolicy.size()
            + " installed="
            + installed.size()
            + " detected="
            + detected.size());

    runOnUiThread(
        () -> {
          if (blocking) {
            securityCheckPanel.setVisibility(View.GONE);
          }
          if (detected.isEmpty()) {
            securityCheckPassed = true;
            lastSecurityPassAt = System.currentTimeMillis();
            if (blocking) {
              ensureLocationReady();
            }
          } else {
            if (blocking) {
              portalLoaded = false;
              webView.setVisibility(View.GONE);
            }
            showBlockedAppsDialog(detected);
          }
        });
  }

  private void showBlockedAppsDialog(List<DetectedBlockedApp> detected) {
    if (blockedAppsDialog != null && blockedAppsDialog.isShowing()) {
      blockedAppsDialog.dismiss();
    }

    ScrollView scrollView = new ScrollView(this);
    int padding = dp(16);
    scrollView.setPadding(padding, padding, padding, padding);

    LinearLayout container = new LinearLayout(this);
    container.setOrientation(LinearLayout.VERTICAL);

    TextView intro = new TextView(this);
    intro.setText(
        detected.size() == 1
            ? getString(R.string.blocked_apps_message_single, detected.get(0).appName)
            : getString(R.string.blocked_apps_message));
    intro.setTextColor(0xFF475569);
    intro.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
    intro.setPadding(0, 0, 0, dp(12));
    container.addView(intro);

    for (DetectedBlockedApp app : detected) {
      LinearLayout row = new LinearLayout(this);
      row.setOrientation(LinearLayout.HORIZONTAL);
      row.setGravity(Gravity.CENTER_VERTICAL);
      row.setPadding(0, 0, 0, dp(10));

      TextView name = new TextView(this);
      name.setLayoutParams(
          new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
      name.setText(app.appName);
      name.setTextColor(0xFF0F172A);
      name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
      name.setTypeface(Typeface.DEFAULT_BOLD);

      Button uninstall = new Button(this);
      uninstall.setText(getString(R.string.blocked_apps_uninstall));
      uninstall.setAllCaps(false);
      uninstall.setOnClickListener(v -> uninstallApp(app.packageName));

      row.addView(name);
      row.addView(uninstall);
      container.addView(row);
    }

    scrollView.addView(container);

    blockedAppsDialog =
        new AlertDialog.Builder(this)
            .setTitle(getString(R.string.blocked_apps_title))
            .setView(scrollView)
            .setCancelable(false)
            .setPositiveButton(
                getString(R.string.blocked_apps_check_again), (dialog, which) -> runSecurityCheck())
            .create();
    blockedAppsDialog.show();
  }

  private void uninstallApp(String packageName) {
    Intent intent = new Intent(Intent.ACTION_DELETE);
    intent.setData(Uri.parse("package:" + packageName));
    startActivity(intent);
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private void ensureLocationReady() {
    if (!securityCheckPassed) {
      return;
    }

    if (NativeGpsHelper.isLocationReady(this)) {
      hideLocationGate();
      NativeGpsHelper.warmup(this);
      requestBackgroundLocationIfNeeded();
      openPortal();
      return;
    }

    if (!hasLocationPermission()) {
      showLocationGate(getString(R.string.location_permission_required));
      return;
    }

    showLocationGate(getString(R.string.location_services_required));
  }

  private void showLocationGate(@NonNull String message) {
    securityCheckPanel.setVisibility(View.GONE);
    errorPanel.setVisibility(View.GONE);
    webView.setVisibility(View.GONE);
    locationGateMessage.setText(message);
    locationGatePanel.setVisibility(View.VISIBLE);
  }

  private void hideLocationGate() {
    if (locationGatePanel != null) {
      locationGatePanel.setVisibility(View.GONE);
    }
  }

  private void onLocationGateAction() {
    if (!hasLocationPermission()) {
      if (shouldShowLocationPermissionSettings()) {
        openAppSettings();
      } else {
        requestStartupPermissions();
      }
      return;
    }

    startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
  }

  private boolean shouldShowLocationPermissionSettings() {
    if (hasLocationPermission()) {
      return false;
    }
    boolean fineDenied =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED;
    boolean coarseDenied =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED;
    if (!fineDenied && !coarseDenied) {
      return false;
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return false;
    }
    boolean fineRationale =
        shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION);
    boolean coarseRationale =
        shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_COARSE_LOCATION);
    return !fineRationale && !coarseRationale;
  }

  private void openAppSettings() {
    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
    intent.setData(Uri.parse("package:" + getPackageName()));
    startActivity(intent);
  }

  private void ensurePortalLoaded() {
    if (portalLoaded || webView == null) {
      return;
    }
    portalLoaded = true;
    webView.loadUrl(resolveEntryUrl());
  }

  private String resolveEntryUrl() {
    String sessionJson = SupervisorSessionCache.loadJson(this);
    if (sessionJson != null && !sessionJson.isEmpty()) {
      return portalBaseUrl();
    }
    return BuildConfig.SUPERVISOR_URL;
  }

  private String portalBaseUrl() {
    String loginUrl = BuildConfig.SUPERVISOR_URL;
    if (loginUrl.endsWith("/login")) {
      return loginUrl.substring(0, loginUrl.length() - "/login".length());
    }
    return loginUrl;
  }

  private void requestBackgroundLocationIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      maybePromptBatteryOptimization();
      return;
    }
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        == PackageManager.PERMISSION_GRANTED) {
      maybePromptBatteryOptimization();
      return;
    }
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      return;
    }
    backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION);
  }

  private void maybePromptBatteryOptimization() {
    if (TrackingBridge.isBatteryOptimizationDisabled(this)) {
      return;
    }
    new AlertDialog.Builder(this)
        .setTitle(R.string.app_name)
        .setMessage(
            "Disable battery optimization for reliable GPS tracking while you are in the field.")
        .setPositiveButton(
            "Open settings",
            (dialog, which) -> TrackingBridge.openBatterySettings(MainActivity.this))
        .setNegativeButton(android.R.string.cancel, null)
        .show();
  }

  private void openPortal() {
    if (!NativeGpsHelper.isLocationReady(this)) {
      ensureLocationReady();
      return;
    }

    securityCheckPanel.setVisibility(View.GONE);
    ensurePortalLoaded();
    webView.setVisibility(View.VISIBLE);
  }

  @SuppressLint("SetJavaScriptEnabled")
  private void configureWebView() {
    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setGeolocationEnabled(true);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);

    String defaultUa = settings.getUserAgentString();
    if (defaultUa == null || !defaultUa.contains(NATIVE_USER_AGENT_TOKEN)) {
      settings.setUserAgentString(defaultUa + " " + NATIVE_USER_AGENT_TOKEN);
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      settings.setSafeBrowsingEnabled(true);
    }

    webView.addJavascriptInterface(new FlexHrmAndroidBridge(this), "FlexHrmAndroid");

    webView.setWebViewClient(
        new WebViewClient() {
          @Nullable
          @Override
          public WebResourceResponse shouldInterceptRequest(
              WebView view, WebResourceRequest request) {
            if (request.getUrl() == null) {
              return super.shouldInterceptRequest(view, request);
            }
            return assetLoader.shouldInterceptRequest(request.getUrl());
          }

          @Override
          public void onPageStarted(WebView view, String url, Bitmap favicon) {
            progressBar.setVisibility(View.VISIBLE);
            errorPanel.setVisibility(View.GONE);
            restoreWebSessionIfNeeded();
          }

          @Override
          public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
            restoreWebSessionIfNeeded();
          }

          @Override
          public void onReceivedError(
              WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return;
            showError(getString(R.string.error_page_load));
          }

          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null) return false;
            String host = uri.getHost();
            if (host != null
                && (host.contains("appassets.androidplatform.net")
                    || host.contains("hostingersite.com"))) {
              return false;
            }
            if ("https".equalsIgnoreCase(uri.getScheme())
                || "http".equalsIgnoreCase(uri.getScheme())) {
              startActivity(new Intent(Intent.ACTION_VIEW, uri));
              return true;
            }
            return false;
          }
        });

    webView.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public void onGeolocationPermissionsShowPrompt(
              String origin, GeolocationPermissions.Callback callback) {
            if (hasLocationPermission()) {
              callback.invoke(origin, true, true);
              return;
            }
            pendingGeoCallback = callback;
            pendingGeoOrigin = origin;
            webPermissionLauncher.launch(getLocationPermissions());
          }

          @Override
          public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(() -> handleWebPermissionRequest(request));
          }

          @Override
          public boolean onShowFileChooser(
              WebView view,
              ValueCallback<Uri[]> filePathCallback,
              FileChooserParams fileChooserParams) {
            if (MainActivity.this.filePathCallback != null) {
              MainActivity.this.filePathCallback.onReceiveValue(null);
            }
            MainActivity.this.filePathCallback = filePathCallback;

            if (!acceptsImagesOnly(fileChooserParams)) {
              cancelFileCallback();
              return true;
            }

            if (needsCameraPermission()) {
              webPermissionLauncher.launch(new String[] {Manifest.permission.CAMERA});
              return true;
            }

            openFileChooser();
            return true;
          }

          @Override
          public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
          }

          @Override
          public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
            Log.d(
                TAG,
                "WebView: "
                    + consoleMessage.message()
                    + " ("
                    + consoleMessage.sourceId()
                    + ":"
                    + consoleMessage.lineNumber()
                    + ")");
            return super.onConsoleMessage(consoleMessage);
          }
        });
  }

  private void handleWebPermissionRequest(PermissionRequest request) {
    Set<String> androidPerms = new LinkedHashSet<>();
    for (String resource : request.getResources()) {
      if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
          && needsCameraPermission()) {
        androidPerms.add(Manifest.permission.CAMERA);
      }
    }

    if (androidPerms.isEmpty()) {
      request.grant(request.getResources());
      return;
    }

    pendingWebPermissionRequest = request;
    webPermissionLauncher.launch(androidPerms.toArray(new String[0]));
  }

  private void onWebPermissionsResult() {
    if (pendingWebPermissionRequest != null) {
      if (hasCameraPermission()) {
        pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
      } else {
        pendingWebPermissionRequest.deny();
      }
      pendingWebPermissionRequest = null;
    }

    if (pendingGeoCallback != null) {
      boolean granted = hasLocationPermission();
      pendingGeoCallback.invoke(pendingGeoOrigin, granted, granted);
      pendingGeoCallback = null;
      pendingGeoOrigin = null;
    }

    if (filePathCallback != null && hasCameraPermission()) {
      openFileChooser();
    } else if (filePathCallback != null) {
      if (isCameraPermissionPermanentlyDenied()) {
        promptCameraPermissionSettings();
      } else {
        filePathCallback.onReceiveValue(null);
        filePathCallback = null;
        deliverPhotoErrorToWeb(getString(R.string.camera_permission_denied));
      }
    }

    if (pendingNativeCameraAfterPermission) {
      pendingNativeCameraAfterPermission = false;
      if (hasCameraPermission()) {
        startNativeCamera();
      } else if (isCameraPermissionPermanentlyDenied()) {
        promptCameraPermissionSettings();
      } else {
        deliverPhotoErrorToWeb(getString(R.string.camera_permission_denied));
      }
    }
  }

  private void onStartupPermissionsResult() {
    Log.d(TAG, "Startup permissions result");
    ensureLocationReady();
  }

  private void requestStartupPermissions() {
    List<String> needed = new ArrayList<>();
    if (needsCameraPermission()) needed.add(Manifest.permission.CAMERA);
    for (String perm : getLocationPermissions()) {
      if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
        needed.add(perm);
      }
    }
    if (!needed.isEmpty()) {
      startupPermissionLauncher.launch(needed.toArray(new String[0]));
    }
  }

  private String[] getLocationPermissions() {
    return new String[] {
      Manifest.permission.ACCESS_FINE_LOCATION,
      Manifest.permission.ACCESS_COARSE_LOCATION
    };
  }

  private boolean needsCameraPermission() {
    return !hasCameraPermission();
  }

  private boolean hasCameraPermission() {
    return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
        == PackageManager.PERMISSION_GRANTED;
  }

  private boolean hasLocationPermission() {
    return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
  }

  private void openFileChooser() {
    pendingCaptureTarget = CaptureTarget.WEB_FILE_INPUT;
    startNativeCamera();
  }

  private boolean acceptsImagesOnly(@Nullable WebChromeClient.FileChooserParams params) {
    if (params == null) return true;
    String[] acceptTypes = params.getAcceptTypes();
    if (acceptTypes == null || acceptTypes.length == 0) return true;
    for (String acceptType : acceptTypes) {
      if (acceptType == null || acceptType.trim().isEmpty()) continue;
      String normalized = acceptType.trim().toLowerCase();
      if (!normalized.startsWith("image/") && !normalized.equals("image/*")) {
        return false;
      }
    }
    return true;
  }

  public void launchNativeCamera() {
    pendingCaptureTarget = CaptureTarget.NATIVE_BRIDGE;
    if (needsCameraPermission()) {
      pendingNativeCameraAfterPermission = true;
      webPermissionLauncher.launch(new String[] {Manifest.permission.CAMERA});
      return;
    }
    startNativeCamera();
  }

  private boolean isCameraPermissionPermanentlyDenied() {
    if (hasCameraPermission()) {
      return false;
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return false;
    }
    // After a deny, if Android won't show the rationale/dialog again.
    return !shouldShowRequestPermissionRationale(Manifest.permission.CAMERA);
  }

  private void promptCameraPermissionSettings() {
    new AlertDialog.Builder(this)
        .setTitle(R.string.app_name)
        .setMessage(R.string.camera_permission_required)
        .setPositiveButton(
            R.string.camera_permission_open_settings,
            (dialog, which) -> {
              pendingCameraAfterSettings = true;
              openAppSettings();
            })
        .setNegativeButton(
            android.R.string.cancel,
            (dialog, which) ->
                deliverPhotoErrorToWeb(getString(R.string.camera_permission_denied)))
        .show();
  }

  private void startNativeCamera() {
    try {
      pendingCaptureFile = new File(getCacheDir(), "visit-" + System.currentTimeMillis() + ".jpg");
      pendingCaptureUri =
          FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", pendingCaptureFile);
      takePictureLauncher.launch(pendingCaptureUri);
    } catch (Exception error) {
      Log.w(TAG, "Could not open native camera", error);
      deliverPhotoErrorToWeb("Could not open camera.");
    }
  }

  private void deliverCapturedPhoto(File file) {
    securityExecutor.execute(
        () -> {
          try {
            Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
            if (bitmap == null) {
              runOnUiThread(() -> deliverPhotoErrorToWeb("Could not read captured photo."));
              return;
            }

            int maxDim = 1920;
            int width = bitmap.getWidth();
            int height = bitmap.getHeight();
            float scale = Math.min(1f, (float) maxDim / Math.max(width, height));
            Bitmap scaled = bitmap;
            if (scale < 1f) {
              int nextWidth = Math.round(width * scale);
              int nextHeight = Math.round(height * scale);
              scaled = Bitmap.createScaledBitmap(bitmap, nextWidth, nextHeight, true);
              if (scaled != bitmap) {
                bitmap.recycle();
              }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.JPEG, 88, out);
            if (scaled != bitmap) {
              scaled.recycle();
            }

            String base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            String dataUrl = "data:image/jpeg;base64," + base64;
            runOnUiThread(() -> deliverPhotoDataUrlToWeb(dataUrl));
          } catch (Exception error) {
            Log.w(TAG, "Failed to process captured photo", error);
            runOnUiThread(() -> deliverPhotoErrorToWeb("Failed to process captured photo."));
          } finally {
            if (file.exists() && !file.delete()) {
              Log.w(TAG, "Could not delete temp capture file");
            }
          }
        });
  }

  private void deliverPhotoDataUrlToWeb(String dataUrl) {
    if (webView == null) return;
    String js =
        "(function(){try{if(window.__flexHrmOnPhotoCaptured){window.__flexHrmOnPhotoCaptured("
            + JSONObject.quote(dataUrl)
            + ");}}catch(e){}})();";
    webView.evaluateJavascript(js, null);
  }

  private void deliverPhotoErrorToWeb(String message) {
    if (webView == null) return;
    String js =
        "(function(){try{if(window.__flexHrmOnPhotoError){window.__flexHrmOnPhotoError("
            + JSONObject.quote(message)
            + ");}}catch(e){}})();";
    webView.evaluateJavascript(js, null);
  }

  public void deliverGpsJsonToWeb(String json) {
    if (webView == null) return;
    String js =
        "(function(){try{if(window.__flexHrmOnGpsReady){window.__flexHrmOnGpsReady("
            + JSONObject.quote(json)
            + ");}}catch(e){}})();";
    webView.evaluateJavascript(js, null);
  }

  private void deliverCapturedUriToFileCallback(@Nullable Uri uri) {
    if (filePathCallback == null) return;
    if (uri != null) {
      filePathCallback.onReceiveValue(new Uri[] {uri});
    } else {
      filePathCallback.onReceiveValue(null);
    }
    filePathCallback = null;
  }

  private void cancelFileCallback() {
    deliverCapturedUriToFileCallback(null);
  }

  private void restoreWebSessionIfNeeded() {
    if (webView == null) return;
    String sessionJson = SupervisorSessionCache.loadJson(this);
    if (sessionJson == null || sessionJson.isEmpty()) return;
    String js =
        "(function(){try{var s="
            + JSONObject.quote(sessionJson)
            + ";var p=JSON.parse(s);if(p.token){localStorage.setItem('hrms_supervisor_token',p.token);if(p.name){localStorage.setItem('hrms_supervisor_name',p.name);}if(p.supervisorId){localStorage.setItem('hrms_supervisor_id',p.supervisorId);}}}catch(e){}})();";
    webView.evaluateJavascript(js, null);
  }

  private void showError(@NonNull String message) {
    progressBar.setVisibility(View.GONE);
    securityCheckPanel.setVisibility(View.GONE);
    hideLocationGate();
    webView.setVisibility(View.GONE);
    errorMessage.setText(message);
    errorPanel.setVisibility(View.VISIBLE);
  }

  private boolean isOnline() {
    ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
    if (cm == null) return false;
    android.net.Network network = cm.getActiveNetwork();
    if (network == null) return false;
    NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
    return capabilities != null
        && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
  }

  @Override
  protected void onDestroy() {
    securityExecutor.shutdownNow();
    if (webView != null) webView.destroy();
    super.onDestroy();
  }
}
