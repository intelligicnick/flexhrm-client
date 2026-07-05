package com.flexhrm.supervisor;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.flexhrm.supervisor.tracking.bridge.TrackingBridge;
import com.flexhrm.supervisor.tracking.security.MockLocationDetector;
import com.google.android.gms.tasks.CancellationTokenSource;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

public final class NativeGpsHelper {
  private static final long FRESH_REQUEST_TIMEOUT_MS = 20_000;
  private static volatile Location lastCachedLocation;

  public interface GpsResultCallback {
    void onResult(String coordinatesJson);
  }

  private NativeGpsHelper() {}

  public static boolean isLocationServicesEnabled(Context context) {
    LocationManager manager = locationManager(context);
    if (manager == null) {
      return false;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      return manager.isLocationEnabled();
    }
    try {
      return manager.isProviderEnabled(LocationManager.GPS_PROVIDER)
          || manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    } catch (Exception ignored) {
      return false;
    }
  }

  public static boolean isLocationReady(Context context) {
    return hasLocationPermission(context) && isLocationServicesEnabled(context);
  }

  @SuppressLint("MissingPermission")
  public static void warmup(Context context) {
    if (!hasLocationPermission(context)) return;

    FusedLocationProviderClient fused = fusedClient(context);
    fused
        .getLastLocation()
        .addOnSuccessListener(
            location -> {
              if (location != null) {
                lastCachedLocation = location;
              }
            });

    CancellationTokenSource tokenSource = new CancellationTokenSource();
    fused
        .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.getToken())
        .addOnSuccessListener(
            location -> {
              if (location != null) {
                lastCachedLocation = location;
              }
            });
  }

  @SuppressLint("MissingPermission")
  public static String getCoordinatesJson(Context context) {
    String cached = TrackingBridge.getCachedGpsJson();
    if (cached != null && !cached.equals("{}")) {
      return cached;
    }
    if (!hasLocationPermission(context)) {
      return "{}";
    }

    if (lastCachedLocation != null) {
      return toJson(lastCachedLocation);
    }

    Location blocking = getLastLocationBlocking(context, 3000L);
    if (blocking != null) {
      lastCachedLocation = blocking;
      return toJson(blocking);
    }

    Location legacy = pickBestLocationLegacy(context);
    if (legacy != null) {
      lastCachedLocation = legacy;
      return toJson(legacy);
    }

    return "{}";
  }

  @SuppressLint("MissingPermission")
  public static void requestFreshCoordinates(Context context, GpsResultCallback callback) {
    if (!hasLocationPermission(context)) {
      callback.onResult("{}");
      return;
    }

    if (lastCachedLocation != null && isRecent(lastCachedLocation, 30_000)) {
      callback.onResult(toJson(lastCachedLocation));
      return;
    }

    FusedLocationProviderClient fused = fusedClient(context);
    Handler handler = new Handler(Looper.getMainLooper());
    final boolean[] delivered = {false};

    Runnable timeout =
        () -> {
          if (delivered[0]) return;
          delivered[0] = true;
          deliverFallback(context, callback);
        };

    handler.postDelayed(timeout, FRESH_REQUEST_TIMEOUT_MS);

    CancellationTokenSource tokenSource = new CancellationTokenSource();
    fused
        .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.getToken())
        .addOnSuccessListener(
            location -> {
              if (delivered[0]) return;
              handler.removeCallbacks(timeout);
              if (location != null) {
                delivered[0] = true;
                lastCachedLocation = location;
                callback.onResult(toJson(location));
                return;
              }
              delivered[0] = true;
              deliverFallback(context, callback);
            })
        .addOnFailureListener(
            error -> {
              if (delivered[0]) return;
              handler.removeCallbacks(timeout);
              delivered[0] = true;
              deliverFallback(context, callback);
            });
  }

  @SuppressLint("MissingPermission")
  private static void deliverFallback(Context context, GpsResultCallback callback) {
    if (lastCachedLocation != null) {
      callback.onResult(toJson(lastCachedLocation));
      return;
    }

    Location blocking = getLastLocationBlocking(context, 2000L);
    if (blocking != null) {
      lastCachedLocation = blocking;
      callback.onResult(toJson(blocking));
      return;
    }

    Location legacy = pickBestLocationLegacy(context);
    if (legacy != null) {
      lastCachedLocation = legacy;
      callback.onResult(toJson(legacy));
      return;
    }

    callback.onResult("{}");
  }

  @SuppressLint("MissingPermission")
  private static Location getLastLocationBlocking(Context context, long timeoutMs) {
    CountDownLatch latch = new CountDownLatch(1);
    final Location[] holder = {null};

    fusedClient(context)
        .getLastLocation()
        .addOnCompleteListener(
            task -> {
              if (task.isSuccessful() && task.getResult() != null) {
                holder[0] = task.getResult();
              }
              latch.countDown();
            });

    try {
      latch.await(timeoutMs, TimeUnit.MILLISECONDS);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    }

    return holder[0];
  }

  private static Location pickBestLocationLegacy(Context context) {
    LocationManager manager = locationManager(context);
    if (manager == null) {
      return null;
    }

    Location best = null;
    for (String provider : manager.getProviders(true)) {
      try {
        Location location = manager.getLastKnownLocation(provider);
        if (location == null) continue;
        if (best == null || location.getTime() > best.getTime()) {
          best = location;
        }
      } catch (Exception ignored) {
        // ignore provider
      }
    }
    return best;
  }

  private static boolean isRecent(Location location, long maxAgeMs) {
    return System.currentTimeMillis() - location.getTime() <= maxAgeMs;
  }

  private static String toJson(Location location) {
    try {
      JSONObject json = new JSONObject();
      json.put("lat", location.getLatitude());
      json.put("lng", location.getLongitude());
      json.put("accuracy", location.getAccuracy());
      json.put("at", location.getTime());
      json.put("speed", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
      json.put("bearing", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
      json.put("isMock", MockLocationDetector.isMock(location));
      return json.toString();
    } catch (Exception error) {
      return "{}";
    }
  }

  private static boolean hasLocationPermission(Context context) {
    return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
  }

  private static LocationManager locationManager(Context context) {
    return (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
  }

  private static FusedLocationProviderClient fusedClient(Context context) {
    return LocationServices.getFusedLocationProviderClient(context);
  }
}
