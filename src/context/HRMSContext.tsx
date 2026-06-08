import React, { createContext, useContext } from "react";
import { useHRMSApp } from "../hooks/useHRMSApp";

export type HRMSContextValue = ReturnType<typeof useHRMSApp>;

const HRMSContext = createContext<HRMSContextValue | null>(null);

export function HRMSProvider({ children }: { children: React.ReactNode }) {
  const value = useHRMSApp();
  return <HRMSContext.Provider value={value}>{children}</HRMSContext.Provider>;
}

export function useHRMS(): HRMSContextValue {
  const ctx = useContext(HRMSContext);
  if (!ctx) throw new Error("useHRMS must be used within HRMSProvider");
  return ctx;
}
