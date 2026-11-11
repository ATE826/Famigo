const MINUTE = 60000;
const ago = (minutes) => new Date(Date.now() - minutes * MINUTE).toISOString();

export const initialWatchedPlaces = { school: true, work: false, apartment: true, dacha: false };

export const initialPlaceEvents = [
  { id: "e1", memberId: "sister", place: "school", type: "arrive", at: ago(95) },
  { id: "e2", memberId: "mama", place: "work", type: "arrive", at: ago(210) },
  { id: "e3", memberId: "mama", place: "apartment", type: "leave", at: ago(250) },
  { id: "e4", memberId: "papa", place: "dacha", type: "arrive", at: ago(60 * 26) },
  { id: "e5", memberId: "sister", place: "school", type: "leave", at: ago(60 * 27) },
  { id: "e6", memberId: "mama", place: "work", type: "leave", at: ago(60 * 52) },
  { id: "e7", memberId: "sister", place: "school", type: "arrive", at: ago(60 * 24 * 4) },
  { id: "e8", memberId: "papa", place: "dacha", type: "leave", at: ago(60 * 24 * 9) },
  { id: "e9", memberId: "mama", place: "shop", type: "arrive", at: ago(60 * 24 * 15) },
  { id: "e10", memberId: "sister", place: "school", type: "arrive", at: ago(60 * 24 * 22) },
];
