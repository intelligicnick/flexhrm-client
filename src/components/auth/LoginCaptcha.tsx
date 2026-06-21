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
        const message =
          res.status === 404
            ? "Captcha API is unavailable. Restart the backend server and try again."
            : "Unable to load captcha.";
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
    <div className="space-y-2">
      <label htmlFor="login-captcha-field" className="text-xs font-bold text-slate-600 block">
        Security Check
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-h-[56px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
          {loading ? (
            <span className="text-[10px] text-slate-400 font-semibold">Loading captcha…</span>
          ) : svg ? (
            <img
              src={svg}
              alt="Captcha challenge"
              className="h-[56px] w-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <span className="text-[10px] text-rose-500 font-semibold px-2 text-center">
              {loadError || "Captcha unavailable"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void loadCaptcha()}
          disabled={disabled || loading}
          className="shrink-0 p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-[#ff791a] hover:border-orange-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh captcha"
          aria-label="Refresh captcha"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
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
        className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition uppercase tracking-widest font-mono"
      />
    </div>
  );
}
