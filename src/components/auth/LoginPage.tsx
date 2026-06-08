import React from "react";
import { useHRMS } from "../../context/HRMSContext";

export default function LoginPage() {
  const { renderLoginPage } = useHRMS();
  return renderLoginPage();
}
