package com.flexhrm.supervisor.tracking.sync

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.flexhrm.supervisor.BuildConfig
import com.flexhrm.supervisor.SupervisorSessionCache
import com.flexhrm.supervisor.tracking.data.LocationRepository
import com.flexhrm.supervisor.tracking.domain.TrackingConfig
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject

class LocationUploadWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    val session = SupervisorSessionCache.loadSession(applicationContext) ?: return Result.success()
    if (session.token.isBlank()) return Result.success()

    val batch = LocationRepository.getUnuploaded(TrackingConfig.UPLOAD_BATCH_SIZE)
    if (batch.isEmpty()) return Result.success()

    return try {
      val payload = buildPayload(batch)
      val connection = openConnection(session.token, batch.first().deviceId)
      connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
      val code = connection.responseCode
      connection.disconnect()
      if (code in 200..299) {
        LocationRepository.markUploaded(batch.map { it.id })
        if (LocationRepository.countUnuploaded() > 0) {
          enqueue(applicationContext)
        }
        Result.success()
      } else {
        Log.w(TAG, "Upload failed with HTTP $code")
        Result.retry()
      }
    } catch (error: Exception) {
      Log.w(TAG, "Upload failed", error)
      Result.retry()
    }
  }

  private fun buildPayload(batch: List<com.flexhrm.supervisor.tracking.data.LocationPointEntity>): JSONObject {
    val points = JSONArray()
    for (point in batch) {
      points.put(
          JSONObject()
              .put("id", point.id)
              .put("latitude", point.latitude)
              .put("longitude", point.longitude)
              .put("timestamp", point.timestamp)
              .put("accuracy", point.accuracy)
              .put("speed", point.speed ?: JSONObject.NULL)
              .put("bearing", point.bearing ?: JSONObject.NULL)
              .put("altitude", point.altitude ?: JSONObject.NULL)
              .put("batteryPercent", point.batteryPercent)
              .put("networkType", point.networkType)
              .put("isMock", point.isMock)
              .put("deviceTime", point.deviceTime))
    }
    return JSONObject()
        .put("supervisorId", batch.first().supervisorId)
        .put("deviceId", batch.first().deviceId)
        .put("points", points)
  }

  private fun openConnection(token: String, deviceId: String): HttpURLConnection {
    val url = URL("${BuildConfig.API_BASE}/school-supervisors/location-pings")
    val connection = url.openConnection() as HttpURLConnection
    connection.requestMethod = "POST"
    connection.connectTimeout = 20_000
    connection.readTimeout = 30_000
    connection.doOutput = true
    connection.setRequestProperty("Content-Type", "application/json")
    connection.setRequestProperty("Authorization", "Bearer $token")
    if (deviceId.isNotBlank()) {
      connection.setRequestProperty("X-Supervisor-Device-Id", deviceId)
    }
    return connection
  }

  companion object {
    private const val TAG = "LocationUpload"
    const val UNIQUE_NAME = "flexhrm_location_upload"

    fun enqueue(context: Context) {
      val request =
          OneTimeWorkRequestBuilder<LocationUploadWorker>()
              .setConstraints(
                  Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
              .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
              .build()
      WorkManager.getInstance(context)
          .enqueueUniqueWork(UNIQUE_NAME, ExistingWorkPolicy.KEEP, request)
    }
  }
}
