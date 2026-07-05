package com.flexhrm.supervisor.tracking.domain

import com.flexhrm.supervisor.tracking.data.LocationPointEntity
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class RouteSummary(
    val totalDistanceMeters: Double,
    val travelTimeMs: Long,
    val stopDurationMs: Long,
    val idleTimeMs: Long,
    val averageSpeedKmh: Double,
    val maxSpeedKmh: Double,
    val workingHoursMs: Long,
    val pointCount: Int,
)

object RouteAnalyticsEngine {
  private const val EARTH_RADIUS_M = 6371000.0

  fun summarize(points: List<LocationPointEntity>): RouteSummary {
    if (points.isEmpty()) {
      return RouteSummary(0.0, 0, 0, 0, 0.0, 0.0, 0, 0)
    }

    val sorted = points.sortedBy { it.timestamp }
    var totalDistance = 0.0
    var maxSpeedKmh = 0.0
    var stopDuration = 0L
    var idleTime = 0L

    for (index in 1 until sorted.size) {
      val prev = sorted[index - 1]
      val curr = sorted[index]
      totalDistance += haversineMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
      val dt = (curr.timestamp - prev.timestamp).coerceAtLeast(0)
      val speedKmh = curr.speed?.times(3.6f)?.toDouble() ?: estimateSpeedKmh(prev, curr, dt)
      if (speedKmh > maxSpeedKmh) maxSpeedKmh = speedKmh
      if (speedKmh < 1.8 && dt >= TrackingConfig.STOP_MIN_DURATION_MS) {
        stopDuration += dt
      }
      if (speedKmh < 0.5) {
        idleTime += dt
      }
    }

    val firstTs = sorted.first().timestamp
    val lastTs = sorted.last().timestamp
    val travelTime = (lastTs - firstTs).coerceAtLeast(0)
    val avgSpeed =
        if (travelTime > 0) (totalDistance / travelTime) * 3600.0 / 1000.0 else 0.0

    return RouteSummary(
        totalDistanceMeters = totalDistance,
        travelTimeMs = travelTime,
        stopDurationMs = stopDuration,
        idleTimeMs = idleTime,
        averageSpeedKmh = avgSpeed,
        maxSpeedKmh = maxSpeedKmh,
        workingHoursMs = travelTime,
        pointCount = sorted.size)
  }

  private fun estimateSpeedKmh(prev: LocationPointEntity, curr: LocationPointEntity, dtMs: Long): Double {
    if (dtMs <= 0) return 0.0
    val meters = haversineMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
    return (meters / dtMs) * 3600.0 / 1000.0
  }

  private fun haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a =
        sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return EARTH_RADIUS_M * c
  }
}
