package com.flexhrm.supervisor.tracking.service

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.flexhrm.supervisor.SupervisorSessionCache
import com.flexhrm.supervisor.tracking.sync.LocationUploadWorker

object TrackingController {
  @Volatile private var trackingActive = false

  fun isTrackingActive(): Boolean = trackingActive

  fun start(context: Context) {
    val session = SupervisorSessionCache.loadSession(context) ?: return
    if (session.supervisorId.isBlank()) return
    val intent =
        Intent(context, LocationTrackingService::class.java).apply {
          action = LocationTrackingService.ACTION_START
          putExtra(LocationTrackingService.EXTRA_SUPERVISOR_ID, session.supervisorId)
          putExtra(LocationTrackingService.EXTRA_DEVICE_ID, readDeviceId(context))
        }
    ContextCompat.startForegroundService(context, intent)
    trackingActive = true
    LocationUploadWorker.enqueue(context)
  }

  fun stop(context: Context) {
    val intent =
        Intent(context, LocationTrackingService::class.java).apply {
          action = LocationTrackingService.ACTION_STOP
        }
    context.startService(intent)
    trackingActive = false
  }

  fun restoreIfSessionValid(context: Context) {
    val session = SupervisorSessionCache.loadSession(context) ?: return
    if (session.token.isNotBlank() && session.supervisorId.isNotBlank()) {
      start(context)
    }
  }

  private fun readDeviceId(context: Context): String {
    val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    return androidId ?: ""
  }
}
