import React from "react";
import { useHRMS } from "../context/HRMSContext";

export default function DashboardLayout() {
  const { renderAuthenticatedApp } = useHRMS();
  return renderAuthenticatedApp();
}
