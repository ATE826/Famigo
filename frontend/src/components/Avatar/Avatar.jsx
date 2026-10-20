import styles from "./Avatar.module.css";

const legacyTones = { sage: "mint", gray: "cream" };

export default function Avatar({ letter, tone = "green", size = 40, photo }) {
  const toneClass = styles[legacyTones[tone] ?? tone];
  const sizeStyle = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  if (photo) {
    return <img src={photo} alt="" className={`${styles.avatar} ${styles.photo}`} style={sizeStyle} />;
  }

  return (
    <span className={`${styles.avatar} ${toneClass}`} style={sizeStyle}>
      {letter}
    </span>
  );
}
