package com.flexhrm.observer;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Native bridge exposed to the observer WebView as {@code window.FlexHrmAndroid}.
 */
public class FlexHrmAndroidBridge {
  private final MainActivity activity;
  private final WebView webView;

  public FlexHrmAndroidBridge(MainActivity activity, WebView webView) {
    this.activity = activity;
    this.webView = webView;
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
  public void sharePdfFromUrl(
      String url, String bearerToken, String filename, String title) {
    if (url == null || url.trim().isEmpty()) {
      PdfNativeHelper.notifyJs(
          webView, "__flexHrmOnPdfShareDone", false, "Missing PDF URL");
      return;
    }

    PdfNativeHelper.downloadPdf(
        activity,
        url.trim(),
        bearerToken,
        filename,
        new PdfNativeHelper.ResultCallback() {
          @Override
          public void onSuccess(java.io.File file) {
            activity.runOnUiThread(
                () -> {
                  try {
                    PdfNativeHelper.sharePdf(activity, file, title);
                    PdfNativeHelper.notifyJs(
                        webView, "__flexHrmOnPdfShareDone", true, "");
                  } catch (Exception ex) {
                    PdfNativeHelper.notifyJs(
                        webView,
                        "__flexHrmOnPdfShareDone",
                        false,
                        ex.getMessage() != null ? ex.getMessage() : "Share failed");
                  }
                });
          }

          @Override
          public void onError(String message) {
            PdfNativeHelper.notifyJs(
                webView, "__flexHrmOnPdfShareDone", false, message);
          }
        });
  }

  @JavascriptInterface
  public void sharePdfFromBase64(String base64, String filename, String title) {
    if (base64 == null || base64.trim().isEmpty()) {
      PdfNativeHelper.notifyJs(
          webView, "__flexHrmOnPdfShareDone", false, "Missing PDF data");
      return;
    }

    new Thread(
            () -> {
              try {
                java.io.File file = PdfNativeHelper.writeBase64Pdf(activity, base64, filename);
                activity.runOnUiThread(
                    () -> {
                      try {
                        PdfNativeHelper.sharePdf(activity, file, title);
                        PdfNativeHelper.notifyJs(
                            webView, "__flexHrmOnPdfShareDone", true, "");
                      } catch (Exception ex) {
                        PdfNativeHelper.notifyJs(
                            webView,
                            "__flexHrmOnPdfShareDone",
                            false,
                            ex.getMessage() != null ? ex.getMessage() : "Share failed");
                      }
                    });
              } catch (Exception ex) {
                PdfNativeHelper.notifyJs(
                    webView,
                    "__flexHrmOnPdfShareDone",
                    false,
                    ex.getMessage() != null ? ex.getMessage() : "Could not save PDF");
              }
            })
        .start();
  }

  @JavascriptInterface
  public void openPdfFromUrl(String url, String bearerToken, String filename) {
    if (url == null || url.trim().isEmpty()) {
      PdfNativeHelper.notifyJs(
          webView, "__flexHrmOnPdfOpenDone", false, "Missing PDF URL");
      return;
    }

    PdfNativeHelper.downloadPdf(
        activity,
        url.trim(),
        bearerToken,
        filename,
        new PdfNativeHelper.ResultCallback() {
          @Override
          public void onSuccess(java.io.File file) {
            activity.runOnUiThread(
                () -> {
                  try {
                    PdfNativeHelper.openPdf(activity, file);
                    PdfNativeHelper.notifyJs(
                        webView, "__flexHrmOnPdfOpenDone", true, "");
                  } catch (Exception ex) {
                    PdfNativeHelper.notifyJs(
                        webView,
                        "__flexHrmOnPdfOpenDone",
                        false,
                        ex.getMessage() != null ? ex.getMessage() : "Open failed");
                  }
                });
          }

          @Override
          public void onError(String message) {
            PdfNativeHelper.notifyJs(webView, "__flexHrmOnPdfOpenDone", false, message);
          }
        });
  }

  @JavascriptInterface
  public void printPdfFromUrl(String url, String bearerToken, String filename) {
    if (url == null || url.trim().isEmpty()) {
      PdfNativeHelper.notifyJs(
          webView, "__flexHrmOnPdfPrintDone", false, "Missing PDF URL");
      return;
    }

    PdfNativeHelper.downloadPdf(
        activity,
        url.trim(),
        bearerToken,
        filename,
        new PdfNativeHelper.ResultCallback() {
          @Override
          public void onSuccess(java.io.File file) {
            activity.runOnUiThread(
                () -> {
                  try {
                    PdfNativeHelper.printPdf(activity, file, filename);
                    PdfNativeHelper.notifyJs(
                        webView, "__flexHrmOnPdfPrintDone", true, "");
                  } catch (Exception ex) {
                    PdfNativeHelper.notifyJs(
                        webView,
                        "__flexHrmOnPdfPrintDone",
                        false,
                        ex.getMessage() != null ? ex.getMessage() : "Print failed");
                  }
                });
          }

          @Override
          public void onError(String message) {
            PdfNativeHelper.notifyJs(webView, "__flexHrmOnPdfPrintDone", false, message);
          }
        });
  }
}
