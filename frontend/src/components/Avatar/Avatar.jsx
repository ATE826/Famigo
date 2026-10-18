import styles from "./Avatar.module.css";

export default function Avatar({ letter, tone = "green", size = 40 }) {
  return (
    <span
      className={`${styles.avatar} ${styles[tone]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {letter}
    </span>
  );
}
