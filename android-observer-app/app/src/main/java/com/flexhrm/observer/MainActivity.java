package com.flexhrm.observer;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
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
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {
  private static final String TAG = "FlexHrmObserver";
  private static final String NATIVE_USER_AGENT_TOKEN = "FlexHrmObserver/1.0.1";
  private static final String BUNDLED_LOGIN_URL =
      "https://appassets.androidplatform.net/observer/login";
  private static final String BUNDLED_HOME_URL =
      "https://appassets.androidplatform.net/observer";

  private WebView webView;
  private ProgressBar progressBar;
  private LinearLayout errorPanel;
  private TextView errorMessage;
  private WebViewAssetLoader assetLoader;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    setContentView(R.layout.activity_main);

    webView = findViewById(R.id.webView);
    progressBar = findViewById(R.id.progressBar);
    errorPanel = findViewById(R.id.errorPanel);
    errorMessage = findViewById(R.id.errorMessage);
    Button retryButton = findViewById(R.id.retryButton);

    LinearLayout securityCheckPanel = findViewById(R.id.securityCheckPanel);
    if (securityCheckPanel != null) {
      securityCheckPanel.setVisibility(View.GONE);
    }

    retryButton.setOnClickListener(v -> loadPortal());

    assetLoader =
        new WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", new SpaAssetPathHandler(this))
            .build();

    configureWebView();
    loadPortal();

    getOnBackPressedDispatcher()
        .addCallback(
            this,
            new OnBackPressedCallback(true) {
              @Override
              public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                  webView.goBack();
                } else {
                  setEnabled(false);
                  getOnBackPressedDispatcher().onBackPressed();
                }
              }
            });
  }

  @SuppressLint("SetJavaScriptEnabled")
  private void configureWebView() {
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setGeolocationEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
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

    CookieManager cookieManager = CookieManager.getInstance();
    cookieManager.setAcceptCookie(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      cookieManager.setAcceptThirdPartyCookies(webView, true);
    }

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
          }

          @Override
          public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
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
            callback.invoke(origin, true, true);
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

  private void loadPortal() {
    errorPanel.setVisibility(View.GONE);
    webView.setVisibility(View.VISIBLE);
    webView.loadUrl(BUNDLED_LOGIN_URL);
  }

  private void showError(@NonNull String message) {
    progressBar.setVisibility(View.GONE);
    webView.setVisibility(View.GONE);
    errorMessage.setText(message);
    errorPanel.setVisibility(View.VISIBLE);
  }

  @Override
  protected void onDestroy() {
    if (webView != null) webView.destroy();
    super.onDestroy();
  }
}
