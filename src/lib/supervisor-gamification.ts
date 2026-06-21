import { SchoolVisit } from "../types";
import { toIsoDate } from "./supervisor-dates";

export type SupervisorBadgeId =
  | "first_visit"
  | "week_warrior"
  | "streak_3"
  | "streak_7"
  | "coverage_half"
  | "mission_complete";

export interface SupervisorLevel {
  id: number;
  titleKey: string;
  minPoints: number;
  nextMinPoints: number | null;
}

export interface SupervisorGamificationStats {
  totalPoints: number;
  level: SupervisorLevel;
  levelProgressPercent: number;
  pointsToNextLevel: number | null;
  streakDays: number;
  weeklyVisits: number;
  weeklyGoal: number;
  weeklyProgressPercent: number;
  uniqueSchoolsThisWeek: number;
  schoolCoveragePercent: number;
  earnedBadges: SupervisorBadgeId[];
  nextBadgeId: SupervisorBadgeId | null;
}

const LEVELS: SupervisorLevel[] = [
  { id: 1, titleKey: "levelRookie", minPoints: 0, nextMinPoints: 50 },
  { id: 2, titleKey: "levelRanger", minPoints: 50, nextMinPoints: 150 },
  { id: 3, titleKey: "levelPro", minPoints: 150, nextMinPoints: 300 },
  { id: 4, titleKey: "levelChampion", minPoints: 300, nextMinPoints: 500 },
  { id: 5, titleKey: "levelLegend", minPoints: 500, nextMinPoints: null },
];

const BADGE_ORDER: SupervisorBadgeId[] = [
  "first_visit",
  "week_warrior",
  "streak_3",
  "streak_7",
  "coverage_half",
  "mission_complete",
];

export const BADGE_LABEL_KEYS: Record<SupervisorBadgeId, string> = {
  first_visit: "badgeFirstVisit",
  week_warrior: "badgeWeekWarrior",
  streak_3: "badgeStreak3",
  streak_7: "badgeStreak7",
  coverage_half: "badgeCoverageHalf",
  mission_complete: "badgeMissionComplete",
};

export const DEFAULT_WEEKLY_GOAL = 12;

function visitPhotoCount(visit: SchoolVisit): number {
  return visit.photoCount ?? visit.photos?.length ?? 1;
}

export function computeVisitStreak(visits: SchoolVisit[], today = new Date()): number {
  const visitDays = new Set(visits.map((v) => toIsoDate(new Date(v.visitDate))));
  if (visitDays.size === 0) return 0;

  const cursor = new Date(today);
  const todayKey = toIsoDate(cursor);
  if (!visitDays.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (;;) {
    const key = toIsoDate(cursor);
    if (!visitDays.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function pointsForVisit(photoCount: number): number {
  const bonusPhotos = Math.min(3, Math.max(0, photoCount - 1));
  return 10 + bonusPhotos * 5;
}

function getLevel(totalPoints: number): SupervisorLevel {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (totalPoints >= level.minPoints) current = level;
  }
  return current;
}

function computeVisitPoints(visits: SchoolVisit[]): number {
  return visits.reduce((sum, visit) => sum + pointsForVisit(visitPhotoCount(visit)), 0);
}

export function computeGamificationStats(params: {
  weekVisits: SchoolVisit[];
  streakVisits: SchoolVisit[];
  totalSchools: number;
  weeklyGoal?: number;
}): SupervisorGamificationStats {
  const { weekVisits, streakVisits, totalSchools, weeklyGoal = DEFAULT_WEEKLY_GOAL } = params;

  const visitPoints = computeVisitPoints(weekVisits);
  const streakDays = computeVisitStreak(streakVisits);
  const streakBonus = streakDays >= 7 ? 25 : streakDays >= 3 ? 10 : 0;
  const missionBonus = weekVisits.length >= weeklyGoal ? 30 : 0;
  const totalPoints = visitPoints + streakBonus + missionBonus;

  const level = getLevel(totalPoints);
  const nextThreshold = level.nextMinPoints;
  const levelSpan = nextThreshold ? nextThreshold - level.minPoints : 1;
  const levelProgress = nextThreshold
    ? Math.min(100, Math.round(((totalPoints - level.minPoints) / levelSpan) * 100))
    : 100;
  const pointsToNextLevel = nextThreshold ? Math.max(0, nextThreshold - totalPoints) : null;

  const weeklyVisits = weekVisits.length;
  const weeklyProgressPercent = Math.min(100, Math.round((weeklyVisits / weeklyGoal) * 100));
  const uniqueSchoolsThisWeek = new Set(weekVisits.map((v) => v.schoolWorkId)).size;
  const schoolCoveragePercent =
    totalSchools > 0 ? Math.min(100, Math.round((uniqueSchoolsThisWeek / totalSchools) * 100)) : 0;

  const earnedBadges: SupervisorBadgeId[] = [];
  if (weeklyVisits >= 1) earnedBadges.push("first_visit");
  if (weeklyVisits >= 5) earnedBadges.push("week_warrior");
  if (streakDays >= 3) earnedBadges.push("streak_3");
  if (streakDays >= 7) earnedBadges.push("streak_7");
  if (schoolCoveragePercent >= 50) earnedBadges.push("coverage_half");
  if (weeklyVisits >= weeklyGoal) earnedBadges.push("mission_complete");

  const earnedSet = new Set(earnedBadges);
  const nextBadgeId = BADGE_ORDER.find((id) => !earnedSet.has(id)) ?? null;

  return {
    totalPoints,
    level,
    levelProgressPercent: levelProgress,
    pointsToNextLevel,
    streakDays,
    weeklyVisits,
    weeklyGoal,
    weeklyProgressPercent,
    uniqueSchoolsThisWeek,
    schoolCoveragePercent,
    earnedBadges,
    nextBadgeId,
  };
}
