package com.flexhrm.supervisor

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONObject

data class SupervisorSession(
    val token: String,
    val name: String,
    val supervisorId: String,
)

object SupervisorSessionCache {
  private const val PREFS = "flexhrm_supervisor_session"
  private const val KEY_TOKEN = "token"
  private const val KEY_NAME = "name"
  private const val KEY_SUPERVISOR_ID = "supervisor_id"

  @JvmStatic
  fun save(context: Context, token: String?, name: String?, supervisorId: String?) {
    if (token.isNullOrBlank()) {
      clear(context)
      return
    }
    prefs(context)
        .edit()
        .putString(KEY_TOKEN, token.trim())
        .putString(KEY_NAME, name?.trim().orEmpty())
        .putString(KEY_SUPERVISOR_ID, supervisorId?.trim().orEmpty())
        .apply()
  }

  @JvmStatic
  fun saveFromJson(context: Context, json: String?) {
    if (json.isNullOrBlank()) {
      clear(context)
      TrackingBridgeHelper.onSessionCleared(context)
      return
    }
    try {
      val objectJson = JSONObject(json)
      save(
          context,
          objectJson.optString("token", ""),
          objectJson.optString("name", ""),
          objectJson.optString("supervisorId", ""))
      TrackingBridgeHelper.onSessionSaved(context)
    } catch (_: Exception) {
      clear(context)
      TrackingBridgeHelper.onSessionCleared(context)
    }
  }

  @JvmStatic
  fun loadJson(context: Context): String {
    val store = prefs(context)
    val token = store.getString(KEY_TOKEN, "").orEmpty()
    if (token.isBlank()) return ""
    return try {
      JSONObject()
          .put("token", token.trim())
          .put("name", store.getString(KEY_NAME, "").orEmpty())
          .put("supervisorId", store.getString(KEY_SUPERVISOR_ID, "").orEmpty())
          .toString()
    } catch (_: Exception) {
      ""
    }
  }

  @JvmStatic
  fun loadSession(context: Context): SupervisorSession? {
    val store = prefs(context)
    val token = store.getString(KEY_TOKEN, "").orEmpty()
    if (token.isBlank()) return null
    return SupervisorSession(
        token = token.trim(),
        name = store.getString(KEY_NAME, "").orEmpty(),
        supervisorId = store.getString(KEY_SUPERVISOR_ID, "").orEmpty())
  }

  @JvmStatic
  fun clear(context: Context) {
    prefs(context).edit().clear().apply()
    TrackingBridgeHelper.onSessionCleared(context)
  }

  private fun prefs(context: Context): SharedPreferences {
    return try {
      val masterKey =
          MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
      EncryptedSharedPreferences.create(
          context,
          PREFS,
          masterKey,
          EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
          EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
    } catch (_: Exception) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }
  }
}

/** Small Java-friendly helper to avoid circular Kotlin imports from Java bridge. */
object TrackingBridgeHelper {
  @JvmStatic
  fun onSessionSaved(context: Context) {
    com.flexhrm.supervisor.tracking.bridge.TrackingBridge.startTracking(context)
    com.flexhrm.supervisor.tracking.sync.LocationUploadWorker.enqueue(context)
  }

  @JvmStatic
  fun onSessionCleared(context: Context) {
    com.flexhrm.supervisor.tracking.bridge.TrackingBridge.stopTracking(context)
  }
}
