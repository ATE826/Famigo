import styles from "./Map.module.css";

const mainRoads = [
  "M-10 330 C 200 320, 600 380, 1010 350",
  "M430 -10 C 450 200, 440 500, 470 710",
  "M-10 610 C 250 540, 540 560, 1010 470",
];

const sideRoads = [
  "M-10 150 L1010 120",
  "M180 -10 L200 710",
  "M700 -10 L690 710",
  "M880 -10 C 890 300, 860 500, 900 710",
  "M-10 480 L430 500",
  "M200 250 L690 235",
];

const blocks = [
  [230, 185, 60, 46],
  [298, 190, 64, 40],
  [236, 262, 52, 52],
  [492, 175, 72, 56],
  [572, 190, 60, 46],
  [500, 255, 58, 42],
  [234, 372, 56, 44],
  [300, 402, 60, 46],
  [250, 440, 48, 40],
  [510, 360, 60, 50],
  [580, 370, 56, 44],
  [720, 270, 58, 46],
  [790, 275, 62, 44],
  [730, 345, 50, 50],
  [940, 380, 46, 60],
  [600, 440, 64, 46],
  [700, 500, 60, 44],
  [90, 255, 60, 50],
  [60, 190, 50, 46],
];

export default function MapArt() {
  return (
    <svg className={styles.art} width={1000} height={700} viewBox="0 0 1000 700" aria-hidden="true">
      <rect className={styles.land} width="1000" height="700" />
      <rect className={styles.park} x="690" y="30" width="270" height="210" rx="56" />
      <rect className={styles.park} x="60" y="395" width="150" height="130" rx="44" />
      <rect className={styles.park} x="360" y="590" width="200" height="90" rx="40" />
      <path
        className={styles.water}
        d="M-20 470 C 200 430, 260 610, 520 640 S 900 700, 1020 610"
        strokeWidth="46"
      />
      {blocks.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} className={styles.block} x={x} y={y} width={w} height={h} rx="8" />
      ))}
      {[...mainRoads.map((d) => [d, 22]), ...sideRoads.map((d) => [d, 11])].map(([d, width]) => (
        <path key={`e-${d}`} className={styles.roadEdge} d={d} strokeWidth={width + 4} />
      ))}
      {[...mainRoads.map((d) => [d, 22]), ...sideRoads.map((d) => [d, 11])].map(([d, width]) => (
        <path key={`r-${d}`} className={styles.road} d={d} strokeWidth={width} />
      ))}
    </svg>
  );
}
