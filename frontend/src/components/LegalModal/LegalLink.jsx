import { useLegal } from "./LegalContext";
import styles from "./LegalLink.module.css";

export default function LegalLink({ doc, children }) {
  const { open } = useLegal();
  return (
    <button type="button" className={styles.link} onClick={() => open(doc)}>
      {children}
    </button>
  );
}
