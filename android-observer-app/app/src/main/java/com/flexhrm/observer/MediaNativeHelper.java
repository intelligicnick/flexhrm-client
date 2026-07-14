package com.flexhrm.observer;

import android.util.Base64;
import android.webkit.WebView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

final class MediaNativeHelper {
  private MediaNativeHelper() {}

  static void fetchUrlAsDataUrl(WebView webView, String url, String bearerToken) {
    new Thread(
            () -> {
              HttpURLConnection connection = null;
              try {
                URL requestUrl = new URL(url);
                connection = (HttpURLConnection) requestUrl.openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(30_000);
                connection.setReadTimeout(90_000);
                connection.setRequestProperty("Accept", "image/*,*/*");
                if (bearerToken != null && !bearerToken.trim().isEmpty()) {
                  connection.setRequestProperty(
                      "Authorization", "Bearer " + bearerToken.trim());
                }

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                  notifyUrlFetched(
                      webView, false, "", "Could not load image (" + status + ")");
                  return;
                }

                String contentType = connection.getContentType();
                if (contentType == null || contentType.trim().isEmpty()) {
                  contentType = "image/jpeg";
                } else {
                  int semi = contentType.indexOf(';');
                  if (semi > 0) {
                    contentType = contentType.substring(0, semi).trim();
                  }
                }

                InputStream input = connection.getInputStream();
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                  out.write(buffer, 0, read);
                }
                input.close();

                byte[] bytes = out.toByteArray();
                if (bytes.length == 0) {
                  notifyUrlFetched(webView, false, "", "Image file is empty");
                  return;
                }

                String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                String dataUrl = contentType + ";base64," + base64;
                if (!dataUrl.startsWith("data:")) {
                  dataUrl = "data:" + dataUrl;
                }
                notifyUrlFetched(webView, true, dataUrl, "");
              } catch (Exception ex) {
                notifyUrlFetched(
                    webView,
                    false,
                    "",
                    ex.getMessage() != null ? ex.getMessage() : "Download failed");
              } finally {
                if (connection != null) {
                  connection.disconnect();
                }
              }
            })
        .start();
  }

  private static void notifyUrlFetched(
      WebView webView, boolean ok, String dataUrl, String message) {
    if (webView == null) return;
    webView.post(
        () -> {
          try {
            String callbackName = "__flexHrmOnUrlFetched";
            String payload =
                callbackName
                    + "("
                    + ok
                    + ","
                    + JSONObject.quote(dataUrl != null ? dataUrl : "")
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
}
