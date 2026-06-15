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
import androidx.core.view.WindowCompat;
import androidx.webkit.WebViewAssetLoader;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
  private static final String TAG = "FlexHrmSupervisor";
  private static final String NATIVE_USER_AGENT_TOKEN = "FlexHrmSupervisor/1.4";
  private static final String REMOTE_LOGIN_URL =
      "https://greenyellow-woodpecker-750354.hostingersite.com/supervisor/login";

  private WebView webView;
  private ProgressBar progressBar;
  private LinearLayout errorPanel;
  private LinearLayout securityCheckPanel;
  private TextView errorMessage;
  private WebViewAssetLoader assetLoader;
  private ValueCallback<Uri[]> filePathCallback;
  private PermissionRequest pendingWebPermissionRequest;
  private GeolocationPermissions.Callback pendingGeoCallback;
  private String pendingGeoOrigin;
  private AlertDialog blockedAppsDialog;
  private boolean portalLoaded;
  private boolean useRemoteFallback;
  private final ExecutorService securityExecutor = Executors.newSingleThreadExecutor();

  private final ActivityResultLauncher<String[]> startupPermissionLauncher =
      registerForActivityResult(
          new ActivityResultContracts.RequestMultiplePermissions(),
          result -> onStartupPermissionsResult());

  private final ActivityResultLauncher<String[]> webPermissionLauncher =
      registerForActivityResult(
          new ActivityResultContracts.RequestMultiplePermissions(),
          result -> onWebPermissionsResult());

  private final ActivityResultLauncher<Intent> fileChooserLauncher =
      registerForActivityResult(
          new ActivityResultContracts.StartActivityForResult(),
          result -> {
            if (filePathCallback == null) return;
            Uri[] uris = null;
            Intent data = result.getData();
            if (result.getResultCode() == RESULT_OK && data != null) {
              Uri uri = data.getData();
              if (uri != null) uris = new Uri[] {uri};
            }
            filePathCallback.onReceiveValue(uris);
            filePathCallback = null;
          });

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    setContentView(R.layout.activity_main);

    webView = findViewById(R.id.webView);
    progressBar = findViewById(R.id.progressBar);
    errorPanel = findViewById(R.id.errorPanel);
    securityCheckPanel = findViewById(R.id.securityCheckPanel);
    errorMessage = findViewById(R.id.errorMessage);
    Button retryButton = findViewById(R.id.retryButton);

    retryButton.setOnClickListener(v -> runSecurityCheck());
    webView.setVisibility(View.GONE);

    assetLoader =
        new WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", new SpaAssetPathHandler(this))
            .build();

    configureWebView();
    requestStartupPermissions();
    runSecurityCheck();

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
    if (blockedAppsDialog != null && blockedAppsDialog.isShowing()) {
      runSecurityCheck();
    }
  }

  private void runSecurityCheck() {
    if (!isOnline()) {
      showError(getString(R.string.error_no_internet));
      return;
    }

    errorPanel.setVisibility(View.GONE);
    securityCheckPanel.setVisibility(View.VISIBLE);
    webView.setVisibility(View.GONE);
    portalLoaded = false;

    securityExecutor.execute(
        () -> {
          try {
            List<String> policy = PortalPolicyFetcher.fetchBlockedApps(BuildConfig.API_BASE);
            if (policy.isEmpty()) {
              runOnUiThread(this::openPortal);
              return;
            }

            List<BlockedAppsScanner.InstalledApp> installed =
                BlockedAppsScanner.getUserInstalledApps(MainActivity.this);
            List<DetectedBlockedApp> detected =
                BlockedAppsScanner.findInstalledBlockedApps(policy, installed);

            runOnUiThread(
                () -> {
                  securityCheckPanel.setVisibility(View.GONE);
                  if (detected.isEmpty()) {
                    openPortal();
                  } else {
                    showBlockedAppsDialog(detected);
                  }
                });
          } catch (Exception error) {
            Log.w(TAG, "Security scan failed, opening login without list UI", error);
            runOnUiThread(this::openPortal);
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
    intro.setText(getString(R.string.blocked_apps_message));
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

  private void openPortal() {
    securityCheckPanel.setVisibility(View.GONE);
    if (portalLoaded) {
      webView.setVisibility(View.VISIBLE);
      return;
    }
    portalLoaded = true;
    webView.setVisibility(View.VISIBLE);
    loadPortal();
  }

  @SuppressLint("SetJavaScriptEnabled")
  private void configureWebView() {
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
            if (useRemoteFallback || request.getUrl() == null) {
              return super.shouldInterceptRequest(view, request);
            }
            return assetLoader.shouldInterceptRequest(request.getUrl());
          }

          @Override
          public void onPageStarted(WebView view, String url, Bitmap favicon) {
            progressBar.setVisibility(View.VISIBLE);
            errorPanel.setVisibility(View.GONE);
          }

          @Override
          public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
          }

          @Override
          public void onReceivedError(
              WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return;
            if (!useRemoteFallback) {
              Log.w(TAG, "Bundled UI failed, falling back to remote login URL");
              useRemoteFallback = true;
              portalLoaded = false;
              webView.loadUrl(REMOTE_LOGIN_URL);
              return;
            }
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
              callback.invoke(origin, true, false);
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
      pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
      pendingGeoCallback = null;
      pendingGeoOrigin = null;
    }

    if (filePathCallback != null && hasCameraPermission()) {
      openFileChooser();
    } else if (filePathCallback != null) {
      filePathCallback.onReceiveValue(null);
      filePathCallback = null;
    }
  }

  private void onStartupPermissionsResult() {
    Log.d(TAG, "Startup permissions granted");
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
    Intent captureIntent = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
    Intent chooserIntent =
        Intent.createChooser(new Intent(Intent.ACTION_GET_CONTENT).setType("image/*"), null);
    chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] {captureIntent});
    fileChooserLauncher.launch(chooserIntent);
  }

  private void loadPortal() {
    if (!isOnline()) {
      showError(getString(R.string.error_no_internet));
      return;
    }
    errorPanel.setVisibility(View.GONE);
    webView.loadUrl(
        useRemoteFallback
            ? REMOTE_LOGIN_URL
            : "https://appassets.androidplatform.net/supervisor/login");
  }

  private void showError(@NonNull String message) {
    progressBar.setVisibility(View.GONE);
    securityCheckPanel.setVisibility(View.GONE);
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
