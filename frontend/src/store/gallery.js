import { offsetDateString } from "../utils/dates";

const MB = 1024 ** 2;

function art({ sky, ground, hill, sun, roof, wall }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
<rect width="600" height="600" fill="url(#g)"/>
<circle cx="440" cy="160" r="62" fill="${sun}"/>
<path d="M0 420 Q150 320 300 400 T600 380 V600 H0Z" fill="${hill}"/>
<path d="M0 480 Q200 420 400 470 T600 450 V600 H0Z" fill="${ground}"/>
<rect x="190" y="330" width="150" height="110" rx="6" fill="${wall}"/>
<path d="M175 335 L265 262 L355 335Z" fill="${roof}"/>
<rect x="250" y="380" width="34" height="60" rx="4" fill="${roof}"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const arts = [
  art({ sky: ["#E5EBE0", "#F5F3EE"], ground: "#667A55", hill: "#8FA37E", sun: "#D38A62", roof: "#D38A62", wall: "#F5F3EE" }),
  art({ sky: ["#F3E2D8", "#F5F3EE"], ground: "#D38A62", hill: "#E6B597", sun: "#FFFFFF", roof: "#667A55", wall: "#FFFFFF" }),
  art({ sky: ["#667A55", "#8FA37E"], ground: "#20221F", hill: "#4C5E3E", sun: "#F5F3EE", roof: "#D38A62", wall: "#E5EBE0" }),
  art({ sky: ["#20221F", "#4A4D47"], ground: "#667A55", hill: "#3E4F32", sun: "#F5F3EE", roof: "#D38A62", wall: "#E5EBE0" }),
  art({ sky: ["#D38A62", "#F3E2D8"], ground: "#4C5E3E", hill: "#667A55", sun: "#F5F3EE", roof: "#20221F", wall: "#F5F3EE" }),
  art({ sky: ["#E5EBE0", "#C9D5C1"], ground: "#D38A62", hill: "#667A55", sun: "#F5F3EE", roof: "#667A55", wall: "#FFFFFF" }),
];

function at(daysAgo, hour) {
  const [day, month, year] = offsetDateString(-daysAgo).split(".").map(Number);
  return new Date(year, month - 1, day, hour, 15).toISOString();
}

export const initialGallery = [
  { id: "g1", type: "image", mime: "image/svg+xml", name: "famigo-photo-1.svg", url: arts[0], size: 4.8 * MB, by: "mama", at: at(1, 18) },
  { id: "g2", type: "image", mime: "image/svg+xml", name: "famigo-photo-2.svg", url: arts[1], size: 6.2 * MB, by: "anton", at: at(3, 12) },
  { id: "g3", type: "image", mime: "image/svg+xml", name: "famigo-photo-3.svg", url: arts[2], size: 3.4 * MB, by: "papa", at: at(6, 9) },
  { id: "g4", type: "image", mime: "image/svg+xml", name: "famigo-photo-4.svg", url: arts[3], size: 5.1 * MB, by: "sister", at: at(9, 20) },
  { id: "g5", type: "image", mime: "image/svg+xml", name: "famigo-photo-5.svg", url: arts[4], size: 7.9 * MB, by: "mama", at: at(15, 14) },
  { id: "g6", type: "image", mime: "image/svg+xml", name: "famigo-photo-6.svg", url: arts[5], size: 4.3 * MB, by: "anton", at: at(21, 11) },
];
