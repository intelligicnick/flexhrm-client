import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { monitorApi } from "../../lib/monitor-api";

interface MonitorLiveViewModalProps {
  deviceAgentId: string;
  employeeName: string;
  sessionId: string;
  onClose: () => void;
}

export default function MonitorLiveViewModal({
  deviceAgentId,
  employeeName,
  sessionId,
  onClose,
}: MonitorLiveViewModalProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const frame = await monitorApi.getLiveViewFrame(deviceAgentId, sessionId);
        if (!active) return;
        if (frame?.imageUrl) {
          setImageUrl(frame.imageUrl);
          setError("");
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load frame");
      }
    };
    poll();
    const interval = window.setInterval(poll, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [deviceAgentId, sessionId]);

  const handleStop = async () => {
    try {
      await monitorApi.stopLiveView(deviceAgentId);
    } catch {
      /* ignore */
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={handleStop}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Live view — {employeeName}</h3>
            <p className="text-[10px] text-slate-400">Refreshes every 5 seconds while session is active</p>
          </div>
          <button type="button" onClick={handleStop} className="p-1.5 rounded-lg hover:bg-slate-100" data-no-busy>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 bg-slate-900 flex items-center justify-center min-h-[320px] p-2">
          {imageUrl ? (
            <img src={imageUrl} alt="Live screen" className="w-full max-h-[70vh] object-contain rounded-lg" />
          ) : (
            <p className="text-slate-400 text-sm">{error || "Waiting for first frame from agent…"}</p>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={handleStop}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            Stop live view
          </button>
        </div>
      </div>
    </div>
  );
}
