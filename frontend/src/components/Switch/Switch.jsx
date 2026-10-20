import styles from "./Switch.module.css";

export default function Switch(props) {
  return <input type="checkbox" role="switch" className={styles.switch} {...props} />;
}
