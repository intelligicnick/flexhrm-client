package com.flexhrm.supervisor.tracking.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface LocationPointDao {
  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insert(point: LocationPointEntity)

  @Query("SELECT * FROM location_points WHERE timestamp BETWEEN :fromMs AND :toMs ORDER BY timestamp ASC")
  suspend fun getPointsBetween(fromMs: Long, toMs: Long): List<LocationPointEntity>

  @Query(
      "SELECT * FROM location_points WHERE supervisorId = :supervisorId AND timestamp BETWEEN :fromMs AND :toMs ORDER BY timestamp ASC")
  suspend fun getPointsForSupervisor(
      supervisorId: String,
      fromMs: Long,
      toMs: Long,
  ): List<LocationPointEntity>

  @Query("SELECT * FROM location_points WHERE uploaded = 0 ORDER BY timestamp ASC LIMIT :limit")
  suspend fun getUnuploaded(limit: Int): List<LocationPointEntity>

  @Query("UPDATE location_points SET uploaded = 1 WHERE id IN (:ids)")
  suspend fun markUploaded(ids: List<String>)

  @Query("SELECT COUNT(*) FROM location_points")
  suspend fun countAll(): Int

  @Query("SELECT COUNT(*) FROM location_points WHERE uploaded = 0")
  suspend fun countUnuploaded(): Int

  @Query("SELECT MAX(timestamp) FROM location_points")
  suspend fun latestTimestamp(): Long?

  @Query("DELETE FROM location_points WHERE id IN (SELECT id FROM location_points ORDER BY timestamp ASC LIMIT :count)")
  suspend fun deleteOldest(count: Int)
}
