import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  getSupervisorLang,
  setSupervisorLang,
  SupervisorLang,
  SupervisorTranslationKey,
  t as translate,
  tStatus,
} from "../../lib/supervisor-i18n";

interface SupervisorI18nContextValue {
  lang: SupervisorLang;
  setLang: (lang: SupervisorLang) => void;
  t: (key: SupervisorTranslationKey) => string;
  tStatus: (status: string) => string;
}

const SupervisorI18nContext = createContext<SupervisorI18nContextValue | null>(null);

export function SupervisorI18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SupervisorLang>(getSupervisorLang);

  const setLang = useCallback((next: SupervisorLang) => {
    setSupervisorLang(next);
    setLangState(next);
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key: SupervisorTranslationKey) => translate(key, lang),
      tStatus: (status: string) => tStatus(status, lang),
    }),
    [lang, setLang],
  );

  return (
    <SupervisorI18nContext.Provider value={value}>{children}</SupervisorI18nContext.Provider>
  );
}

export function useSupervisorI18n() {
  const ctx = useContext(SupervisorI18nContext);
  if (!ctx) throw new Error("useSupervisorI18n must be used within SupervisorI18nProvider");
  return ctx;
}
