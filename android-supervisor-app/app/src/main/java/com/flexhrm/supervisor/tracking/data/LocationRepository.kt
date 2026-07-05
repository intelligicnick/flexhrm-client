package com.flexhrm.supervisor.tracking.data

import android.content.Context
import android.location.Location
import android.os.BatteryManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.flexhrm.supervisor.tracking.domain.TrackingConfig
import com.flexhrm.supervisor.tracking.security.MockLocationDetector
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object LocationRepository {
  @Volatile private var appContext: Context? = null

  fun init(context: Context) {
    appContext = context.applicationContext
  }

  private fun db(): LocationDatabase {
    val ctx = appContext ?: throw IllegalStateException("LocationRepository not initialized")
    return LocationDatabase.get(ctx)
  }

  suspend fun insertLocation(
      context: Context,
      location: Location,
      supervisorId: String,
      deviceId: String,
  ) = withContext(Dispatchers.IO) {
    val dao = db().locationPointDao()
    val total = dao.countAll()
    if (total >= TrackingConfig.MAX_STORED_POINTS) {
      dao.deleteOldest(total - TrackingConfig.MAX_STORED_POINTS + 100)
    }
    dao.insert(
        LocationPointEntity(
            id = UUID.randomUUID().toString(),
            supervisorId = supervisorId,
            deviceId = deviceId,
            latitude = location.latitude,
            longitude = location.longitude,
            timestamp = location.time,
            accuracy = location.accuracy,
            speed = if (location.hasSpeed()) location.speed else null,
            bearing = if (location.hasBearing()) location.bearing else null,
            altitude = if (location.hasAltitude()) location.altitude else null,
            batteryPercent = readBatteryPercent(context),
            networkType = readNetworkType(context),
            isMock = MockLocationDetector.isMock(location),
            deviceTime = System.currentTimeMillis(),
            uploaded = false))
  }

  suspend fun getPointsBetween(fromMs: Long, toMs: Long): List<LocationPointEntity> =
      withContext(Dispatchers.IO) { db().locationPointDao().getPointsBetween(fromMs, toMs) }

  suspend fun getPointsForSupervisor(
      supervisorId: String,
      fromMs: Long,
      toMs: Long,
  ): List<LocationPointEntity> =
      withContext(Dispatchers.IO) {
        db().locationPointDao().getPointsForSupervisor(supervisorId, fromMs, toMs)
      }

  suspend fun getUnuploaded(limit: Int): List<LocationPointEntity> =
      withContext(Dispatchers.IO) { db().locationPointDao().getUnuploaded(limit) }

  suspend fun markUploaded(ids: List<String>) =
      withContext(Dispatchers.IO) {
        if (ids.isNotEmpty()) db().locationPointDao().markUploaded(ids)
      }

  suspend fun latestTimestamp(): Long? =
      withContext(Dispatchers.IO) { db().locationPointDao().latestTimestamp() }

  suspend fun countUnuploaded(): Int =
      withContext(Dispatchers.IO) { db().locationPointDao().countUnuploaded() }

  suspend fun countAll(): Int = withContext(Dispatchers.IO) { db().locationPointDao().countAll() }

  private fun readBatteryPercent(context: Context): Int {
    val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager ?: return -1
    return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
  }

  private fun readNetworkType(context: Context): String {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        ?: return "none"
    val network = cm.activeNetwork ?: return "none"
    val caps = cm.getNetworkCapabilities(network) ?: return "unknown"
    return when {
      caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
      else -> "other"
    }
  }
}
