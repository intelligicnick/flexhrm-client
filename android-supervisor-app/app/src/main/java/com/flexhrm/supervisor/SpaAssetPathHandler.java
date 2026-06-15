package com.flexhrm.supervisor;

import android.content.Context;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;
import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/**
 * Serves bundled SPA assets from {@code assets/www/}.
 * WebViewAssetLoader passes paths without a leading slash (e.g. {@code assets/app.js}).
 */
public class SpaAssetPathHandler implements WebViewAssetLoader.PathHandler {
  private static final String ASSET_ROOT = "www";
  private final Context context;

  public SpaAssetPathHandler(Context context) {
    this.context = context.getApplicationContext();
  }

  @Nullable
  @Override
  public WebResourceResponse handle(String path) {
    String relative = normalizeRelativePath(path);

    WebResourceResponse response = openAsset(relative);
    if (response != null) {
      return response;
    }

    if (shouldFallbackToIndex(relative)) {
      return openAsset("index.html");
    }
    return null;
  }

  private String normalizeRelativePath(String path) {
    if (path == null || path.isEmpty()) {
      return "index.html";
    }
    return path.startsWith("/") ? path.substring(1) : path;
  }

  private boolean shouldFallbackToIndex(String relativePath) {
    String lower = relativePath.toLowerCase(Locale.US);
    return !lower.startsWith("assets/")
        && !lower.endsWith(".js")
        && !lower.endsWith(".mjs")
        && !lower.endsWith(".css")
        && !lower.endsWith(".png")
        && !lower.endsWith(".svg")
        && !lower.endsWith(".ico")
        && !lower.endsWith(".woff2")
        && !lower.endsWith(".webmanifest")
        && !"index.html".equals(lower);
  }

  @Nullable
  private WebResourceResponse openAsset(String relativePath) {
    String assetPath = ASSET_ROOT + "/" + relativePath;
    try {
      InputStream stream = context.getAssets().open(assetPath);
      String mime = guessMimeType(relativePath);
      return new WebResourceResponse(mime, "UTF-8", stream);
    } catch (IOException ignored) {
      return null;
    }
  }

  private String guessMimeType(String relativePath) {
    String extension = MimeTypeMap.getFileExtensionFromUrl(relativePath);
    if (extension != null) {
      String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
      if (mime != null) return mime;
    }
    if (relativePath.endsWith(".mjs") || relativePath.endsWith(".js")) {
      return "application/javascript";
    }
    if (relativePath.endsWith(".css")) return "text/css";
    if (relativePath.endsWith(".svg")) return "image/svg+xml";
    if (relativePath.endsWith(".webmanifest")) return "application/manifest+json";
    return "text/html";
  }
}
