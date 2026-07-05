package com.flexhrm.supervisor.tracking.domain

object TrackingConfig {
  const val MOVING_MIN_INTERVAL_MS = 15_000L
  const val MOVING_MAX_INTERVAL_MS = 30_000L
  const val STATIONARY_MIN_INTERVAL_MS = 120_000L
  const val STATIONARY_MAX_INTERVAL_MS = 300_000L
  const val MOVING_SPEED_THRESHOLD_MPS = 1.0f
  const val STOP_SPEED_THRESHOLD_MPS = 0.5f
  const val STOP_MIN_DURATION_MS = 180_000L
  const val UPLOAD_BATCH_SIZE = 200
  const val MAX_STORED_POINTS = 50_000
  const val SECURITY_SCAN_INTERVAL_MS = 30 * 60 * 1000L
}
