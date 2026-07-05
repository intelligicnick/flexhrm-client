package com.flexhrm.supervisor.tracking.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "location_points",
    indices =
        [
            Index(value = ["timestamp"]),
            Index(value = ["uploaded"]),
            Index(value = ["supervisorId", "timestamp"])])
data class LocationPointEntity(
    @PrimaryKey val id: String,
    val supervisorId: String,
    val deviceId: String,
    val latitude: Double,
    val longitude: Double,
    val timestamp: Long,
    val accuracy: Float,
    val speed: Float?,
    val bearing: Float?,
    val altitude: Double?,
    val batteryPercent: Int,
    val networkType: String,
    val isMock: Boolean,
    val deviceTime: Long,
    val uploaded: Boolean = false,
)
