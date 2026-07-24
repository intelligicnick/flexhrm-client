import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCheck,
  Loader2,
  MessageSquarePlus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { SchoolWork, SupervisorRequest, AppNotification } from "../../types";
import { parseApiError } from "../../api";
import { captureLivePhotoDataUrl } from "../../lib/live-camera";
import {
  isBrowserPushEnabled,
  isNotificationSoundEnabled,
  playNotificationSound,
  requestBrowserNotificationPermission,
  setBrowserPushEnabled,
  setNotificationSoundEnabled,
} from "../../lib/notification-alerts";
import { getSupervisorNotificationTarget } from "../../lib/notification-navigation";
import { fetchSupervisorSchools } from "../../lib/supervisor-schools-cache";
import { localizeSupervisorNotification } from "../../lib/supervisor-notifications-i18n";
import { useSupervisorI18n } from "./SupervisorI18nContext";
import { SupervisorActionButton } from "./SupervisorUI";

type PageTab = "raise" | "mine" | "notifications";

import { resolvePhotoSrc } from "../../lib/media-url";

function photoSrc(photo: { photoDataBase64: string; mimeType: string; imagekitUrl?: string }) {
  return resolvePhotoSrc(photo);
}

function formatWhen(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pending",
    responded: "Responded",
    closed: "Closed",
    escalated: "Escalated",
  };
  return map[status] || status;
}

function notificationTypeLabel(type: AppNotification["type"], t: (key: string) => string): string {
  const map: Record<AppNotification["type"], string> = {
    commitment_created: t("notifCommitmentCreated"),
    commitment_overdue: t("notifCommitmentOverdue"),
    commitment_reminder: t("notifCommitmentReminder"),
    commitment_admin_update: t("notifCommitmentAdminUpdate"),
    supervisor_request_new: t("notifRequestNew"),
    supervisor_request_response: t("adminResponse"),
    supervisor_request_escalated: t("notifRequestEscalated"),
    visit_submitted: t("notifVisitSubmitted"),
    visit_reviewed: t("notifVisitReviewed"),
    planned_visit_due: t("notifPlannedVisitDue"),
    planned_visit_missed: t("notifPlannedVisitMissed"),
  };
  return map[type] || type;
}

export default function SupervisorRequestsPage() {
  const { supervisorFetch } = useOutletContext<{ supervisorFetch: typeof fetch }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, lang } = useSupervisorI18n();
  const [tab, setTab] = useState<PageTab>("raise");
  const [schools, setSchools] = useState<SchoolWork[]>([]);
  const [requests, setRequests] = useState<SupervisorRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<
    { caption: string; mimeType: string; filename: string; photoDataBase64: string; takenAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [soundOn, setSoundOn] = useState(isNotificationSoundEnabled);
  const [pushOn, setPushOn] = useState(isBrowserPushEnabled);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyPhotos, setReplyPhotos] = useState<
    Record<
      string,
      { caption: string; mimeType: string; filename: string; photoDataBase64: string; takenAt: string }[]
    >
  >({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [capturingReplyId, setCapturingReplyId] = useState<string | null>(null);
  const [escalationText, setEscalationText] = useState<Record<string, string>>({});
  const [escalatingId, setEscalatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schoolList, requestsRes, summaryRes] = await Promise.all([
        fetchSupervisorSchools(supervisorFetch),
        supervisorFetch("/api/supervisor-requests/supervisor/mine"),
        supervisorFetch("/api/notifications/supervisor/summary"),
      ]);
      setSchools(schoolList);
      if (requestsRes.ok) setRequests(await requestsRes.json());
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setNotifications(Array.isArray(data.items) ? data.items : []);
        setUnreadCount(Number(data.count) || 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [supervisorFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "raise" || tabParam === "mine" || tabParam === "notifications") {
      setTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (tab !== "mine" || loading) return;
    const unread = requests.filter(
      (req) => req.adminResponse && req.status === "responded" && !req.supervisorReadAt,
    );
    if (unread.length === 0) return;
    void (async () => {
      await Promise.all(
        unread.map((req) =>
          supervisorFetch(`/api/supervisor-requests/supervisor/${req.id}/read`, {
            method: "PATCH",
          }),
        ),
      );
      setRequests((prev) =>
        prev.map((req) =>
          unread.some((u) => u.id === req.id)
            ? { ...req, supervisorReadAt: new Date().toISOString() }
            : req,
        ),
      );
    })();
  }, [tab, loading, requests, supervisorFetch]);

  const filteredSchools = useMemo(() => {
    const q = schoolSearch.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.schoolName.toLowerCase().includes(q) ||
        s.udise.toLowerCase().includes(q) ||
        s.block.toLowerCase().includes(q),
    );
  }, [schools, schoolSearch]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.readAt),
    [notifications],
  );

  const toggleSchool = (id: string) => {
    setSelectedSchoolIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCapturePhoto = async () => {
    setCapturing(true);
    setError(null);
    try {
      const dataUrl = await captureLivePhotoDataUrl();
      setPhotos((prev) => [
        ...prev,
        {
          caption: "",
          mimeType: "image/jpeg",
          filename: `request-${Date.now()}.jpg`,
          photoDataBase64: dataUrl,
          takenAt: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("photoCaptureFailed"));
    } finally {
      setCapturing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError(t("requestMessageRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await supervisorFetch("/api/supervisor-requests/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolWorkIds: selectedSchoolIds,
          message: trimmed,
          photos,
        }),
      });
      if (!res.ok) throw await parseApiError(res, t("requestSubmitFailed"));
      setMessage("");
      setPhotos([]);
      setSelectedSchoolIds([]);
      setSuccess(t("requestSubmitted"));
      await loadData();
      setTab("mine");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("requestSubmitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const markRead = async (id: string) => {
    await supervisorFetch(`/api/notifications/supervisor/${id}/read`, {
      method: "PATCH",
    });
    await loadData();
  };

  const markAllRead = async () => {
    await supervisorFetch("/api/notifications/supervisor/read-all", {
      method: "PATCH",
    });
    await loadData();
  };

  const handleCaptureReplyPhoto = async (requestId: string) => {
    setCapturingReplyId(requestId);
    setError(null);
    try {
      const dataUrl = await captureLivePhotoDataUrl();
      setReplyPhotos((prev) => ({
        ...prev,
        [requestId]: [
          ...(prev[requestId] || []),
          {
            caption: "",
            mimeType: "image/jpeg",
            filename: `reply-${Date.now()}.jpg`,
            photoDataBase64: dataUrl,
            takenAt: new Date().toISOString(),
          },
        ],
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("photoCaptureFailed"));
    } finally {
      setCapturingReplyId(null);
    }
  };

  const handleReply = async (requestId: string) => {
    const trimmed = (replyText[requestId] || "").trim();
    if (!trimmed) {
      setError(t("replyMessageRequired"));
      return;
    }
    setReplyingId(requestId);
    setError(null);
    setSuccess(null);
    try {
      const res = await supervisorFetch(`/api/supervisor-requests/supervisor/${requestId}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          photos: replyPhotos[requestId] || [],
        }),
      });
      if (!res.ok) throw await parseApiError(res, t("replySubmitFailed"));
      setReplyText((prev) => ({ ...prev, [requestId]: "" }));
      setReplyPhotos((prev) => ({ ...prev, [requestId]: [] }));
      setSuccess(t("replySubmitted"));
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("replySubmitFailed"));
    } finally {
      setReplyingId(null);
    }
  };

  const handleEscalate = async (requestId: string) => {
    const trimmed = (escalationText[requestId] || "").trim();
    if (!trimmed) {
      setError(t("escalationReasonRequired"));
      return;
    }
    if (!window.confirm(t("escalateConfirm"))) return;
    setEscalatingId(requestId);
    setError(null);
    setSuccess(null);
    try {
      const res = await supervisorFetch(`/api/supervisor-requests/supervisor/${requestId}/escalate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw await parseApiError(res, t("escalationSubmitFailed"));
      setEscalationText((prev) => ({ ...prev, [requestId]: "" }));
      setSuccess(t("escalationSubmitted"));
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("escalationSubmitFailed"));
    } finally {
      setEscalatingId(null);
    }
  };

  const handleNotificationNavigate = async (notif: AppNotification) => {
    if (!notif.readAt) {
      await markRead(notif.id);
    }
    const target = getSupervisorNotificationTarget(notif);
    if (!target) return;
    if (target.tab) {
      setTab(target.tab);
      navigate(`${target.path}?tab=${target.tab}`);
      return;
    }
    navigate(target.path);
  };

  const tabs: { id: PageTab; label: string; icon: typeof MessageSquarePlus; badge?: number }[] = [
    { id: "raise", label: t("raiseRequest"), icon: MessageSquarePlus },
    { id: "mine", label: t("myRequests"), icon: Send },
    { id: "notifications", label: t("notifications"), icon: Bell, badge: unreadCount },
  ];

  return (
    <div className="space-y-4 pb-4">
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 relative py-2 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition cursor-pointer ${
              tab === id ? "bg-[#ff791a] text-white" : "text-slate-500"
            }`}
          >
            <Icon size={16} />
            {label}
            {badge ? (
              <span className="absolute top-1 right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : tab === "raise" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <h2 className="font-black text-slate-900 text-sm">{t("raiseRequest")}</h2>
            <p className="text-[11px] text-slate-400">{t("raiseRequestHint")}</p>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {t("selectSchoolsOptional")}
              </label>
              <input
                type="search"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder={t("searchSchool")}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
              <div className="mt-2 max-h-36 overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-2">
                {filteredSchools.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">{t("noSchoolsFound")}</p>
                ) : (
                  filteredSchools.map((school) => {
                    const checked = selectedSchoolIds.includes(school.id);
                    return (
                      <label
                        key={school.id}
                        className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer text-xs ${
                          checked ? "bg-orange-50 border border-orange-200" : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSchool(school.id)}
                          className="mt-0.5 accent-[#ff791a]"
                        />
                        <span>
                          <span className="font-bold text-slate-800 block">{school.schoolName}</span>
                          <span className="text-slate-400">{school.block} · {school.udise}</span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {selectedSchoolIds.length > 0 && (
                <p className="text-[10px] text-[#ff791a] font-bold mt-1">
                  {selectedSchoolIds.length} {t("schoolsSelected")}
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {t("requestMessage")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={t("requestMessagePlaceholder")}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs resize-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {t("requestPhotosOptional")}
              </label>
              <p className="text-[10px] text-slate-400 mt-0.5">{t("requestPhotoHint")}</p>
              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={capturing || photos.length >= 5}
                className="mt-2 w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {capturing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {capturing ? t("capturingPhoto") : t("addPhoto")}
              </button>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {photos.map((photo, i) => (
                    <div key={i} className="relative">
                      <img
                        src={photoSrc(photo)}
                        alt=""
                        className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
          {success && <p className="text-xs text-emerald-600 font-semibold">{success}</p>}

          <SupervisorActionButton
            type="submit"
            loading={submitting}
            loadingText={t("submittingRequest")}
            fullWidth
            className="py-3 text-sm font-black"
            icon={<Send size={18} />}
          >
            {t("submitRequest")}
          </SupervisorActionButton>
        </form>
      ) : tab === "mine" ? (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">{t("noRequestsYet")}</p>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      req.status === "escalated"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {statusLabel(req.status)}
                  </span>
                  <span className="text-[10px] text-slate-400">{formatWhen(req.createdAt)}</span>
                </div>
                {req.schools?.length > 0 ? (
                  <div className="text-xs text-slate-600">
                    {req.schools.map((s) => (
                      <span key={s.id} className="block font-semibold text-slate-800">
                        {s.schoolName}
                        <span className="font-normal text-slate-400"> · {s.block}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">{t("generalRequest")}</p>
                )}
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{req.message}</p>
                {req.photos?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {req.photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={photoSrc(photo)}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                      />
                    ))}
                  </div>
                )}
                {req.followUps?.map((followUp) => (
                  <div key={followUp.id} className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <p className="text-[10px] font-bold text-orange-700 uppercase">{t("yourFollowUp")}</p>
                    <p className="text-xs text-orange-900 mt-1 whitespace-pre-wrap">{followUp.message}</p>
                    <p className="text-[10px] text-orange-600 mt-1">{formatWhen(followUp.createdAt)}</p>
                    {followUp.photos?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {followUp.photos.map((photo) => (
                          <img
                            key={photo.id}
                            src={photoSrc(photo)}
                            alt=""
                            className="w-16 h-16 object-cover rounded-lg border border-orange-200"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {req.adminResponse && (
                  <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">{t("adminResponse")}</p>
                    <p className="text-xs text-emerald-900 mt-1 whitespace-pre-wrap">{req.adminResponse}</p>
                    <p className="text-[10px] text-emerald-600 mt-1">{formatWhen(req.respondedAt)}</p>
                  </div>
                )}
                {req.escalationMessage && (
                  <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <p className="text-[10px] font-bold text-rose-700 uppercase flex items-center gap-1">
                      <AlertTriangle size={12} /> {t("escalationReason")}
                    </p>
                    <p className="text-xs text-rose-900 mt-1 whitespace-pre-wrap">{req.escalationMessage}</p>
                    <p className="text-[10px] text-rose-600 mt-1">{formatWhen(req.escalatedAt)}</p>
                  </div>
                )}
                {req.escalationResolution && (
                  <div className="mt-2 p-3 bg-violet-50 border border-violet-200 rounded-xl">
                    <p className="text-[10px] font-bold text-violet-700 uppercase">{t("superAdminResolution")}</p>
                    <p className="text-xs text-violet-900 mt-1 whitespace-pre-wrap">{req.escalationResolution}</p>
                    <p className="text-[10px] text-violet-600 mt-1">{formatWhen(req.escalationResolvedAt)}</p>
                  </div>
                )}
                {req.status === "escalated" && (
                  <p className="text-[10px] text-rose-600 font-semibold">{t("escalationPendingReview")}</p>
                )}
                {req.status !== "closed" && req.status !== "escalated" && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      {t("replyToRequest")}
                    </label>
                    <textarea
                      value={replyText[req.id] || ""}
                      onChange={(e) =>
                        setReplyText((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder={t("replyPlaceholder")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCaptureReplyPhoto(req.id)}
                      disabled={
                        capturingReplyId === req.id || (replyPhotos[req.id]?.length || 0) >= 5
                      }
                      className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {capturingReplyId === req.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Camera size={16} />
                      )}
                      {capturingReplyId === req.id ? t("capturingPhoto") : t("addReplyPhoto")}
                    </button>
                    {(replyPhotos[req.id]?.length || 0) > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {replyPhotos[req.id].map((photo, i) => (
                          <div key={i} className="relative">
                            <img
                              src={photoSrc(photo)}
                              alt=""
                              className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setReplyPhotos((prev) => ({
                                  ...prev,
                                  [req.id]: (prev[req.id] || []).filter((_, idx) => idx !== i),
                                }))
                              }
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <SupervisorActionButton
                      type="button"
                      loading={replyingId === req.id}
                      loadingText={t("submittingReply")}
                      onClick={() => void handleReply(req.id)}
                      fullWidth
                      className="py-2.5 text-xs font-black"
                      icon={<Send size={16} />}
                    >
                      {t("sendReply")}
                    </SupervisorActionButton>
                  </div>
                )}
                {req.status === "closed" && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <label className="text-[10px] font-bold text-rose-600 uppercase tracking-wide flex items-center gap-1">
                      <AlertTriangle size={12} /> {t("escalateToSuperAdmin")}
                    </label>
                    <p className="text-[10px] text-slate-400">{t("escalateHint")}</p>
                    <textarea
                      value={escalationText[req.id] || ""}
                      onChange={(e) =>
                        setEscalationText((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder={t("escalationPlaceholder")}
                      className="w-full px-3 py-2 border border-rose-200 rounded-xl text-xs resize-none"
                    />
                    <SupervisorActionButton
                      type="button"
                      variant="danger"
                      loading={escalatingId === req.id}
                      loadingText={t("submittingEscalation")}
                      onClick={() => void handleEscalate(req.id)}
                      fullWidth
                      className="py-2.5 text-xs font-black"
                      icon={<AlertTriangle size={16} />}
                    >
                      {t("escalateRequest")}
                    </SupervisorActionButton>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {unreadNotifications.length > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="w-full py-2 text-xs font-bold text-[#ff791a] flex items-center justify-center gap-1 cursor-pointer"
            >
              <CheckCheck size={14} /> {t("markAllRead")}
            </button>
          )}
          {notifications.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">{t("noNotificationsYet")}</p>
          ) : (
            notifications.map((notif) => {
              const unread = !notif.readAt;
              const localized = localizeSupervisorNotification(notif, lang);
              return (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => void handleNotificationNavigate(notif)}
                  className={`w-full text-left bg-white border rounded-2xl p-4 space-y-2 cursor-pointer transition ${
                    unread ? "border-[#ff791a] shadow-sm" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase text-[#ff791a]">
                      {notificationTypeLabel(notif.type, t)}
                    </span>
                    {unread && (
                      <span className="text-[9px] font-bold bg-[#ff791a] text-white px-1.5 py-0.5 rounded-full">
                        {t("new")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-black text-slate-800">{localized.title}</p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{localized.message}</p>
                  <p className="text-[10px] text-slate-400">{formatWhen(notif.createdAt)}</p>
                </button>
              );
              })
          )}
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => {
                const next = !soundOn;
                setSoundOn(next);
                setNotificationSoundEnabled(next);
                if (next) playNotificationSound();
              }}
              className={`text-[10px] font-bold cursor-pointer ${soundOn ? "text-[#ff791a]" : "text-slate-400"}`}
            >
              {soundOn ? t("soundOn") : t("soundOff")}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !pushOn;
                setPushOn(next);
                setBrowserPushEnabled(next);
                if (next) void requestBrowserNotificationPermission();
              }}
              className={`text-[10px] font-bold cursor-pointer ${pushOn ? "text-[#ff791a]" : "text-slate-400"}`}
            >
              {pushOn ? t("browserAlertsOn") : t("browserAlertsOff")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
