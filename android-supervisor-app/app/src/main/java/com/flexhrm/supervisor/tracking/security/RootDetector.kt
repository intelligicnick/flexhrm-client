package com.flexhrm.supervisor.tracking.security

import android.content.Context
import android.os.Build
import java.io.File

object RootDetector {
  fun isRooted(context: Context): Boolean {
    if (isSuPresent()) return true
    if (Build.TAGS?.contains("test-keys") == true) return true
    val paths =
        arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su",
        )
    return paths.any { File(it).exists() }
  }

  private fun isSuPresent(): Boolean {
    return try {
      Runtime.getRuntime().exec(arrayOf("/system/xbin/which", "su")).inputStream.bufferedReader().readLine() != null
    } catch (_: Exception) {
      false
    }
  }
}
