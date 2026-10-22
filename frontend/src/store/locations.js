export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 700;
export const KM_PER_UNIT = 0.005;

export const places = {
  apartment: { x: 300, y: 380, kind: "home", homeId: "apartment" },
  dacha: { x: 800, y: 150, kind: "home", homeId: "dacha" },
  work: { x: 640, y: 520, kind: "poi" },
  school: { x: 170, y: 160, kind: "poi" },
  shop: { x: 470, y: 290, kind: "poi" },
};

export const initialLocations = {
  anton: { place: "apartment", dx: 0, dy: 0, updated: 0, battery: 82 },
  mama: { place: "work", dx: 16, dy: -10, updated: 2, battery: 64 },
  papa: { place: "dacha", dx: -14, dy: 12, updated: 15, battery: 15 },
  sister: { place: "school", dx: 10, dy: 14, updated: 1, battery: 7 },
};

export const initialSharing = { anton: false, mama: true, papa: true, sister: true };

export function positionOf(location) {
  const place = places[location.place];
  return { x: place.x + location.dx, y: place.y + location.dy };
}
