package com.flexhrm.supervisor.tracking.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.flexhrm.supervisor.MainActivity
import com.flexhrm.supervisor.R
import com.flexhrm.supervisor.tracking.data.LocationRepository
import com.flexhrm.supervisor.tracking.sync.LocationUploadWorker
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class LocationTrackingService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private lateinit var fusedClient: FusedLocationProviderClient
  private val smartEngine = SmartTrackingEngine()
  private var supervisorId: String = ""
  private var deviceId: String = ""
  @Volatile private var lastCachedLocation: Location? = null

  private val locationCallback =
      object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
          val location = result.lastLocation ?: return
          try {
            smartEngine.onLocation(location)
            lastCachedLocation = location
            latestLocation = location
            scope.launch {
              LocationRepository.insertLocation(
                  this@LocationTrackingService, location, supervisorId, deviceId)
            }
            requestLocationUpdates()
          } catch (error: Exception) {
            Log.w(TAG, "Failed to handle location update", error)
          }
        }
      }

  override fun onCreate() {
    super.onCreate()
    fusedClient = LocationServices.getFusedLocationProviderClient(this)
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopTracking()
        stopSelf()
        return START_NOT_STICKY
      }
      else -> {
        supervisorId = intent?.getStringExtra(EXTRA_SUPERVISOR_ID).orEmpty()
        deviceId = intent?.getStringExtra(EXTRA_DEVICE_ID).orEmpty()
        if (supervisorId.isBlank() || !hasLocationPermission()) {
          stopSelf()
          return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, buildNotification())
        requestLocationUpdates()
        return START_STICKY
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    stopTracking()
    scope.cancel()
    super.onDestroy()
  }

  private fun requestLocationUpdates() {
    if (!hasLocationPermission()) return
    try {
      fusedClient.removeLocationUpdates(locationCallback)
      fusedClient.requestLocationUpdates(
          smartEngine.buildLocationRequest(), locationCallback, Looper.getMainLooper())
    } catch (error: SecurityException) {
      Log.w(TAG, "Location permission missing", error)
    }
  }

  private fun stopTracking() {
    try {
      fusedClient.removeLocationUpdates(locationCallback)
    } catch (ignored: Exception) {
      // ignore
    }
  }

  private fun hasLocationPermission(): Boolean {
    return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
  }

  private fun buildNotification(): Notification {
    val launchIntent = Intent(this, MainActivity::class.java)
    val pendingIntent =
        PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle(getString(R.string.tracking_notification_title))
        .setContentText(getString(R.string.tracking_notification_body))
        .setSmallIcon(R.drawable.ic_launcher)
        .setOngoing(true)
        .setContentIntent(pendingIntent)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel =
        NotificationChannel(
                CHANNEL_ID,
                getString(R.string.tracking_channel_name),
                NotificationManager.IMPORTANCE_LOW)
            .apply { description = getString(R.string.tracking_channel_description) }
    val manager = getSystemService(NotificationManager::class.java)
    manager?.createNotificationChannel(channel)
  }

  companion object {
    private const val TAG = "LocationTracking"
    const val ACTION_START = "com.flexhrm.supervisor.action.START_TRACKING"
    const val ACTION_STOP = "com.flexhrm.supervisor.action.STOP_TRACKING"
    const val EXTRA_SUPERVISOR_ID = "supervisorId"
    const val EXTRA_DEVICE_ID = "deviceId"
    private const val CHANNEL_ID = "flexhrm_location_tracking"
    private const val NOTIFICATION_ID = 7001

    @Volatile var latestLocation: Location? = null

    fun getCachedLocation(): Location? = latestLocation
  }
}
