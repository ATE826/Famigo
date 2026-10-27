import styles from "./Splash.module.css";

// Заставка, пока проверяем сессию и загружаем данные семьи.
export default function Splash() {
  return (
    <div className={styles.splash} role="status" aria-label="Famigo">
      <span className={styles.logo}>F</span>
    </div>
  );
}
