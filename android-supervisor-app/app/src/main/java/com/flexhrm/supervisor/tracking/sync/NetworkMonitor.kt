package com.flexhrm.supervisor.tracking.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.flexhrm.supervisor.tracking.service.TrackingController

object NetworkMonitor {
  @Volatile private var registered = false

  fun register(context: Context) {
    if (registered) return
    registered = true
    val appContext = context.applicationContext
    val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val request =
        NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build()
    cm.registerNetworkCallback(
        request,
        object : ConnectivityManager.NetworkCallback() {
          override fun onAvailable(network: Network) {
            LocationUploadWorker.enqueue(appContext)
            TrackingController.restoreIfSessionValid(appContext)
          }
        })
  }
}
