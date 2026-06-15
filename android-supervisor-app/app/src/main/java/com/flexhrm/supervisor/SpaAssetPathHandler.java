package com.flexhrm.supervisor;

import android.content.Context;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;
import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/** Serves bundled SPA assets and falls back to index.html for client routes. */
public class SpaAssetPathHandler implements WebViewAssetLoader.PathHandler {
  private static final String ASSET_ROOT = "www";
  private final Context context;

  public SpaAssetPathHandler(Context context) {
    this.context = context.getApplicationContext();
  }

  @Nullable
  @Override
  public WebResourceResponse handle(String path) {
    String normalized = path == null ? "" : path;
    if (normalized.isEmpty() || "/".equals(normalized)) {
      normalized = "/index.html";
    }

    WebResourceResponse response = openAsset(normalized);
    if (response != null) {
      return response;
    }

    if (shouldFallbackToIndex(normalized)) {
      return openAsset("/index.html");
    }
    return null;
  }

  private boolean shouldFallbackToIndex(String path) {
    String lower = path.toLowerCase(Locale.US);
    return !lower.contains("/assets/")
        && !lower.endsWith(".js")
        && !lower.endsWith(".css")
        && !lower.endsWith(".mjs")
        && !lower.endsWith(".png")
        && !lower.endsWith(".svg")
        && !lower.endsWith(".ico")
        && !lower.endsWith(".woff2")
        && !lower.endsWith(".webmanifest");
  }

  @Nullable
  private WebResourceResponse openAsset(String path) {
    String assetPath = ASSET_ROOT + path;
    try {
      InputStream stream =
          context.getAssets().open(assetPath.startsWith("/") ? assetPath.substring(1) : assetPath);
      String mime = guessMimeType(path);
      return new WebResourceResponse(mime, "UTF-8", stream);
    } catch (IOException ignored) {
      return null;
    }
  }

  private String guessMimeType(String path) {
    String extension = MimeTypeMap.getFileExtensionFromUrl(path);
    if (extension != null) {
      String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
      if (mime != null) return mime;
    }
    if (path.endsWith(".mjs")) return "text/javascript";
    if (path.endsWith(".js")) return "text/javascript";
    if (path.endsWith(".css")) return "text/css";
    if (path.endsWith(".svg")) return "image/svg+xml";
    return "text/html";
  }
}
