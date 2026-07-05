package com.flexhrm.supervisor.tracking.security

import android.location.Location
import kotlin.jvm.JvmStatic
import android.os.Build

object MockLocationDetector {
  @JvmStatic
  fun isMock(location: Location): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      location.isMock
    } else {
      @Suppress("DEPRECATION") location.isFromMockProvider
    }
  }
}
