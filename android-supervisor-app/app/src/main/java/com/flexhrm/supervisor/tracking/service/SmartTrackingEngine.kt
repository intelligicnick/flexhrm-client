package com.flexhrm.supervisor.tracking.service

import android.location.Location
import com.flexhrm.supervisor.tracking.domain.TrackingConfig
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.Priority

class SmartTrackingEngine {
  private var lastLocation: Location? = null
  private var isMoving = false

  fun onLocation(location: Location) {
    val previous = lastLocation
    if (previous != null) {
      val speed = if (location.hasSpeed()) location.speed else previous.distanceTo(location)
      isMoving =
          speed >= TrackingConfig.MOVING_SPEED_THRESHOLD_MPS ||
              previous.distanceTo(location) >= 30f
    }
    lastLocation = location
  }

  fun buildLocationRequest(): LocationRequest {
    val interval =
        if (isMoving) TrackingConfig.MOVING_MIN_INTERVAL_MS
        else TrackingConfig.STATIONARY_MIN_INTERVAL_MS
    val priority =
        if (isMoving) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY
    return LocationRequest.Builder(priority, interval)
        .setMinUpdateIntervalMillis(interval / 2)
        .setMaxUpdateDelayMillis(interval * 2)
        .setMinUpdateDistanceMeters(if (isMoving) 10f else 25f)
        .build()
  }

  fun isCurrentlyMoving(): Boolean = isMoving
}
