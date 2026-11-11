import { useEffect } from "react";
import Icon from "../Icon/Icon";
import styles from "./ConfirmDialog.module.css";

export default function ConfirmDialog({ icon = "crown", title, text, cancelLabel, confirmLabel, onConfirm, onClose, children }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.icon}>
          <Icon name={icon} size={24} strokeWidth={1.8} />
        </span>
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        <p id="confirm-text" className={styles.text}>
          {text}
        </p>
        {children}
        <div className={styles.buttons}>
          <button type="button" className={styles.keep} onClick={onClose} autoFocus>
            {cancelLabel}
          </button>
          <button type="button" className={styles.danger} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
