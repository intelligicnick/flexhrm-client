package com.flexhrm.supervisor

import android.app.Application
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.flexhrm.supervisor.tracking.data.LocationRepository
import com.flexhrm.supervisor.tracking.service.TrackingController
import com.flexhrm.supervisor.tracking.sync.LocationHealthWorker
import com.flexhrm.supervisor.tracking.sync.NetworkMonitor
import java.util.concurrent.TimeUnit

class FlexHrmApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    LocationRepository.init(this)
    NetworkMonitor.register(this)
    scheduleHealthCheck()
    TrackingController.restoreIfSessionValid(this)
  }

  private fun scheduleHealthCheck() {
    val request =
        PeriodicWorkRequestBuilder<LocationHealthWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.NOT_REQUIRED).build())
            .build()
    WorkManager.getInstance(this)
        .enqueueUniquePeriodicWork(
            LocationHealthWorker.UNIQUE_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request)
  }
}
