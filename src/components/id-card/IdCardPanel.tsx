import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Printer } from "lucide-react";
import { buildCardData, previewScale } from "./data";
import { CARD_SIZE } from "./constants";
import { exportCardPng, printCards } from "./export";
import { fitPhotoForIdCard } from "./photo";
import { generateEmployeeQrDataUrl } from "./qr";
import IdCardFront from "./IdCardFront";
import IdCardBack from "./IdCardBack";
import styles from "./IdCard.module.css";
import { Employee } from "../../types";

export interface IdCardPanelProps {
  employee: Employee;
  photoUrl: string | null;
  previewWidth?: number;
  onIdCardEnsured?: (idCard: string) => void;
}

export default function IdCardPanel({
  employee,
  photoUrl,
  previewWidth = 360,
  onIdCardEnsured,
}: IdCardPanelProps) {
  const [idCard, setIdCard] = useState(employee.idCard?.trim() || "");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [cardPhotoUrl, setCardPhotoUrl] = useState<string | null>(null);
  const [idLoading, setIdLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureIdCard() {
      setIdLoading(true);
      try {
        const res = await fetch(
          `/api/employees/${encodeURIComponent(employee.id)}/id-card/ensure`,
          { method: "POST" },
        );
        if (!res.ok) {
          throw new Error("Unable to assign ID card number.");
        }
        const payload = (await res.json()) as { idCard: string };
        if (cancelled) return;
        setIdCard(payload.idCard);
        onIdCardEnsured?.(payload.idCard);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setIdCard(employee.idCard?.trim() || "—");
        }
      } finally {
        if (!cancelled) {
          setIdLoading(false);
        }
      }
    }

    void ensureIdCard();

    return () => {
      cancelled = true;
    };
  }, [employee.id, employee.idCard, onIdCardEnsured]);

  useEffect(() => {
    if (!photoUrl) {
      setCardPhotoUrl(null);
      return;
    }

    let cancelled = false;

    void fitPhotoForIdCard(photoUrl)
      .then((processed) => {
        if (!cancelled) setCardPhotoUrl(processed);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setCardPhotoUrl(photoUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  const displayPhotoUrl = cardPhotoUrl ?? photoUrl;

  const data = useMemo(
    () => buildCardData(employee, displayPhotoUrl, idCard, qrCode),
    [employee, displayPhotoUrl, idCard, qrCode],
  );

  useEffect(() => {
    let cancelled = false;

    async function buildQr() {
      if (!idCard || idCard === "—" || idLoading) {
        setQrCode(null);
        return;
      }

      try {
        const url = await generateEmployeeQrDataUrl({
          idNo: idCard,
          name: data.name,
          employeeCode: employee.employeeCode || employee.id,
          designation: data.designation,
          dob: data.dob,
          issueDate: data.issueDate,
          expiryDate: data.expiryDate,
        });
        if (!cancelled) {
          setQrCode(url);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setQrCode(null);
        }
      }
    }

    void buildQr();

    return () => {
      cancelled = true;
    };
  }, [
    idCard,
    idLoading,
    data.name,
    data.designation,
    data.dob,
    data.issueDate,
    data.expiryDate,
    employee.employeeCode,
    employee.id,
  ]);

  const scale = useMemo(
    () => previewScale(previewWidth, CARD_SIZE.widthPx),
    [previewWidth],
  );

  const code = employee.employeeCode || employee.id;

  const run = async (label: string, fn: () => Promise<void>) => {
    try {
      setBusy(label);
      await fn();
    } catch (err) {
      console.error(err);
      alert(`Export failed: ${label}`);
    } finally {
      setBusy(null);
    }
  };

  const scaleStyle = {
    transform: `scale(${scale})`,
    transformOrigin: "top left" as const,
    width: CARD_SIZE.widthPx,
    height: CARD_SIZE.heightPx,
  };

  const exportsDisabled = !!busy || idLoading || !idCard || idCard === "—";

  return (
    <div className="space-y-4">
      {idLoading ? (
        <p className="text-xs text-slate-500">Assigning ID card number…</p>
      ) : idCard && idCard !== "—" ? (
        <p className="text-xs text-slate-600">
          ID No: <span className="font-mono font-semibold text-slate-800">{idCard}</span>
        </p>
      ) : null}

      <div className={styles.panelActions}>
        <button
          type="button"
          disabled={exportsDisabled}
          onClick={() =>
            frontRef.current &&
            backRef.current &&
            run("print", () => printCards(frontRef.current!, backRef.current!))
          }
          className={`${styles.panelBtn} ${styles.panelBtnSecondary}`}
        >
          <Printer size={14} />
          {busy === "print" ? "Preparing…" : "Print"}
        </button>
        <button
          type="button"
          disabled={exportsDisabled}
          onClick={() =>
            run("front", async () => {
              if (!frontRef.current) return;
              await exportCardPng(frontRef.current, `${code}_id_card_front.png`);
            })
          }
          className={`${styles.panelBtn} ${styles.panelBtnSecondary}`}
        >
          <Image size={14} />
          Front PNG
        </button>
        <button
          type="button"
          disabled={exportsDisabled}
          onClick={() =>
            run("back", async () => {
              if (!backRef.current) return;
              await exportCardPng(backRef.current, `${code}_id_card_back.png`);
            })
          }
          className={`${styles.panelBtn} ${styles.panelBtnSecondary}`}
        >
          <Image size={14} />
          Back PNG
        </button>
      </div>

      <div className={styles.previewGrid}>
        <div className={styles.previewBox}>
          <p className={styles.previewLabel}>Front</p>
          <div
            className={styles.previewScaler}
            style={{
              width: CARD_SIZE.widthPx * scale,
              height: CARD_SIZE.heightPx * scale,
            }}
          >
            <div style={scaleStyle}>
              <IdCardFront data={data} />
            </div>
          </div>
        </div>
        <div className={styles.previewBox}>
          <p className={styles.previewLabel}>Back</p>
          <div
            className={styles.previewScaler}
            style={{
              width: CARD_SIZE.widthPx * scale,
              height: CARD_SIZE.heightPx * scale,
            }}
          >
            <div style={scaleStyle}>
              <IdCardBack />
            </div>
          </div>
        </div>
      </div>

      <div ref={printRef} className="id-card-print-source" aria-hidden>
        <IdCardFront ref={frontRef} data={data} />
        <IdCardBack ref={backRef} />
      </div>
    </div>
  );
}
