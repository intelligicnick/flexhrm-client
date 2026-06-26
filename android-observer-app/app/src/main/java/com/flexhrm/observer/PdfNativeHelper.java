package com.flexhrm.observer;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

final class PdfNativeHelper {
  private PdfNativeHelper() {}

  interface ResultCallback {
    void onSuccess(File file);

    void onError(String message);
  }

  static void downloadPdf(
      Context context,
      String url,
      String bearerToken,
      String filename,
      ResultCallback callback) {
    new Thread(
            () -> {
              HttpURLConnection connection = null;
              try {
                URL requestUrl = new URL(url);
                connection = (HttpURLConnection) requestUrl.openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(30_000);
                connection.setReadTimeout(60_000);
                connection.setRequestProperty("Accept", "application/pdf,*/*");
                if (bearerToken != null && !bearerToken.trim().isEmpty()) {
                  connection.setRequestProperty(
                      "Authorization", "Bearer " + bearerToken.trim());
                }

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                  callback.onError("Could not load PDF (" + status + ")");
                  return;
                }

                InputStream input = connection.getInputStream();
                File cacheDir = new File(context.getCacheDir(), "pdf");
                //noinspection ResultOfMethodCallIgnored
                cacheDir.mkdirs();
                File output = new File(cacheDir, sanitizeFilename(filename));
                try (FileOutputStream out = new FileOutputStream(output)) {
                  byte[] buffer = new byte[8192];
                  int read;
                  while ((read = input.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                  }
                } finally {
                  input.close();
                }

                if (output.length() == 0L) {
                  //noinspection ResultOfMethodCallIgnored
                  output.delete();
                  callback.onError("PDF file is empty");
                  return;
                }

                callback.onSuccess(output);
              } catch (Exception ex) {
                callback.onError(ex.getMessage() != null ? ex.getMessage() : "Download failed");
              } finally {
                if (connection != null) {
                  connection.disconnect();
                }
              }
            })
        .start();
  }

  static Uri fileUri(MainActivity activity, File file) {
    return FileProvider.getUriForFile(
        activity, activity.getPackageName() + ".fileprovider", file);
  }

  static void sharePdf(MainActivity activity, File file, String title) {
    Intent share = new Intent(Intent.ACTION_SEND);
    share.setType("application/pdf");
    Uri uri = fileUri(activity, file);
    share.putExtra(Intent.EXTRA_STREAM, uri);
    share.putExtra(Intent.EXTRA_SUBJECT, title != null ? title : "PDF");
    share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    Intent chooser = Intent.createChooser(share, "Share PDF");
    activity.startActivity(chooser);
  }

  static void openPdf(MainActivity activity, File file) {
    Intent view = new Intent(Intent.ACTION_VIEW);
    Uri uri = fileUri(activity, file);
    view.setDataAndType(uri, "application/pdf");
    view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    Intent chooser = Intent.createChooser(view, "Open PDF");
    activity.startActivity(chooser);
  }

  static void printPdf(MainActivity activity, File file, String jobName) {
    Intent view = new Intent(Intent.ACTION_VIEW);
    Uri uri = fileUri(activity, file);
    view.setDataAndType(uri, "application/pdf");
    view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    String label = jobName != null && !jobName.trim().isEmpty() ? jobName.trim() : "Print PDF";
    activity.startActivity(Intent.createChooser(view, label));
  }

  static void notifyJs(WebView webView, String callbackName, boolean ok, String message) {
    if (webView == null) return;
    webView.post(
        () -> {
          try {
            String payload =
                callbackName
                    + "("
                    + ok
                    + ","
                    + JSONObject.quote(message != null ? message : "")
                    + ")";
            webView.evaluateJavascript(
                "window." + callbackName + " && " + payload, null);
          } catch (Exception ignored) {
            // ignore malformed callback
          }
        });
  }

  private static String sanitizeFilename(String filename) {
    String base =
        filename == null || filename.trim().isEmpty()
            ? "document.pdf"
            : filename.trim().replaceAll("[^\\w.-]+", "_");
    if (!base.toLowerCase().endsWith(".pdf")) {
      base = base + ".pdf";
    }
    return base;
  }
}
