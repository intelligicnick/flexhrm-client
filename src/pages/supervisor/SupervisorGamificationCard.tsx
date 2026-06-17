import React from "react";
import {
  Award,
  Flame,
  Medal,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import {
  BADGE_LABEL_KEYS,
  SupervisorBadgeId,
  SupervisorGamificationStats,
} from "../../lib/supervisor-gamification";
import { useSupervisorI18n } from "./SupervisorI18nContext";

const BADGE_ICONS: Record<SupervisorBadgeId, typeof Star> = {
  first_visit: Zap,
  week_warrior: Trophy,
  streak_3: Flame,
  streak_7: Flame,
  coverage_half: Target,
  mission_complete: Medal,
};

export default function SupervisorGamificationCard({
  stats,
}: {
  stats: SupervisorGamificationStats;
}) {
  const { t } = useSupervisorI18n();

  return (
    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-[#0C1E4A] via-[#152a5c] to-[#1a3568] p-4 text-white shadow-lg space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-orange-300/90 flex items-center gap-1.5">
            <Sparkles size={14} />
            {t("fieldProgress")}
          </p>
          <p className="text-lg font-black mt-1">{t(stats.level.titleKey as never)}</p>
          <p className="text-xs text-slate-300 mt-0.5">
            {stats.totalPoints} {t("xpPoints")}
            {stats.pointsToNextLevel !== null && (
              <span className="text-orange-200/90">
                {" "}
                · {stats.pointsToNextLevel} {t("xpToNextLevel")}
              </span>
            )}
          </p>
        </div>
        <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 border border-orange-400/30">
          <Award size={24} className="text-orange-300" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1.5">
          <span>{t("levelProgress")}</span>
          <span className="text-orange-200">{stats.levelProgressPercent}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ff791a] to-amber-400 rounded-full transition-all"
            style={{ width: `${stats.levelProgressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-200/90">{t("weeklyMission")}</p>
          <p className="text-sm font-black mt-0.5">
            {stats.weeklyVisits}/{stats.weeklyGoal}
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">{t("visitsDone")}</p>
        </div>
        <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-200/90 flex items-center gap-1">
            <Flame size={12} />
            {t("streakDays")}
          </p>
          <p className="text-sm font-black mt-0.5">
            {stats.streakDays} {t("days")}
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">
            {stats.streakDays > 0 ? t("keepItUp") : t("startStreakHint")}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black uppercase tracking-wide text-orange-200/90">{t("badges")}</p>
          <span className="text-[10px] font-bold text-slate-300">
            {stats.earnedBadges.length}/{Object.keys(BADGE_LABEL_KEYS).length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(BADGE_LABEL_KEYS) as SupervisorBadgeId[]).map((badgeId) => {
            const earned = stats.earnedBadges.includes(badgeId);
            const Icon = BADGE_ICONS[badgeId];
            const isNext = stats.nextBadgeId === badgeId;
            return (
              <div
                key={badgeId}
                className={`rounded-xl px-2 py-2.5 text-center border transition ${
                  earned
                    ? "bg-orange-500/20 border-orange-400/40"
                    : isNext
                      ? "bg-white/5 border-orange-300/30"
                      : "bg-white/5 border-white/10 opacity-60"
                }`}
              >
                <Icon
                  size={18}
                  className={`mx-auto ${earned ? "text-orange-300" : "text-slate-400"}`}
                />
                <p className="text-[9px] font-bold mt-1 leading-tight text-slate-200">
                  {t(BADGE_LABEL_KEYS[badgeId] as never)}
                </p>
              </div>
            );
          })}
        </div>
        {stats.nextBadgeId && (
          <p className="text-[10px] text-orange-200/90 mt-2 text-center">
            {t("nextBadgeHint")}: {t(BADGE_LABEL_KEYS[stats.nextBadgeId] as never)}
          </p>
        )}
      </div>
    </div>
  );
}
