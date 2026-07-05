package com.flexhrm.supervisor.tracking.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [LocationPointEntity::class], version = 1, exportSchema = false)
abstract class LocationDatabase : RoomDatabase() {
  abstract fun locationPointDao(): LocationPointDao

  companion object {
    @Volatile private var instance: LocationDatabase? = null

    fun get(context: Context): LocationDatabase {
      return instance
          ?: synchronized(this) {
            instance
                ?: Room.databaseBuilder(
                        context.applicationContext,
                        LocationDatabase::class.java,
                        "flexhrm_location.db")
                    .build()
                    .also { instance = it }
          }
    }
  }
}
