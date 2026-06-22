import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiUrl } from "../../api";

export interface LoginCaptchaValue {
  id: string;
  answer: string;
}

interface LoginCaptchaProps {
  value: LoginCaptchaValue;
  onChange: (value: LoginCaptchaValue) => void;
  disabled?: boolean;
}

export default function LoginCaptcha({ value, onChange, disabled }: LoginCaptchaProps) {
  const [svg, setSvg] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/captcha"), { credentials: "include" });
      if (!res.ok) {
        let message = "Unable to load captcha.";
        if (res.status === 404) {
          message = "Captcha API is unavailable. Restart the backend server and try again.";
        } else if (res.status === 502 || res.status === 503) {
          message =
            "Backend API is unavailable. Start it with: cd backend && npm run start:dev";
        } else {
          try {
            const body = (await res.json()) as { error?: string; message?: string };
            const detail = body.message || body.error;
            if (detail) message = detail;
          } catch {
            // Keep generic message when response is not JSON.
          }
        }
        throw new Error(message);
      }
      const data = (await res.json()) as { id: string; svg: string };
      if (!data.id || !data.svg) throw new Error("Invalid captcha response.");
      setSvg(data.svg);
      onChangeRef.current({ id: data.id, answer: "" });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load captcha.");
      setSvg("");
      onChangeRef.current({ id: "", answer: "" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  return (
    <div className="space-y-2.5">
      <label htmlFor="login-captcha-field" className="text-xs sm:text-sm font-bold text-slate-600 block">
        Security Check
      </label>
      <div className="flex items-stretch gap-2 min-w-0">
        <div className="flex-1 min-w-0 min-h-[56px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
          {loading ? (
            <span className="text-xs text-slate-400 font-semibold px-2 text-center">Loading captcha…</span>
          ) : svg ? (
            <img
              src={svg}
              alt="Captcha challenge"
              className="h-[56px] w-full max-w-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <span className="text-xs text-rose-500 font-semibold px-2 text-center leading-snug">
              {loadError || "Captcha unavailable"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void loadCaptcha()}
          disabled={disabled || loading}
          className="shrink-0 min-w-[48px] min-h-[48px] p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-[#ff791a] hover:border-orange-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center touch-manipulation"
          title="Refresh captcha"
          aria-label="Refresh captcha"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <input
        type="text"
        id="login-captcha-field"
        name="captcha"
        autoComplete="off"
        spellCheck={false}
        value={value.answer}
        onChange={(e) => onChange({ ...value, answer: e.target.value.toUpperCase() })}
        placeholder="Enter characters shown above"
        disabled={disabled || !value.id}
        className="w-full px-3.5 py-3.5 border border-slate-200 rounded-xl focus:border-[#ff791a] focus:ring-2 focus:ring-orange-100 focus:outline-none text-base text-slate-800 transition uppercase tracking-widest font-mono bg-slate-50/50 touch-manipulation"
      />
    </div>
  );
}
