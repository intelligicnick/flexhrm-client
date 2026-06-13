import React, { createContext, useContext } from "react";
import { useHRMSApp } from "../hooks/useHRMSApp";
import ConfirmDialog from "../components/ui/ConfirmDialog";

export type HRMSContextValue = ReturnType<typeof useHRMSApp>;

const HRMSContext = createContext<HRMSContextValue | null>(null);

export function HRMSProvider({ children }: { children: React.ReactNode }) {
  const value = useHRMSApp();
  return (
    <HRMSContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!value.confirmDialog}
        title={value.confirmDialog?.title ?? ""}
        message={value.confirmDialog?.message ?? ""}
        confirmLabel={value.confirmDialog?.confirmLabel}
        cancelLabel={value.confirmDialog?.cancelLabel}
        variant={value.confirmDialog?.variant}
        onConfirm={value.handleConfirmDialogConfirm}
        onCancel={value.handleConfirmDialogCancel}
      />
    </HRMSContext.Provider>
  );
}

export function useHRMS(): HRMSContextValue {
  const ctx = useContext(HRMSContext);
  if (!ctx) throw new Error("useHRMS must be used within HRMSProvider");
  return ctx;
}
