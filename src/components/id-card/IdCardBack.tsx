import React, { forwardRef } from "react";
import styles from "./IdCard.module.css";
import { CARD_SIZE, CARD_TEMPLATE } from "./constants";

export interface IdCardBackProps {
  className?: string;
}

const IdCardBack = forwardRef<HTMLDivElement, IdCardBackProps>(
  function IdCardBack({ className = "" }, ref) {
    return (
      <div
        ref={ref}
        data-card-side="back"
        className={`${styles.card} ${className}`.trim()}
        style={{
          width: CARD_SIZE.widthPx,
          height: CARD_SIZE.heightPx,
          backgroundImage: `url(${CARD_TEMPLATE.back})`,
        }}
      />
    );
  },
);

export default IdCardBack;
