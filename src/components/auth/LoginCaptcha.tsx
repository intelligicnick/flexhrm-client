import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

export interface LoginCaptchaValue {
  id: string;
  answer: string;
}

interface LoginCaptchaProps {
  value: LoginCaptchaValue;
  onChange: (value: LoginCaptchaValue) => void;
  disabled?: boolean;
  refreshKey?: number;
}

function generateMathChallenge(): { id: string; question: string } {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { id: `math:${a}+${b}`, question: `${a} + ${b} = ?` };
}

export default function LoginCaptcha({ value, onChange, disabled, refreshKey = 0 }: LoginCaptchaProps) {
  const [question, setQuestion] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const loadCaptcha = useCallback(() => {
    const challenge = generateMathChallenge();
    setQuestion(challenge.question);
    onChangeRef.current({ id: challenge.id, answer: "" });
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha, refreshKey]);

  return (
    <div className="space-y-2.5">
      <label htmlFor="login-captcha-field" className="text-xs sm:text-sm font-bold text-slate-600 block">
        Security Check
      </label>
      <div className="flex items-stretch gap-2 min-w-0">
        <div className="flex-1 min-w-0 min-h-[56px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden px-4">
          <span className="text-xl sm:text-2xl font-bold text-slate-800 tracking-wide select-none font-mono">
            {question}
          </span>
        </div>
        <button
          type="button"
          onClick={loadCaptcha}
          disabled={disabled}
          className="shrink-0 min-w-[48px] min-h-[48px] p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-[#ff791a] hover:border-orange-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center touch-manipulation"
          title="New question"
          aria-label="New question"
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        id="login-captcha-field"
        name="captcha"
        autoComplete="off"
        spellCheck={false}
        value={value.answer}
        onChange={(e) => onChange({ ...value, answer: e.target.value.replace(/\D/g, "") })}
        placeholder="Enter the answer"
        disabled={disabled || !value.id}
        className="w-full px-3.5 py-3.5 border border-slate-200 rounded-xl focus:border-[#ff791a] focus:ring-2 focus:ring-orange-100 focus:outline-none text-base text-slate-800 transition font-mono bg-slate-50/50 touch-manipulation"
      />
    </div>
  );
}
