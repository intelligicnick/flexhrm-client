package com.flexhrm.supervisor.tracking.security

import android.content.Context
import android.os.Build
import android.provider.Settings

object DeviceIntegrityChecker {
  data class IntegrityStatus(
      val developerOptionsEnabled: Boolean,
      val rooted: Boolean,
  )

  fun check(context: Context): IntegrityStatus {
    return IntegrityStatus(
        developerOptionsEnabled = isDeveloperOptionsEnabled(context),
        rooted = RootDetector.isRooted(context))
  }

  private fun isDeveloperOptionsEnabled(context: Context): Boolean {
    return try {
      Settings.Global.getInt(context.contentResolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1
    } catch (_: Exception) {
      false
    }
  }
}
