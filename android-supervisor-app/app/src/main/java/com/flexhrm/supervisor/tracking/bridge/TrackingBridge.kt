package com.flexhrm.supervisor.tracking.bridge

import android.content.Context
import kotlin.jvm.JvmStatic
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.flexhrm.supervisor.SupervisorSessionCache
import com.flexhrm.supervisor.tracking.data.LocationRepository
import com.flexhrm.supervisor.tracking.domain.RouteAnalyticsEngine
import com.flexhrm.supervisor.tracking.security.DeviceIntegrityChecker
import com.flexhrm.supervisor.tracking.service.LocationTrackingService
import com.flexhrm.supervisor.tracking.service.TrackingController
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject

object TrackingBridge {
  @JvmStatic
  fun startTracking(context: Context) {
    TrackingController.start(context)
    LocationRepository.init(context)
  }

  @JvmStatic
  fun stopTracking(context: Context) {
    TrackingController.stop(context)
  }

  @JvmStatic
  fun getTrackingStatus(context: Context): String {
    return runBlocking {
      val latest = LocationRepository.latestTimestamp()
      val count = LocationRepository.countAll()
      val pending = LocationRepository.countUnuploaded()
      JSONObject()
          .put("active", TrackingController.isTrackingActive())
          .put("lastPointAt", latest ?: 0)
          .put("pointCount", count)
          .put("pendingUpload", pending)
          .toString()
    }
  }

  @JvmStatic
  fun getRoutePoints(context: Context, fromMs: Long, toMs: Long): String {
    val session = SupervisorSessionCache.loadSession(context)
    val supervisorId = session?.supervisorId.orEmpty()
    return runBlocking {
      val points =
          if (supervisorId.isNotBlank()) {
            LocationRepository.getPointsForSupervisor(supervisorId, fromMs, toMs)
          } else {
            LocationRepository.getPointsBetween(fromMs, toMs)
          }
      val array = JSONArray()
      for (point in points) {
        array.put(
            JSONObject()
                .put("lat", point.latitude)
                .put("lng", point.longitude)
                .put("timestamp", point.timestamp)
                .put("accuracy", point.accuracy)
                .put("speed", point.speed ?: JSONObject.NULL)
                .put("bearing", point.bearing ?: JSONObject.NULL)
                .put("isMock", point.isMock))
      }
      array.toString()
    }
  }

  @JvmStatic
  fun getRouteSummary(context: Context, fromMs: Long, toMs: Long): String {
    val session = SupervisorSessionCache.loadSession(context)
    val supervisorId = session?.supervisorId.orEmpty()
    return runBlocking {
      val points =
          if (supervisorId.isNotBlank()) {
            LocationRepository.getPointsForSupervisor(supervisorId, fromMs, toMs)
          } else {
            LocationRepository.getPointsBetween(fromMs, toMs)
          }
      val summary = RouteAnalyticsEngine.summarize(points)
      JSONObject()
          .put("totalDistanceMeters", summary.totalDistanceMeters)
          .put("travelTimeMs", summary.travelTimeMs)
          .put("stopDurationMs", summary.stopDurationMs)
          .put("idleTimeMs", summary.idleTimeMs)
          .put("averageSpeedKmh", summary.averageSpeedKmh)
          .put("maxSpeedKmh", summary.maxSpeedKmh)
          .put("workingHoursMs", summary.workingHoursMs)
          .put("pointCount", summary.pointCount)
          .toString()
    }
  }

  @JvmStatic
  fun isBatteryOptimizationDisabled(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(context.packageName)
  }

  @JvmStatic
  fun openBatterySettings(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val intent =
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    context.startActivity(intent)
  }

  @JvmStatic
  fun getDeviceIntegrity(context: Context): String {
    val status = DeviceIntegrityChecker.check(context)
    return JSONObject()
        .put("developerOptionsEnabled", status.developerOptionsEnabled)
        .put("rooted", status.rooted)
        .toString()
  }

  @JvmStatic
  fun getCachedGpsJson(): String {
    val location = LocationTrackingService.getCachedLocation() ?: return "{}"
    return JSONObject()
        .put("lat", location.latitude)
        .put("lng", location.longitude)
        .put("accuracy", location.accuracy)
        .put("at", location.time)
        .put("speed", if (location.hasSpeed()) location.speed else JSONObject.NULL)
        .put("bearing", if (location.hasBearing()) location.bearing else JSONObject.NULL)
        .toString()
  }
}
