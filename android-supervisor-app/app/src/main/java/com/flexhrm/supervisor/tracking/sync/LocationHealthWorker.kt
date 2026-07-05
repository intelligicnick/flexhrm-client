package com.flexhrm.supervisor.tracking.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.flexhrm.supervisor.SupervisorSessionCache
import com.flexhrm.supervisor.tracking.service.TrackingController

class LocationHealthWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    val session = SupervisorSessionCache.loadSession(applicationContext)
    if (session != null && session.token.isNotBlank() && !TrackingController.isTrackingActive()) {
      TrackingController.start(applicationContext)
    }
    LocationUploadWorker.enqueue(applicationContext)
    return Result.success()
  }

  companion object {
    const val UNIQUE_NAME = "flexhrm_location_health"
  }
}
