import React, { forwardRef } from "react";
import styles from "./IdCard.module.css";
import { CARD_SIZE, CARD_TEMPLATE, FRONT_LAYOUT } from "./constants";
import { IdCardData } from "./types";

export interface IdCardFrontProps {
  data: IdCardData;
  className?: string;
}

function pct(value: number): string {
  return `${value}%`;
}

const IdCardFront = forwardRef<HTMLDivElement, IdCardFrontProps>(
  function IdCardFront({ data, className = "" }, ref) {
    const { photo: photoBox, fieldsBlock, idNumber: idNumberBox, qr } = FRONT_LAYOUT;

    return (
      <div
        ref={ref}
        data-card-side="front"
        className={`${styles.card} ${className}`.trim()}
        style={{
          width: CARD_SIZE.widthPx,
          height: CARD_SIZE.heightPx,
          backgroundImage: `url(${CARD_TEMPLATE.front})`,
        }}
      >
        <div
          className={styles.idNumberStrip}
          style={{
            right: idNumberBox.rightPx,
            top: idNumberBox.topPx,
          }}
        >
          <span className={styles.idNumberLabel}>ID No :</span>
          <span className={styles.idNumberText}>{data.idNumber}</span>
        </div>

        <div
          className={styles.photoMask}
          style={{
            left: pct(photoBox.left),
            top: pct(photoBox.top),
            width: pct(photoBox.width),
            height: pct(photoBox.height),
          }}
        >
          {data.photo ? (
            <img src={data.photo} alt={data.name} className={styles.photo} />
          ) : (
            <div className={styles.photoPlaceholder} />
          )}
        </div>

        <div
          className={styles.fieldsBlock}
          style={{
            left: pct(fieldsBlock.left),
            top: pct(fieldsBlock.top),
            width: pct(fieldsBlock.width),
            height: pct(fieldsBlock.height),
          }}
        >
          <p className={styles.fieldLine}>
            <span className={styles.fieldLabel}>Name :</span>
            <span className={styles.fieldText}>{data.name}</span>
          </p>
          <p className={styles.fieldLine}>
            <span className={styles.fieldLabel}>Date of Birth :</span>
            <span className={styles.fieldText}>{data.dob}</span>
          </p>
          <p className={styles.fieldLine}>
            <span className={styles.fieldLabel}>Designation :</span>
            <span className={styles.fieldText}>{data.designation}</span>
          </p>
          <p className={`${styles.fieldLine} ${styles.datesLine}`}>
            <span>
              <span className={styles.fieldLabel}>Issue:</span>{" "}
              <span className={styles.fieldText}>{data.issueDate}</span>
            </span>
            <span>
              <span className={styles.fieldLabel}>Expiry:</span>{" "}
              <span className={styles.fieldText}>{data.expiryDate}</span>
            </span>
          </p>
        </div>

        {data.qrCode ? (
          <img
            src={data.qrCode}
            alt=""
            aria-hidden
            className={styles.qrCode}
            style={{
              right: qr.rightPx,
              bottom: qr.bottomPx,
              width: qr.sizePx,
              height: qr.sizePx,
            }}
          />
        ) : null}
      </div>
    );
  },
);

export default IdCardFront;
